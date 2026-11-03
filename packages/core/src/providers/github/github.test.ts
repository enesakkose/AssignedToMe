import { expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { github } from '.';

const connection: Connection = { id: 'g1', providerId: 'github', name: 'GitHub', values: { token: 'ghp_x' } };

const ok = (payload: unknown, seen?: { url?: string; auth?: string }) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    if (seen) {
      seen.url = String(url);
      seen.auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;

test('validate sends a bearer token and accepts a user', async () => {
  const seen: { url?: string; auth?: string } = {};
  await github.validate(connection, ok({ login: 'octocat' }, seen));
  expect(seen.url).toBe('https://api.github.com/user');
  expect(seen.auth).toBe('Bearer ghp_x');
});

test('validate throws when the token is rejected', async () => {
  const fetch = (async (_url: string | URL | Request, _init?: RequestInit) => new Response('', { status: 401 })) as Fetch;
  expect(github.validate(connection, fetch)).rejects.toThrow();
});

test('fetchMyTasks maps issues and pull requests', async () => {
  const seen: { url?: string } = {};
  const tasks = await github.fetchMyTasks(
    connection,
    ok(
      [
        {
          id: 101,
          number: 7,
          title: 'Bug in parser',
          html_url: 'https://github.com/acme/app/issues/7',
          state: 'open',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-30T00:00:00Z',
          body: 'repro',
          repository: { name: 'app', full_name: 'acme/app' },
          assignee: { id: 9, login: 'octocat' },
        },
        {
          id: 102,
          number: 8,
          title: 'Add feature',
          html_url: 'https://github.com/acme/app/pull/8',
          state: 'open',
          pull_request: { url: 'x' },
          repository: { name: 'app', full_name: 'acme/app' },
        },
      ],
      seen,
    ),
  );
  expect(seen.url).toContain('filter=assigned');
  // The repo lives in the key so later calls can address it.
  expect(tasks[0]).toMatchObject({ id: 'g1:101', key: 'acme/app#7', type: 'Issue', statusCategory: 'todo', createdAt: '2026-10-01T00:00:00Z', assignee: { id: '9', name: 'octocat' } });
  expect(tasks[1]).toMatchObject({ key: 'acme/app#8', type: 'Pull request' });
});

test('getComments addresses the repo from the key and marks the user own comments', async () => {
  const seen: { url?: string } = {};
  const fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith('/user')) return new Response(JSON.stringify({ login: 'octocat' }), { status: 200, headers: { 'content-type': 'application/json' } });
    seen.url = u;
    return new Response(
      JSON.stringify([
        { id: 1, body: 'from me', created_at: '2026-10-02T00:00:00Z', user: { login: 'octocat' } },
        { id: 2, body: 'from them', created_at: '2026-10-03T00:00:00Z', user: { login: 'other' } },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as Fetch;
  const comments = await github.getComments!(connection, 'acme/app#7', fetch);
  expect(seen.url).toContain('/repos/acme/app/issues/7/comments');
  expect(comments[0]).toMatchObject({ id: '1', mine: true, text: 'from me' });
  expect(comments[1]!.mine).toBe(false);
});

test('getTransitions offers close for an open issue and transition patches state', async () => {
  const seen: { body?: string } = {};
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      seen.body = init.body as string;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ state: 'open' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;
  const transitions = await github.getTransitions!(connection, 'acme/app#7', fetch);
  expect(transitions.map((t) => t.id)).toEqual(['close', 'close_not_planned']);
  await github.transition!(connection, 'acme/app#7', transitions[0]!, fetch);
  expect(seen.body).toContain('"state":"closed"');
  expect(seen.body).toContain('completed');
});

test('getTransitions offers Projects v2 Status options and transition updates the field over GraphQL', async () => {
  const seen: { body?: string; url?: string } = {};
  const j = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith('/graphql')) {
      const q = String(init?.body);
      if (q.includes('updateProjectV2ItemFieldValue')) {
        seen.url = u;
        seen.body = q;
        return j({ data: { updateProjectV2ItemFieldValue: { clientMutationId: null } } });
      }
      return j({
        data: {
          repository: {
            issue: {
              projectItems: {
                nodes: [
                  {
                    id: 'ITEM1',
                    project: { id: 'PROJ1', field: { id: 'FIELD1', options: [{ id: 'o-todo', name: 'Todo' }, { id: 'o-prog', name: 'In Progress' }, { id: 'o-done', name: 'Done' }] } },
                    fieldValueByName: { optionId: 'o-todo' },
                  },
                ],
              },
            },
          },
        },
      });
    }
    return j({ state: 'open' }); // REST GET issue
  }) as Fetch;
  const transitions = await github.getTransitions!(connection, 'acme/app#7', fetch);
  // Current "Todo" is dropped; the other statuses come first, then open/close.
  expect(transitions.map((t) => t.id)).toEqual(['proj:PROJ1:ITEM1:FIELD1:o-prog', 'proj:PROJ1:ITEM1:FIELD1:o-done', 'close', 'close_not_planned']);
  expect(transitions.find((t) => t.id.endsWith('o-done'))!.to.category).toBe('done');
  expect(transitions.find((t) => t.id.endsWith('o-prog'))!.to.category).toBe('in_progress');
  await github.transition!(connection, 'acme/app#7', transitions[0]!, fetch);
  expect(seen.url).toContain('/graphql');
  expect(seen.body).toContain('updateProjectV2ItemFieldValue');
  expect(seen.body).toContain('o-prog');
});

test('getChildren lists an issue\'s sub-issues addressed by their own repo', async () => {
  const seen: { url?: string } = {};
  const fetch = (async (url: string | URL | Request) => {
    seen.url = String(url);
    return new Response(
      JSON.stringify([
        { id: 201, number: 11, title: 'Sub one', html_url: 'https://github.com/acme/app/issues/11', state: 'open', assignee: { id: 9, login: 'octocat' } },
        { id: 202, number: 12, title: 'Sub two', html_url: 'https://github.com/acme/app/issues/12', state: 'closed' },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as Fetch;
  const kids = await github.getChildren!(connection, { key: 'acme/app#7', type: 'Issue' }, fetch);
  expect(seen.url).toContain('/repos/acme/app/issues/7/sub_issues');
  expect(kids[0]).toMatchObject({ key: 'acme/app#11', title: 'Sub one', statusCategory: 'todo', assignee: { name: 'octocat' } });
  expect(kids[1]).toMatchObject({ key: 'acme/app#12', statusCategory: 'done' });
});

test('a key without a repo is rejected', () => {
  expect(github.getComments!(connection, '#7', (async (_url: string | URL | Request, _init?: RequestInit) => new Response('[]')) as Fetch)).rejects.toThrow();
});

test('fetchMyTasks reads every page past the first 100 issues', async () => {
  const pages: string[] = [];
  const issue = (n: number) => ({ id: n, number: n, title: `T${n}`, html_url: `https://github.com/acme/app/issues/${n}`, state: 'open', repository: { name: 'app', full_name: 'acme/app' } });
  const fetch = (async (url: string | URL | Request) => {
    const page = new URL(String(url)).searchParams.get('page')!;
    pages.push(page);
    const body = page === '1' ? Array.from({ length: 100 }, (_, i) => issue(i + 1)) : [issue(101)];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;
  const tasks = await github.fetchMyTasks(connection, fetch);
  expect(pages).toEqual(['1', '2']);
  expect(tasks).toHaveLength(101);
});

test('a null project item does not hide the Status options', async () => {
  const j = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetch = (async (url: string | URL | Request) => {
    if (!String(url).endsWith('/graphql')) return j({ state: 'open' });
    return j({
      data: {
        repository: {
          issue: {
            projectItems: {
              nodes: [null, { id: 'ITEM1', project: { id: 'PROJ1', field: { id: 'F1', options: [{ id: 'o1', name: 'Todo' }, { id: 'o2', name: 'Done' }] } }, fieldValueByName: { optionId: 'o1' } }],
            },
          },
        },
      },
    });
  }) as Fetch;
  const transitions = await github.getTransitions!(connection, 'acme/app#7', fetch);
  expect(transitions[0]!.id).toBe('proj:PROJ1:ITEM1:F1:o2');
});
