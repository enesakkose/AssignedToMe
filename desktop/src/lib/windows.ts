import type { Task } from '@mytask/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** This webview: the menubar popover ("main") or the regular app window ("app"). The popover outside Tauri. */
export const windowLabel = (() => {
  try {
    return getCurrentWindow().label;
  } catch {
    return 'main';
  }
})();
export const isAppWindow = windowLabel === 'app';

// The popover and the app window are separate webviews over the same store, so each keeps its own memory (queries,
// prefs). These events keep them in step. Payloads are non-secret task data and nothing else.
type Events = {
  /** A board was fetched: the other window takes the result instead of fetching again. */
  'tasks-fetched': { connectionId: string; tasks: Task[] };
  /** Something was changed (a mutation): the other window refetches what it shows. */
  'data-changed': null;
  /** A preference changed (theme, language, refresh, …): the other window re-reads them. */
  'prefs-changed': null;
  /** A task notification was clicked while the app window is open: show that task there. */
  'open-task': { connectionId: string; taskKey: string };
};

export function broadcast<K extends keyof Events>(event: K, payload: Events[K]) {
  emit(event, { from: windowLabel, payload }).catch(() => undefined);
}

/** Listens to the other window's broadcasts (a window never hears its own). */
export function onBroadcast<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void) {
  return listen<{ from: string; payload: Events[K] }>(event, (e) => {
    if (e.payload.from !== windowLabel) cb(e.payload.payload);
  });
}
