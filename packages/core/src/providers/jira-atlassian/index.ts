import { z } from 'zod';
import { ProviderError } from '../../errors';
import type { Connection, Fetch, Provider } from '../../types';
import { adfToText, createJira, jiraOrigin, textToAdf } from '../jira';
import { beginMcpSignIn, callTool as callMcpTool, finishMcpSignIn, MCP_FIELDS, parseTool, refreshMcpToken, type McpAuth } from '../mcp';

/**
 * Jira Cloud through Atlassian's remote MCP server: the user signs in in the browser (OAuth 2.1, dynamic client
 * registration + PKCE, no client secret), so there is no API token to create. The server's Jira tools answer with
 * the same JSON as the REST API, so the regular Jira code runs on top of `mcpFetch`, which turns its REST calls into
 * tool calls. Calls with no tool behind them are left out of the provider, and the UI hides those actions.
 */

// shortcut: endpoints from https://mcp.atlassian.com/.well-known/oauth-authorization-server, hardcoded; read the
// metadata at sign-in if Atlassian moves them. v1, because the v2 server rejects these clients' authorize requests.
const SERVER = 'https://mcp.atlassian.com';
const MCP_URL = `${SERVER}/v1/mcp`;
/** Calls one of Atlassian's MCP tools; for the Jira tools the text is the REST API's JSON. */
export const callTool = (fetch: Fetch, token: string, name: string, args: Record<string, unknown>) => callMcpTool(fetch, MCP_URL, token, name, args);

/* ------------------------------------------------------------------------------------------------- REST over MCP */

const json = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : undefined);

/**
 * A `fetch` for the Jira code that answers its REST calls with MCP tools. Only the routes the provider below uses;
 * anything else is a 501, which the Jira code reports like any HTTP error.
 */
export function mcpFetch(connection: Connection, fetch: Fetch): Fetch {
  const { accessToken = '', cloudId = '' } = connection.values;
  const call = (name: string, args: Record<string, unknown>) => callTool(fetch, accessToken, name, { cloudId, ...args });
  const route = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/rest\/api\/3/, '');
    const q = url.searchParams;
    // Keys and ids only ("AB-12", "10001"): nothing else is passed on as a tool argument.
    const issue = /^\/issue\/([A-Za-z0-9_-]+)(\/transitions|\/assignee|\/worklog|\/comment)?$/.exec(path);
    const key = issue ? decodeURIComponent(issue[1]!) : '';

    if (method === 'GET' && path === '/search/jql') {
      const max = Number(q.get('maxResults') ?? 50);
      return json(
        await call('searchJiraIssuesUsingJql', {
          jql: q.get('jql') ?? '',
          fields: list(q.get('fields')),
          // The tool takes 50–100; the Jira code asks for fewer only near its own limit, so a few extra are harmless.
          maxResults: Math.min(100, Math.max(50, max)),
          ...(q.get('nextPageToken') ? { nextPageToken: q.get('nextPageToken') } : {}),
        }),
      );
    }
    if (method === 'GET' && path === '/myself') {
      const me = z
        .object({ account_id: z.string(), name: z.string().optional(), email: z.string().optional() })
        .safeParse(parseTool(await callTool(fetch, accessToken, 'atlassianUserInfo', {})));
      if (!me.success) throw new ProviderError('invalid_response', 'Unexpected user info');
      return json(JSON.stringify({ accountId: me.data.account_id, displayName: me.data.name ?? '', emailAddress: me.data.email, active: true }));
    }
    // No tool lists the site's fields; one issue's field names and types say the same (sprint, story points).
    if (method === 'GET' && path === '/field') {
      const found = z.object({ issues: z.array(z.object({ key: z.string() })) }).safeParse(
        parseTool(await call('searchJiraIssuesUsingJql', { jql: 'updated >= -365d ORDER BY updated DESC', maxResults: 50, fields: ['summary'] })),
      );
      const any = found.success ? found.data.issues[0]?.key : undefined;
      if (!any) return json('[]');
      const meta = z
        .object({ names: z.record(z.string(), z.string()).default({}), schema: z.record(z.string(), z.object({ custom: z.string().optional() })).default({}) })
        .safeParse(parseTool(await call('getJiraIssue', { issueIdOrKey: any, fields: ['*all'], expand: 'names,schema' })));
      if (!meta.success) return json('[]');
      return json(JSON.stringify(Object.entries(meta.data.names).map(([id, name]) => ({ id, name, schema: meta.data.schema[id] }))));
    }
    // shortcut: work logs and comments come embedded in the issue (Jira sends up to 20 work logs there); a task with
    // more shows the latest 20. Upgrade if the server gets a tool that pages them.
    if ((issue?.[2] === '/worklog' || issue?.[2] === '/comment') && method === 'GET') {
      const field = issue[2] === '/worklog' ? 'worklog' : 'comment';
      const got = z
        .object({ fields: z.record(z.string(), z.unknown()) })
        .safeParse(parseTool(await call('getJiraIssue', { issueIdOrKey: key, fields: [field] })));
      const page = (got.success ? got.data.fields[field] : undefined) as { worklogs?: unknown[]; comments?: unknown[] } | undefined;
      const items = (field === 'worklog' ? page?.worklogs : page?.comments) ?? [];
      return json(JSON.stringify({ [field === 'worklog' ? 'worklogs' : 'comments']: items, total: items.length, startAt: 0 }));
    }
    if (issue?.[2] === '/worklog' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { timeSpentSeconds: number; started: string; comment?: unknown };
      const text = await call('addWorklogToJiraIssue', {
        issueIdOrKey: key,
        timeSpent: `${Math.round(body.timeSpentSeconds / 60)}m`,
        started: body.started,
        ...(body.comment ? { commentBody: adfToText(body.comment), contentFormat: 'markdown' } : {}),
      });
      return json(JSON.stringify({ id: idIn(text) }));
    }
    if (issue?.[2] === '/comment' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { body?: unknown };
      const text = await call('addCommentToJiraIssue', { issueIdOrKey: key, commentBody: adfToText(body.body), contentFormat: 'markdown' });
      return json(text);
    }
    if (issue?.[2] === '/transitions' && method === 'GET') return json(await call('getTransitionsForJiraIssue', { issueIdOrKey: key, expand: q.get('expand') ?? undefined }));
    if (issue?.[2] === '/transitions' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      await call('transitionJiraIssue', { ...body, issueIdOrKey: key });
      return new Response(null, { status: 204 });
    }
    if (issue?.[2] === '/assignee' && method === 'PUT') {
      const { accountId } = JSON.parse(String(init?.body ?? '{}')) as { accountId?: string | null };
      await call('editJiraIssue', { issueIdOrKey: key, fields: { assignee: accountId ? { accountId } : null } });
      return new Response(null, { status: 204 });
    }
    // The tool is Jira's user picker (anyone on the site, not only who can be assigned), in one page; Jira refuses
    // an assignee who can't take the issue, and that message is shown.
    if (method === 'GET' && path === '/user/assignable/search') {
      const query = q.get('query')?.trim() ?? '';
      // Empty, the picker lists the people you work with most.
      if (Number(q.get('startAt') ?? 0) > 0) return json('[]');
      const found = z
        .object({ data: z.object({ users: z.object({ users: z.array(z.object({ accountId: z.string(), displayName: z.string() })) }) }) })
        .safeParse(parseTool(await call('lookupJiraAccountId', { searchString: query })));
      if (!found.success) throw new ProviderError('invalid_response', 'Unexpected user search');
      return json(JSON.stringify(found.data.data.users.users.map((u) => ({ ...u, active: true }))));
    }
    if (issue && !issue[2] && method === 'GET')
      return json(await call('getJiraIssue', { issueIdOrKey: key, fields: list(q.get('fields')), expand: q.get('expand') ?? undefined }));
    return json('{"errorMessages":["Not available through the Atlassian MCP server"]}', 501);
  };
  // The Jira code reads a thrown error as "network", so an answer the server gave (signed out, not found, rate limit)
  // goes back as the HTTP status it stands for; only a real network failure is thrown.
  return (async (input: string | URL | Request, init?: RequestInit) => {
    try {
      return await route(input, init);
    } catch (error) {
      if (!(error instanceof ProviderError) || error.code === 'network') throw error;
      const status =
        error.code === 'unauthorized' ? 401 : error.code === 'not_found' ? 404 : error.code === 'rate_limited' ? 429 : error.status && error.status >= 400 ? error.status : 502;
      return json(JSON.stringify({ errorMessages: [error.message] }), status);
    }
  }) as Fetch;
}

/** The new record's id from a tool answer: its own `id`, or the first id-looking value in the text. */
function idIn(text: string): string {
  try {
    const parsed = JSON.parse(text) as { id?: unknown };
    if (typeof parsed.id === 'string' || typeof parsed.id === 'number') return String(parsed.id);
  } catch {
    // not JSON
  }
  return /"?id"?\s*[:=]\s*"?(\d+)/.exec(text)?.[1] ?? '';
}

/* ------------------------------------------------------------------------------------------------------- Sign-in */

const AUTH: McpAuth = { register: `${SERVER}/v1/register`, authorize: `${SERVER}/v1/authorize`, token: `${SERVER}/v1/token` };
const sitesSchema = z.array(z.object({ id: z.string(), url: z.string(), name: z.string(), scopes: z.array(z.string()).default([]) }));

/** Finishes the sign-in and returns one board per Jira site the account can reach. */
async function finishAtlassianSignIn(fetch: Fetch, pending: Record<string, string>, redirectedTo: string) {
  const tokens = await finishMcpSignIn(fetch, AUTH, pending, redirectedTo);
  const sites = sitesSchema.safeParse(parseTool(await callTool(fetch, tokens.accessToken, 'getAccessibleAtlassianResources', {})));
  if (!sites.success) throw new ProviderError('invalid_response', 'Unexpected site list');
  // The list repeats a site once per product; keep the Jira ones.
  const jiraSites = [...new Map(sites.data.filter((s) => s.scopes.some((x) => x.includes('jira'))).map((s) => [s.id, s])).values()];
  if (!jiraSites.length) throw new ProviderError('not_found', 'No Jira site on this Atlassian account');
  return jiraSites.map((site) => ({ name: site.name, values: { domain: site.url, cloudId: site.id, ...tokens } }));
}

/* ------------------------------------------------------------------------------------------------------ Provider */

const base = createJira({
  id: 'jira-atlassian',
  name: 'Jira',
  docsUrl: 'https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/',
  // Not a form: what sign-in stores. The secret ones go to the platform's secret store like any token.
  fields: [
    { key: 'domain', type: 'url', label: { tr: 'Jira adresi', en: 'Jira site' } },
    { key: 'cloudId', type: 'text', label: { tr: 'Site kimliği', en: 'Site id' } },
    ...MCP_FIELDS,
  ],
  guide: [],
  api: '3',
  base: jiraOrigin,
  headers: () => ({}),
  identity: (connection) => connection.values.cloudId ?? '',
  defaultName: (b) => new URL(b).hostname.replace('.atlassian.net', ''),
  comment: textToAdf,
  assignBody: (personId) => ({ accountId: personId }),
  userQueryParam: 'query',
  epicChildrenJql: (key) => `parent = ${key} ORDER BY created ASC`,
});

export const jiraAtlassian: Provider = {
  ...base,
  // The server has no tool to delete a work log or comment, nor to download a file; those are left out.
  deleteWorkLog: undefined,
  deleteComment: undefined,
  downloadAttachment: undefined,
  signIn: {
    for: 'jira',
    label: { tr: 'Atlassian ile ekle', en: 'Add with Atlassian' },
    kind: 'redirect',
    begin: (fetch, redirectUri) => beginMcpSignIn(fetch, AUTH, redirectUri),
    finish: finishAtlassianSignIn,
  },
  validate: async (connection, fetch) => {
    await callTool(fetch, connection.values.accessToken ?? '', 'atlassianUserInfo', {});
  },
  refreshCredentials: (connection, fetch) => refreshMcpToken(fetch, AUTH, connection.values),
  fetchMyTasks: (c, fetch) => base.fetchMyTasks(c, mcpFetch(c, fetch)),
  getTask: (c, key, fetch) => base.getTask!(c, key, mcpFetch(c, fetch)),
  getChildren: (c, task, fetch) => base.getChildren!(c, task, mcpFetch(c, fetch)),
  getDescriptionHtml: (c, key, fetch) => base.getDescriptionHtml!(c, key, mcpFetch(c, fetch)),
  searchTasks: (c, query, fetch, hints) => base.searchTasks!(c, query, mcpFetch(c, fetch), hints),
  getTransitions: (c, key, fetch) => base.getTransitions!(c, key, mcpFetch(c, fetch)),
  transition: (c, key, tr, fetch, input) => base.transition!(c, key, tr, mcpFetch(c, fetch), input),
  currentUser: (c, fetch) => base.currentUser!(c, mcpFetch(c, fetch)),
  searchAssignees: (c, key, query, fetch, startAt) => base.searchAssignees!(c, key, query, mcpFetch(c, fetch), startAt),
  assign: (c, key, personId, fetch) => base.assign!(c, key, personId, mcpFetch(c, fetch)),
  logWork: (c, key, entry, fetch) => base.logWork!(c, key, entry, mcpFetch(c, fetch)),
  getWorkLogs: (c, key, fetch) => base.getWorkLogs!(c, key, mcpFetch(c, fetch)),
  getComments: (c, key, fetch, attachments) => base.getComments!(c, key, mcpFetch(c, fetch), attachments),
  addComment: (c, key, text, fetch) => base.addComment!(c, key, text, mcpFetch(c, fetch)),
};
