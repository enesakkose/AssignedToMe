import type { Task } from './types';

// Turkish and English lowercasing differ on I/İ/ı; compare in both so "iptal" finds "İptal" and "ID" finds "id".
const folds = (text: string) => [text.toLocaleLowerCase('tr'), text.toLocaleLowerCase('en')];

/** True when every word of the query appears in the task or one of its sub-tasks. */
export function matchesQuery(task: Task, query: string): boolean {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [
    task.key,
    task.title,
    task.status,
    task.type,
    task.sprint,
    task.project,
    task.assignee?.name,
    ...(task.subtasks ?? []).flatMap((s) => [s.key, s.title, s.assignee?.name]),
  ]
    .filter(Boolean)
    .join('\n');
  const [tr, en] = folds(haystack);
  return words.every((word) => folds(word).some((w) => tr!.includes(w) || en!.includes(w)));
}
