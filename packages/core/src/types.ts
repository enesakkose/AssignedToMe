export type Locale = 'tr' | 'en';
export type Localized = Record<Locale, string>;

export type StatusCategory = 'todo' | 'in_progress' | 'done';

/** A file attached to a task. URLs need the connection's credentials; download them through the provider. */
export type Attachment = {
  id: string;
  name: string;
  mimeType?: string;
  url: string;
  thumbnailUrl?: string;
};

/** A piece of a description, in order: text, a link, or an attached image shown where the author put it. */
export type DescriptionPart =
  | { type: 'text'; text: string }
  | { type: 'link'; url: string; text: string }
  | { type: 'image'; attachmentId: string };

/** Another task this one points to (its parent or a linked issue), with just enough to show and open it. */
export type RelatedTask = {
  key: string;
  title: string;
  url: string;
  type?: string;
  status?: string;
  statusCategory?: StatusCategory;
};

/** A link to another task, phrased from this task's side ("blocks", "is blocked by", "relates to", …). */
export type TaskLink = RelatedTask & {
  relation: string;
  /** The other task blocks this one. */
  blocksThis?: boolean;
};

/** A user in the source tool. */
export type Person = { id: string; name: string };
export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

export type Task = {
  id: string;
  /** Human key shown in the UI, e.g. "ABC-123". */
  key: string;
  title: string;
  status: string;
  statusCategory: StatusCategory;
  priority?: string;
  /** 1 lowest … 5 highest, when the priority name can be read. */
  priorityLevel?: PriorityLevel;
  type?: string;
  project?: string;
  assignee?: Person;
  description?: string;
  /** Set when the description has links or inline images; `description` stays its plain text. */
  descriptionParts?: DescriptionPart[];
  /** Current (or last) sprint / iteration name. */
  sprint?: string;
  /** Original estimate in seconds. */
  estimateSeconds?: number;
  /** Time logged so far in seconds. */
  loggedSeconds?: number;
  storyPoints?: number;
  attachments?: Attachment[];
  /** Child tasks (e.g. sub-tasks of a story), with whoever they are assigned to. */
  subtasks?: Subtask[];
  /** How many child tasks exist (e.g. GitHub sub-issues) when they aren't embedded in `subtasks`; the detail page loads them via `getChildren`. */
  childCount?: number;
  /** The task this one sits under: a story's epic, a sub-task's story. */
  parent?: RelatedTask;
  links?: TaskLink[];
  /** Opens the task in its source app. Always http(s). */
  url: string;
  connectionId: string;
  /** ISO 8601 */
  updatedAt: string;
  /** ISO 8601. Lists sort by this so edits (status, logs, comments) never move a task. */
  createdAt?: string;
};

export type Subtask = {
  id: string;
  key: string;
  title: string;
  status: string;
  statusCategory: StatusCategory;
  /** Empty when unassigned. */
  assignee?: Person;
  description?: string;
  /** Set when the description has links or inline images; `description` stays its plain text. */
  descriptionParts?: DescriptionPart[];
  attachments?: Attachment[];
  estimateSeconds?: number;
  loggedSeconds?: number;
  links?: TaskLink[];
  url: string;
};

/** One configured account of a provider. Shown as one board tab. */
export type Connection = {
  id: string;
  providerId: string;
  /** Tab name, user-editable. */
  name: string;
  /** Field values keyed by ProviderField.key, secrets included. */
  values: Record<string, string>;
};

export type ProviderField = {
  key: string;
  label: Localized;
  placeholder?: string;
  type: 'text' | 'email' | 'url' | 'secret';
  /** May be left empty (e.g. a username that only a password sign-in needs). */
  optional?: boolean;
  /** This device's sign-in state (session expiry, client id), not part of the board: never moved to another device. */
  session?: boolean;
};

export type GuideStep = {
  text: Localized;
  link?: string;
  /** A value or command the user can copy. `{field}` placeholders are filled from the form. */
  copy?: string;
};

/** A field on a transition's screen that the app can render. */
export type TransitionField = {
  key: string;
  name: string;
  required: boolean;
  kind: 'select' | 'number' | 'text' | 'textarea';
  /** For `select`. */
  options?: { id: string; name: string }[];
};

/** A status change the current user can make on a task right now. */
export type Transition = {
  id: string;
  /** Action name, e.g. "Start progress". */
  name: string;
  to: { name: string; category: StatusCategory };
  /** Fields the app can fill in before moving (from the transition's screen). */
  fields: TransitionField[];
  /** Whether the screen takes a comment. */
  allowsComment: boolean;
  /** A required field the app can't render (date, user…); offer "open in source" instead. */
  needsInput: boolean;
};

/** Values for a transition's screen, keyed by field; `select` values are option ids. */
export type TransitionInput = { values?: Record<string, string>; comment?: string };

export type WorkLogEntry = {
  seconds: number;
  started: Date;
  comment?: string;
};

export type WorkLog = {
  id: string;
  author?: string;
  /** Logged by the connected account; only these are offered for deletion. */
  mine: boolean;
  seconds: number;
  /** ISO 8601 */
  started: string;
  comment?: string;
};

export type Comment = {
  id: string;
  author?: string;
  /** Written by the connected account. */
  mine: boolean;
  /** ISO 8601 */
  created: string;
  /** Plain text (for search and screen readers). */
  text: string;
  /** Set when the comment has links or inline images. */
  parts?: DescriptionPart[];
};

/** Platform fetch (Tauri plugin-http, Next proxy, React Native). */
export type Fetch = typeof globalThis.fetch;

/** A board a browser sign-in produced: its name and the values to store (secrets included). */
export type SignedInBoard = { name: string; values: Record<string, string> };

export type Provider = {
  id: string;
  name: string;
  /** The app its tasks open in, for "Open in …" buttons (both Jira flavors open in "Jira"). */
  appName: string;
  /** SVG markup. */
  logo: string;
  docsUrl: string;
  fields: ProviderField[];
  guide: GuideStep[];
  defaultName: (values: Record<string, string>) => string;
  /**
   * Optional: signs in through the browser instead of a form (`fields` then only describe what is stored). Not listed
   * among the providers; offered inside the screen of the provider `for`.
   */
  signIn?: { for: string; label: Localized } & (
    | {
        /** The browser comes back to http://localhost:<port>/callback (any free port unless `port` is set). */
        kind: 'redirect';
        port?: number;
        /** Returns the page to open; `pending` comes back to `finish` with the URL the browser was sent to. */
        begin: (fetch: Fetch, redirectUri: string) => Promise<{ url: string; pending: Record<string, string> }>;
        /** One board per site the account can reach. */
        finish: (fetch: Fetch, pending: Record<string, string>, redirectedTo: string) => Promise<SignedInBoard[]>;
      }
    | {
        /** The app shows `code`; the user enters it at `url`. `finish` waits until they have. */
        kind: 'device';
        begin: (fetch: Fetch) => Promise<{ url: string; code: string; pending: Record<string, string> }>;
        finish: (fetch: Fetch, pending: Record<string, string>, signal?: AbortSignal) => Promise<SignedInBoard[]>;
      }
  );
  /** Optional: new credentials when the stored ones are about to expire (an OAuth access token); undefined when still fine. Store what it returns. */
  refreshCredentials?: (connection: Connection, fetch: Fetch) => Promise<Record<string, string> | undefined>;
  /** Resolves when the credentials work, throws ProviderError otherwise. */
  validate: (connection: Connection, fetch: Fetch) => Promise<void>;
  fetchMyTasks: (connection: Connection, fetch: Fetch) => Promise<Task[]>;
  /** Optional: statuses the task can move to. Providers without status changes omit both. */
  getTransitions?: (connection: Connection, taskKey: string, fetch: Fetch) => Promise<Transition[]>;
  transition?: (connection: Connection, taskKey: string, transition: Transition, fetch: Fetch, input?: TransitionInput) => Promise<void>;
  /** Optional: time tracking. Returns the new work log id so it can be undone. */
  logWork?: (connection: Connection, taskKey: string, entry: WorkLogEntry, fetch: Fetch) => Promise<string>;
  deleteWorkLog?: (connection: Connection, taskKey: string, workLogId: string, fetch: Fetch) => Promise<void>;
  /** Optional: fetch an attachment with the connection's credentials. Only URLs on the connection's own site. */
  downloadAttachment?: (connection: Connection, url: string, fetch: Fetch) => Promise<Blob>;
  /** Optional: search the whole source, not only my tasks. `projectKeys` lets a bare number like "2750" mean PROJ-2750. */
  searchTasks?: (connection: Connection, query: string, fetch: Fetch, hints?: { projectKeys?: string[] }) => Promise<Task[]>;
  /** Optional: the description as HTML rendered by the source (tables, panels, smart links, macros). Untrusted: sanitize before showing. */
  getDescriptionHtml?: (connection: Connection, taskKey: string, fetch: Fetch) => Promise<string | undefined>;
  /** Optional: the tasks under this one, e.g. an epic's issues (sub-tasks already come with the task). */
  getChildren?: (connection: Connection, task: Pick<Task, 'key' | 'type'>, fetch: Fetch) => Promise<Task[]>;
  /** Optional: one task by key, e.g. a parent or linked issue that isn't in the user's list. */
  getTask?: (connection: Connection, taskKey: string, fetch: Fetch) => Promise<Task>;
  /** Optional: assignment. `personId` null unassigns. */
  currentUser?: (connection: Connection, fetch: Fetch) => Promise<Person>;
  /** Paged: pass the previous page's `next` as `startAt`; no `next` means this was the last page. */
  searchAssignees?: (
    connection: Connection,
    taskKey: string,
    query: string,
    fetch: Fetch,
    startAt?: number,
  ) => Promise<{ people: Person[]; next?: number }>;
  assign?: (connection: Connection, taskKey: string, personId: string | null, fetch: Fetch) => Promise<void>;
  /** Newest first. */
  getWorkLogs?: (connection: Connection, taskKey: string, fetch: Fetch) => Promise<WorkLog[]>;
  /** Optional: the latest comments, oldest first. `attachments` lets inline images resolve to the task's files. */
  getComments?: (connection: Connection, taskKey: string, fetch: Fetch, attachments?: Attachment[]) => Promise<Comment[]>;
  /** Optional: adds a plain-text comment and returns it. */
  addComment?: (connection: Connection, taskKey: string, text: string, fetch: Fetch) => Promise<Comment>;
  /** Optional: deletes a comment; UIs offer it only on the user's own (`mine`). */
  deleteComment?: (connection: Connection, taskKey: string, commentId: string, fetch: Fetch) => Promise<void>;
};
