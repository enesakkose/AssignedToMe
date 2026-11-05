import { z } from 'zod';
import { ProviderError } from '../../errors';
import type { Connection, Fetch, Provider, Task, Transition } from '../../types';
import { beginMcpSignIn, callTool, finishMcpSignIn, MCP_FIELDS, refreshMcpToken, type McpAuth } from '../mcp';
import { linear, PRIORITY_LEVEL, statusCategory } from '.';

/**
 * Linear through its remote MCP server: the user signs in in the browser (dynamic registration + PKCE, no app of
 * ours to register, no API key). Its tools answer with their own JSON, not the GraphQL API's, so this maps them
 * itself instead of reusing the API-key provider's queries.
 */

// shortcut: endpoints from https://mcp.linear.app/.well-known/oauth-authorization-server, hardcoded.
const SERVER = 'https://mcp.linear.app';
const MCP_URL = `${SERVER}/mcp`;
const AUTH: McpAuth = { register: `${SERVER}/register`, authorize: `${SERVER}/authorize`, token: `${SERVER}/token` };
// shortcut: stops after this many pages; the tool lists done issues too, so a long history costs a few pages.
const MAX_PAGES = 10;

const call = async (connection: Connection, fetch: Fetch, name: string, args: Record<string, unknown>) =>
  JSON.parse(await callTool(fetch, MCP_URL, connection.values.accessToken ?? '', name, args)) as unknown;

const issueSchema = z.object({
  id: z.string(),
  uuid: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  priority: z.object({ value: z.number(), name: z.string() }).nullish(),
  url: z.string(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  status: z.string(),
  statusType: z.string().nullish(),
  assignee: z.string().nullish(),
  assigneeId: z.string().nullish(),
  team: z.string().nullish(),
  project: z.string().nullish(),
});
const pageSchema = z.object({
  issues: z.array(issueSchema),
  hasNextPage: z.boolean().default(false),
  // The tool's cursor key isn't documented; take whichever it sends.
  cursor: z.string().nullish(),
  nextCursor: z.string().nullish(),
  endCursor: z.string().nullish(),
});
const statusesSchema = z.array(z.object({ id: z.string(), name: z.string(), type: z.string() }));

/** Linear's "duplicate" state is closed too; the API-key provider never sees it (it filters server-side). */
const category = (type: string | null | undefined) => (type === 'duplicate' ? 'done' : statusCategory(type ?? undefined));

function toTask(connection: Connection, n: z.infer<typeof issueSchema>): Task {
  const level = n.priority?.value ? PRIORITY_LEVEL[n.priority.value] : undefined;
  return {
    id: `${connection.id}:${n.uuid}`,
    key: n.id,
    title: n.title,
    status: n.status,
    statusCategory: category(n.statusType),
    priority: level ? n.priority?.name : undefined,
    priorityLevel: level,
    project: n.project ?? n.team ?? undefined,
    assignee: n.assigneeId && n.assignee ? { id: n.assigneeId, name: n.assignee } : undefined,
    description: n.description || undefined,
    url: n.url,
    connectionId: connection.id,
    updatedAt: n.updatedAt ?? new Date().toISOString(),
    createdAt: n.createdAt ?? undefined,
  };
}

/** "ENG-123" → "ENG": the team whose workflow the issue follows. */
const teamOf = (key: string) => key.slice(0, key.lastIndexOf('-'));

export const linearSignIn: Provider = {
  ...linear,
  id: 'linear-mcp',
  fields: [...MCP_FIELDS],
  guide: [],
  signIn: {
    for: 'linear',
    label: { tr: 'Linear ile giriş yap', en: 'Sign in with Linear' },
    kind: 'redirect',
    begin: (fetch, redirectUri) => beginMcpSignIn(fetch, AUTH, redirectUri),
    finish: async (fetch, pending, redirectedTo) => {
      const values = await finishMcpSignIn(fetch, AUTH, pending, redirectedTo);
      const ws = z.object({ name: z.string() }).safeParse(await call({ id: '', providerId: 'linear-mcp', name: '', values }, fetch, 'get_workspace', {}));
      if (!ws.success) throw new ProviderError('invalid_response', 'Unexpected Linear workspace');
      return [{ name: ws.data.name, values }];
    },
  },
  refreshCredentials: (connection, fetch) => refreshMcpToken(fetch, AUTH, connection.values),
  validate: async (connection, fetch) => {
    await call(connection, fetch, 'get_workspace', {});
  },
  fetchMyTasks: async (connection, fetch) => {
    const tasks: Task[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const parsed = pageSchema.safeParse(await call(connection, fetch, 'list_issues', { assignee: 'me', limit: 100, orderBy: 'updatedAt', ...(cursor ? { cursor } : {}) }));
      if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected Linear issue list');
      for (const n of parsed.data.issues) if (category(n.statusType) !== 'done') tasks.push(toTask(connection, n));
      cursor = parsed.data.nextCursor ?? parsed.data.endCursor ?? parsed.data.cursor ?? undefined;
      if (!parsed.data.hasNextPage || !cursor) break;
    }
    return tasks;
  },
  getTransitions: async (connection, taskKey, fetch): Promise<Transition[]> => {
    const parsed = statusesSchema.safeParse(await call(connection, fetch, 'list_issue_statuses', { team: teamOf(taskKey) }));
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected Linear statuses');
    return parsed.data.map((s) => ({ id: s.id, name: s.name, to: { name: s.name, category: category(s.type) }, fields: [], allowsComment: false, needsInput: false }));
  },
  transition: async (connection, taskKey, transition, fetch) => {
    await call(connection, fetch, 'save_issue', { id: taskKey, state: transition.id });
  },
};
