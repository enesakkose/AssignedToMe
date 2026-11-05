import { z } from 'zod';
import { ProviderError, request } from '../../errors';
import type { Connection, Fetch, Provider, StatusCategory, Task } from '../../types';

const ENDPOINT = 'https://api.linear.app/graphql';

// Official Linear mark (Simple Icons), single path in the brand colour.
const LOGO =
  '<svg fill="#5E6AD2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"/></svg>';

const issueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  url: z.string(),
  priority: z.number().nullish(),
  priorityLabel: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  description: z.string().nullish(),
  state: z.object({ name: z.string(), type: z.string() }).nullish(),
  team: z.object({ name: z.string() }).nullish(),
  project: z.object({ name: z.string() }).nullish(),
});
type Issue = z.infer<typeof issueSchema>;

const gqlError = z.array(z.object({ message: z.string() })).nullish();
const viewerSchema = z.object({ data: z.object({ viewer: z.object({ id: z.string() }).nullish() }).nullish(), errors: gqlError });
const tasksSchema = z.object({
  data: z
    .object({
      viewer: z
        .object({
          assignedIssues: z.object({
            nodes: z.array(issueSchema),
            pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullish() }).nullish(),
          }),
        })
        .nullish(),
    })
    .nullish(),
  errors: gqlError,
});

/** Linear accepts a personal API key straight in the Authorization header (no "Bearer"). */
const headers = (connection: Connection): HeadersInit => ({
  Authorization: connection.values.apiKey ?? '',
  'Content-Type': 'application/json',
});

const gql = (connection: Connection, fetch: Fetch, query: string, variables?: Record<string, unknown>) =>
  request(fetch, ENDPOINT, { method: 'POST', headers: headers(connection), body: JSON.stringify({ query, variables }) });

// Linear's workflow-state types; `completed`/`canceled` are filtered out server-side, the rest are open.
export function statusCategory(type: string | undefined): StatusCategory {
  if (type === 'completed' || type === 'canceled') return 'done';
  if (type === 'started') return 'in_progress';
  return 'todo';
}

// Linear priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low → our 5..1 scale (urgent highest).
export const PRIORITY_LEVEL: Record<number, 5 | 4 | 3 | 2> = { 1: 5, 2: 4, 3: 3, 4: 2 };

// Issues assigned to the signed-in user that aren't done; `viewer` is whoever the key belongs to. Paged by cursor.
const ASSIGNED_QUERY = `query ($after: String) {
  viewer {
    assignedIssues(first: 100, after: $after, filter: { completedAt: { null: true }, canceledAt: { null: true } }) {
      nodes {
        id identifier title url priority priorityLabel createdAt updatedAt description
        state { name type }
        team { name }
        project { name }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;
// shortcut: stops after this many pages (2,000 issues) so a runaway cursor can't loop forever; nobody has more assigned.
const MAX_PAGES = 20;

function firstError(errors: { message: string }[] | null | undefined) {
  return errors?.length ? errors[0]!.message : undefined;
}

function toTask(connection: Connection, n: Issue): Task {
  const level = n.priority ? PRIORITY_LEVEL[n.priority] : undefined;
  return {
    id: `${connection.id}:${n.id}`,
    key: n.identifier,
    title: n.title,
    status: n.state?.name ?? '',
    statusCategory: statusCategory(n.state?.type),
    priority: level ? (n.priorityLabel ?? undefined) : undefined,
    priorityLevel: level,
    project: n.project?.name ?? n.team?.name,
    description: n.description || undefined,
    url: n.url,
    connectionId: connection.id,
    updatedAt: n.updatedAt ?? new Date().toISOString(),
    createdAt: n.createdAt ?? undefined,
  };
}

export const linear: Provider = {
  id: 'linear',
  name: 'Linear',
  appName: 'Linear',
  logo: LOGO,
  docsUrl: 'https://linear.app/settings/account/security',
  fields: [{ key: 'apiKey', type: 'secret', label: { tr: 'API anahtarı', en: 'API key' } }],
  guide: [
    {
      text: {
        tr: 'Linear’da Settings → Account → Security & access → Personal API keys bölümünü aç. Bölüm yoksa ya da anahtar oluşturamıyorsan, workspace admin’inin Settings → Administration → API altında üyelerin API anahtarı oluşturmasına izin vermesi gerekir.',
        en: 'In Linear open Settings → Account → Security & access → Personal API keys. If it’s missing or you can’t create a key, a workspace admin has to allow member API keys under Settings → Administration → API.',
      },
      link: 'https://linear.app/settings/account/security',
    },
    {
      text: {
        tr: '“New API key” ile bir anahtar oluştur ve bir isim ver (kopyalayabilirsin). İzinlerde “Read” (ya da Full access) seç; takımlarda tüm takımları bırak, yoksa dışarıda kalan takımların görevleri görünmez.',
        en: 'Create one with “New API key” and give it a name (you can copy this one). For permissions pick “Read” (or Full access); leave all teams selected, or issues from teams left out won’t show.',
      },
      copy: 'AssignedToMe',
    },
    {
      text: {
        tr: 'Anahtarı kopyala ve API anahtarı alanına yapıştır. Sayfadan ayrılınca tekrar gösterilmez.',
        en: 'Copy the key and paste it into the API key field. It is not shown again after you leave.',
      },
    },
  ],
  defaultName: () => 'Linear',
  validate: async (connection, fetch) => {
    const parsed = viewerSchema.safeParse(await gql(connection, fetch, 'query { viewer { id } }'));
    if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected Linear response');
    const message = firstError(parsed.data.errors);
    if (message) throw new ProviderError('unauthorized', message);
    if (!parsed.data.data?.viewer?.id) throw new ProviderError('unauthorized', 'Linear rejected the API key');
  },
  fetchMyTasks: async (connection, fetch) => {
    const issues: Issue[] = [];
    let after: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const parsed = tasksSchema.safeParse(await gql(connection, fetch, ASSIGNED_QUERY, { after }));
      if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected Linear response');
      const message = firstError(parsed.data.errors);
      if (message) throw new ProviderError('unauthorized', message);
      const assigned = parsed.data.data?.viewer?.assignedIssues;
      issues.push(...(assigned?.nodes ?? []));
      if (!assigned?.pageInfo?.hasNextPage || !assigned.pageInfo.endCursor) break;
      after = assigned.pageInfo.endCursor;
    }
    return issues.map((n) => toTask(connection, n));
  },
};
