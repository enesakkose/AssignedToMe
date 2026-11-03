import { useConnectionsStore } from "@/features/connections/api/connections";
import { i18n } from "@/lib/i18n";
import { announceNewTasks } from "@/lib/notifications";
import { isHaltError } from "@/lib/query";
import { mmkvStorage } from "@/lib/storage/mmkv-storage";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { fetchTasks } from "./api/fetch-tasks";

const TASK = "refresh-tasks";

// Boards whose sign-in was refused are not tried again in the background (repeated attempts can lock the account,
// e.g. Jira's CAPTCHA) until the connection is saved again.
const HALTED_KEY = "haltedBoards";
const halted = (): string[] => JSON.parse(mmkvStorage.getItem(HALTED_KEY) ?? "[]");
export const clearHalted = (connectionId: string) =>
  mmkvStorage.setItem(HALTED_KEY, JSON.stringify(halted().filter((id) => id !== connectionId)));

// Must be defined at module scope: iOS launches the JS bundle headless to run it, with no React tree.
TaskManager.defineTask(TASK, async () => {
  const skip = new Set(halted());
  const boards = useConnectionsStore.getState().connections.filter((b) => !skip.has(b.id));
  const results = await Promise.allSettled(boards.map(fetchTasks));
  const refused = boards.filter((_b, i) => {
    const r = results[i];
    return r?.status === "rejected" && isHaltError(r.reason);
  });
  if (refused.length)
    mmkvStorage.setItem(HALTED_KEY, JSON.stringify([...skip, ...refused.map((b) => b.id)]));
  await announceNewTasks(
    boards.map((b, i) => {
      const r = results[i];
      return { id: b.id, name: b.name, tasks: r?.status === "fulfilled" ? r.value : undefined };
    }),
    i18n.t,
  );
  return BackgroundTask.BackgroundTaskResult.Success;
});

/**
 * Asks iOS to wake the app now and then to look for new tasks. iOS decides when (15 minutes at the earliest, often
 * much later), so this only complements the refresh that runs while the app is open.
 */
export async function registerBackgroundRefresh(minutes: number) {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available)
    return;
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: Math.max(15, minutes) });
}
