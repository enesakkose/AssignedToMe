import { z } from 'zod';
import { ProviderError, request } from '../../errors';
import type { Connection, Fetch, Provider, StatusCategory, Task, Transition } from '../../types';
import { dataCenterBase } from '../jira';

// Official Bitbucket mark (Simple Icons), in Atlassian blue.
const LOGO =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#2684FF" d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/></svg>';

const PAGE_SIZE = 50;
// shortcut: stops after 5 pages (250 PRs) per query; raise if someone really reviews more open PRs at once.
const MAX_PAGES = 5;

const userSchema = z.object({ name: z.string(), slug: z.string(), displayName: z.string().optional(), active: z.boolean().optional() });
// A reviewer/author entry: status is the person's review state, UNAPPROVED until they act.
const participantSchema = z.object({
  user: userSchema,
  role: z.string().optional(),
  approved: z.boolean().optional(),
  status: z.string().optional(),
});
const repoSchema = z.object({ slug: z.string(), name: z.string().optional(), project: z.object({ key: z.string(), name: z.string().optional() }) });
const refSchema = z.object({ repository: repoSchema });
const prSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullish(),
  state: z.string(),
  createdDate: z.number().optional(),
  updatedDate: z.number().optional(),
  toRef: refSchema,
  author: participantSchema.nullish(),
  reviewers: z.array(participantSchema).nullish(),
  links: z.object({ self: z.array(z.object({ href: z.string() })) }).nullish(),
});
type PullRequest = z.infer<typeof prSchema>;

const pageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ values: z.array(item), isLastPage: z.boolean().optional(), nextPageStart: z.number().nullish() });
const usersPageSchema = pageSchema(userSchema);

type Ctx = { connection: Connection; base: string; init: RequestInit; fetch: Fetch };

function context(connection: Connection, fetch: Fetch): Ctx {
  const token = connection.values.token?.trim();
  if (!token) throw new ProviderError('invalid_input', 'An HTTP access token is required');
  return {
    connection,
    base: dataCenterBase(connection.values.domain ?? ''),
    init: { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
    fetch,
  };
}

const api = (ctx: Ctx, path: string) => `${ctx.base}/rest/api/1.0${path}`;

function unexpected(error: z.ZodError) {
  const issue = error.issues[0];
  return new ProviderError('invalid_response', `Unexpected Bitbucket response at ${issue?.path.join('.') || '(root)'}: ${issue?.message ?? ''}`);
}

/** The key carries project/repo so a PR can be addressed from its key alone: "PROJ/repo#123". */
function parseKey(key: string): { project: string; repo: string; id: string } {
  const hash = key.lastIndexOf('#');
  const id = key.slice(hash + 1);
  const slash = key.indexOf('/');
  if (hash < 0 || slash < 0 || slash > hash || !/^\d+$/.test(id)) throw new ProviderError('invalid_input', 'Not a Bitbucket PR key');
  return { project: key.slice(0, slash), repo: key.slice(slash + 1, hash), id };
}

/** Bitbucket DC returns the signed-in username in the X-AUSERNAME header on any authenticated call. */
async function fetchUsername(ctx: Ctx): Promise<string> {
  let res: Response;
  try {
    res = await ctx.fetch(api(ctx, '/inbox/pull-requests/count'), ctx.init);
  } catch {
    throw new ProviderError('network', 'Network request failed');
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('unauthorized', 'Credentials rejected', res.status);
  if (!res.ok) throw new ProviderError('http', `HTTP ${res.status}`, res.status);
  const username = res.headers.get('X-AUSERNAME');
  if (!username || username === 'anonymous') throw new ProviderError('unauthorized', 'Not signed in', res.status);
  return username;
}

// shortcut: caches the connected account per base for the app's lifetime; fine until someone swaps tokens mid-session.
const meCache = new Map<string, Promise<{ username: string; slug: string }>>();
function currentUser(ctx: Ctx) {
  let me = meCache.get(ctx.base);
  if (!me) {
    me = (async () => {
      const username = await fetchUsername(ctx);
      // The participant path takes a userSlug; it usually equals the username, but resolve it to be safe.
      let slug = username;
      try {
        const parsed = usersPageSchema.safeParse(await request(ctx.fetch, `${api(ctx, '/users')}?filter=${encodeURIComponent(username)}&limit=25`, ctx.init));
        if (parsed.success) slug = parsed.data.values.find((u) => u.name === username)?.slug ?? slug;
      } catch {
        // A locked-down token can't list users; the username is a good-enough slug.
      }
      return { username, slug };
    })();
    me.catch(() => meCache.delete(ctx.base));
    meCache.set(ctx.base, me);
  }
  return me;
}

/** My review status on a PR (I'm always a reviewer here), or UNAPPROVED when it can't be read. */
function myStatus(pr: PullRequest, username: string): string {
  return pr.reviewers?.find((r) => r.user.name === username)?.status?.toUpperCase() ?? 'UNAPPROVED';
}

function statusLabel(status: string): { status: string; statusCategory: StatusCategory } {
  if (status === 'APPROVED') return { status: 'Approved', statusCategory: 'done' };
  if (status === 'NEEDS_WORK') return { status: 'Needs work', statusCategory: 'in_progress' };
  return { status: 'Needs review', statusCategory: 'todo' };
}

async function page<T extends z.ZodTypeAny>(ctx: Ctx, path: string, item: T): Promise<z.infer<T>[]> {
  const schema = pageSchema(item);
  const all: z.infer<T>[] = [];
  let start = 0;
  for (let p = 0; p < MAX_PAGES; p++) {
    const sep = path.includes('?') ? '&' : '?';
    const parsed = schema.safeParse(await request(ctx.fetch, `${api(ctx, path)}${sep}limit=${PAGE_SIZE}&start=${start}`, ctx.init));
    if (!parsed.success) throw unexpected(parsed.error);
    all.push(...parsed.data.values);
    if (parsed.data.isLastPage !== false || parsed.data.nextPageStart == null) break;
    start = parsed.data.nextPageStart;
  }
  return all;
}

function prUrl(ctx: Ctx, pr: PullRequest, project: string, repo: string): string {
  const self = pr.links?.self?.[0]?.href;
  if (self && /^https?:\/\//.test(self)) return self;
  return `${ctx.base}/projects/${project}/repos/${repo}/pull-requests/${pr.id}/overview`;
}

function toTask(ctx: Ctx, pr: PullRequest, username: string): Task {
  const repo = pr.toRef.repository;
  const project = repo.project.key;
  return {
    id: `${ctx.connection.id}:${pr.id}`,
    key: `${project}/${repo.slug}#${pr.id}`,
    title: pr.title,
    ...statusLabel(myStatus(pr, username)),
    type: 'Pull request',
    project: repo.name ?? repo.slug,
    // PR descriptions are untrusted markdown; keep as plain text, never rendered as HTML.
    description: pr.description?.trim() || undefined,
    url: prUrl(ctx, pr, project, repo.slug),
    connectionId: ctx.connection.id,
    updatedAt: new Date(pr.updatedDate ?? Date.now()).toISOString(),
    createdAt: pr.createdDate ? new Date(pr.createdDate).toISOString() : undefined,
  };
}

/** The review statuses offered as "transitions", minus the one I'm already in. */
const REVIEW_STATES: { status: string; name: string; to: { name: string; category: StatusCategory } }[] = [
  { status: 'APPROVED', name: 'Approve', to: { name: 'Approved', category: 'done' } },
  { status: 'NEEDS_WORK', name: 'Request changes', to: { name: 'Needs work', category: 'in_progress' } },
  { status: 'UNAPPROVED', name: 'Reset review', to: { name: 'Needs review', category: 'todo' } },
];

export const bitbucket: Provider = {
  id: 'bitbucket-dc',
  name: 'Bitbucket Data Center',
  appName: 'Bitbucket',
  logo: LOGO,
  docsUrl: 'https://confluence.atlassian.com/bitbucketserver/http-access-tokens-939515499.html',
  fields: [
    { key: 'domain', type: 'url', placeholder: 'bitbucket.company.com', label: { tr: 'Bitbucket adresi', en: 'Bitbucket address' } },
    { key: 'token', type: 'secret', label: { tr: 'HTTP erişim token’ı', en: 'HTTP access token' } },
  ],
  guide: [
    {
      text: {
        tr: 'Önemli: Bitbucket’ınız VPN arkasındaysa bağlı olduğunuzdan emin olun — uygulama sunucuya doğrudan cihazınızdan erişir. Bağlantının en sık başarısız olma nedeni budur.',
        en: 'Important: If your Bitbucket is behind a VPN, make sure you’re connected to it — the app reaches the server directly from your device. This is the most common reason a connection fails.',
      },
    },
    {
      text: {
        tr: 'Bitbucket adresin, Bitbucket açıkken tarayıcının adres çubuğundaki adres (örn. bitbucket.sirket.com).',
        en: 'Your Bitbucket address is what the browser shows while Bitbucket is open (e.g. bitbucket.company.com).',
      },
    },
    {
      text: {
        tr: 'Bitbucket’ta sağ üstteki avatarın → Manage account → HTTP access tokens → Create token. Onaylamak için “Repository Read”, birleştirmek (merge) için “Repository Write” iznini seç. Bu sayfayı tarayıcıda açabilirsin:',
        en: 'In Bitbucket, your avatar (top right) → Manage account → HTTP access tokens → Create token. Pick “Repository Read” to approve, or “Repository Write” to also merge. You can open the page in your browser:',
      },
      copy: 'https://{domain}/plugins/servlet/access-tokens/manage',
      link: 'https://confluence.atlassian.com/bitbucketserver/http-access-tokens-939515499.html',
    },
    {
      text: {
        tr: 'Token’ı kopyala ve HTTP erişim token’ı alanına yapıştır; sadece bir kez gösterilir. Token yalnızca bu Mac’in Anahtar Zinciri’nde saklanır.',
        en: 'Copy the token into the HTTP access token field; it is shown only once. The token is stored only in this Mac’s Keychain.',
      },
    },
    {
      text: {
        tr: 'İstersen terminalde dene; sayı dönüyorsa token doğru.',
        en: 'Optionally test it in a terminal; it works if a count comes back.',
      },
      copy: 'curl -H "Authorization: Bearer <TOKEN>" https://{domain}/rest/api/1.0/inbox/pull-requests/count',
    },
  ],
  defaultName: (values) => {
    try {
      return new URL(dataCenterBase(values.domain ?? '')).hostname.split('.')[0] ?? 'Bitbucket';
    } catch {
      return 'Bitbucket';
    }
  },
  validate: async (connection, fetch) => {
    const ctx = context(connection, fetch);
    await request(fetch, api(ctx, '/inbox/pull-requests/count'), ctx.init);
  },
  fetchMyTasks: async (connection, fetch) => {
    const ctx = context(connection, fetch);
    const me = await currentUser(ctx);
    // shortcut: reviewer-only; to also show PRs I authored, page role=AUTHOR too and merge by id.
    const prs = await page(ctx, '/dashboard/pull-requests?role=REVIEWER&state=OPEN', prSchema);
    return prs.map((pr) => toTask(ctx, pr, me.username));
  },
  getTransitions: async (connection, taskKey, fetch): Promise<Transition[]> => {
    const ctx = context(connection, fetch);
    const { project, repo, id } = parseKey(taskKey);
    const [body, me] = await Promise.all([
      request(fetch, api(ctx, `/projects/${project}/repos/${repo}/pull-requests/${id}`), ctx.init),
      currentUser(ctx),
    ]);
    const parsed = prSchema.safeParse(body);
    if (!parsed.success) throw unexpected(parsed.error);
    const current = myStatus(parsed.data, me.username);
    return REVIEW_STATES.filter((s) => s.status !== current).map((s) => ({
      id: s.status,
      name: s.name,
      to: s.to,
      fields: [],
      allowsComment: false,
      needsInput: false,
    }));
  },
  transition: async (connection, taskKey, transition, fetch) => {
    const ctx = context(connection, fetch);
    const { project, repo, id } = parseKey(taskKey);
    const me = await currentUser(ctx);
    // Changing my own participant status approves / requests changes / resets. REPO_READ is enough.
    await request(fetch, api(ctx, `/projects/${project}/repos/${repo}/pull-requests/${id}/participants/${encodeURIComponent(me.slug)}`), {
      method: 'PUT',
      headers: { ...ctx.init.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: { name: me.username }, status: transition.id }),
    });
  },
  // shortcut: no merge action yet (needs REPO_WRITE); add POST .../pull-requests/{id}/merge?version=N, gated on write access.
};
