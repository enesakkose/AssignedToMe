import { describe, expect, test } from 'bun:test';
import { ProviderError } from '../../errors';
import type { Connection, Fetch } from '../../types';
import { adfToText, jira, jiraDateTime, jiraOrigin, pickSprint } from '.';

const connection: Connection = {
  id: 'c1',
  providerId: 'jira',
  name: 'acme',
  values: { domain: 'acme', email: 'me@acme.com', apiToken: 'tok' },
};

/** Same account on another site, so per-site caches (custom field ids) don't leak between tests. */
const onSite = (domain: string): Connection => ({ ...connection, values: { ...connection.values, domain } });

const issue = (n: number) => ({
  id: String(n),
  key: `ABC-${n}`,
  fields: {
    summary: `Task ${n}`,
    updated: '2026-10-30T09:00:00.000+0300',
    status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    priority: { name: 'High' },
    issuetype: { name: 'Bug' },
    project: { name: 'Alpha' },
    description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fix it' }] }] },
    timeoriginalestimate: 28800,
    timespent: 3600,
    customfield_10020: [
      { name: 'Sprint 23', state: 'closed' },
      { name: 'Sprint 24', state: 'active' },
    ],
  },
});

const fieldList = [
  { id: 'summary', schema: { system: 'summary' } },
  { id: 'customfield_10020', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } },
];

/** Serves the field list for /field and the given search pages in order. */
function fakeFetch(pages: unknown[], calls: string[] = [], fields: unknown = fieldList): Fetch {
  let i = 0;
  return (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith('/rest/api/3/field')) return new Response(JSON.stringify(fields), { status: 200 });
    calls.push(u);
    return new Response(JSON.stringify(pages[i++]), { status: 200 });
  }) as Fetch;
}

describe('jiraOrigin', () => {
  test('accepts short name, host and full url', () => {
    expect(jiraOrigin('acme')).toBe('https://acme.atlassian.net');
    expect(jiraOrigin('acme.atlassian.net')).toBe('https://acme.atlassian.net');
    expect(jiraOrigin(' https://acme.atlassian.net/ ')).toBe('https://acme.atlassian.net');
  });

  test('rejects non Jira Cloud hosts and http', () => {
    expect(() => jiraOrigin('evil.com')).toThrow(ProviderError);
    expect(() => jiraOrigin('http://acme.atlassian.net')).toThrow(ProviderError);
    expect(() => jiraOrigin('')).toThrow(ProviderError);
  });
});

test('adfToText flattens paragraphs and breaks', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'c' }] },
    ],
  };
  expect(adfToText(doc)).toBe('a\nb\nc\n');
  expect(adfToText(null)).toBe('');
});

test('fetchMyTasks normalizes issues and follows pages', async () => {
  const calls: string[] = [];
  const tasks = await jira.fetchMyTasks(
    connection,
    fakeFetch([{ issues: [issue(1)], nextPageToken: 'p2' }, { issues: [issue(2)] }], calls),
  );
  expect(calls).toHaveLength(2);
  expect(calls[1]).toContain('nextPageToken=p2');
  expect(decodeURIComponent(calls[0]!)).toContain('customfield_10020');
  expect(tasks[0]).toEqual({
    id: 'c1:1',
    key: 'ABC-1',
    title: 'Task 1',
    status: 'In Progress',
    statusCategory: 'in_progress',
    priority: 'High',
    priorityLevel: 4,
    type: 'Bug',
    project: 'Alpha',
    sprint: 'Sprint 24',
    estimateSeconds: 28800,
    loggedSeconds: 3600,
    description: 'Fix it',
    url: 'https://acme.atlassian.net/browse/ABC-1',
    connectionId: 'c1',
    updatedAt: '2026-10-30T06:00:00.000Z',
  });
});

test('401 becomes unauthorized without leaking the token', async () => {
  const fetch = (async () => new Response('', { status: 401 })) as unknown as Fetch;
  const error = await jira.validate(connection, fetch).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ProviderError);
  expect((error as ProviderError).code).toBe('unauthorized');
  expect((error as ProviderError).message).not.toContain('tok');
});

test('malformed response is rejected', async () => {
  await expect(jira.fetchMyTasks(connection, fakeFetch([{ nope: true }]))).rejects.toMatchObject({ code: 'invalid_response' });
});

test('sites without a sprint field still load, without sprint', async () => {
  const tasks = await jira.fetchMyTasks(onSite('nosprint'), fakeFetch([{ issues: [issue(1)] }], [], [{ id: 'summary' }]));
  expect(tasks[0]!.sprint).toBeUndefined();
  expect(tasks[0]!.estimateSeconds).toBe(28800);
});

test('pickSprint prefers the active sprint, else the last one', () => {
  expect(pickSprint([{ name: 'A', state: 'closed' }, { name: 'B', state: 'future' }])).toBe('B');
  expect(pickSprint([{ name: 'A', state: 'active' }, { name: 'B', state: 'future' }])).toBe('A');
  expect(pickSprint(null)).toBeUndefined();
  expect(pickSprint('garbage')).toBeUndefined();
});

test('story points, aggregate estimate and sub-tasks with assignees', async () => {
  const story = {
    id: '10',
    key: 'ABC-10',
    fields: {
      summary: 'Story',
      updated: '2026-10-30T09:00:00.000+0300',
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      subtasks: [{ id: '11' }, { id: '12' }],
      aggregatetimeoriginalestimate: 36000,
      aggregatetimespent: 7200,
      customfield_10016: 5,
    },
  };
  const sub = (id: string, assignee?: string) => ({
    id,
    key: `ABC-${id}`,
    fields: {
      summary: `Sub ${id}`,
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: assignee ? { accountId: `acc-${id}`, displayName: assignee } : null,
      description: id === '11' ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Steps' }] }] } : null,
      timeoriginalestimate: 3600,
      parent: { key: 'ABC-10' },
    },
  });
  const fields = [
    { id: 'summary' },
    { id: 'customfield_10016', name: 'Story point estimate', schema: { custom: 'com.pyxis.greenhopper.jira:jsw-story-points' } },
  ];
  const calls: string[] = [];
  const [task] = await jira.fetchMyTasks(
    onSite('points'),
    fakeFetch([{ issues: [story] }, { issues: [sub('11', 'Ayşe Yılmaz'), sub('12')] }], calls, fields),
  );
  expect(new URL(calls[1]!).searchParams.get('jql')).toBe('parent in (ABC-10) ORDER BY created ASC');
  expect(task!.storyPoints).toBe(5);
  expect(task!.estimateSeconds).toBe(36000);
  expect(task!.loggedSeconds).toBe(7200);
  expect(task!.subtasks).toEqual([
    {
      id: 'c1:11',
      key: 'ABC-11',
      title: 'Sub 11',
      status: 'To Do',
      statusCategory: 'todo',
      assignee: { id: 'acc-11', name: 'Ayşe Yılmaz' },
      description: 'Steps',
      estimateSeconds: 3600,
      loggedSeconds: undefined,
      url: 'https://points.atlassian.net/browse/ABC-11',
    },
    expect.objectContaining({ key: 'ABC-12', assignee: undefined }),
  ]);
});

test('a failing sub-task query keeps the main list', async () => {
  const story = { ...issue(1), fields: { ...issue(1).fields, subtasks: [{ id: '2' }] } };
  let n = 0;
  const fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith('/rest/api/3/field')) return new Response('[]', { status: 200 });
    return n++ === 0 ? new Response(JSON.stringify({ issues: [story] }), { status: 200 }) : new Response('', { status: 500 });
  }) as Fetch;
  const tasks = await jira.fetchMyTasks(connection, fetch);
  expect(tasks).toHaveLength(1);
  expect(tasks[0]!.subtasks).toBeUndefined();
});

test('getTransitions maps targets and flags ones needing extra fields', async () => {
  const calls: string[] = [];
  const fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(
      JSON.stringify({
        transitions: [
          { id: '21', name: 'Start', to: { name: 'In Progress', statusCategory: { key: 'indeterminate' } }, fields: {} },
          {
            id: '31',
            name: 'Resolve',
            to: { name: 'Done', statusCategory: { key: 'done' } },
            fields: { resolution: { required: true, hasDefaultValue: false } },
          },
          { id: '41', name: 'Hidden', isAvailable: false, to: { name: 'X', statusCategory: { key: 'new' } } },
        ],
      }),
      { status: 200 },
    );
  }) as Fetch;
  const transitions = await jira.getTransitions!(connection, 'ABC-1', fetch);
  expect(calls[0]).toBe('https://acme.atlassian.net/rest/api/3/issue/ABC-1/transitions?expand=transitions.fields');
  expect(transitions).toEqual([
    { id: '21', name: 'Start', to: { name: 'In Progress', category: 'in_progress' }, fields: [], allowsComment: false, needsInput: false },
    // A required field with no type the app can render (here: no schema) still points to Jira.
    { id: '31', name: 'Resolve', to: { name: 'Done', category: 'done' }, fields: [], allowsComment: false, needsInput: true },
  ]);
});

test('transition posts the id and accepts an empty 204', async () => {
  let body = '';
  let method = '';
  const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    body = String(init?.body);
    method = String(init?.method);
    return new Response(null, { status: 204 });
  }) as Fetch;
  const start = { id: '21', name: 'Start', to: { name: 'In Progress', category: 'in_progress' as const }, fields: [], allowsComment: false, needsInput: false };
  await jira.transition!(connection, 'ABC-1', start, fetch);
  expect(method).toBe('POST');
  expect(JSON.parse(body)).toEqual({ transition: { id: '21' } });
});

test('transition refuses a key that is not a Jira issue key', async () => {
  const t = { id: '1', name: 'x', to: { name: 'x', category: 'todo' as const }, fields: [], allowsComment: false, needsInput: false };
  await expect(jira.transition!(connection, '../../admin', t, fakeFetch([]))).rejects.toMatchObject({ code: 'invalid_input' });
});

test('jiraDateTime uses local time with a numeric offset', () => {
  expect(jiraDateTime(new Date(2026, 9, 30, 9, 5, 7, 12))).toMatch(/^2026-10-30T09:05:07\.012[+-]\d{4}$/);
});

test('logWork posts seconds, start and an ADF comment, and returns the id', async () => {
  let url = '';
  let body: Record<string, unknown> = {};
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    url = String(u);
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: '100028' }), { status: 201 });
  }) as Fetch;
  const id = await jira.logWork!(connection, 'ABC-1', { seconds: 5400, started: new Date(2026, 9, 30, 9), comment: 'Fixed\nTested' }, fetch);
  expect(id).toBe('100028');
  expect(url).toBe('https://acme.atlassian.net/rest/api/3/issue/ABC-1/worklog');
  expect(body.timeSpentSeconds).toBe(5400);
  expect(body.started).toMatch(/^2026-10-30T09:00:00\.000[+-]\d{4}$/);
  expect(body.comment).toEqual({
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Fixed' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tested' }] },
    ],
  });
});

test('logWork without a comment omits it; deleteWorkLog deletes by id', async () => {
  const calls: { url: string; method?: string; body?: string }[] = [];
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(u), method: init?.method, body: init?.body as string | undefined });
    return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : new Response('{"id":"7"}', { status: 201 });
  }) as Fetch;
  await jira.logWork!(connection, 'ABC-1', { seconds: 600, started: new Date() }, fetch);
  expect(JSON.parse(calls[0]!.body!).comment).toBeUndefined();
  await jira.deleteWorkLog!(connection, 'ABC-1', '7', fetch);
  expect(calls[1]).toMatchObject({ url: 'https://acme.atlassian.net/rest/api/3/issue/ABC-1/worklog/7', method: 'DELETE' });
  await expect(jira.deleteWorkLog!(connection, 'ABC-1', '../x', fetch)).rejects.toMatchObject({ code: 'invalid_input' });
});

test('getWorkLogs returns newest first and marks the connected account', async () => {
  const fetch = (async (u: string | URL | Request) => {
    const url = String(u);
    if (url.endsWith('/rest/api/3/myself')) return new Response(JSON.stringify({ accountId: 'me-1', displayName: 'Enes' }), { status: 200 });
    return new Response(
      JSON.stringify({
        worklogs: [
          { id: '1', author: { accountId: 'other', displayName: 'Ayşe' }, timeSpentSeconds: 3600, started: '2026-10-28T09:00:00.000+0300' },
          {
            id: '2',
            author: { accountId: 'me-1', displayName: 'Enes' },
            timeSpentSeconds: 1800,
            started: '2026-10-30T10:00:00.000+0300',
            comment: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Review' }] }] },
          },
        ],
      }),
      { status: 200 },
    );
  }) as Fetch;
  const logs = await jira.getWorkLogs!({ ...connection, values: { ...connection.values, email: 'wl@acme.com' } }, 'ABC-1', fetch);
  expect(logs).toEqual([
    { id: '2', author: 'Enes', mine: true, seconds: 1800, started: '2026-10-30T07:00:00.000Z', comment: 'Review' },
    { id: '1', author: 'Ayşe', mine: false, seconds: 3600, started: '2026-10-28T06:00:00.000Z', comment: undefined },
  ]);
});

test('searchAssignees asks for assignable users of the issue and skips inactive ones', async () => {
  let url = '';
  const fetch = (async (u: string | URL | Request) => {
    url = String(u);
    return new Response(
      JSON.stringify([
        { accountId: 'a1', displayName: 'Ayşe', active: true },
        { accountId: 'a2', displayName: 'Gone', active: false },
      ]),
      { status: 200 },
    );
  }) as Fetch;
  const people = await jira.searchAssignees!(connection, 'ABC-1', ' ay ', fetch);
  const params = new URL(url).searchParams;
  expect([params.get('issueKey'), params.get('query'), params.get('startAt')]).toEqual(['ABC-1', 'ay', '0']);
  expect(people).toEqual({ people: [{ id: 'a1', name: 'Ayşe' }], next: 50 });
});

test('searchAssignees keeps paging after short pages and stops on an empty one or at Jira\'s limit', async () => {
  let size = 3;
  const fetch = (async (_u: string | URL | Request) =>
    new Response(JSON.stringify(Array.from({ length: size }, (_, i) => ({ accountId: `a${i}`, displayName: `P${i}`, active: i > 0 }))), {
      status: 200,
    })) as Fetch;
  const first = await jira.searchAssignees!(connection, 'ABC-1', '', fetch);
  expect([first.people.length, first.next]).toEqual([2, 50]);
  expect((await jira.searchAssignees!(connection, 'ABC-1', '', fetch, 950)).next).toBeUndefined();
  size = 0;
  expect((await jira.searchAssignees!(connection, 'ABC-1', '', fetch, 50)).next).toBeUndefined();
});

test('assign sends the account id, or null to unassign', async () => {
  const bodies: unknown[] = [];
  const fetch = (async (_u: string | URL | Request, init?: RequestInit) => {
    expect(init?.method).toBe('PUT');
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 204 });
  }) as Fetch;
  await jira.assign!(connection, 'ABC-1', 'a1', fetch);
  await jira.assign!(connection, 'ABC-1', null, fetch);
  expect(bodies).toEqual([{ accountId: 'a1' }, { accountId: null }]);
});

test('searchTasks: full key, bare number via project hints, and text, without duplicates', async () => {
  const calls: string[] = [];
  const fetch = (async (u: string | URL | Request) => {
    const url = String(u);
    calls.push(url);
    if (url.endsWith('/rest/api/3/field')) return new Response('[]', { status: 200 });
    if (url.includes('/rest/api/3/issue/ABC-2750')) return new Response(JSON.stringify({ ...issue(2750), key: 'ABC-2750' }), { status: 200 });
    if (url.includes('/rest/api/3/issue/')) return new Response('', { status: 404 });
    // Text search finds the same issue again plus another one.
    return new Response(JSON.stringify({ issues: [{ ...issue(2750), key: 'ABC-2750' }, issue(7)] }), { status: 200 });
  }) as Fetch;
  const site = onSite('search');

  const byNumber = await jira.searchTasks!(site, '2750', fetch, { projectKeys: ['ABC', 'XYZ', 'ABC'] });
  expect(byNumber.map((t) => t.key)).toEqual(['ABC-2750', 'ABC-7']);
  expect(calls.filter((c) => c.includes('/rest/api/3/issue/')).map((c) => new URL(c).pathname)).toEqual([
    '/rest/api/3/issue/ABC-2750',
    '/rest/api/3/issue/XYZ-2750',
  ]);
  const textCall = calls.find((c) => c.includes('/search/jql'))!;
  expect(new URL(textCall).searchParams.get('jql')).toBe('text ~ "2750" ORDER BY updated DESC');

  calls.length = 0;
  await jira.searchTasks!(site, 'abc-2750', fetch);
  expect(calls.some((c) => new URL(c).pathname === '/rest/api/3/issue/ABC-2750')).toBe(true);

  calls.length = 0;
  await jira.searchTasks!(site, 'say "hi"', fetch);
  expect(new URL(calls.find((c) => c.includes('/search/jql'))!).searchParams.get('jql')).toBe('text ~ "say \\"hi\\"" ORDER BY updated DESC');

  expect(await jira.searchTasks!(site, 'a', fetch)).toEqual([]);
});

test('getComments fetches the newest page when there are many, marks mine and keeps links', async () => {
  const urls: string[] = [];
  const comment = (id: string, accountId: string) => ({
    id,
    author: { accountId, displayName: accountId },
    created: '2026-10-30T09:00:00.000+0300',
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'inlineCard', attrs: { url: 'https://c.atlassian.net/browse/ABC-9' } }] }] },
  });
  const fetch = (async (u: string | URL | Request) => {
    const url = String(u);
    urls.push(url);
    if (url.endsWith('/myself')) return new Response(JSON.stringify({ accountId: 'me', displayName: 'Me' }), { status: 200 });
    const startAt = new URL(url).searchParams.get('startAt');
    return new Response(JSON.stringify({ total: 60, startAt: Number(startAt), comments: [comment(`c${startAt}`, startAt === '10' ? 'me' : 'x')] }), {
      status: 200,
    });
  }) as Fetch;
  const comments = await jira.getComments!(onSite('comments'), 'ABC-1', fetch);
  expect(urls.filter((u) => u.includes('/comment?')).map((u) => new URL(u).searchParams.get('startAt'))).toEqual(['0', '10']);
  expect(comments).toEqual([
    {
      id: 'c10',
      author: 'me',
      mine: true,
      created: '2026-10-30T06:00:00.000Z',
      text: 'ABC-9',
      parts: [{ type: 'link', url: 'https://c.atlassian.net/browse/ABC-9', text: 'ABC-9' }],
    },
  ]);
});

test('addComment posts ADF on Cloud and refuses an empty one', async () => {
  const bodies: unknown[] = [];
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    if (String(u).endsWith('/myself')) return new Response(JSON.stringify({ accountId: 'me', displayName: 'Me' }), { status: 200 });
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: '5', author: { accountId: 'me', displayName: 'Me' }, created: '2026-11-01T10:00:00.000Z', body: 'x' }), {
      status: 201,
    });
  }) as Fetch;
  const c = await jira.addComment!(onSite('addcomment'), 'ABC-1', '  hello  ', fetch);
  expect(bodies[0]).toEqual({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] } });
  expect([c.id, c.mine]).toEqual(['5', true]);
  expect(jira.addComment!(connection, 'ABC-1', '   ', fetch)).rejects.toThrow();
});

test('deleteComment sends DELETE to the comment and rejects odd ids', async () => {
  const calls: { url: string; method?: string }[] = [];
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(u), method: init?.method });
    return new Response(null, { status: 204 });
  }) as Fetch;
  await jira.deleteComment!(connection, 'ABC-1', '42', fetch);
  expect(calls[0]).toEqual({ url: 'https://acme.atlassian.net/rest/api/3/issue/ABC-1/comment/42', method: 'DELETE' });
  expect(jira.deleteComment!(connection, 'ABC-1', '../x', fetch)).rejects.toThrow();
});

test('parent and issue links are phrased from the task\'s side, and a blocker is marked', async () => {
  const linked = (key: string, cat: string) => ({
    key,
    fields: { summary: `Title ${key}`, status: { name: cat, statusCategory: { key: cat } }, issuetype: { name: 'Bug' } },
  });
  const issue = {
    id: '1',
    key: 'ABC-1',
    fields: {
      summary: 'Story',
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      parent: { key: 'ABC-0', fields: { summary: 'The epic', issuetype: { name: 'Epic' } } },
      issuelinks: [
        { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: linked('ABC-2', 'indeterminate') },
        { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: linked('ABC-3', 'new') },
        { type: { name: 'Relates', inward: 'relates to', outward: 'relates to' }, outwardIssue: linked('ABC-4', 'done') },
      ],
    },
  };
  const [task] = await jira.fetchMyTasks(onSite('links'), fakeFetch([{ issues: [issue] }]));
  expect(task!.parent).toEqual({ key: 'ABC-0', title: 'The epic', url: 'https://links.atlassian.net/browse/ABC-0', type: 'Epic', status: undefined, statusCategory: undefined });
  expect(task!.links!.map((l) => [l.relation, l.key, l.blocksThis, l.statusCategory])).toEqual([
    ['is blocked by', 'ABC-2', true, 'in_progress'],
    ['blocks', 'ABC-3', undefined, 'todo'],
    ['relates to', 'ABC-4', undefined, 'done'],
  ]);
});

test('getTask loads one issue by key, with its sub-tasks', async () => {
  const calls: string[] = [];
  const story = { id: '7', key: 'ABC-7', fields: { summary: 'Parent story', status: { name: 'To Do', statusCategory: { key: 'new' } }, subtasks: [{ id: '8' }] } };
  const sub = { id: '8', key: 'ABC-8', fields: { summary: 'Child', status: { name: 'To Do', statusCategory: { key: 'new' } }, parent: { key: 'ABC-7' } } };
  const task = await jira.getTask!(onSite('gettask'), 'ABC-7', fakeFetch([story, { issues: [sub] }], calls));
  expect(new URL(calls[0]!).pathname).toBe('/rest/api/3/issue/ABC-7');
  expect([task.key, task.title, task.subtasks?.map((s) => s.key)]).toEqual(['ABC-7', 'Parent story', ['ABC-8']]);
  expect(jira.getTask!(connection, 'nope', fakeFetch([]))).rejects.toThrow();
});

test('getDescriptionHtml asks Jira to render the description', async () => {
  const calls: string[] = [];
  const html = await jira.getDescriptionHtml!(onSite('html'), 'ABC-1', fakeFetch([{ renderedFields: { description: ' <p>Hi</p> ' } }], calls));
  expect(new URL(calls[0]!).searchParams.get('expand')).toBe('renderedFields');
  expect(html).toBe('<p>Hi</p>');
});

test('getChildren lists an epic\'s issues and skips anything that is not an epic', async () => {
  const calls: string[] = [];
  const child = { id: '9', key: 'ABC-9', fields: { summary: 'Child story', status: { name: 'To Do', statusCategory: { key: 'new' } } } };
  const kids = await jira.getChildren!(onSite('epic'), { key: 'ABC-1', type: 'Epic' }, fakeFetch([{ issues: [child] }], calls));
  expect(new URL(calls[0]!).searchParams.get('jql')).toBe('parent = ABC-1 ORDER BY created ASC');
  expect(kids.map((k) => k.key)).toEqual(['ABC-9']);
  expect(await jira.getChildren!(onSite('epic'), { key: 'ABC-2', type: 'Story' }, fakeFetch([]))).toEqual([]);
});
