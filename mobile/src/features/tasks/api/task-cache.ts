import type { Task } from "@mytask/core";
import { mmkvStorage } from "@/lib/storage/mmkv-storage";

// The last fetched tasks per board, so the list is whole on the first frame instead of filling in board by board.
// Non-secret (titles, statuses), so MMKV. Bump the key when the Task shape changes.
const KEY = "taskCache:v1";
type Entry = { tasks: Task[]; updatedAt: number };

const read = (): Record<string, Entry> => {
  try {
    return JSON.parse(mmkvStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};

export const getCachedTasks = (connectionId: string): Entry | undefined => read()[connectionId];

export function cacheTasks(connectionId: string, tasks: Task[]) {
  mmkvStorage.setItem(
    KEY,
    JSON.stringify({ ...read(), [connectionId]: { tasks, updatedAt: Date.now() } }),
  );
}

export function forgetTasks(connectionId: string) {
  const { [connectionId]: _removed, ...rest } = read();
  mmkvStorage.setItem(KEY, JSON.stringify(rest));
}
