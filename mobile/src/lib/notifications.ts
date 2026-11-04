import type { Task } from "@mytask/core";
import { mmkvStorage } from "@/lib/storage/mmkv-storage";
import { useNotificationHistory } from "@/stores/notification-history";
import * as Notifications from "expo-notifications";
import type { TFunction } from "i18next";
import { Linking } from "react-native";

// Show alerts while the app is open too (SDK 57 hides foreground notifications by default).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Current permission, without prompting; the refresh only notifies when this is already true. */
export async function isNotificationGranted() {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Shows iOS's "Allow notifications?" once; afterwards the answer is changed only in iOS Settings. */
export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export const openNotificationSettings = () => Linking.openSettings();

// The task ids last seen on each board, so only genuinely new assignments are announced. Non-secret, so MMKV.
const SEEN_KEY = "seenTasks";
type Seen = Record<string, string[]>;
type Board = { id: string; name: string; tasks: Task[] | undefined };

/**
 * Notifies about tasks assigned since the last refresh. The first time a board is seen its tasks are only
 * remembered, not announced, so existing work never triggers a burst; a board that failed to load is left untouched.
 */
export async function announceNewTasks(boards: Board[], t: TFunction) {
  const seen: Seen = JSON.parse(mmkvStorage.getItem(SEEN_KEY) ?? "{}");
  const fresh: { board: string; connectionId: string; task: Task }[] = [];
  for (const b of boards) {
    if (!b.tasks) continue;
    const known = seen[b.id];
    if (known) {
      const knownSet = new Set(known);
      for (const task of b.tasks)
        if (!knownSet.has(task.id)) fresh.push({ board: b.name, connectionId: b.id, task });
    }
    seen[b.id] = b.tasks.map((task) => task.id);
  }
  mmkvStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  if (!fresh.length) return;
  // Kept for the Notifications tab whether or not iOS lets us show an alert.
  const at = Date.now();
  useNotificationHistory.getState().add(
    fresh.map(({ board, connectionId, task }) => ({
      at,
      board,
      connectionId,
      id: `${connectionId}:${task.id}:${at}`,
      key: task.key,
      title: task.title,
    })),
  );
  if (!(await isNotificationGranted())) return;

  if (fresh.length <= 3) {
    for (const { board, connectionId, task } of fresh)
      await notify(t("notifications.assigned", { board }), `${task.key}  ${task.title}`, {
        connectionId,
        key: task.key,
      });
  } else {
    await notify(
      t("notifications.assignedMany", { count: fresh.length }),
      fresh.map((f) => f.task.key).join(", "),
    );
  }
}

/** A task's board and key ride along, so a tap can open it (see useOpenTaskFromNotification). */
const notify = (title: string, body: string, data?: { connectionId: string; key: string }) =>
  Notifications.scheduleNotificationAsync({ content: { body, data, title }, trigger: null }).catch(
    () => undefined,
  );
