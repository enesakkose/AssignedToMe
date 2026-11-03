import { z } from 'zod';
import type { Task } from './types';

export const NO_SPRINT = '';

/** Saved filters for one tab. Within a group any selected value matches; groups combine with AND. Empty means no filter. */
export const taskFiltersSchema = z.object({
  status: z.array(z.enum(['todo', 'in_progress'])).default([]),
  priority: z.array(z.enum(['high', 'medium', 'low'])).default([]),
  type: z.array(z.string()).default([]),
  /** Sprint names; `NO_SPRINT` picks tasks outside any sprint. */
  sprint: z.array(z.string()).default([]),
  time: z.array(z.enum(['unlogged', 'over', 'unestimated'])).default([]),
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;
export type FilterGroup = keyof TaskFilters;

export const emptyFilters = (): TaskFilters => ({ status: [], priority: [], type: [], sprint: [], time: [] });

export function activeFilterCount(f: TaskFilters): number {
  return Object.values(f).reduce((n, values) => n + values.length, 0);
}

/** High and up, medium (or a scheme we can't read), low and below. */
function priorityBand(task: Task): TaskFilters['priority'][number] {
  if (task.priorityLevel == null || task.priorityLevel === 3) return 'medium';
  return task.priorityLevel > 3 ? 'high' : 'low';
}

function timeTags(task: Task): TaskFilters['time'] {
  const logged = task.loggedSeconds ?? 0;
  const tags: TaskFilters['time'] = [];
  if (!logged) tags.push('unlogged');
  if (!task.estimateSeconds) tags.push('unestimated');
  else if (logged > task.estimateSeconds) tags.push('over');
  return tags;
}

export function matchesFilters(task: Task, f: TaskFilters): boolean {
  const any = <T>(selected: T[], ...values: T[]) => !selected.length || values.some((v) => selected.includes(v));
  return (
    any(f.status, task.statusCategory as TaskFilters['status'][number]) &&
    any(f.priority, priorityBand(task)) &&
    any(f.type, task.type ?? '') &&
    any(f.sprint, task.sprint ?? NO_SPRINT) &&
    any(f.time, ...timeTags(task))
  );
}

/** Types and sprints present in the list, so the filter only offers values that can match. */
export function filterOptions(tasks: Task[]) {
  const sorted = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  return {
    type: sorted(tasks.map((t) => t.type)),
    sprint: [...sorted(tasks.map((t) => t.sprint)), ...(tasks.some((t) => !t.sprint) ? [NO_SPRINT] : [])],
  };
}

/** Reads filters saved per tab; anything that doesn't parse is dropped rather than half-applied. */
export function parseSavedFilters(value: unknown): Record<string, TaskFilters> | undefined {
  const parsed = z.record(z.string(), taskFiltersSchema).safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
