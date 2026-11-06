import { emptyFilters, taskFiltersSchema, type TaskFilters } from "@mytask/core";

/** Everything the screen shows is a function of the URL: board, search, filters and the selected task. */
export type QueueParams = { board: string; q: string; task: string; filters: TaskFilters };
export type RawParams = Record<string, string | string[] | undefined>;

export const ALL_BOARDS = "all";
/** Where the task screen lives; `/` is the landing page. */
export const APP_PATH = "/app";
const KEY = /^[A-Za-z0-9#/_.-]{1,80}$/;
const FILTER_GROUPS = ["status", "priority", "type"] as const;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** What a person (or anyone with a link) put in the URL; anything that doesn't fit is dropped, never half-applied. */
export function parseQueueParams(raw: RawParams): QueueParams {
  const board = first(raw.board)?.slice(0, 64) || ALL_BOARDS;
  const q = first(raw.q)?.trim().slice(0, 100) ?? "";
  const task = first(raw.task) ?? "";
  const lists = Object.fromEntries(
    FILTER_GROUPS.map((g) => [g, (first(raw[g]) ?? "").split(",").filter(Boolean).slice(0, 12)]),
  );
  const parsed = taskFiltersSchema.safeParse(lists);
  return {
    board,
    q,
    task: KEY.test(task) ? task : "",
    filters: parsed.success ? parsed.data : emptyFilters(),
  };
}

/** The URL for these params with one change applied; defaults are left out so links stay short. */
export function queueHref(current: QueueParams, patch: Partial<QueueParams> = {}): string {
  const next = { ...current, ...patch };
  const sp = new URLSearchParams();
  if (next.board !== ALL_BOARDS) sp.set("board", next.board);
  if (next.q) sp.set("q", next.q);
  for (const g of FILTER_GROUPS) if (next.filters[g].length) sp.set(g, next.filters[g].join(","));
  if (next.task) sp.set("task", next.task);
  const query = sp.toString();
  return query ? `${APP_PATH}?${query}` : APP_PATH;
}

/** The params with one filter value switched on or off. */
export function toggleFilter(
  current: QueueParams,
  group: (typeof FILTER_GROUPS)[number],
  value: string,
): QueueParams {
  const has = (current.filters[group] as string[]).includes(value);
  const values = has
    ? current.filters[group].filter((v) => v !== value)
    : [...current.filters[group], value];
  return { ...current, filters: { ...current.filters, [group]: values } };
}
