import { z } from 'zod';
import { ProviderError, request } from '../../errors';
import type { Comment, Connection, Fetch, Provider, StatusCategory, Task, Transition } from '../../types';

// Azure DevOps mark (devicon).
const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="adoG" x1="9" x2="9" y1="16.97" y2="1.03" gradientTransform="scale(7.11111)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0078d4"/><stop offset=".16" stop-color="#1380da"/><stop offset=".53" stop-color="#3c91e5"/><stop offset=".82" stop-color="#559cec"/><stop offset="1" stop-color="#5ea0ef"/></linearGradient></defs><path fill="url(#adoG)" d="M120.89 28.445v69.262l-28.445 23.324l-44.09-16.07v15.93L23.395 88.25l72.746 5.688V31.574ZM96.64 31.93L55.82 7.11v16.285L18.348 34.418L7.109 48.852v32.785l16.075 7.11V46.718Zm0 0"/></svg>';

/** The organization from a pasted value: "myorg", dev.azure.com/myorg/… (with or without https://) or legacy myorg.visualstudio.com. */
export function orgOf(input: string): string {
  const s = input.trim().replace(/^https?:\/\//i, '');
  const org =
    /^dev\.azure\.com\/([^/?#]+)/i.exec(s)?.[1] ?? /^([^./?#]+)\.visualstudio\.com/i.exec(s)?.[1] ?? s.replace(/[/?#].*$/, '');
  if (!/^[\w.-]+$/.test(org)) throw new ProviderError('invalid_input', 'Not a valid Azure DevOps organization');
  return org;
}
const base = (connection: Connection) => `https://dev.azure.com/${orgOf(connection.values.org ?? '')}`;
// PAT over Basic auth with an empty username.
const headers = (connection: Connection): HeadersInit => ({ Authorization: `Basic ${btoa(`:${connection.values.pat ?? ''}`)}` });
const jsonHeaders = (connection: Connection): HeadersInit => ({ ...headers(connection), 'Content-Type': 'application/json' });
const patchHeaders = (connection: Connection): HeadersInit => ({ ...headers(connection), 'Content-Type': 'application/json-patch+json' });
// Work-item comments stayed in preview across the 7.x line.
const COMMENTS = 'api-version=7.1-preview.4';

const COMPLETED = 'Microsoft.VSTS.Scheduling.CompletedWork';
const ESTIMATE = 'Microsoft.VSTS.Scheduling.OriginalEstimate';
const FIELDS = ['System.Title', 'System.State', 'System.WorkItemType', 'System.TeamProject', 'System.AssignedTo', 'System.CreatedDate', 'System.ChangedDate', COMPLETED, ESTIMATE];
// Items assigned to the signed-in user that aren't finished; @Me resolves to the token's owner.
// shortcut: excludes the stock "finished" state names only (WIQL can't filter by state category); a custom process's
// own done state, or Agile/CMMI "Resolved", still shows. Upgrade: read each type's states and drop Completed ones.
const WIQL =
  "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' AND [System.State] <> 'Done' ORDER BY [System.ChangedDate] DESC";

const wiqlSchema = z.object({ workItems: z.array(z.object({ id: z.number() })).nullish() });
const itemSchema = z.object({
  id: z.number(),
  fields: z.object({
    'System.Title': z.string(),
    'System.State': z.string().nullish(),
    'System.WorkItemType': z.string().nullish(),
    'System.TeamProject': z.string().nullish(),
    'System.CreatedDate': z.string().nullish(),
    'System.ChangedDate': z.string().nullish(),
    'System.AssignedTo': z.object({ displayName: z.string().nullish(), id: z.string().nullish() }).nullish(),
    [COMPLETED]: z.number().nullish(),
    [ESTIMATE]: z.number().nullish(),
  }),
});
const itemsSchema = z.object({ value: z.array(itemSchema) });

const commentSchema = z.object({
  id: z.number(),
  text: z.string().nullish(),
  createdDate: z.string().nullish(),
  createdBy: z.object({ displayName: z.string().nullish(), id: z.string().nullish() }).nullish(),
});
const commentsSchema = z.object({ comments: z.array(commentSchema) });

/** Azure's state categories mapped onto our three buckets. */
function categoryOf(stateCategory: string | null | undefined): StatusCategory {
  if (stateCategory === 'InProgress') return 'in_progress';
  if (stateCategory === 'Completed' || stateCategory === 'Resolved' || stateCategory === 'Removed') return 'done';
  return 'todo'; // Proposed
}

/** Maps a single work item's State name (not its category) onto our buckets, for the task list. */
function statusCategory(state: string | undefined): StatusCategory {
  const s = (state ?? '').toLowerCase();
  if (['closed', 'done', 'removed', 'resolved', 'completed'].includes(s)) return 'done';
  if (['active', 'doing', 'in progress', 'committed'].includes(s)) return 'in_progress';
  return 'todo';
}

const hoursToSeconds = (hours: number | null | undefined) => (hours ? Math.round(hours * 3600) : undefined);

function idOf(key: string): string {
  const id = key.replace(/^#/, '');
  if (!/^\d+$/.test(id)) throw new ProviderError('invalid_input', 'Not a work item id');
  return id;
}

/** A work item's comments URL. Comments live under the project, which the "#123" key doesn't carry, so read it first. */
async function commentsUrl(connection: Connection, taskKey: string, fetch: Fetch): Promise<string> {
  const ctx = base(connection);
  const id = idOf(taskKey);
  const wi = z
    .object({ fields: z.object({ 'System.TeamProject': z.string() }) })
    .safeParse(await request(fetch, `${ctx}/_apis/wit/workitems/${id}?fields=System.TeamProject&api-version=7.1`, { headers: headers(connection) }));
  if (!wi.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
  return `${ctx}/${encodeURIComponent(wi.data.fields['System.TeamProject'])}/_apis/wit/workItems/${id}/comments`;
}

/** Id of the connected account, to mark the user's own comments; undefined if it can't be read. */
async function meId(connection: Connection, fetch: Fetch): Promise<string | undefined> {
  const r = z
    .object({ authenticatedUser: z.object({ id: z.string() }).nullish() })
    .safeParse(await request(fetch, `${base(connection)}/_apis/connectionData`, { headers: headers(connection) }));
  return r.success ? r.data.authenticatedUser?.id : undefined;
}

// Azure comment text is HTML; reduce it to plain text for display and search.
function stripHtml(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function toComment(c: z.infer<typeof commentSchema>, me: string | undefined): Comment {
  return {
    id: String(c.id),
    author: c.createdBy?.displayName ?? undefined,
    mine: !!c.createdBy?.id && c.createdBy.id === me,
    created: c.createdDate ?? new Date().toISOString(),
    text: stripHtml(c.text),
  };
}

export const azure: Provider = {
  id: 'azure',
  name: 'Azure DevOps',
  appName: 'Azure DevOps',
  logo: LOGO,
  docsUrl: 'https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
  fields: [
    { key: 'org', type: 'text', placeholder: 'my-organization', label: { tr: 'Kuruluş (organization)', en: 'Organization' } },
    { key: 'pat', type: 'secret', label: { tr: 'Personal access token', en: 'Personal access token' } },
  ],
  guide: [
    {
      text: {
        tr: 'Kuruluş adın dev.azure.com/<kuruluş> adresindeki kısımdır.',
        en: 'Your organization is the <org> part of dev.azure.com/<org>.',
      },
    },
    {
      text: {
        tr: 'Azure DevOps → User settings → Personal access tokens → New Token. “Work Items (Read & write)” izni yorum ve durum değişikliği için yeter.',
        en: 'Azure DevOps → User settings → Personal access tokens → New Token. “Work Items (Read & write)” covers comments and status changes.',
      },
      link: 'https://learn.microsoft.com/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
    },
    {
      text: {
        tr: 'Token’ı kopyala ve Personal access token alanına yapıştır. Sayfadan ayrılınca tekrar gösterilmez.',
        en: 'Copy the token and paste it into the Personal access token field. It is not shown again.',
      },
    },
  ],
  // Called on every keystroke to prefill the board name, so it must never throw on an empty or half-typed org.
  defaultName: (values) => {
    try {
      return orgOf(values.org ?? '') || 'Azure DevOps';
    } catch {
      return 'Azure DevOps';
    }
  },
  validate: async (connection, fetch) => {
    // The same WIQL query the list runs: it needs only "Work Items (Read)", which the guide asks for. (Listing
    // projects would also need "Project and Team" scope and reject a token made per the guide.)
    const parsed = wiqlSchema.safeParse(
      await request(fetch, `${base(connection)}/_apis/wit/wiql?$top=1&api-version=7.1`, {
        method: 'POST',
        headers: jsonHeaders(connection),
        body: JSON.stringify({ query: WIQL }),
      }),
    );
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
  },
  fetchMyTasks: async (connection, fetch) => {
    const ctx = base(connection);
    const query = wiqlSchema.safeParse(
      await request(fetch, `${ctx}/_apis/wit/wiql?api-version=7.1`, { method: 'POST', headers: jsonHeaders(connection), body: JSON.stringify({ query: WIQL }) }),
    );
    if (!query.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
    const ids = (query.data.workItems ?? []).map((w) => w.id);
    // The batch read takes at most 200 ids per request.
    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
    const pages = await Promise.all(
      batches.map(async (batch) => {
        const page = itemsSchema.safeParse(
          await request(fetch, `${ctx}/_apis/wit/workitems?ids=${batch.join(',')}&fields=${FIELDS.join(',')}&api-version=7.1`, { headers: headers(connection) }),
        );
        if (!page.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
        return page.data.value;
      }),
    );
    return pages.flat().map((w): Task => {
      const f = w.fields;
      const project = f['System.TeamProject'];
      const a = f['System.AssignedTo'];
      return {
        id: `${connection.id}:${w.id}`,
        key: `#${w.id}`,
        title: f['System.Title'],
        status: f['System.State'] ?? '',
        statusCategory: statusCategory(f['System.State'] ?? undefined),
        type: f['System.WorkItemType'] ?? undefined,
        project: project ?? undefined,
        assignee: a?.id ? { id: a.id, name: a.displayName ?? '' } : undefined,
        estimateSeconds: hoursToSeconds(f[ESTIMATE]),
        loggedSeconds: hoursToSeconds(f[COMPLETED]),
        url: project ? `${ctx}/${encodeURIComponent(project)}/_workitems/edit/${w.id}` : `${ctx}/_workitems/edit/${w.id}`,
        connectionId: connection.id,
        updatedAt: f['System.ChangedDate'] ?? new Date().toISOString(),
        createdAt: f['System.CreatedDate'] ?? undefined,
      };
    });
  },
  getTransitions: async (connection, taskKey, fetch): Promise<Transition[]> => {
    const ctx = base(connection);
    const id = idOf(taskKey);
    const wi = z
      .object({ fields: z.object({ 'System.WorkItemType': z.string(), 'System.State': z.string(), 'System.TeamProject': z.string() }) })
      .safeParse(
        await request(fetch, `${ctx}/_apis/wit/workitems/${id}?fields=System.WorkItemType,System.State,System.TeamProject&api-version=7.1`, { headers: headers(connection) }),
      );
    if (!wi.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
    const { 'System.WorkItemType': type, 'System.State': current, 'System.TeamProject': project } = wi.data.fields;
    // Allowed states come from the work item type in that project.
    const states = z
      .object({ value: z.array(z.object({ name: z.string(), stateCategory: z.string().nullish() })) })
      .safeParse(
        await request(fetch, `${ctx}/${encodeURIComponent(project)}/_apis/wit/workitemtypes/${encodeURIComponent(type)}/states?api-version=7.1`, { headers: headers(connection) }),
      );
    if (!states.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
    return states.data.value
      .filter((s) => s.name !== current)
      .map((s): Transition => ({ id: s.name, name: s.name, to: { name: s.name, category: categoryOf(s.stateCategory) }, fields: [], allowsComment: false, needsInput: false }));
  },
  transition: async (connection, taskKey, transition, fetch) => {
    const id = idOf(taskKey);
    await request(fetch, `${base(connection)}/_apis/wit/workitems/${id}?api-version=7.1`, {
      method: 'PATCH',
      headers: patchHeaders(connection),
      body: JSON.stringify([{ op: 'add', path: '/fields/System.State', value: transition.id }]),
    });
  },
  getComments: async (connection, taskKey, fetch) => {
    const [list, me] = await Promise.all([
      commentsUrl(connection, taskKey, fetch).then((url) => request(fetch, `${url}?${COMMENTS}`, { headers: headers(connection) })),
      meId(connection, fetch),
    ]);
    const parsed = commentsSchema.safeParse(list);
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
    // Azure returns newest first; the UI expects oldest first.
    return parsed.data.comments.map((c) => toComment(c, me)).reverse();
  },
  addComment: async (connection, taskKey, text, fetch) => {
    if (!text.trim()) throw new ProviderError('invalid_input', 'Empty comment');
    const [res, me] = await Promise.all([
      commentsUrl(connection, taskKey, fetch).then((url) =>
        request(fetch, `${url}?${COMMENTS}`, { method: 'POST', headers: jsonHeaders(connection), body: JSON.stringify({ text: text.trim() }) }),
      ),
      meId(connection, fetch),
    ]);
    const parsed = commentSchema.safeParse(res);
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected Azure DevOps response');
    return toComment(parsed.data, me);
  },
  deleteComment: async (connection, taskKey, commentId, fetch) => {
    if (!/^\d+$/.test(commentId)) throw new ProviderError('invalid_input', 'Not a comment id');
    await request(fetch, `${await commentsUrl(connection, taskKey, fetch)}/${commentId}?${COMMENTS}`, { method: 'DELETE', headers: headers(connection) });
  },
};
