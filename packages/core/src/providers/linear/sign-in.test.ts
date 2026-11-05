import { expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { linearSignIn } from './sign-in';

/** A fake MCP server answering each tools/call with `tools[name](args)`. */
function fakeServer(tools: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    const msg = JSON.parse(String(init.body)) as { id?: number; method: string; params?: { name: string; arguments: Record<string, unknown> } };
    if (msg.id === undefined) return new Response(null, { status: 202 });
    let result: unknown = {};
    if (msg.method === 'tools/call') {
      calls.push({ name: msg.params!.name, args: msg.params!.arguments });
      result = { content: [{ type: 'text', text: JSON.stringify(tools[msg.params!.name]!(msg.params!.arguments)) }] };
    }
    return Response.json({ jsonrpc: '2.0', id: msg.id, result }, { headers: { 'mcp-session-id': 's1' } });
  }) as Fetch;
  return { fetch, calls };
}

const connection: Connection = { id: 'c1', providerId: 'linear-mcp', name: 'acme', values: { accessToken: `t-${Math.random()}` } };
const issue = (id: string, statusType: string) => ({
  id,
  uuid: `u-${id}`,
  title: id,
  priority: { value: 2, name: 'High' },
  url: `https://linear.app/acme/issue/${id}`,
  status: statusType,
  statusType,
  assignee: 'Ada',
  assigneeId: 'a1',
  team: 'Eng',
});

test('my issues come from list_issues with done ones left out, mapped like the API-key provider', async () => {
  const server = fakeServer({ list_issues: () => ({ issues: [issue('ENG-1', 'started'), issue('ENG-2', 'completed'), issue('ENG-3', 'duplicate')], hasNextPage: false }) });
  const tasks = await linearSignIn.fetchMyTasks(connection, server.fetch);
  expect(tasks.map((t) => [t.key, t.statusCategory, t.priorityLevel, t.assignee?.name])).toEqual([['ENG-1', 'in_progress', 4, 'Ada']]);
  expect(server.calls[0]!.args).toMatchObject({ assignee: 'me' });
});

test('a status change saves the issue with the chosen state, from its team’s statuses', async () => {
  const server = fakeServer({ list_issue_statuses: () => [{ id: 's1', name: 'Done', type: 'completed' }], save_issue: () => ({}) });
  const [done] = await linearSignIn.getTransitions!(connection, 'ENG-12', server.fetch);
  expect(server.calls[0]!.args).toEqual({ team: 'ENG' });
  await linearSignIn.transition!(connection, 'ENG-12', done!, server.fetch);
  expect(server.calls[1]).toEqual({ name: 'save_issue', args: { id: 'ENG-12', state: 's1' } });
});
