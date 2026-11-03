import { expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { azure, orgOf } from '.';

const connection: Connection = { id: 'az1', providerId: 'azure', name: 'Azure', values: { org: 'acme', pat: 'tok' } };

test('validate runs the WIQL query (Work Items scope only) with basic auth', async () => {
  const seen: { url?: string; auth?: string; method?: string } = {};
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.url = String(url);
    seen.method = init?.method;
    seen.auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    return new Response(JSON.stringify({ workItems: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;
  await azure.validate(connection, fetch);
  expect(seen.url).toContain('https://dev.azure.com/acme/_apis/wit/wiql');
  expect(seen.method).toBe('POST');
  expect(seen.auth).toBe(`Basic ${btoa(':tok')}`);
});

test('orgOf reads every pasted form of the organization and rejects garbage', () => {
  for (const input of ['acme', ' acme ', 'https://dev.azure.com/acme', 'https://dev.azure.com/acme/My%20Project/_workitems', 'dev.azure.com/acme', 'https://acme.visualstudio.com', 'acme.visualstudio.com/Proj'])
    expect(orgOf(input)).toBe('acme');
  for (const bad of ['', 'bad org', 'https://'])
    expect(() => orgOf(bad)).toThrow();
});

test('fetchMyTasks runs WIQL then batches work items', async () => {
  const seen: { wiql?: string; items?: string } = {};
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/wiql')) {
      seen.wiql = init?.body as string;
      return new Response(JSON.stringify({ workItems: [{ id: 41 }, { id: 42 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    seen.items = u;
    return new Response(
      JSON.stringify({
        value: [
          {
            id: 41,
            fields: {
              'System.Title': 'Ship it',
              'System.State': 'Active',
              'System.WorkItemType': 'Task',
              'System.TeamProject': 'My Project',
              'System.AssignedTo': { displayName: 'Enes Akkose', id: 'guid-1' },
              'System.CreatedDate': '2026-10-01T00:00:00Z',
              'System.ChangedDate': '2026-10-30T00:00:00Z',
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as Fetch;
  const tasks = await azure.fetchMyTasks(connection, fetch);
  expect(seen.wiql).toContain('@Me');
  expect(seen.items).toContain('ids=41,42');
  expect(tasks[0]).toMatchObject({
    id: 'az1:41',
    key: '#41',
    title: 'Ship it',
    statusCategory: 'in_progress',
    type: 'Task',
    project: 'My Project',
    url: 'https://dev.azure.com/acme/My%20Project/_workitems/edit/41',
    createdAt: '2026-10-01T00:00:00Z',
    assignee: { id: 'guid-1', name: 'Enes Akkose' },
  });
});

test('fetchMyTasks returns nothing when no work items match', async () => {
  const fetch = (async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify({ workItems: [] }), { status: 200, headers: { 'content-type': 'application/json' } })) as Fetch;
  expect(await azure.fetchMyTasks(connection, fetch)).toEqual([]);
});

test('fetchMyTasks maps scheduling hours to seconds', async () => {
  const fetch = (async (url: string | URL | Request) => {
    if (String(url).includes('/wiql')) return new Response(JSON.stringify({ workItems: [{ id: 5 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(
      JSON.stringify({
        value: [
          {
            id: 5,
            fields: {
              'System.Title': 'Timed',
              'System.State': 'Active',
              'Microsoft.VSTS.Scheduling.OriginalEstimate': 2,
              'Microsoft.VSTS.Scheduling.CompletedWork': 1.5,
            },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as Fetch;
  const tasks = await azure.fetchMyTasks(connection, fetch);
  expect(tasks[0]).toMatchObject({ estimateSeconds: 7200, loggedSeconds: 5400 });
});

test('getComments strips HTML, orders oldest first, and marks own comments', async () => {
  const seen: { url?: string } = {};
  const fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('/connectionData'))
      return new Response(JSON.stringify({ authenticatedUser: { id: 'u1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    // The work item read that finds the comments' project.
    if (u.includes('fields=System.TeamProject'))
      return new Response(JSON.stringify({ fields: { 'System.TeamProject': 'My Project' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    seen.url = u;
    return new Response(
      JSON.stringify({
        comments: [
          { id: 2, text: '<div>newer</div>', createdDate: '2026-10-03T00:00:00Z', createdBy: { displayName: 'Them', id: 'u2' } },
          { id: 1, text: 'older &amp; mine', createdDate: '2026-10-02T00:00:00Z', createdBy: { displayName: 'Me', id: 'u1' } },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as Fetch;
  const comments = await azure.getComments!(connection, '#41', fetch);
  // Comments are addressed under their project.
  expect(seen.url).toContain('https://dev.azure.com/acme/My%20Project/_apis/wit/workItems/41/comments');
  expect(comments.map((c) => c.id)).toEqual(['1', '2']);
  expect(comments[0]).toMatchObject({ mine: true, text: 'older & mine' });
  expect(comments[1]).toMatchObject({ mine: false, text: 'newer' });
});

test('getTransitions lists other states and transition patches System.State', async () => {
  const seen: { body?: string; ct?: string } = {};
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'PATCH') {
      seen.body = init.body as string;
      seen.ct = (init.headers as Record<string, string>)['Content-Type'];
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.includes('/workitemtypes/'))
      return new Response(
        JSON.stringify({ value: [{ name: 'New', stateCategory: 'Proposed' }, { name: 'Active', stateCategory: 'InProgress' }, { name: 'Closed', stateCategory: 'Completed' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    return new Response(
      JSON.stringify({ fields: { 'System.WorkItemType': 'Bug', 'System.State': 'Active', 'System.TeamProject': 'My Project' } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as Fetch;
  const transitions = await azure.getTransitions!(connection, '#41', fetch);
  expect(transitions.map((t) => t.id)).toEqual(['New', 'Closed']);
  expect(transitions.find((t) => t.id === 'Closed')!.to.category).toBe('done');
  await azure.transition!(connection, '#41', transitions[0]!, fetch);
  expect(seen.body).toContain('/fields/System.State');
  expect(seen.body).toContain('New');
  expect(seen.ct).toBe('application/json-patch+json');
});

test('fetchMyTasks reads more than 200 work items in batches of 200', async () => {
  const batches: number[] = [];
  const fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('/wiql'))
      return new Response(JSON.stringify({ workItems: Array.from({ length: 250 }, (_, i) => ({ id: i + 1 })) }), { status: 200, headers: { 'content-type': 'application/json' } });
    const ids = new URL(u).searchParams.get('ids')!.split(',').map(Number);
    batches.push(ids.length);
    return new Response(JSON.stringify({ value: ids.map((id) => ({ id, fields: { 'System.Title': `T${id}` } })) }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as Fetch;
  const tasks = await azure.fetchMyTasks(connection, fetch);
  expect(batches).toEqual([200, 50]);
  expect(tasks).toHaveLength(250);
});
