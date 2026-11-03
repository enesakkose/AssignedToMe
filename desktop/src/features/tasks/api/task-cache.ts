import type { Task } from '@mytask/core';
import { getStore } from '@/lib/store';

// Last fetched tasks per connection, so the list shows instantly when the app starts.
type Entry = { tasks: Task[]; updatedAt: number };
// Bump when the Task shape changes so old caches without new fields are not shown as fresh.
const KEY = 'taskCache:v7';
const OLD_KEYS = ['taskCache', 'taskCache:v2', 'taskCache:v3', 'taskCache:v4', 'taskCache:v5', 'taskCache:v6'];
let cache: Record<string, Entry> = {};

export async function loadTaskCache() {
  const store = getStore();
  for (const key of OLD_KEYS) await store.delete(key);
  cache = (await store.get<Record<string, Entry>>(KEY)) ?? {};
}

export const getCachedTasks = (connectionId: string): Entry | undefined => cache[connectionId];

export async function cacheTasks(connectionId: string, tasks: Task[]) {
  cache = { ...cache, [connectionId]: { tasks, updatedAt: Date.now() } };
  await getStore().set(KEY, cache);
}

export async function forgetTasks(connectionId: string) {
  const { [connectionId]: _removed, ...rest } = cache;
  cache = rest;
  await getStore().set(KEY, cache);
}
