import { expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { dataCenterBase, jiraDataCenter, pickSprint } from '.';

const dc = (domain = 'maestro.example.com'): Connection => ({
  id: 'd1',
  providerId: 'jira-dc',
  name: 'maestro',
  values: { domain, username: 'enes.akkose', password: 'pä:ss' },
});

test('dataCenterBase accepts hosts, pasted page URLs and context paths; rejects http and credentials', () => {
  expect(dataCenterBase('maestro.example.com')).toBe('https://maestro.example.com');
  expect(dataCenterBase('https://maestro.example.com/secure/ViewProfile.jspa')).toBe('https://maestro.example.com');
  expect(dataCenterBase('https://host.example.com/jira/browse/WMO-1')).toBe('https://host.example.com/jira');
  expect(dataCenterBase('https://host.example.com/jira/')).toBe('https://host.example.com/jira');
  for (const bad of ['', 'http://maestro.example.com', 'https://u:p@maestro.example.com', 'not a url at all'])
    expect(() => dataCenterBase(bad)).toThrow();
});

test('pickSprint reads Data Center sprint strings', () => {
  expect(
    pickSprint([
      'com.atlassian.greenhopper.service.sprint.Sprint@1a[id=1,rapidViewId=9,state=CLOSED,name=Sprint 23,startDate=x]',
      'com.atlassian.greenhopper.service.sprint.Sprint@2b[id=2,rapidViewId=9,state=ACTIVE,name=Sprint 24,startDate=y]',
    ]),
  ).toBe('Sprint 24');
});

test('fetchMyTasks on Data Center: v2 search with offset paging, basic auth, plain descriptions, usernames', async () => {
  const calls: { url: string; auth?: string }[] = [];
  const issue = (n: number) => ({
    id: String(n),
    key: `WMO-${n}`,
    fields: {
      summary: `Task ${n}`,
      updated: '2026-10-30T09:00:00.000+0300',
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      description: 'h3. Steps\nDo it',
      assignee: { name: 'enes.akkose', key: 'JIRAUSER1', displayName: 'Enes Akköse' },
      customfield_10100: ['com.atlassian.greenhopper.service.sprint.Sprint@1[id=1,state=ACTIVE,name=PI3-S4]'],
    },
  });
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    const url = String(u);
    calls.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization });
    if (url.endsWith('/rest/api/2/field'))
      return new Response(JSON.stringify([{ id: 'customfield_10100', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } }]), { status: 200 });
    const startAt = Number(new URL(url).searchParams.get('startAt'));
    return new Response(JSON.stringify({ startAt, total: 2, issues: [issue(startAt + 1)] }), { status: 200 });
  }) as Fetch;

  const tasks = await jiraDataCenter.fetchMyTasks(dc(), fetch);
  const searches = calls.filter((c) => c.url.includes('/rest/api/2/search?'));
  expect(searches.map((c) => new URL(c.url).searchParams.get('startAt'))).toEqual(['0', '1']);
  expect(calls[0]!.auth).toBe(`Basic ${Buffer.from('enes.akkose:pä:ss').toString('base64')}`);
  expect(tasks.map((t) => t.key)).toEqual(['WMO-1', 'WMO-2']);
  expect(tasks[0]).toMatchObject({
    description: 'h3. Steps\nDo it',
    assignee: { id: 'enes.akkose', name: 'Enes Akköse' },
    sprint: 'PI3-S4',
    url: 'https://maestro.example.com/browse/WMO-1',
  });
});

test('Data Center assigns by username and searches users with the username parameter', async () => {
  const calls: { url: string; body?: string }[] = [];
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(u), body: init?.body as string | undefined });
    if (init?.method === 'PUT') return new Response(null, { status: 204 });
    return new Response(JSON.stringify([{ name: 'ayse', displayName: 'Ayşe', active: true }]), { status: 200 });
  }) as Fetch;
  const people = await jiraDataCenter.searchAssignees!(dc('assign.example.com'), 'WMO-1', 'ay', fetch);
  expect(new URL(calls[0]!.url).searchParams.get('username')).toBe('ay');
  expect(people.people).toEqual([{ id: 'ayse', name: 'Ayşe' }]);
  await jiraDataCenter.assign!(dc('assign.example.com'), 'WMO-1', 'ayse', fetch);
  expect(calls[1]!.url).toBe('https://assign.example.com/rest/api/2/issue/WMO-1/assignee');
  expect(JSON.parse(calls[1]!.body!)).toEqual({ name: 'ayse' });
});

test('a CAPTCHA lockout is reported as its own error, a wrong password as unauthorized', async () => {
  const respond = (headers: Record<string, string>) =>
    (async () => new Response('', { status: 401, headers })) as unknown as Fetch;
  await expect(jiraDataCenter.validate(dc(), respond({ 'X-Authentication-Denied-Reason': 'CAPTCHA_CHALLENGE; login-url=x' }))).rejects.toMatchObject({
    code: 'captcha',
  });
  await expect(jiraDataCenter.validate(dc(), respond({ 'X-Seraph-LoginReason': 'AUTHENTICATED_FAILED' }))).rejects.toMatchObject({
    code: 'unauthorized',
  });
});

test('attachments come through, wiki image embeds leave the description', async () => {
  const fetch = (async (u: string | URL | Request) => {
    const url = String(u);
    if (url.endsWith('/rest/api/2/field')) return new Response('[]', { status: 200 });
    return new Response(
      JSON.stringify({
        startAt: 0,
        total: 1,
        issues: [
          {
            id: '9',
            key: 'BOOM-9',
            fields: {
              summary: 'With image',
              status: { name: 'To Do', statusCategory: { key: 'new' } },
              description: 'See below\n!image-2026.png|thumbnail!\n\n\n!other.JPG!\nDone',
              attachment: [
                {
                  id: 501,
                  filename: 'image-2026.png',
                  mimeType: 'image/png',
                  content: 'https://att.example.com/secure/attachment/501/image-2026.png',
                  thumbnail: 'https://att.example.com/secure/thumbnail/501/_thumb_501.png',
                },
              ],
            },
          },
        ],
      }),
      { status: 200 },
    );
  }) as Fetch;
  const [task] = await jiraDataCenter.fetchMyTasks(dc('att.example.com'), fetch);
  expect(task!.description).toBe('See below\n\nDone');
  expect(task!.attachments).toEqual([
    {
      id: '501',
      name: 'image-2026.png',
      mimeType: 'image/png',
      url: 'https://att.example.com/secure/attachment/501/image-2026.png',
      thumbnailUrl: 'https://att.example.com/secure/thumbnail/501/_thumb_501.png',
    },
  ]);
});

test('downloadAttachment sends credentials only to the connection site', async () => {
  const seen: { url: string; auth?: string }[] = [];
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(u), auth: (init?.headers as Record<string, string>)?.Authorization });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } });
  }) as Fetch;
  const blob = await jiraDataCenter.downloadAttachment!(dc('att.example.com'), 'https://att.example.com/secure/attachment/1/a.png', fetch);
  expect(blob.size).toBe(3);
  expect(seen[0]!.auth).toStartWith('Basic ');
  for (const url of ['https://evil.example.com/a.png', 'https://att.example.com.evil.com/a.png'])
    await expect(jiraDataCenter.downloadAttachment!(dc('att.example.com'), url, fetch)).rejects.toMatchObject({ code: 'invalid_input' });
  expect(seen).toHaveLength(1);
});

test('transitions fall back to the plain list when the field expansion breaks', async () => {
  const urls: string[] = [];
  const fetch = (async (u: string | URL | Request) => {
    const url = String(u);
    urls.push(url);
    if (url.includes('expand=')) return new Response('<html>Oops</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    return new Response(
      JSON.stringify({ transitions: [{ id: '11', name: 'Send Code Review', to: { name: 'Code Review', statusCategory: { key: 'indeterminate' } } }] }),
      { status: 200 },
    );
  }) as Fetch;
  const transitions = await jiraDataCenter.getTransitions!(dc('wf.example.com'), 'BOOM-7187', fetch);
  expect(urls).toEqual([
    'https://wf.example.com/rest/api/2/issue/BOOM-7187/transitions?expand=transitions.fields',
    'https://wf.example.com/rest/api/2/issue/BOOM-7187/transitions',
  ]);
  expect(transitions).toEqual([
    { id: '11', name: 'Send Code Review', to: { name: 'Code Review', category: 'in_progress' }, fields: [], allowsComment: false, needsInput: false },
  ]);
});

test('downloadAttachment refuses an HTML page in place of the file', async () => {
  const fetch = (async () => new Response('<html>Erişim Engellendi</html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })) as unknown as Fetch;
  await expect(
    jiraDataCenter.downloadAttachment!(dc('att.example.com'), 'https://att.example.com/secure/attachment/1/a.png', fetch),
  ).rejects.toMatchObject({ code: 'blocked' });
});

test('a transition screen like "Estimated Budget Effort" becomes a form and is sent as Jira expects', async () => {
  let posted: Record<string, unknown> = {};
  const fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted = JSON.parse(String(init.body));
      expect((init.headers as Record<string, string>)['X-Atlassian-Token']).toBe('no-check');
      return new Response(null, { status: 204 });
    }
    return new Response(
      JSON.stringify({
        transitions: [
          {
            id: '91',
            name: 'Estimated Budget Effort',
            hasScreen: true,
            to: { name: 'Waiting for Approval', statusCategory: { key: 'indeterminate' } },
            fields: {
              customfield_20001: {
                required: true,
                name: 'Budget Item',
                schema: { type: 'option', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:select' },
                allowedValues: [
                  { id: '301', value: 'Lead Engine' },
                  { id: '302', value: 'Self Service' },
                ],
              },
              customfield_11425: { required: true, name: 'Estimated Budget Effort Man/Day', schema: { type: 'number' } },
              customfield_30000: { required: false, name: 'Notes', schema: { type: 'string', custom: 'x:textarea' } },
              customfield_40000: { required: false, name: 'Due', schema: { type: 'date' } },
              comment: { required: false, name: 'Comment', schema: { type: 'comments-page' } },
            },
          },
        ],
      }),
      { status: 200 },
    );
  }) as Fetch;
  const conn = dc('budget.example.com');
  const [effort] = await jiraDataCenter.getTransitions!(conn, 'BOOM-1', fetch);
  expect(effort).toMatchObject({ allowsComment: true, needsInput: false });
  expect(effort!.fields).toEqual([
    { key: 'customfield_20001', name: 'Budget Item', required: true, kind: 'select', options: [{ id: '301', name: 'Lead Engine' }, { id: '302', name: 'Self Service' }] },
    { key: 'customfield_11425', name: 'Estimated Budget Effort Man/Day', required: true, kind: 'number' },
    { key: 'customfield_30000', name: 'Notes', required: false, kind: 'textarea' },
  ]);

  await expect(jiraDataCenter.transition!(conn, 'BOOM-1', effort!, fetch, { values: { customfield_20001: '301' } })).rejects.toMatchObject({
    code: 'invalid_input',
  });
  await jiraDataCenter.transition!(conn, 'BOOM-1', effort!, fetch, {
    values: { customfield_20001: '301', customfield_11425: '2,5' },
    comment: 'Estimated with the team',
  });
  expect(posted).toEqual({
    transition: { id: '91' },
    fields: { customfield_20001: { id: '301' }, customfield_11425: 2.5 },
    update: { comment: [{ add: { body: 'Estimated with the team' } }] },
  });
});

test('Data Center finds an epic\'s issues through the Epic Link field', async () => {
  const urls: string[] = [];
  const fetch = (async (u: string | URL | Request) => {
    urls.push(String(u));
    if (String(u).endsWith('/field')) return new Response('[]', { status: 200 });
    return new Response(JSON.stringify({ issues: [], total: 0 }), { status: 200 });
  }) as Fetch;
  await jiraDataCenter.getChildren!(dc('epic.example.com'), { key: 'WMO-5', type: 'Epic' }, fetch);
  expect(new URL(urls.find((u) => u.includes('/search'))!).searchParams.get('jql')).toBe('"Epic Link" = WMO-5 ORDER BY created ASC');
});

test('a Personal Access Token (no username) signs in with Bearer; a username keeps the password sign-in', async () => {
  const auth: (string | undefined)[] = [];
  const fetch = (async (_u: string | URL | Request, init?: RequestInit) => {
    auth.push((init?.headers as Record<string, string>)?.Authorization);
    return new Response(JSON.stringify({ name: 'enes.akkose' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;
  await jiraDataCenter.validate({ ...dc(), values: { domain: 'maestro.example.com', username: '', password: 'pat-123' } }, fetch);
  await jiraDataCenter.validate(dc(), fetch);
  expect(auth[0]).toBe('Bearer pat-123');
  expect(auth[1]).toStartWith('Basic ');
});
