import { z } from 'zod';
import { ProviderError, request } from '../../errors';
import type { Comment, Connection, Fetch, Provider, StatusCategory, Task, Transition } from '../../types';

const API = 'https://api.github.com';

// Official GitHub mark (Simple Icons). Monochrome: uses currentColor so it follows the app theme (the app renders
// this one inline; a media query inside an <img> SVG doesn't reliably track the window theme in WebKit).
const LOGO =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';

const issueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  state: z.string(),
  updated_at: z.string().nullish(),
  created_at: z.string().nullish(),
  body: z.string().nullish(),
  pull_request: z.unknown().nullish(),
  repository: z.object({ name: z.string(), full_name: z.string() }).nullish(),
  assignee: z.object({ id: z.number(), login: z.string() }).nullish(),
  assignees: z.array(z.object({ id: z.number(), login: z.string() })).nullish(),
  sub_issues_summary: z.object({ total: z.number() }).nullish(),
});

const commentSchema = z.object({
  id: z.number(),
  body: z.string().nullish(),
  created_at: z.string(),
  user: z.object({ login: z.string() }).nullish(),
});

// The Todo/In Progress/Done "Status" lives on a GitHub Project (v2), reached over GraphQL — not on the issue.
const projectItemsSchema = z.object({
  data: z
    .object({
      repository: z
        .object({
          issue: z
            .object({
              projectItems: z
                .object({
                  nodes: z.array(
                    z.object({
                      id: z.string(),
                      project: z.object({
                        id: z.string(),
                        field: z.object({ id: z.string(), options: z.array(z.object({ id: z.string(), name: z.string() })) }).nullish(),
                      }),
                      fieldValueByName: z.object({ optionId: z.string().nullish() }).nullish(),
                    })
                    // The schema lets a connection hold null items; one must not hide the rest.
                    .nullable(),
                  ),
                })
                .nullish(),
            })
            .nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

/** GitHub status options carry no category; infer ours from the common names. */
function statusOptionCategory(name: string): StatusCategory {
  const n = name.toLowerCase();
  if (['done', 'closed', 'completed', 'shipped'].some((w) => n.includes(w))) return 'done';
  if (['progress', 'doing', 'review', 'started', 'active'].some((w) => n.includes(w))) return 'in_progress';
  return 'todo';
}

export const headers = (connection: Connection): HeadersInit => ({
  Authorization: `Bearer ${connection.values.token ?? ''}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  // GitHub rejects API requests without a User-Agent.
  'User-Agent': 'AssignedToMe',
});
const jsonHeaders = (connection: Connection): HeadersInit => ({ ...headers(connection), 'Content-Type': 'application/json' });

/** The key carries the repo so a task can be addressed from its key alone: "owner/repo#123". */
function parseKey(key: string): { owner: string; repo: string; number: string } {
  const hash = key.lastIndexOf('#');
  const number = key.slice(hash + 1);
  const slash = key.indexOf('/');
  if (hash < 0 || slash < 0 || slash > hash || !/^\d+$/.test(number)) throw new ProviderError('invalid_input', 'Not a GitHub issue key');
  return { owner: key.slice(0, slash), repo: key.slice(slash + 1, hash), number };
}

/** POST a GraphQL query/mutation. GitHub returns HTTP 200 even on errors, so callers inspect the body. */
async function graphql(connection: Connection, query: string, variables: Record<string, unknown>, fetch: Fetch): Promise<unknown> {
  return request(fetch, `${API}/graphql`, { method: 'POST', headers: jsonHeaders(connection), body: JSON.stringify({ query, variables }) });
}

const PROJECT_STATUS_QUERY = `query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){issue(number:$number){projectItems(first:10){nodes{id project{id field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{optionId}}}}}}}`;

/** The issue's Status field on the first project it belongs to, or undefined (no project, no Status field, or no "project" scope). */
async function projectStatus(connection: Connection, owner: string, repo: string, number: number, fetch: Fetch) {
  const res = await graphql(connection, PROJECT_STATUS_QUERY, { owner, repo, number }, fetch);
  // A missing "project" scope comes back as a GraphQL error with data:null, so the parse just yields no nodes.
  const nodes = projectItemsSchema.safeParse(res).data?.data?.repository?.issue?.projectItems?.nodes ?? [];
  for (const n of nodes) {
    if (n?.project.field)
      return { projectId: n.project.id, itemId: n.id, fieldId: n.project.field.id, options: n.project.field.options, currentOptionId: n.fieldValueByName?.optionId ?? undefined };
  }
  return undefined;
}

// shortcut: list reads stop after this many pages (1,000 items) so a bad response can't loop forever; that covers any
// assigned list or issue thread.
const MAX_PAGES = 10;

/** Every page of a GitHub list endpoint (`url` already has per_page=100), page by page until a short one. */
async function allPages<T extends z.ZodTypeAny>(connection: Connection, url: string, item: T, fetch: Fetch): Promise<z.infer<T>[]> {
  const all: z.infer<T>[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const parsed = z.array(item).safeParse(await request(fetch, `${url}&page=${page}`, { headers: headers(connection) }));
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected GitHub response');
    all.push(...parsed.data);
    if (parsed.data.length < 100) break;
  }
  return all;
}

/** Login of the connected account, to mark which comments are the user's own; undefined if it can't be read. */
async function meLogin(connection: Connection, fetch: Fetch): Promise<string | undefined> {
  const r = z.object({ login: z.string() }).safeParse(await request(fetch, `${API}/user`, { headers: headers(connection) }));
  return r.success ? r.data.login : undefined;
}

function toComment(c: z.infer<typeof commentSchema>, me: string | undefined): Comment {
  return { id: String(c.id), author: c.user?.login, mine: !!c.user && c.user.login === me, created: c.created_at, text: c.body ?? '' };
}

/** Maps a GitHub issue (from the list or a sub-issue) to a Task. The repo lives in the key so the task can be addressed later. */
function toTask(i: z.infer<typeof issueSchema>, connection: Connection): Task {
  const a = i.assignee ?? i.assignees?.[0];
  // Sub-issues omit the nested repository object, so fall back to the owner/repo in the html_url.
  const repoPath = i.repository?.full_name ?? i.html_url.match(/github\.com\/([^/]+\/[^/]+)\//)?.[1];
  return {
    id: `${connection.id}:${i.id}`,
    key: repoPath ? `${repoPath}#${i.number}` : `#${i.number}`,
    title: i.title,
    status: i.state === 'closed' ? 'Closed' : 'Open',
    statusCategory: (i.state === 'closed' ? 'done' : 'todo') satisfies StatusCategory,
    type: i.pull_request ? 'Pull request' : 'Issue',
    assignee: a ? { id: String(a.id), name: a.login } : undefined,
    description: i.body || undefined,
    url: i.html_url,
    connectionId: connection.id,
    updatedAt: i.updated_at ?? new Date().toISOString(),
    createdAt: i.created_at ?? undefined,
    childCount: i.sub_issues_summary?.total || undefined,
  };
}

export const github: Provider = {
  id: 'github',
  name: 'GitHub',
  appName: 'GitHub',
  logo: LOGO,
  docsUrl: 'https://github.com/settings/tokens',
  fields: [{ key: 'token', type: 'secret', label: { tr: 'Access token', en: 'Access token' } }],
  guide: [
    {
      text: {
        tr: 'GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → “Generate new token” menüsünden “Generate new token (classic)”. Klasik token birden çok organizasyon ve SSO ile en sorunsuz çalışanı; fine-grained token tek bir organizasyonla sınırlı kalır.',
        en: 'GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → “Generate new token (classic)” from the “Generate new token” menu. A classic token works most smoothly across organizations and SSO; a fine-grained token is limited to one organization.',
      },
      link: 'https://github.com/settings/tokens',
    },
    {
      text: {
        tr: '“repo” iznini işaretle. Görevlerin “Status” alanını (Todo / In Progress / Done — bu alan GitHub Projects’e aittir, issue’nun kendisine değil) görmek ve değiştirmek için “project” iznini de işaretle (sadece görmek için “read:project” yeter).',
        en: 'Tick the “repo” scope. To see and change a task’s “Status” field (Todo / In Progress / Done — it belongs to GitHub Projects, not the issue itself), also tick “project” (“read:project” is enough to only see it).',
      },
    },
    {
      text: {
        tr: 'Organizasyonun SAML SSO (tek oturum) kullanıyorsa: token’ı oluşturduktan sonra listede yanındaki “Configure SSO”ya tıkla ve her organizasyon için “Authorize” et. Buton görünmüyorsa önce o organizasyona tarayıcıda SSO ile bir kez giriş yap. Bunu yapmazsan o organizasyonun görevleri hiç görünmez.',
        en: 'If your organization uses SAML SSO: after creating the token, click “Configure SSO” next to it in the list and Authorize each organization. If the button is missing, sign in to that organization through SSO in the browser once first. Without this, that org’s tasks simply won’t show up.',
      },
    },
    {
      text: {
        tr: 'Token’ı kopyala ve Access token alanına yapıştır. Sayfadan ayrılınca tekrar gösterilmez.',
        en: 'Copy the token and paste it into the Access token field. It is not shown again.',
      },
    },
  ],
  defaultName: () => 'GitHub',
  validate: async (connection, fetch) => {
    const parsed = z.object({ login: z.string() }).safeParse(await request(fetch, `${API}/user`, { headers: headers(connection) }));
    if (!parsed.success) throw new ProviderError('unauthorized', 'GitHub rejected the token');
  },
  fetchMyTasks: async (connection, fetch) => {
    // Issues and PRs assigned to the authenticated user, across every repo they can see.
    const issues = await allPages(connection, `${API}/issues?filter=assigned&state=open&per_page=100`, issueSchema, fetch);
    return issues.map((i) => toTask(i, connection));
  },
  getTransitions: async (connection, taskKey, fetch): Promise<Transition[]> => {
    const { owner, repo, number } = parseKey(taskKey);
    const base = { fields: [], allowsComment: false, needsInput: false };
    const issue = z.object({ state: z.string() }).safeParse(await request(fetch, `${API}/repos/${owner}/${repo}/issues/${number}`, { headers: headers(connection) }));
    if (!issue.success) throw new ProviderError('invalid_response', 'Unexpected GitHub response');

    // Project "Status" (Todo/In Progress/Done) over GraphQL; needs the token's "project" scope.
    // shortcut: uses the first project the issue sits in; an issue in several projects shows only that one's Status.
    const status: Transition[] = [];
    const item = await projectStatus(connection, owner, repo, Number(number), fetch).catch(() => undefined);
    if (item)
      for (const opt of item.options)
        if (opt.id !== item.currentOptionId)
          status.push({ id: `proj:${item.projectId}:${item.itemId}:${item.fieldId}:${opt.id}`, name: opt.name, to: { name: opt.name, category: statusOptionCategory(opt.name) }, ...base });

    const openClose: Transition[] =
      issue.data.state === 'closed'
        ? [{ id: 'reopen', name: 'Reopen', to: { name: 'Open', category: 'todo' }, ...base }]
        : [
            { id: 'close', name: 'Close as done', to: { name: 'Closed', category: 'done' }, ...base },
            { id: 'close_not_planned', name: 'Close as not planned', to: { name: 'Closed', category: 'done' }, ...base },
          ];
    return [...status, ...openClose];
  },
  transition: async (connection, taskKey, transition, fetch) => {
    // A project Status change: id is "proj:<projectId>:<itemId>:<fieldId>:<optionId>" (node ids carry no colon).
    const parts = transition.id.split(':');
    if (parts[0] === 'proj') {
      const [, projectId, itemId, fieldId, optionId] = parts;
      const mutation = `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){clientMutationId}}`;
      const res = await graphql(connection, mutation, { p: projectId, i: itemId, f: fieldId, o: optionId }, fetch);
      const err = z.object({ errors: z.array(z.object({ message: z.string() })).nullish() }).safeParse(res);
      if (err.data?.errors?.length) throw new ProviderError('invalid_response', err.data.errors[0]!.message);
      return;
    }
    const { owner, repo, number } = parseKey(taskKey);
    const body =
      transition.id === 'reopen'
        ? { state: 'open', state_reason: 'reopened' }
        : { state: 'closed', state_reason: transition.id === 'close_not_planned' ? 'not_planned' : 'completed' };
    await request(fetch, `${API}/repos/${owner}/${repo}/issues/${number}`, { method: 'PATCH', headers: jsonHeaders(connection), body: JSON.stringify(body) });
  },
  getChildren: async (connection, task, fetch) => {
    const { owner, repo, number } = parseKey(task.key);
    const issues = await allPages(connection, `${API}/repos/${owner}/${repo}/issues/${number}/sub_issues?per_page=100`, issueSchema, fetch);
    return issues.map((i) => toTask(i, connection));
  },
  getComments: async (connection, taskKey, fetch) => {
    const { owner, repo, number } = parseKey(taskKey);
    // Oldest first, every page: on a long thread the newest comments are on the last page.
    const [comments, me] = await Promise.all([
      allPages(connection, `${API}/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`, commentSchema, fetch),
      meLogin(connection, fetch),
    ]);
    return comments.map((c) => toComment(c, me));
  },
  addComment: async (connection, taskKey, text, fetch) => {
    if (!text.trim()) throw new ProviderError('invalid_input', 'Empty comment');
    const { owner, repo, number } = parseKey(taskKey);
    const [res, me] = await Promise.all([
      request(fetch, `${API}/repos/${owner}/${repo}/issues/${number}/comments`, { method: 'POST', headers: jsonHeaders(connection), body: JSON.stringify({ body: text.trim() }) }),
      meLogin(connection, fetch),
    ]);
    const parsed = commentSchema.safeParse(res);
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected GitHub response');
    return toComment(parsed.data, me);
  },
  deleteComment: async (connection, taskKey, commentId, fetch) => {
    const { owner, repo } = parseKey(taskKey);
    if (!/^\d+$/.test(commentId)) throw new ProviderError('invalid_input', 'Not a comment id');
    await request(fetch, `${API}/repos/${owner}/${repo}/issues/comments/${commentId}`, { method: 'DELETE', headers: headers(connection) });
  },
};
