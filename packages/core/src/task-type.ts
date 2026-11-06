export type TaskTypeKind = 'bug' | 'story' | 'task' | 'epic' | 'subtask';

/**
 * Sorts a provider's freeform issue-type name (en/tr) into a few known kinds, so every app can tint the type badge the
 * same way. A name that matches nothing stays uncoloured (undefined). Sub-task is checked before task, since it contains it.
 */
export function taskTypeKind(name: string | undefined): TaskTypeKind | undefined {
  const n = name?.toLocaleLowerCase('tr') ?? '';
  if (!n) return undefined;
  if (/bug|defect|incident|hata|arıza/.test(n)) return 'bug';
  if (/epic|epik/.test(n)) return 'epic';
  if (/sub-?task|subtask|alt\s*görev/.test(n)) return 'subtask';
  if (/story|feature|hikaye|öykü|özellik/.test(n)) return 'story';
  if (/task|chore|görev/.test(n)) return 'task';
  return undefined;
}
