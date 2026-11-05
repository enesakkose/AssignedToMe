import { describe, expect, test } from 'bun:test';
import type { Connection, Fetch } from '../../types';
import { jiraAtlassian, mcpFetch } from '.';

/** A fake MCP server: answers initialize, then each tools/call with `tools[name](args)` as an event stream. */
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
    const event = `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n\n`;
    return new Response(event, { headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 's1' } });
  }) as Fetch;
  return { fetch, calls };
}

const connection = (values: Record<string, string> = {}): Connection => ({
  id: 'c1',
  providerId: 'jira-atlassian',
  name: 'acme',
  values: { domain: 'https://acme.atlassian.net', cloudId: 'cloud-1', accessToken: `t-${Math.random()}`, ...values },
});

describe('jira-atlassian', () => {
  test('a REST search becomes a searchJiraIssuesUsingJql call on the site, and its JSON comes back as the response', async () => {
    const server = fakeServer({ searchJiraIssuesUsingJql: () => ({ issues: [], isLast: true }) });
    const res = await mcpFetch(connection(), server.fetch)('https://acme.atlassian.net/rest/api/3/search/jql?jql=x&fields=summary,status&maxResults=10');
    expect(await res.json()).toEqual({ issues: [], isLast: true });
    expect(server.calls).toEqual([{ name: 'searchJiraIssuesUsingJql', args: { cloudId: 'cloud-1', jql: 'x', fields: ['summary', 'status'], maxResults: 50 } }]);
  });

  test('a transition posts its body to transitionJiraIssue; a route with no tool is a 501', async () => {
    const server = fakeServer({ transitionJiraIssue: () => ({}) });
    const f = mcpFetch(connection(), server.fetch);
    const res = await f('https://acme.atlassian.net/rest/api/3/issue/AB-1/transitions', { method: 'POST', body: JSON.stringify({ transition: { id: '41' } }) });
    expect(res.status).toBe(204);
    expect(server.calls[0]).toEqual({ name: 'transitionJiraIssue', args: { cloudId: 'cloud-1', issueIdOrKey: 'AB-1', transition: { id: '41' } } });
    expect((await f('https://acme.atlassian.net/rest/api/3/issue/AB-1/worklog/7', { method: 'DELETE' })).status).toBe(501);
  });

  test('assigning edits the assignee field; people come from the user picker', async () => {
    const server = fakeServer({
      editJiraIssue: () => ({}),
      lookupJiraAccountId: () => ({ data: { users: { users: [{ accountId: 'a1', displayName: 'Ada' }] } } }),
    });
    const people = await jiraAtlassian.searchAssignees!(connection(), 'AB-1', 'ad', server.fetch);
    expect(people.people.map((p) => p.name)).toEqual(['Ada']);
    await jiraAtlassian.assign!(connection(), 'AB-1', null, server.fetch);
    expect(server.calls.at(-1)).toEqual({ name: 'editJiraIssue', args: { cloudId: 'cloud-1', issueIdOrKey: 'AB-1', fields: { assignee: null } } });
  });

  test('credentials refresh only near expiry, keeping the old refresh token when none comes back', async () => {
    const fresh = connection({ expiresAt: String(Date.now() + 60 * 60_000), refreshToken: 'r1', clientId: 'id' });
    expect(await jiraAtlassian.refreshCredentials!(fresh, (() => Promise.reject(new Error('no call'))) as unknown as Fetch)).toBeUndefined();
    const dying = connection({ expiresAt: String(Date.now() + 60_000), refreshToken: 'r1', clientId: 'id' });
    let sent = '';
    const fetch = (async (_url: string, init: RequestInit) => {
      sent = String(init.body);
      return Response.json({ access_token: 'new', expires_in: 3600 });
    }) as Fetch;
    const values = await jiraAtlassian.refreshCredentials!(dying, fetch);
    expect(sent).toContain('grant_type=refresh_token');
    expect(values).toMatchObject({ accessToken: 'new', refreshToken: 'r1', cloudId: 'cloud-1' });
  });
});
