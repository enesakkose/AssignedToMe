import { expect, test } from 'bun:test';
import { emptyFilters, filterOptions, matchesFilters, NO_SPRINT, taskFiltersSchema, type TaskFilters } from './filters';
import type { Task } from './types';

const task = (over: Partial<Task>) => ({ id: 'x', statusCategory: 'todo', ...over }) as Task;
const f = (over: Partial<TaskFilters>) => ({ ...emptyFilters(), ...over });

test('no filters match everything', () => {
  expect(matchesFilters(task({}), emptyFilters())).toBe(true);
});

test('OR inside a group, AND across groups', () => {
  const bug = task({ type: 'Bug', statusCategory: 'in_progress', priorityLevel: 5 });
  expect(matchesFilters(bug, f({ type: ['Story', 'Bug'] }))).toBe(true);
  expect(matchesFilters(bug, f({ type: ['Bug'], status: ['todo'] }))).toBe(false);
  expect(matchesFilters(bug, f({ priority: ['high'] }))).toBe(true);
  expect(matchesFilters(task({}), f({ priority: ['medium'] }))).toBe(true); // unknown priority counts as medium
});

test('sprint and time filters', () => {
  expect(matchesFilters(task({}), f({ sprint: [NO_SPRINT] }))).toBe(true);
  expect(matchesFilters(task({ sprint: 'S4' }), f({ sprint: [NO_SPRINT] }))).toBe(false);
  expect(matchesFilters(task({ loggedSeconds: 7200, estimateSeconds: 3600 }), f({ time: ['over'] }))).toBe(true);
  expect(matchesFilters(task({ estimateSeconds: 3600 }), f({ time: ['unlogged'] }))).toBe(true);
  expect(matchesFilters(task({ loggedSeconds: 60 }), f({ time: ['unestimated'] }))).toBe(true);
  expect(matchesFilters(task({ loggedSeconds: 60, estimateSeconds: 3600 }), f({ time: ['unlogged', 'over', 'unestimated'] }))).toBe(false);
});

test('options list present values, and a saved blob with junk falls back safely', () => {
  expect(filterOptions([task({ type: 'Bug', sprint: 'S2' }), task({ type: 'Bug' }), task({ type: 'Story', sprint: 'S1' })])).toEqual({
    type: ['Bug', 'Story'],
    sprint: ['S1', 'S2', NO_SPRINT],
  });
  expect(taskFiltersSchema.safeParse({ status: ['nope'] }).success).toBe(false);
  expect(taskFiltersSchema.parse({ type: ['Bug'] })).toEqual(f({ type: ['Bug'] }));
});
