import type { Task } from '@mytask/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import type { TFunction } from 'i18next';
import { getStore } from './store';

// The task ids last seen on each board, so only genuinely new assignments are announced. Non-secret, so plain store.
const KEY = 'seenTasks';
type Seen = Record<string, string[]>;

let seen: Seen | undefined;
async function loadSeen(): Promise<Seen> {
  if (!seen) seen = (await getStore().get<Seen>(KEY)) ?? {};
  return seen;
}

// Permission is the single source of truth (managed in macOS System Settings); cached for the session.
let permission: boolean | undefined;
/** Current permission, without ever prompting — used by the background refresh. */
async function isGranted(): Promise<boolean> {
  if (permission === undefined) permission = await isPermissionGranted();
  return permission;
}
/** Prompts once if the OS hasn't decided yet; used from onboarding and the test action. */
async function requestAccess(): Promise<boolean> {
  if (!(await isGranted())) permission = (await requestPermission()) === 'granted';
  return permission ?? false;
}

/**
 * Ask for notification permission up front (from onboarding). The plugin's requestPermission never prompts on desktop
 * (it just answers "granted"), so this shows macOS's own "Allow notifications?" dialog from the Rust side.
 */
export async function ensureNotificationPermission(): Promise<void> {
  try {
    await invoke('request_notification_permission');
  } catch {
    // Not in Tauri (browser preview) — nothing to request.
  }
}

/** Dev aid: force one notification now (asks permission). From devtools: returns false if permission was refused. */
export async function sendTestNotification(): Promise<boolean> {
  const ok = await requestAccess();
  if (ok) notify('AssignedToMe', 'Test · bildirimler çalışıyor');
  return ok;
}

type Board = { id: string; name: string; tasks: Task[] | undefined };

/**
 * Notifies about tasks assigned to the user since the last refresh. The first time a board is seen its tasks are only
 * remembered, not announced, so existing work never triggers a burst; a board that failed to load is left untouched.
 */
export async function announceNewTasks(boards: Board[], t: TFunction) {
  let store: ReturnType<typeof getStore>;
  try {
    store = getStore();
  } catch {
    return; // no store outside Tauri (browser preview)
  }
  const map = await loadSeen();
  const fresh: { board: string; connectionId: string; task: Task }[] = [];
  let changed = false;
  for (const b of boards) {
    if (!b.tasks) continue;
    const known = map[b.id];
    if (known) {
      const knownSet = new Set(known);
      for (const task of b.tasks) if (!knownSet.has(task.id)) fresh.push({ board: b.name, connectionId: b.id, task });
    }
    map[b.id] = b.tasks.map((task) => task.id);
    changed = true;
  }
  if (changed) await store.set(KEY, map).catch(() => undefined);
  // Background refresh never prompts; it notifies only if the OS already granted permission.
  if (!fresh.length || !(await isGranted())) return;

  if (fresh.length <= 3) {
    for (const { board, connectionId, task } of fresh)
      notify(t('notifications.assigned', { board }), `${task.key}  ${task.title}`, connectionId, task.key);
  } else {
    notify(t('notifications.assignedMany', { count: fresh.length }), fresh.map((f) => f.task.key).join(', '));
  }
}

/**
 * Posts a notification through macOS's own notification center (Rust `notify_task`); the plugin's sendNotification
 * uses an API macOS drops. A task's board and key ride along so a click can open it.
 */
function notify(title: string, body: string, board = '', task = '') {
  invoke('notify_task', { title, body, board, task }).catch(() => undefined);
}

/** Calls back when the user clicks a task notification, with the board + task it carried (empty for the summary). */
export async function onNotificationClick(cb: (connectionId: string, taskKey: string) => void) {
  try {
    await listen<[string, string]>('notification-clicked', ({ payload: [board, task] }) => cb(board, task));
  } catch {
    // Not in Tauri (browser preview).
  }
}
