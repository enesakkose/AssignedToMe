import { z } from 'zod';
import { ProviderError, request } from '../../errors';
import type { Comment, Connection, Fetch, Provider, StatusCategory, Task, Transition } from '../../types';

// Official GitLab mark (Simple Icons).
const LOGO =
  '<svg fill="#FC6D26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z"/></svg>';

/**
 * Host (with port) from a pasted address: gitlab.com, a self-hosted name, an IP or host:port, with or without scheme
 * and path. Always reached over https.
 * shortcut: drops any path, so a GitLab installed under a subpath (example.com/gitlab) isn't supported; a pasted
 * project URL would be indistinguishable from one. Upgrade: a separate "base path" field if someone needs it.
 */
export function hostOf(input: string): string {
  const s = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new ProviderError('invalid_input', 'Not a valid GitLab host');
  }
  if (!url.hostname || url.username || url.password) throw new ProviderError('invalid_input', 'Not a valid GitLab host');
  return url.host;
}
const api = (connection: Connection) => `https://${hostOf(connection.values.domain ?? 'gitlab.com')}/api/v4`;
const headers = (connection: Connection): HeadersInit => ({ 'PRIVATE-TOKEN': connection.values.token ?? '' });
const jsonHeaders = (connection: Connection): HeadersInit => ({ ...headers(connection), 'Content-Type': 'application/json' });

// shortcut: list reads stop after this many pages (1,000 items) so a bad response can't loop forever.
const MAX_PAGES = 10;

/** Every page of a GitLab list endpoint (`url` already has per_page=100), page by page until a short one. */
async function allPages<T extends z.ZodTypeAny>(connection: Connection, url: string, item: T, fetch: Fetch): Promise<z.infer<T>[]> {
  const all: z.infer<T>[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const parsed = z.array(item).safeParse(await request(fetch, `${url}&page=${page}`, { headers: headers(connection) }));
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected GitLab response');
    all.push(...parsed.data);
    if (parsed.data.length < 100) break;
  }
  return all;
}

/** The key is "group/project#iid"; the project path may have subgroups, so split on the last "#". */
function parseKey(key: string): { project: string; iid: string } {
  const hash = key.lastIndexOf('#');
  const iid = key.slice(hash + 1);
  if (hash <= 0 || !/^\d+$/.test(iid)) throw new ProviderError('invalid_input', 'Not a GitLab issue key');
  return { project: encodeURIComponent(key.slice(0, hash)), iid };
}

const issueSchema = z.object({
  id: z.number(),
  iid: z.number(),
  title: z.string(),
  web_url: z.string(),
  state: z.string(),
  updated_at: z.string().nullish(),
  created_at: z.string().nullish(),
  description: z.string().nullish(),
  references: z.object({ full: z.string() }).nullish(),
  time_stats: z.object({ time_estimate: z.number().nullish(), total_time_spent: z.number().nullish() }).nullish(),
  assignee: z.object({ id: z.number(), name: z.string().nullish(), username: z.string().nullish() }).nullish(),
  assignees: z.array(z.object({ id: z.number(), name: z.string().nullish(), username: z.string().nullish() })).nullish(),
});

// System notes are status/label changes GitLab writes itself; only human notes are comments.
const noteSchema = z.object({
  id: z.number(),
  body: z.string().nullish(),
  created_at: z.string(),
  system: z.boolean().nullish(),
  author: z.object({ username: z.string(), name: z.string().nullish() }).nullish(),
});

/** Username of the connected account, to mark the user's own comments; undefined if it can't be read. */
async function meUsername(connection: Connection, fetch: Fetch): Promise<string | undefined> {
  const r = z.object({ username: z.string() }).safeParse(await request(fetch, `${api(connection)}/user`, { headers: headers(connection) }));
  return r.success ? r.data.username : undefined;
}

function toComment(n: z.infer<typeof noteSchema>, me: string | undefined): Comment {
  return { id: String(n.id), author: n.author?.name ?? n.author?.username, mine: !!n.author && n.author.username === me, created: n.created_at, text: n.body ?? '' };
}

export const gitlab: Provider = {
  id: 'gitlab',
  name: 'GitLab',
  appName: 'GitLab',
  logo: LOGO,
  docsUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
  fields: [
    { key: 'domain', type: 'url', placeholder: 'gitlab.com', label: { tr: 'GitLab adresi', en: 'GitLab host' } },
    { key: 'token', type: 'secret', label: { tr: 'Access token', en: 'Access token' } },
  ],
  guide: [
    {
      text: {
        tr: 'Kendi sunucun değilse adres gitlab.com’dur. GitLab’da avatarın → Edit profile → Access → Personal access tokens → “Generate token” (sorarsa “Legacy token”). Bu link sayfayı ad ve izin doldurulmuş açar:',
        en: 'For gitlab.com leave the host as is. In GitLab: your avatar → Edit profile → Access → Personal access tokens → “Generate token” (pick “Legacy token” if asked). This link opens the page with the name and scope filled in:',
      },
      copy: 'https://{domain}/-/user_settings/personal_access_tokens?name=AssignedToMe&scopes=api',
      link: 'https://docs.gitlab.com/user/profile/personal_access_tokens/',
    },
    {
      text: {
        tr: '“api” iznini seç (issue okumak, yorum ve durum değişikliği için yeter), istersen bitiş tarihi ver ve oluştur.',
        en: 'Select the “api” scope (covers reading issues, comments and status changes), optionally set an expiry, and create it.',
      },
    },
    {
      text: {
        tr: 'Token’ı kopyala ve Access token alanına yapıştır. Sayfadan ayrılınca tekrar gösterilmez.',
        en: 'Copy the token and paste it into the Access token field. It is not shown again.',
      },
    },
  ],
  defaultName: (values) => values.domain?.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || 'GitLab',
  validate: async (connection, fetch) => {
    const parsed = z.object({ id: z.number() }).safeParse(await request(fetch, `${api(connection)}/user`, { headers: headers(connection) }));
    if (!parsed.success) throw new ProviderError('unauthorized', 'GitLab rejected the token');
  },
  fetchMyTasks: async (connection, fetch) => {
    const issues = await allPages(connection, `${api(connection)}/issues?scope=assigned_to_me&state=opened&per_page=100`, issueSchema, fetch);
    return issues.map((i): Task => {
      const a = i.assignee ?? i.assignees?.[0];
      return {
        id: `${connection.id}:${i.id}`,
        key: i.references?.full ?? `#${i.iid}`,
        title: i.title,
        status: i.state === 'closed' ? 'Closed' : 'Open',
        statusCategory: (i.state === 'closed' ? 'done' : 'todo') satisfies StatusCategory,
        type: 'Issue',
        assignee: a ? { id: String(a.id), name: a.name ?? a.username ?? '' } : undefined,
        description: i.description || undefined,
        // GitLab already reports time in seconds.
        estimateSeconds: i.time_stats?.time_estimate || undefined,
        loggedSeconds: i.time_stats?.total_time_spent || undefined,
        url: i.web_url,
        connectionId: connection.id,
        updatedAt: i.updated_at ?? new Date().toISOString(),
        createdAt: i.created_at ?? undefined,
      };
    });
  },
  getTransitions: async (connection, taskKey, fetch): Promise<Transition[]> => {
    const { project, iid } = parseKey(taskKey);
    const issue = z.object({ state: z.string() }).safeParse(await request(fetch, `${api(connection)}/projects/${project}/issues/${iid}`, { headers: headers(connection) }));
    if (!issue.success) throw new ProviderError('invalid_response', 'Unexpected GitLab response');
    const base = { fields: [], allowsComment: false, needsInput: false };
    return issue.data.state === 'closed'
      ? [{ id: 'reopen', name: 'Reopen', to: { name: 'Open', category: 'todo' }, ...base }]
      : [{ id: 'close', name: 'Close', to: { name: 'Closed', category: 'done' }, ...base }];
  },
  transition: async (connection, taskKey, transition, fetch) => {
    const { project, iid } = parseKey(taskKey);
    const state_event = transition.id === 'reopen' ? 'reopen' : 'close';
    await request(fetch, `${api(connection)}/projects/${project}/issues/${iid}`, { method: 'PUT', headers: jsonHeaders(connection), body: JSON.stringify({ state_event }) });
  },
  getComments: async (connection, taskKey, fetch) => {
    const { project, iid } = parseKey(taskKey);
    // Oldest first, every page: system notes count toward each page, and the newest comments are on the last one.
    const [notes, me] = await Promise.all([
      allPages(connection, `${api(connection)}/projects/${project}/issues/${iid}/notes?per_page=100&sort=asc&order_by=created_at`, noteSchema, fetch),
      meUsername(connection, fetch),
    ]);
    return notes.filter((n) => !n.system).map((n) => toComment(n, me));
  },
  addComment: async (connection, taskKey, text, fetch) => {
    if (!text.trim()) throw new ProviderError('invalid_input', 'Empty comment');
    const { project, iid } = parseKey(taskKey);
    const [res, me] = await Promise.all([
      request(fetch, `${api(connection)}/projects/${project}/issues/${iid}/notes`, { method: 'POST', headers: jsonHeaders(connection), body: JSON.stringify({ body: text.trim() }) }),
      meUsername(connection, fetch),
    ]);
    const parsed = noteSchema.safeParse(res);
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected GitLab response');
    return toComment(parsed.data, me);
  },
  deleteComment: async (connection, taskKey, commentId, fetch) => {
    const { project, iid } = parseKey(taskKey);
    if (!/^\d+$/.test(commentId)) throw new ProviderError('invalid_input', 'Not a comment id');
    await request(fetch, `${api(connection)}/projects/${project}/issues/${iid}/notes/${commentId}`, { method: 'DELETE', headers: headers(connection) });
  },
};
