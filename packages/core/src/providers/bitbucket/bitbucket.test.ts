import { expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { bitbucket } from '.';

const connection: Connection = { id: 'b1', providerId: 'bitbucket-dc', name: 'Bitbucket', values: { domain: 'bitbucket.acme.com', token: 'BBToken' } };

const json = (payload: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

const pr = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  title: 'Add parser',
  description: 'Fixes the thing',
  state: 'OPEN',
  createdDate: 1_696_118_400_000, // 2023-10-01
  updatedDate: 1_698_624_000_000, // 2023-10-30
  toRef: { repository: { slug: 'app', name: 'App', project: { key: 'PROJ', name: 'Project' } } },
  author: { user: { name: 'author', slug: 'author', displayName: 'Author' }, role: 'AUTHOR', status: 'UNAPPROVED' },
  reviewers: [{ user: { name: 'me', slug: 'me', displayName: 'Me' }, role: 'REVIEWER', approved: false, status: 'UNAPPROVED' }],
  links: { self: [{ href: 'https://bitbucket.acme.com/projects/PROJ/repos/app/pull-requests/42/overview' }] },
  ...overrides,
});

/** Routes the calls fetchMyTasks / getTransitions make: whoami (count + users) and the PR endpoints. */
const route = (handlers: { count?: () => Response; users?: () => Response; dashboard?: () => Response; prGet?: () => Response }, seen?: { url?: string; method?: string; body?: string; auth?: string }): Fetch =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/inbox/pull-requests/count')) return handlers.count?.() ?? json({ count: 1 }, { 'X-AUSERNAME': 'me' });
    if (u.includes('/users?filter=')) return handlers.users?.() ?? json({ values: [{ name: 'me', slug: 'me', displayName: 'Me' }], isLastPage: true });
    if (u.includes('/dashboard/pull-requests')) return handlers.dashboard?.() ?? json({ values: [pr()], isLastPage: true });
    if (seen) {
      seen.url = u;
      seen.method = init?.method;
      seen.body = init?.body as string;
      seen.auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    }
    return handlers.prGet?.() ?? json(pr());
  }) as Fetch;

test('validate sends a bearer token to the inbox count endpoint', async () => {
  const seen: { url?: string; auth?: string } = {};
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.url = String(url);
    seen.auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    return json({ count: 3 });
  }) as Fetch;
  await bitbucket.validate(connection, fetch);
  expect(seen.url).toBe('https://bitbucket.acme.com/rest/api/1.0/inbox/pull-requests/count');
  expect(seen.auth).toBe('Bearer BBToken');
});

test('validate throws when the token is rejected', async () => {
  const fetch = (async (_url: string | URL | Request, _init?: RequestInit) => new Response('', { status: 401 })) as Fetch;
  expect(bitbucket.validate(connection, fetch)).rejects.toThrow();
});

test('fetchMyTasks maps a reviewer PR to a Task with my review status', async () => {
  const seen: { url?: string } = {};
  const dashboard = () => {
    return json({ values: [pr(), pr({ id: 7, title: 'Approved one', reviewers: [{ user: { name: 'me', slug: 'me', displayName: 'Me' }, role: 'REVIEWER', status: 'APPROVED' }] })], isLastPage: true });
  };
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/inbox/pull-requests/count')) return json({ count: 2 }, { 'X-AUSERNAME': 'me' });
    if (u.includes('/users?filter=')) return json({ values: [{ name: 'me', slug: 'me', displayName: 'Me' }], isLastPage: true });
    seen.url = u;
    return dashboard();
  }) as Fetch;
  const tasks = await bitbucket.fetchMyTasks(connection, fetch);
  expect(seen.url).toContain('role=REVIEWER');
  expect(seen.url).toContain('state=OPEN');
  expect(tasks[0]).toMatchObject({
    id: 'b1:42',
    key: 'PROJ/app#42',
    title: 'Add parser',
    type: 'Pull request',
    status: 'Needs review',
    statusCategory: 'todo',
    project: 'App',
    url: 'https://bitbucket.acme.com/projects/PROJ/repos/app/pull-requests/42/overview',
    createdAt: '2023-10-01T00:00:00.000Z',
  });
  // An approved PR reads as done from my side.
  expect(tasks[1]).toMatchObject({ key: 'PROJ/app#7', status: 'Approved', statusCategory: 'done' });
});

test('getTransitions offers the states I am not already in', async () => {
  const transitions = await bitbucket.getTransitions!(connection, 'PROJ/app#42', route({}));
  // Currently UNAPPROVED, so Approve and Request changes are offered, Reset review is not.
  expect(transitions.map((t) => t.id)).toEqual(['APPROVED', 'NEEDS_WORK']);
  expect(transitions.find((t) => t.id === 'APPROVED')!.to.category).toBe('done');
});

test('getTransitions drops the current state (approved)', async () => {
  const approved = () => json(pr({ reviewers: [{ user: { name: 'me', slug: 'me', displayName: 'Me' }, role: 'REVIEWER', status: 'APPROVED' }] }));
  const transitions = await bitbucket.getTransitions!(connection, 'PROJ/app#42', route({ prGet: approved }));
  expect(transitions.map((t) => t.id)).toEqual(['NEEDS_WORK', 'UNAPPROVED']);
});

test('approve posts to the current-user approve endpoint (no participant slug)', async () => {
  const seen: { url?: string; method?: string; body?: string } = {};
  const transition = { id: 'APPROVED', name: 'Approve', to: { name: 'Approved', category: 'done' as const }, fields: [], allowsComment: false, needsInput: false };
  await bitbucket.transition!(connection, 'PROJ/app#42', transition, route({}, seen));
  expect(seen.method).toBe('POST');
  expect(seen.url).toBe('https://bitbucket.acme.com/rest/api/1.0/projects/PROJ/repos/app/pull-requests/42/approve');
});

test('request-changes PUTs my participant status', async () => {
  const seen: { url?: string; method?: string; body?: string } = {};
  const transition = { id: 'NEEDS_WORK', name: 'Request changes', to: { name: 'Needs work', category: 'in_progress' as const }, fields: [], allowsComment: false, needsInput: false };
  await bitbucket.transition!(connection, 'PROJ/app#42', transition, route({}, seen));
  expect(seen.method).toBe('PUT');
  expect(seen.url).toBe('https://bitbucket.acme.com/rest/api/1.0/projects/PROJ/repos/app/pull-requests/42/participants/me');
  expect(seen.body).toContain('"status":"NEEDS_WORK"');
});

test('a key without a project/repo is rejected', () => {
  expect(bitbucket.getTransitions!(connection, '#42', route({}))).rejects.toThrow();
});

/** Resolves whoami (count + users) and delegates everything else to `rest`. */
const withWhoami = (rest: Fetch, username = 'me'): Fetch =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/inbox/pull-requests/count')) return json({ count: 1 }, { 'X-AUSERNAME': username });
    if (u.includes('/users?filter=')) return json({ values: [{ name: 'me', slug: 'me', displayName: 'Me' }], isLastPage: true });
    return rest(url, init);
  }) as Fetch;

const comment = (id: number, author: string, overrides: Record<string, unknown> = {}) => ({
  id,
  version: 0,
  text: `comment ${id}`,
  author: { name: author, slug: author, displayName: author === 'me' ? 'Me' : 'Them' },
  createdDate: 1_698_624_000_000,
  ...overrides,
});

test('getComments builds a thread tree with nested replies and mine detection', async () => {
  const activities = () =>
    json({
      values: [
        { action: 'APPROVED' },
        {
          action: 'COMMENTED',
          comment: comment(1, 'them', {
            comments: [comment(2, 'me', { comments: [comment(3, 'them')] })],
          }),
        },
      ],
      isLastPage: true,
    });
  const comments = await bitbucket.getComments!(connection, 'PROJ/app#42', withWhoami((async (url) => {
    if (String(url).includes('/activities')) return activities();
    throw new Error(`unexpected ${url}`);
  }) as Fetch));
  expect(comments).toHaveLength(1);
  expect(comments[0]).toMatchObject({ id: '1', author: 'Them', mine: false, text: 'comment 1' });
  const reply = comments[0]!.replies![0]!;
  expect(reply).toMatchObject({ id: '2', mine: true });
  expect(reply.replies![0]).toMatchObject({ id: '3', mine: false });
});

test('addComment posts a top-level comment with just text', async () => {
  const seen: { url?: string; method?: string; body?: string } = {};
  await bitbucket.addComment!(connection, 'PROJ/app#42', 'hello', withWhoami((async (url, init) => {
    seen.url = String(url);
    seen.method = init?.method;
    seen.body = init?.body as string;
    return json(comment(9, 'me', { text: 'hello' }));
  }) as Fetch));
  expect(seen.method).toBe('POST');
  expect(seen.url).toBe('https://bitbucket.acme.com/rest/api/1.0/projects/PROJ/repos/app/pull-requests/42/comments');
  expect(JSON.parse(seen.body!)).toEqual({ text: 'hello' });
});

test('addComment with a parentId posts a reply', async () => {
  const seen: { body?: string } = {};
  const created = await bitbucket.addComment!(connection, 'PROJ/app#42', 'a reply', withWhoami((async (_url, init) => {
    seen.body = init?.body as string;
    return json(comment(10, 'me', { text: 'a reply' }));
  }) as Fetch), '1');
  expect(JSON.parse(seen.body!)).toEqual({ text: 'a reply', parent: { id: 1 } });
  expect(created).toMatchObject({ id: '10', mine: true });
});

test('deleteComment fetches the version then deletes with it', async () => {
  const seen: { getUrl?: string; delUrl?: string; delMethod?: string } = {};
  await bitbucket.deleteComment!(connection, 'PROJ/app#42', '9', withWhoami((async (url, init) => {
    const u = String(url);
    if (init?.method === 'DELETE') {
      seen.delUrl = u;
      seen.delMethod = init.method;
      return new Response('', { status: 204 });
    }
    seen.getUrl = u;
    return json(comment(9, 'me', { version: 4 }));
  }) as Fetch));
  expect(seen.getUrl).toBe('https://bitbucket.acme.com/rest/api/1.0/projects/PROJ/repos/app/pull-requests/42/comments/9');
  expect(seen.delMethod).toBe('DELETE');
  expect(seen.delUrl).toBe('https://bitbucket.acme.com/rest/api/1.0/projects/PROJ/repos/app/pull-requests/42/comments/9?version=4');
});
