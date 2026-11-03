import { z } from 'zod';
import { ProviderError, request } from '../../errors';
import { priorityLevel } from '../../priority';
import type {
  Attachment,
  Comment,
  TransitionField,
  TransitionInput,
  Connection,
  Fetch,
  GuideStep,
  Person,
  Provider,
  RelatedTask,
  ProviderField,
  StatusCategory,
  Subtask,
  Task,
  TaskLink,
  Transition,
  WorkLog,
  WorkLogEntry,
} from '../../types';
import { adfToParts, partsToText, wikiToParts } from './description';

const PAGE_SIZE = 100;
// shortcut: stops after 5 pages (500 issues) per query, raise if someone really has more open tasks.
const MAX_PAGES = 5;
// Jira takes this many users from the whole site, then keeps only the assignable ones, so a page is often short.
const PEOPLE_PAGE = 50;
// Jira never looks past the thousandth user.
const PEOPLE_LIMIT = 1000;
const JQL = 'assignee = currentUser() AND statusCategory != Done ORDER BY created DESC';
const FIELDS =
  'summary,status,priority,updated,created,description,issuetype,project,subtasks,assignee,attachment,' +
  'timeoriginalestimate,timespent,aggregatetimeoriginalestimate,aggregatetimespent,issuelinks,parent';
// Enough for a row in an epic's issue list.
const CHILD_FIELDS = 'summary,status,priority,updated,created,issuetype,assignee,timeoriginalestimate,timespent';
const SUBTASK_FIELDS = 'summary,status,assignee,description,attachment,timeoriginalestimate,timespent,parent,issuelinks';
const SPRINT_FIELD_TYPE = 'com.pyxis.greenhopper.jira:gh-sprint';
// Team-managed projects use the typed field; company-managed ones a number field named "Story Points".
const STORY_POINT_FIELD_TYPE = 'com.pyxis.greenhopper.jira:jsw-story-points';
const STORY_POINT_FIELD_NAMES = new Set(['story points', 'story point estimate']);
const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

const statusSchema = z.object({ name: z.string(), statusCategory: z.object({ key: z.string() }) });

const relatedSchema = z.object({
  key: z.string(),
  fields: z
    .object({ summary: z.string().optional(), status: statusSchema.nullish(), issuetype: z.object({ name: z.string() }).nullish() })
    .optional(),
});
const issueLinkSchema = z.object({
  type: z.object({ name: z.string(), inward: z.string(), outward: z.string() }),
  inwardIssue: relatedSchema.optional(),
  outwardIssue: relatedSchema.optional(),
});

const issueSchema = z.object({
  id: z.string(),
  key: z.string(),
  fields: z
    .object({
      summary: z.string(),
      updated: z.string().optional(),
      created: z.string().optional(),
      status: statusSchema,
      priority: z.object({ name: z.string() }).nullish(),
      issuetype: z.object({ name: z.string() }).nullish(),
      project: z.object({ name: z.string() }).nullish(),
      description: z.unknown().nullish(),
      subtasks: z.array(z.object({ id: z.string() })).nullish(),
      assignee: z.object({ accountId: z.string().optional(), name: z.string().optional(), displayName: z.string() }).nullish(),
      parent: relatedSchema.nullish(),
      issuelinks: z.array(issueLinkSchema).nullish(),
      attachment: z
        .array(
          z.object({
            id: z.union([z.string(), z.number()]),
            filename: z.string(),
            mimeType: z.string().optional(),
            content: z.string(),
            thumbnail: z.string().optional(),
          }),
        )
        .nullish(),
      timeoriginalestimate: z.number().nullish(),
      timespent: z.number().nullish(),
      aggregatetimeoriginalestimate: z.number().nullish(),
      aggregatetimespent: z.number().nullish(),
    })
    .catchall(z.unknown()),
});
type Issue = z.infer<typeof issueSchema>;

const searchSchema = z.object({
  issues: z.array(issueSchema),
  nextPageToken: z.string().nullish(),
  // Data Center pages by offset.
  startAt: z.number().optional(),
  total: z.number().optional(),
});

const sprintsSchema = z.array(z.union([z.object({ name: z.string(), state: z.string().optional() }), z.string()]));
const fieldListSchema = z.array(
  z.object({ id: z.string(), name: z.string().optional(), schema: z.object({ custom: z.string().optional() }).optional() }),
);

type SiteFields = { sprint?: string; storyPoints: string[] };

/** What differs between Jira Cloud and Jira Data Center/Server; everything else is shared. */
type Flavor = {
  id: string;
  name: string;
  docsUrl: string;
  fields: ProviderField[];
  guide: GuideStep[];
  /** REST API version: Cloud 3, Data Center 2. */
  api: '2' | '3';
  /** Validated base URL (origin plus an optional context path) from the user's input. */
  base: (domain: string) => string;
  headers: (connection: Connection) => HeadersInit;
  /** Who is signed in, for per-account caches. */
  identity: (connection: Connection) => string;
  defaultName: (base: string) => string;
  /** Work log comment body: Cloud wants a document, Data Center plain text. */
  comment: (text: string) => unknown;
  assignBody: (personId: string | null) => Record<string, unknown>;
  /** Assignable user search parameter: Cloud `query`, Data Center `username`. */
  userQueryParam: 'query' | 'username';
  /** JQL for an epic's issues: Cloud links them as children, Data Center through the "Epic Link" field. */
  epicChildrenJql: (epicKey: string) => string;
};

type Ctx = { flavor: Flavor; connection: Connection; base: string; init: RequestInit; fetch: Fetch };

function context(flavor: Flavor, connection: Connection, fetch: Fetch): Ctx {
  return { flavor, connection, base: flavor.base(connection.values.domain ?? ''), init: { headers: flavor.headers(connection) }, fetch };
}

const api = (ctx: Ctx, path: string) => `${ctx.base}/rest/api/${ctx.flavor.api}${path}`;
/** Jira Server rejects writes without this header (XSRF check); Cloud ignores it. */
const NO_XSRF = { 'X-Atlassian-Token': 'no-check' };

const json = (ctx: Ctx, method: string, body: unknown): RequestInit => ({
  method,
  headers: { ...ctx.init.headers, ...NO_XSRF, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Says which field broke, so a different server version can be diagnosed from the UI. */
function unexpected(error: z.ZodError) {
  const issue = error.issues[0];
  return new ProviderError('invalid_response', `Unexpected Jira response at ${issue?.path.join('.') || '(root)'}: ${issue?.message ?? ''}`);
}

/** Only sign-in problems should stop a request chain; other failures degrade gracefully. */
const isAuthError = (error: unknown) =>
  error instanceof ProviderError && (error.code === 'unauthorized' || error.code === 'captcha');

// shortcut: field ids are cached per site for the app's lifetime; a newly added sprint field needs an app restart.
const siteFields = new Map<string, Promise<SiteFields>>();
function cachedSiteFields(ctx: Ctx) {
  let fields = siteFields.get(ctx.base);
  if (!fields) {
    fields = findSiteFields(ctx);
    fields.catch(() => siteFields.delete(ctx.base));
    siteFields.set(ctx.base, fields);
  }
  return fields;
}

/** Custom field ids differ per Jira site; find sprint and story points by type or name. Missing ones are skipped. */
async function findSiteFields(ctx: Ctx): Promise<SiteFields> {
  try {
    const parsed = fieldListSchema.safeParse(await request(ctx.fetch, api(ctx, '/field'), ctx.init));
    if (!parsed.success) return { storyPoints: [] };
    return {
      sprint: parsed.data.find((f) => f.schema?.custom === SPRINT_FIELD_TYPE)?.id,
      storyPoints: parsed.data
        .filter((f) => f.schema?.custom === STORY_POINT_FIELD_TYPE || STORY_POINT_FIELD_NAMES.has(f.name?.toLowerCase() ?? ''))
        .map((f) => f.id),
    };
  } catch (error) {
    if (isAuthError(error)) throw error;
    return { storyPoints: [] };
  }
}

/** Data Center 8.x sends sprints as "com.atlassian.greenhopper.service.sprint.Sprint@1a[id=1,state=ACTIVE,name=Sprint 24,...]". */
function parseSprint(value: string | { name: string; state?: string }) {
  if (typeof value !== 'string') return value;
  const name = /[[,]name=([^,\]]*)/.exec(value)?.[1];
  return name ? { name, state: /[[,]state=([^,\]]*)/.exec(value)?.[1]?.toLowerCase() } : undefined;
}

/** Active sprint first, otherwise the latest one the issue was in. */
export function pickSprint(value: unknown): string | undefined {
  const parsed = sprintsSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const sprints = parsed.data.map(parseSprint).filter((s) => !!s);
  return (sprints.find((s) => s.state === 'active') ?? sprints.at(-1))?.name;
}

// Wiki image embeds like !screen.png|thumbnail!; the images are shown from the attachments instead.
function relatedOf(ctx: Ctx, r: z.infer<typeof relatedSchema>): RelatedTask {
  return {
    key: r.key,
    title: r.fields?.summary ?? r.key,
    url: `${ctx.base}/browse/${encodeURIComponent(r.key)}`,
    type: r.fields?.issuetype?.name,
    status: r.fields?.status?.name,
    statusCategory: r.fields?.status ? statusCategory(r.fields.status.statusCategory.key) : undefined,
  };
}

/** Issue links phrased from this task's side: an inward link reads with the type's inward text ("is blocked by"). */
function linksOf(ctx: Ctx, links: z.infer<typeof issueLinkSchema>[] | null | undefined): TaskLink[] | undefined {
  const out = (links ?? []).flatMap((l): TaskLink[] => {
    if (l.inwardIssue) return [{ ...relatedOf(ctx, l.inwardIssue), relation: l.type.inward, blocksThis: l.type.name === 'Blocks' }];
    if (l.outwardIssue) return [{ ...relatedOf(ctx, l.outwardIssue), relation: l.type.outward }];
    return [];
  });
  return out.length ? out : undefined;
}

/** Plain text of a description or comment, in either format. */
function textOf(value: unknown): string {
  return partsToText(typeof value === 'string' ? wikiToParts(value) : adfToParts(value));
}

/** Plain text for search, plus ordered parts when there's a link or an inline image worth showing in place. */
function descriptionOf(value: unknown, attachments: Attachment[] | undefined) {
  const parts = typeof value === 'string' ? wikiToParts(value, attachments) : adfToParts(value, attachments);
  return {
    description: partsToText(parts) || undefined,
    descriptionParts: parts.some((p) => p.type !== 'text') ? parts : undefined,
  };
}

function attachmentsOf(list: Issue['fields']['attachment']): Attachment[] | undefined {
  if (!list?.length) return undefined;
  return list.map((a) => ({
    id: String(a.id),
    name: a.filename,
    mimeType: a.mimeType,
    url: a.content,
    thumbnailUrl: a.thumbnail,
  }));
}

async function search(ctx: Ctx, jql: string, fields: string, limit = PAGE_SIZE * MAX_PAGES): Promise<Issue[]> {
  const issues: Issue[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES && issues.length < limit; page++) {
    const params = new URLSearchParams({ jql, fields, maxResults: String(Math.min(PAGE_SIZE, limit - issues.length)) });
    // Cloud pages with a token on /search/jql; Data Center with an offset on /search.
    if (ctx.flavor.api === '3' && pageToken) params.set('nextPageToken', pageToken);
    if (ctx.flavor.api === '2') params.set('startAt', String(issues.length));
    const path = ctx.flavor.api === '3' ? '/search/jql' : '/search';
    const parsed = searchSchema.safeParse(await request(ctx.fetch, `${api(ctx, path)}?${params}`, ctx.init));
    if (!parsed.success) throw unexpected(parsed.error);
    issues.push(...parsed.data.issues);
    if (ctx.flavor.api === '3') {
      pageToken = parsed.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    } else if (!parsed.data.issues.length || issues.length >= (parsed.data.total ?? 0)) break;
  }
  return issues;
}

/** Sub-tasks of the given parents, grouped by parent key. A failure here hides sub-tasks, not the whole list. */
async function fetchSubtasks(ctx: Ctx, parents: string[]) {
  const byParent = new Map<string, Subtask[]>();
  const keys = parents.filter((k) => ISSUE_KEY.test(k));
  for (let i = 0; i < keys.length; i += 50) {
    let issues: Issue[];
    try {
      issues = await search(ctx, `parent in (${keys.slice(i, i + 50).join(',')}) ORDER BY created ASC`, SUBTASK_FIELDS);
    } catch (error) {
      if (isAuthError(error)) throw error;
      continue;
    }
    for (const { id, key, fields: f } of issues) {
      const parent = f.parent?.key;
      if (!parent) continue;
      const list = byParent.get(parent) ?? [];
      list.push({
        id: `${ctx.connection.id}:${id}`,
        key,
        title: f.summary,
        status: f.status.name,
        statusCategory: statusCategory(f.status.statusCategory.key),
        assignee: f.assignee ? person(f.assignee) : undefined,
        ...descriptionOf(f.description, attachmentsOf(f.attachment)),
        attachments: attachmentsOf(f.attachment),
        estimateSeconds: f.timeoriginalestimate ?? undefined,
        loggedSeconds: f.timespent ?? undefined,
        links: linksOf(ctx, f.issuelinks),
        url: `${ctx.base}/browse/${encodeURIComponent(key)}`,
      });
      byParent.set(parent, list);
    }
  }
  return byParent;
}

const transitionFieldSchema = z.object({
  required: z.boolean().optional(),
  hasDefaultValue: z.boolean().optional(),
  name: z.string().optional(),
  schema: z.object({ type: z.string().optional(), system: z.string().optional(), custom: z.string().optional() }).optional(),
  allowedValues: z
    .array(z.object({ id: z.union([z.string(), z.number()]).optional(), value: z.string().optional(), name: z.string().optional() }))
    .optional(),
});

const transitionsSchema = z.object({
  transitions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isAvailable: z.boolean().optional(),
      hasScreen: z.boolean().optional(),
      to: z.object({ name: z.string(), statusCategory: z.object({ key: z.string() }) }),
      fields: z.record(z.string(), transitionFieldSchema).optional(),
    }),
  ),
});

const SELECT_TYPES = new Set(['option', 'resolution', 'priority']);

/** A transition screen field the app can render, or null when it can't (dates, users, multi-selects…). */
function toTransitionField(key: string, f: z.infer<typeof transitionFieldSchema>): TransitionField | null {
  const type = f.schema?.type;
  const base = { key, name: f.name ?? key, required: !!f.required };
  const options = (f.allowedValues ?? [])
    .filter((v) => v.id !== undefined)
    .map((v) => ({ id: String(v.id), name: v.value ?? v.name ?? String(v.id) }));
  if (type && SELECT_TYPES.has(type) && options.length) return { ...base, kind: 'select', options };
  if (type === 'number') return { ...base, kind: 'number' };
  if (type === 'string') {
    const long = f.schema?.custom?.endsWith(':textarea') || f.schema?.system === 'description' || f.schema?.system === 'environment';
    return { ...base, kind: long ? 'textarea' : 'text' };
  }
  return null;
}

function issuePath(ctx: Ctx, key: string, resource: 'transitions' | 'worklog' | 'assignee' | 'comment') {
  if (!ISSUE_KEY.test(key)) throw new ProviderError('invalid_input', 'Not a Jira issue key');
  return api(ctx, `/issue/${encodeURIComponent(key)}/${resource}`);
}

/** Jira wants local time with a numeric offset: 2026-10-30T09:00:00.000+0300. */
export function jiraDateTime(date: Date): string {
  const pad = (n: number, size = 2) => String(Math.abs(n)).padStart(size, '0');
  const offset = -date.getTimezoneOffset();
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${offset >= 0 ? '+' : '-'}${pad(Math.trunc(offset / 60))}${pad(offset % 60)}`
  );
}

/** Plain text to an Atlassian Document, one paragraph per line. */
function textToAdf(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })),
  };
}

const workLogSchema = z.object({ id: z.string() });
const workLogListSchema = z.object({
  worklogs: z.array(
    z.object({
      id: z.string(),
      author: z.object({ accountId: z.string().optional(), name: z.string().optional(), displayName: z.string().optional() }).nullish(),
      timeSpentSeconds: z.number(),
      started: z.string(),
      comment: z.unknown().nullish(),
    }),
  ),
});
const commentSchema = z.object({
  id: z.string(),
  author: z.object({ accountId: z.string().optional(), name: z.string().optional(), displayName: z.string().optional() }).nullish(),
  body: z.unknown(),
  created: z.string(),
});
const commentPageSchema = z.object({ comments: z.array(commentSchema), total: z.number(), startAt: z.number().optional() });
// The newest this many comments; older ones are a click away in Jira.
const COMMENT_PAGE = 50;

function toComment(c: z.infer<typeof commentSchema>, meId: string, attachments?: Attachment[]): Comment {
  const authorId = c.author?.accountId ?? c.author?.name;
  const { description, descriptionParts } = descriptionOf(c.body, attachments);
  return {
    id: c.id,
    author: c.author?.displayName,
    mine: !!authorId && authorId === meId,
    created: new Date(c.created).toISOString(),
    text: description ?? '',
    parts: descriptionParts,
  };
}

/** My id for marking my own comments; failing to get it only loses that mark, except a sign-in error. */
const myIdOrNone = (ctx: Ctx) =>
  currentUser(ctx).then(
    (u) => u.id,
    (error) => {
      if (isAuthError(error)) throw error;
      return '';
    },
  );

const userSchema = z.object({
  accountId: z.string().optional(),
  name: z.string().optional(),
  displayName: z.string(),
  active: z.boolean().optional(),
});
const usersSchema = z.array(userSchema);

type JiraUser = { accountId?: string; name?: string; displayName: string };
/** Cloud identifies people by accountId, Data Center by username. */
const person = (u: JiraUser): Person => ({ id: u.accountId ?? u.name ?? '', name: u.displayName });

// shortcut: caches the connected account per site+user for the app's lifetime; fine until accounts switch mid-session.
const me = new Map<string, Promise<Person>>();
function currentUser(ctx: Ctx) {
  const cacheKey = `${ctx.base}|${ctx.flavor.identity(ctx.connection)}`;
  let user = me.get(cacheKey);
  if (!user) {
    user = request(ctx.fetch, api(ctx, '/myself'), ctx.init).then((body) => {
      const parsed = userSchema.safeParse(body);
      if (!parsed.success) throw unexpected(parsed.error);
      return person(parsed.data);
    });
    user.catch(() => me.delete(cacheKey));
    me.set(cacheKey, user);
  }
  return user;
}

function firstNumber(fields: Record<string, unknown>, ids: string[]): number | undefined {
  for (const id of ids) if (typeof fields[id] === 'number') return fields[id];
  return undefined;
}

/** Accepts "acme", "acme.atlassian.net" or a full URL; returns the https origin. */
export function jiraOrigin(domain: string): string {
  const raw = domain.trim().replace(/\/+$/, '');
  if (!raw) throw new ProviderError('invalid_input', 'Domain is required');
  const withHost = raw.includes('.') ? raw : `${raw}.atlassian.net`;
  let url: URL;
  try {
    url = new URL(withHost.startsWith('http') ? withHost : `https://${withHost}`);
  } catch {
    throw new ProviderError('invalid_input', 'Domain is not valid');
  }
  // shortcut: Jira Cloud only (email + API token), Data Center needs PAT bearer auth.
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.atlassian.net')) {
    throw new ProviderError('invalid_input', 'Domain must be a Jira Cloud site (*.atlassian.net)');
  }
  return url.origin;
}

/** Any https Jira Data Center/Server URL, keeping a context path like /jira. Returns it without a trailing slash. */
export function dataCenterBase(domain: string): string {
  const raw = domain.trim();
  if (!raw) throw new ProviderError('invalid_input', 'Address is required');
  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    throw new ProviderError('invalid_input', 'Address is not valid');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new ProviderError('invalid_input', 'Address must be https and contain no credentials');
  }
  // Pasted page URLs like /secure/ViewProfile.jspa or /browse/X-1 point at the site root.
  const path = url.pathname.replace(/\/(secure|browse|projects|issues|plugins)\/.*$/, '').replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

function basic(user: string, secret: string) {
  return { Accept: 'application/json', Authorization: `Basic ${btoa(unescape(encodeURIComponent(`${user}:${secret}`)))}` };
}

/** Atlassian Document Format to plain text. */
export function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === 'text') return n.text ?? '';
  if (n.type === 'hardBreak') return '\n';
  const inner = (n.content ?? []).map(adfToText).join('');
  return n.type === 'paragraph' || n.type === 'heading' || n.type === 'listItem' ? `${inner}\n` : inner;
}

function statusCategory(key: string): StatusCategory {
  if (key === 'done' || key === 'completed') return 'done';
  if (key === 'indeterminate' || key === 'in-flight') return 'in_progress';
  return 'todo';
}

function fieldsFor(site: SiteFields) {
  return [FIELDS, site.sprint, ...site.storyPoints].filter(Boolean).join(',');
}

async function toTasks(ctx: Ctx, site: SiteFields, issues: Issue[]) {
  const subtasks = await fetchSubtasks(
    ctx,
    issues.filter((i) => i.fields.subtasks?.length).map((i) => i.key),
  );
  return issues.map(({ id, key, fields: f }): Task => {
    return {
      id: `${ctx.connection.id}:${id}`,
      key,
      title: f.summary,
      status: f.status.name,
      statusCategory: statusCategory(f.status.statusCategory.key),
      priority: f.priority?.name,
      priorityLevel: priorityLevel(f.priority?.name),
      type: f.issuetype?.name,
      project: f.project?.name,
      assignee: f.assignee ? person(f.assignee) : undefined,
      sprint: site.sprint ? pickSprint(f[site.sprint]) : undefined,
      // A story's own estimate, else the sum over its sub-tasks.
      estimateSeconds: f.timeoriginalestimate ?? f.aggregatetimeoriginalestimate ?? undefined,
      loggedSeconds: f.timespent ?? f.aggregatetimespent ?? undefined,
      storyPoints: firstNumber(f, site.storyPoints),
      attachments: attachmentsOf(f.attachment),
      subtasks: subtasks.get(key),
      parent: f.parent ? relatedOf(ctx, f.parent) : undefined,
      links: linksOf(ctx, f.issuelinks),
      ...descriptionOf(f.description, attachmentsOf(f.attachment)),
      url: `${ctx.base}/browse/${encodeURIComponent(key)}`,
      connectionId: ctx.connection.id,
      updatedAt: new Date(f.updated ?? Date.now()).toISOString(),
      createdAt: f.created ? new Date(f.created).toISOString() : undefined,
    };
  });
}

const LOGO =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0052CC" d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z"/></svg>';

function createJira(flavor: Flavor): Provider {
  const ctxOf = (connection: Connection, fetch: Fetch) => context(flavor, connection, fetch);
  return {
    id: flavor.id,
    name: flavor.name,
    appName: 'Jira',
    logo: LOGO,
    docsUrl: flavor.docsUrl,
    fields: flavor.fields,
    guide: flavor.guide,
    defaultName: (values) => {
      try {
        return flavor.defaultName(flavor.base(values.domain ?? ''));
      } catch {
        return flavor.name;
      }
    },
    validate: async (connection, fetch) => {
      const ctx = ctxOf(connection, fetch);
      await request(fetch, api(ctx, '/myself'), ctx.init);
    },
    getTransitions: async (connection, taskKey, fetch): Promise<Transition[]> => {
      const ctx = ctxOf(connection, fetch);
      const path = issuePath(ctx, taskKey, 'transitions');
      // Field details tell which transitions need extra input. Some server plugins break that expansion,
      // so fall back to the plain list (those transitions then fail on submit with the server's own message).
      const body = await request(fetch, `${path}?expand=transitions.fields`, ctx.init).catch((error) => {
        if (isAuthError(error)) throw error;
        return request(fetch, path, ctx.init);
      });
      const res = transitionsSchema.safeParse(body);
      if (!res.success) throw unexpected(res.error);
      return res.data.transitions
        .filter((t) => t.isAvailable !== false)
        .map((t): Transition => {
          const fields: TransitionField[] = [];
          let needsInput = false;
          for (const [key, f] of Object.entries(t.fields ?? {})) {
            if (key === 'comment') continue;
            const field = toTransitionField(key, f);
            if (field) fields.push(field);
            else if (f.required && !f.hasDefaultValue) needsInput = true;
          }
          return {
            id: t.id,
            name: t.name,
            to: { name: t.to.name, category: statusCategory(t.to.statusCategory.key) },
            fields,
            allowsComment: !!t.hasScreen || 'comment' in (t.fields ?? {}),
            needsInput,
          };
        });
    },
    transition: async (connection, taskKey, transition, fetch, input?: TransitionInput) => {
      const ctx = ctxOf(connection, fetch);
      const body: Record<string, unknown> = { transition: { id: transition.id } };
      const fields: Record<string, unknown> = {};
      for (const field of transition.fields) {
        const raw = input?.values?.[field.key]?.trim();
        if (!raw) {
          if (field.required) throw new ProviderError('invalid_input', `${field.name} is required`);
          continue;
        }
        if (field.kind === 'number') {
          const n = Number(raw.replace(',', '.'));
          if (!Number.isFinite(n)) throw new ProviderError('invalid_input', `${field.name} must be a number`);
          fields[field.key] = n;
        } else if (field.kind === 'select') {
          if (!field.options?.some((o) => o.id === raw)) throw new ProviderError('invalid_input', `${field.name} has no such option`);
          fields[field.key] = { id: raw };
        } else fields[field.key] = field.kind === 'textarea' ? flavor.comment(raw) : raw;
      }
      if (Object.keys(fields).length) body.fields = fields;
      if (input?.comment?.trim()) body.update = { comment: [{ add: { body: flavor.comment(input.comment.trim()) } }] };
      await request(fetch, issuePath(ctx, taskKey, 'transitions'), json(ctx, 'POST', body));
    },
    logWork: async (connection, taskKey, entry: WorkLogEntry, fetch) => {
      if (!Number.isInteger(entry.seconds) || entry.seconds < 60) throw new ProviderError('invalid_input', 'At least one minute');
      const ctx = ctxOf(connection, fetch);
      const body: Record<string, unknown> = { timeSpentSeconds: entry.seconds, started: jiraDateTime(entry.started) };
      if (entry.comment?.trim()) body.comment = flavor.comment(entry.comment.trim());
      const res = workLogSchema.safeParse(await request(fetch, issuePath(ctx, taskKey, 'worklog'), json(ctx, 'POST', body)));
      if (!res.success) throw unexpected(res.error);
      return res.data.id;
    },
    deleteWorkLog: async (connection, taskKey, workLogId, fetch) => {
      if (!/^\d+$/.test(workLogId)) throw new ProviderError('invalid_input', 'Not a work log id');
      const ctx = ctxOf(connection, fetch);
      await request(fetch, `${issuePath(ctx, taskKey, 'worklog')}/${workLogId}`, { method: 'DELETE', headers: { ...ctx.init.headers, ...NO_XSRF } });
    },
    getWorkLogs: async (connection, taskKey, fetch): Promise<WorkLog[]> => {
      const ctx = ctxOf(connection, fetch);
      // shortcut: one page of up to 1000 logs (oldest first from Jira); enough for a single task.
      const [list, self] = await Promise.all([
        request(fetch, `${issuePath(ctx, taskKey, 'worklog')}?maxResults=1000`, ctx.init),
        currentUser(ctx),
      ]);
      const parsed = workLogListSchema.safeParse(list);
      if (!parsed.success) throw unexpected(parsed.error);
      return parsed.data.worklogs
        .map((w) => {
          const authorId = w.author?.accountId ?? w.author?.name;
          return {
            id: w.id,
            author: w.author?.displayName,
            mine: !!authorId && authorId === self.id,
            seconds: w.timeSpentSeconds,
            started: new Date(w.started).toISOString(),
            comment: textOf(w.comment) || undefined,
          };
        })
        .sort((a, b) => b.started.localeCompare(a.started));
    },
    getComments: async (connection, taskKey, fetch, attachments) => {
      const ctx = ctxOf(connection, fetch);
      const page = async (startAt: number) => {
        const params = new URLSearchParams({ startAt: String(startAt), maxResults: String(COMMENT_PAGE) });
        const parsed = commentPageSchema.safeParse(await request(fetch, `${issuePath(ctx, taskKey, 'comment')}?${params}`, ctx.init));
        if (!parsed.success) throw unexpected(parsed.error);
        return parsed.data;
      };
      // Jira lists oldest first in both flavors; when there are more than a page, fetch the last page instead.
      const [first, meId] = await Promise.all([page(0), myIdOrNone(ctx)]);
      const latest = first.total > COMMENT_PAGE ? await page(first.total - COMMENT_PAGE) : first;
      return latest.comments.map((c) => toComment(c, meId, attachments));
    },
    addComment: async (connection, taskKey, text, fetch) => {
      if (!text.trim()) throw new ProviderError('invalid_input', 'Empty comment');
      const ctx = ctxOf(connection, fetch);
      const [res, meId] = await Promise.all([
        request(fetch, issuePath(ctx, taskKey, 'comment'), json(ctx, 'POST', { body: flavor.comment(text.trim()) })),
        myIdOrNone(ctx),
      ]);
      const parsed = commentSchema.safeParse(res);
      if (!parsed.success) throw unexpected(parsed.error);
      return toComment(parsed.data, meId);
    },
    deleteComment: async (connection, taskKey, commentId, fetch) => {
      if (!/^\d+$/.test(commentId)) throw new ProviderError('invalid_input', 'Not a comment id');
      const ctx = ctxOf(connection, fetch);
      await request(fetch, `${issuePath(ctx, taskKey, 'comment')}/${commentId}`, { method: 'DELETE', headers: { ...ctx.init.headers, ...NO_XSRF } });
    },
    downloadAttachment: async (connection, url, fetch) => {
      const ctx = ctxOf(connection, fetch);
      // Credentials only ever go to the connection's own site.
      if (!url.startsWith(`${ctx.base}/`)) throw new ProviderError('invalid_input', 'Attachment is not on this site');
      const { Accept: _accept, ...auth } = ctx.init.headers as Record<string, string>;
      let res: Response;
      try {
        res = await fetch(url, { headers: auth });
      } catch {
        throw new ProviderError('network', 'Network request failed');
      }
      if (res.status === 401 || res.status === 403) throw new ProviderError('unauthorized', 'Credentials rejected', res.status);
      if (!res.ok) throw new ProviderError('http', `HTTP ${res.status}`, res.status);
      // A proxy or firewall can answer 200 with an HTML page; don't hand that over as the file.
      const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
      if (type === 'text/html') throw new ProviderError('blocked', `Blocked by a proxy (HTTP ${res.status})`, res.status);
      return res.blob();
    },
    currentUser: (connection, fetch) => currentUser(ctxOf(connection, fetch)),
    searchAssignees: async (connection, taskKey, query, fetch, startAt = 0) => {
      const ctx = ctxOf(connection, fetch);
      if (!ISSUE_KEY.test(taskKey)) throw new ProviderError('invalid_input', 'Not a Jira issue key');
      const params = new URLSearchParams({
        issueKey: taskKey,
        [flavor.userQueryParam]: query.trim(),
        startAt: String(startAt),
        maxResults: String(PEOPLE_PAGE),
      });
      const parsed = usersSchema.safeParse(await request(fetch, `${api(ctx, '/user/assignable/search')}?${params}`, ctx.init));
      if (!parsed.success) throw unexpected(parsed.error);
      // A short page doesn't mean the end (see PEOPLE_PAGE); an empty one does, or Jira's own limit.
      const next = parsed.data.length && startAt + PEOPLE_PAGE < PEOPLE_LIMIT ? startAt + PEOPLE_PAGE : undefined;
      return { people: parsed.data.filter((u) => u.active !== false).map(person).filter((p) => p.id), next };
    },
    assign: async (connection, taskKey, personId, fetch) => {
      const ctx = ctxOf(connection, fetch);
      await request(fetch, issuePath(ctx, taskKey, 'assignee'), json(ctx, 'PUT', flavor.assignBody(personId)));
    },
    fetchMyTasks: async (connection, fetch) => {
      const ctx = ctxOf(connection, fetch);
      const site = await cachedSiteFields(ctx);
      return toTasks(ctx, site, await search(ctx, JQL, fieldsFor(site)));
    },
    getDescriptionHtml: async (connection, taskKey, fetch) => {
      if (!ISSUE_KEY.test(taskKey)) throw new ProviderError('invalid_input', 'Not a Jira issue key');
      const ctx = ctxOf(connection, fetch);
      const body = await request(fetch, `${api(ctx, `/issue/${encodeURIComponent(taskKey)}`)}?fields=description&expand=renderedFields`, ctx.init);
      const parsed = z.object({ renderedFields: z.object({ description: z.string().nullish() }).nullish() }).safeParse(body);
      if (!parsed.success) throw unexpected(parsed.error);
      return parsed.data.renderedFields?.description?.trim() || undefined;
    },
    getChildren: async (connection, task, fetch) => {
      // Only epics have issues of their own; a story's sub-tasks already come with it.
      if (!task.type || !/epic/i.test(task.type) || !ISSUE_KEY.test(task.key)) return [];
      const ctx = ctxOf(connection, fetch);
      const site = await cachedSiteFields(ctx);
      return toTasks(ctx, site, await search(ctx, flavor.epicChildrenJql(task.key), CHILD_FIELDS, 200));
    },
    getTask: async (connection, taskKey, fetch) => {
      if (!ISSUE_KEY.test(taskKey)) throw new ProviderError('invalid_input', 'Not a Jira issue key');
      const ctx = ctxOf(connection, fetch);
      const site = await cachedSiteFields(ctx);
      const parsed = issueSchema.safeParse(
        await request(fetch, `${api(ctx, `/issue/${encodeURIComponent(taskKey)}`)}?fields=${fieldsFor(site)}`, ctx.init),
      );
      if (!parsed.success) throw unexpected(parsed.error);
      const [task] = await toTasks(ctx, site, [parsed.data]);
      return task!;
    },
    searchTasks: async (connection, query, fetch, hints) => {
      const q = query.trim();
      if (q.length < 2) return [];
      const ctx = ctxOf(connection, fetch);
      const site = await cachedSiteFields(ctx);
      const fields = fieldsFor(site);
      const upper = q.toUpperCase();
      const keys = ISSUE_KEY.test(upper)
        ? [upper]
        : /^\d+$/.test(q)
          ? [...new Set(hints?.projectKeys ?? [])].filter((p) => /^[A-Z][A-Z0-9_]*$/.test(p)).slice(0, 5).map((p) => `${p}-${q}`)
          : [];
      // A missing key is a 404, not an error; anything but sign-in problems just means "no hits from this part".
      const quiet = <T,>(promise: Promise<T>, fallback: T) =>
        promise.catch((error) => {
          if (isAuthError(error)) throw error;
          return fallback;
        });
      const [byKey, byText] = await Promise.all([
        Promise.all(
          keys.map((k) =>
            quiet(
              request(fetch, `${api(ctx, `/issue/${encodeURIComponent(k)}`)}?fields=${fields}`, ctx.init).then((body) => {
                const parsed = issueSchema.safeParse(body);
                return parsed.success ? parsed.data : null;
              }),
              null,
            ),
          ),
        ),
        quiet(search(ctx, `text ~ "${q.replace(/[\\"]/g, '\\$&')}" ORDER BY updated DESC`, fields, 20), []),
      ]);
      const seen = new Set<string>();
      const issues = [...byKey.filter((i): i is Issue => !!i), ...byText].filter((i) => !seen.has(i.key) && !!seen.add(i.key));
      return toTasks(ctx, site, issues);
    },
  };
}

export const jira = createJira({
  id: 'jira',
  name: 'Jira',
  docsUrl: 'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/',
  fields: [
    { key: 'domain', type: 'url', placeholder: 'sirket.atlassian.net', label: { tr: 'Jira adresi', en: 'Jira site' } },
    { key: 'email', type: 'email', placeholder: 'ad@sirket.com', label: { tr: 'Atlassian e-postası', en: 'Atlassian email' } },
    { key: 'apiToken', type: 'secret', label: { tr: 'API token', en: 'API token' } },
  ],
  guide: [
    {
      text: {
        tr: 'Jira adresin, Jira açıkken tarayıcının adres çubuğundaki alan adıdır.',
        en: 'Your Jira site is the domain in the address bar while Jira is open.',
      },
    },
    {
      text: { tr: 'Atlassian API token sayfasını aç.', en: 'Open the Atlassian API tokens page.' },
      link: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    },
    {
      text: {
        tr: '"Create API token" butonuna bas ("Create API token with scopes" değil), bir isim ver ve süresini seç.',
        en: 'Click "Create API token" (not "Create API token with scopes"), give it a name and pick an expiry.',
      },
      copy: 'AssignedToMe',
    },
    {
      text: {
        tr: 'Oluşan token’ı kopyala ve API token alanına yapıştır. Sayfayı kapatınca tekrar gösterilmez.',
        en: 'Copy the token and paste it into the API token field. It is not shown again.',
      },
    },
    {
      text: {
        tr: 'İstersen terminalde dene, hesap bilgin dönüyorsa bilgiler doğru.',
        en: 'Optionally test it in a terminal; it works if your account comes back.',
      },
      copy: 'curl -u {email}:<API_TOKEN> https://{domain}/rest/api/3/myself',
    },
  ],
  api: '3',
  base: jiraOrigin,
  headers: (connection) => {
    const { email = '', apiToken = '' } = connection.values;
    if (!email.trim() || !apiToken.trim()) throw new ProviderError('invalid_input', 'Email and API token are required');
    return basic(email.trim(), apiToken.trim());
  },
  identity: (connection) => connection.values.email ?? '',
  defaultName: (base) => new URL(base).hostname.replace('.atlassian.net', ''),
  comment: textToAdf,
  assignBody: (personId) => ({ accountId: personId }),
  userQueryParam: 'query',
  epicChildrenJql: (key) => `parent = ${key} ORDER BY created ASC`,
});

export const jiraDataCenter = createJira({
  id: 'jira-dc',
  name: 'Jira Data Center',
  docsUrl: 'https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html',
  fields: [
    { key: 'domain', type: 'url', placeholder: 'jira.sirket.com', label: { tr: 'Jira adresi', en: 'Jira address' } },
    // The secret keeps its old "password" key so existing connections still load; it now usually holds a PAT.
    { key: 'password', type: 'secret', label: { tr: 'Personal access token', en: 'Personal access token' } },
    {
      key: 'username',
      type: 'text',
      placeholder: 'ad.soyad',
      optional: true,
      label: { tr: 'Kullanıcı adı (sadece şifreyle girişte)', en: 'Username (password sign-in only)' },
    },
  ],
  guide: [
    {
      text: {
        tr: 'Jira adresin, Jira açıkken tarayıcının adres çubuğundaki adres (örn. jira.sirket.com). Şirket ağı ya da VPN gerekiyorsa bağlı ol.',
        en: 'Your Jira address is what the browser shows while Jira is open (e.g. jira.company.com). Connect to the company network or VPN if needed.',
      },
    },
    {
      text: {
        tr: 'Jira’da sağ üstteki avatarın → Profile → Personal access tokens → Create token. Bir ad ver (örn. AssignedToMe), istersen bitiş tarihi seç ve Create’e bas. Bu sayfayı tarayıcıda açabilirsin:',
        en: 'In Jira, your avatar (top right) → Profile → Personal access tokens → Create token. Give it a name (e.g. AssignedToMe), optionally an expiry, and press Create. You can open the page in your browser:',
      },
      copy: 'https://{domain}/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens',
      link: 'https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html',
    },
    {
      text: {
        tr: 'Token’ı kopyala ve Personal access token alanına yapıştır; sadece bir kez gösterilir. Kullanıcı adını boş bırak. Token yalnızca bu Mac’in Anahtar Zinciri’nde saklanır.',
        en: 'Copy the token into the Personal access token field; it is shown only once. Leave the username empty. The token is stored only in this Mac’s Keychain.',
      },
    },
    {
      text: {
        tr: 'Profilinde "Personal access tokens" yoksa Jira’n 8.14’ten eski: token alanına Jira şifreni, kullanıcı adı alanına giriş adını yaz. Yanlış şifre art arda denenirse Jira hesabı CAPTCHA ile kilitler; AssignedToMe reddedilince denemeyi durdurur.',
        en: 'No "Personal access tokens" in your profile means Jira is older than 8.14: put your Jira password in the token field and your sign-in name in the username field. Repeated wrong passwords make Jira lock the account behind a CAPTCHA; AssignedToMe stops retrying once refused.',
      },
    },
    {
      text: {
        tr: 'İstersen terminalde dene; hesap bilgin dönüyorsa token doğru.',
        en: 'Optionally test it in a terminal; it works if your account comes back.',
      },
      copy: 'curl -H "Authorization: Bearer <TOKEN>" https://{domain}/rest/api/2/myself',
    },
  ],
  api: '2',
  base: dataCenterBase,
  headers: (connection) => {
    const { username = '', password = '' } = connection.values;
    if (!password) throw new ProviderError('invalid_input', 'A personal access token or password is required');
    // A Personal Access Token (Jira 8.14+) goes as Bearer with no username. A username means the older password
    // sign-in (Basic), which admins can switch off — hence the token is what the guide leads with.
    if (!username.trim()) return { Accept: 'application/json', Authorization: `Bearer ${password}` };
    return basic(username.trim(), password);
  },
  identity: (connection) => connection.values.username ?? '',
  defaultName: (base) => new URL(base).hostname.split('.')[0] ?? 'Jira',
  comment: (text) => text,
  assignBody: (personId) => ({ name: personId }),
  userQueryParam: 'username',
  epicChildrenJql: (key) => `"Epic Link" = ${key} ORDER BY created ASC`,
});
