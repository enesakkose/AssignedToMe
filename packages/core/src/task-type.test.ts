import { describe, expect, test } from 'bun:test';
import { taskTypeKind } from './task-type';

describe('taskTypeKind', () => {
  test('known names in en/tr', () => {
    expect(taskTypeKind('Bug')).toBe('bug');
    expect(taskTypeKind('Hata')).toBe('bug');
    expect(taskTypeKind('Sub-task')).toBe('subtask');
    expect(taskTypeKind('Alt görev')).toBe('subtask');
    expect(taskTypeKind('Story')).toBe('story');
    expect(taskTypeKind('Epic')).toBe('epic');
    expect(taskTypeKind('Task')).toBe('task');
  });
  test('sub-task wins over task', () => {
    expect(taskTypeKind('Subtask')).toBe('subtask');
  });
  test('unknown or empty is undefined', () => {
    expect(taskTypeKind('Spike')).toBeUndefined();
    expect(taskTypeKind('')).toBeUndefined();
    expect(taskTypeKind(undefined)).toBeUndefined();
  });
});
