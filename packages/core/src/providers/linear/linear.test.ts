import { expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { linear } from '.';

const connection: Connection = { id: 'l1', providerId: 'linear', name: 'Linear', values: { apiKey: 'lin_key' } };

const ok = (payload: unknown, seen?: { url?: string; auth?: string; body?: string }) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    if (seen) {
      seen.url = String(url);
      seen.auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      seen.body = init?.body as string | undefined;
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;

test('validate posts the API key and accepts a viewer', async () => {
  const seen: { url?: string; auth?: string } = {};
  await linear.validate(connection, ok({ data: { viewer: { id: 'u1' } } }, seen));
  expect(seen.url).toBe('https://api.linear.app/graphql');
  expect(seen.auth).toBe('lin_key');
});

test('validate throws on a GraphQL auth error', async () => {
  expect(linear.validate(connection, ok({ errors: [{ message: 'Authentication required' }] }))).rejects.toThrow();
});

test('fetchMyTasks maps assigned issues and priority, and asks for open ones only', async () => {
  const seen: { body?: string } = {};
  const fetch = ok(
    {
      data: {
        viewer: {
          assignedIssues: {
            nodes: [
              {
                id: 'i1',
                identifier: 'ENG-12',
                title: 'Fix login',
                url: 'https://linear.app/acme/issue/ENG-12',
                priority: 1,
                priorityLabel: 'Urgent',
                createdAt: '2026-10-01T00:00:00.000Z',
                updatedAt: '2026-10-30T00:00:00.000Z',
                description: 'steps',
                state: { name: 'In Progress', type: 'started' },
                team: { name: 'Engineering' },
                project: { name: 'Auth' },
              },
              { id: 'i2', identifier: 'ENG-13', title: 'No priority', url: 'u', priority: 0, state: { name: 'Todo', type: 'unstarted' } },
            ],
          },
        },
      },
    },
    seen,
  );
  const tasks = await linear.fetchMyTasks(connection, fetch);
  expect(seen.body).toContain('completedAt');
  expect(tasks[0]).toMatchObject({
    id: 'l1:i1',
    key: 'ENG-12',
    title: 'Fix login',
    status: 'In Progress',
    statusCategory: 'in_progress',
    priority: 'Urgent',
    priorityLevel: 5,
    project: 'Auth',
    url: 'https://linear.app/acme/issue/ENG-12',
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  // Priority 0 → no priority shown; unstarted → todo.
  expect([tasks[1]!.priority, tasks[1]!.priorityLevel, tasks[1]!.statusCategory]).toEqual([undefined, undefined, 'todo']);
});

test('fetchMyTasks follows the cursor past the first 100 issues', async () => {
  const afters: (string | undefined)[] = [];
  const issue = (n: number) => ({ id: `i${n}`, identifier: `ENG-${n}`, title: `T${n}`, url: `https://linear.app/x/issue/ENG-${n}` });
  const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const after = (JSON.parse(init?.body as string) as { variables?: { after?: string } }).variables?.after;
    afters.push(after);
    const page = after
      ? { nodes: [issue(2)], pageInfo: { hasNextPage: false, endCursor: 'c2' } }
      : { nodes: [issue(1)], pageInfo: { hasNextPage: true, endCursor: 'c1' } };
    return new Response(JSON.stringify({ data: { viewer: { assignedIssues: page } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;
  const tasks = await linear.fetchMyTasks(connection, fetch);
  expect(afters).toEqual([undefined, 'c1']);
  expect(tasks.map((t) => t.key)).toEqual(['ENG-1', 'ENG-2']);
});
