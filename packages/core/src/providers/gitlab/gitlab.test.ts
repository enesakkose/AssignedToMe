import { expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { gitlab } from '.';

const connection: Connection = { id: 'gl1', providerId: 'gitlab', name: 'GitLab', values: { domain: 'gitlab.com', token: 'glpat' } };

const ok = (payload: unknown, seen?: { url?: string; token?: string }) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    if (seen) {
      seen.url = String(url);
      seen.token = (init?.headers as Record<string, string> | undefined)?.['PRIVATE-TOKEN'];
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;

test('validate sends the private token to the host API', async () => {
  const seen: { url?: string; token?: string } = {};
  await gitlab.validate(connection, ok({ id: 1 }, seen));
  expect(seen.url).toBe('https://gitlab.com/api/v4/user');
  expect(seen.token).toBe('glpat');
});

test('a self-hosted host is used and a bad host is rejected', async () => {
  const seen: { url?: string } = {};
  const self: Connection = { ...connection, values: { domain: 'https://git.acme.io/', token: 't' } };
  await gitlab.validate(self, ok({ id: 1 }, seen));
  expect(seen.url).toBe('https://git.acme.io/api/v4/user');
  const bad: Connection = { ...connection, values: { domain: 'not a host', token: 't' } };
  expect(gitlab.validate(bad, ok({ id: 1 }))).rejects.toThrow();
});

test('fetchMyTasks maps assigned open issues', async () => {
  const seen: { url?: string } = {};
  const tasks = await gitlab.fetchMyTasks(
    connection,
    ok(
      [
        {
          id: 55,
          iid: 3,
          title: 'Flaky test',
          web_url: 'https://gitlab.com/acme/app/-/issues/3',
          state: 'opened',
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-30T00:00:00Z',
          references: { full: 'acme/app#3' },
          assignees: [{ id: 7, name: 'Ada', username: 'ada' }],
        },
      ],
      seen,
    ),
  );
  expect(seen.url).toContain('scope=assigned_to_me');
  expect(tasks[0]).toMatchObject({ id: 'gl1:55', key: 'acme/app#3', statusCategory: 'todo', url: 'https://gitlab.com/acme/app/-/issues/3', assignee: { id: '7', name: 'Ada' } });
});

test('fetchMyTasks surfaces time stats as seconds', async () => {
  const tasks = await gitlab.fetchMyTasks(
    connection,
    ok([
      {
        id: 56,
        iid: 4,
        title: 'Timed',
        web_url: 'u',
        state: 'opened',
        references: { full: 'acme/app#4' },
        time_stats: { time_estimate: 7200, total_time_spent: 3600 },
      },
    ]),
  );
  expect(tasks[0]).toMatchObject({ estimateSeconds: 7200, loggedSeconds: 3600 });
});

test('getComments encodes a subgroup path, drops system notes, and marks own ones', async () => {
  const seen: { url?: string } = {};
  const fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.endsWith('/user')) return new Response(JSON.stringify({ username: 'me' }), { status: 200, headers: { 'content-type': 'application/json' } });
    seen.url = u;
    return new Response(
      JSON.stringify([
        { id: 10, body: 'changed status', created_at: '2026-10-02T00:00:00Z', system: true, author: { username: 'me' } },
        { id: 11, body: 'real comment', created_at: '2026-10-03T00:00:00Z', system: false, author: { username: 'me', name: 'Me' } },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as Fetch;
  const comments = await gitlab.getComments!(connection, 'group/sub/app#4', fetch);
  expect(seen.url).toContain('/projects/group%2Fsub%2Fapp/issues/4/notes');
  expect(comments).toHaveLength(1);
  expect(comments[0]).toMatchObject({ id: '11', mine: true, author: 'Me', text: 'real comment' });
});

test('transition closes an open issue via state_event', async () => {
  const seen: { body?: string; method?: string } = {};
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      seen.body = init.body as string;
      seen.method = init.method;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ state: 'opened' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;
  const transitions = await gitlab.getTransitions!(connection, 'acme/app#3', fetch);
  expect(transitions[0]!.id).toBe('close');
  await gitlab.transition!(connection, 'acme/app#3', transitions[0]!, fetch);
  expect(seen.body).toContain('"state_event":"close"');
});

test('hostOf takes gitlab.com, self-hosted names, ports and IPs, with or without scheme and path', async () => {
  const { hostOf } = await import('.');
  expect(hostOf('gitlab.com')).toBe('gitlab.com');
  expect(hostOf('https://gitlab.company.com/group/project/-/issues/3')).toBe('gitlab.company.com');
  expect(hostOf('gitlab.company.com:8443')).toBe('gitlab.company.com:8443');
  expect(hostOf('10.0.0.5')).toBe('10.0.0.5');
  expect(hostOf('gitlab')).toBe('gitlab');
  for (const bad of ['', 'bad host', 'https://u:p@gitlab.com']) expect(() => hostOf(bad)).toThrow();
});
