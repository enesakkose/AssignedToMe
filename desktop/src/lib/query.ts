import { ProviderError } from '@mytask/core';
import { MutationCache, QueryClient, focusManager } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { broadcast } from './windows';

export const HOUR = 60 * 60 * 1000;

/** Rejected sign-ins must never be retried automatically: repeated attempts lock the account (e.g. Jira's CAPTCHA). */
export const isSignInError = (error: unknown) =>
  error instanceof ProviderError && (error.code === 'unauthorized' || error.code === 'captcha');

/** A company proxy/firewall blocked the request; the API never saw it, so retrying only adds noise. */
export const isBlocked = (error: unknown) => error instanceof ProviderError && error.code === 'blocked';

/** Errors retrying can't fix: a wrong/absent sign-in, a network block, or an input we built wrong. */
export const isHaltError = (error: unknown) =>
  isSignInError(error) || isBlocked(error) || (error instanceof ProviderError && error.code === 'invalid_input');

export const queryClient = new QueryClient({
  // Any change made here (status, comment, board, …) makes the other window refetch what it shows.
  mutationCache: new MutationCache({ onSuccess: () => broadcast('data-changed', null) }),
  defaultOptions: {
    queries: { retry: (failures, error) => !isHaltError(error) && failures < 1, refetchOnReconnect: true },
  },
});

// Tasks the user left to change in the source app (e.g. a status Jira blocks our API from setting), by board.
// On return we refetch that board's list once (it holds status/assignee/time) and only the opened task's own data —
// not every cached task's comments and logs.
const pendingRefresh = new Map<string, Set<string>>();
// The per-task query families to refresh for a touched task.
const TASK_FAMILIES = ['comments', 'worklogs', 'description-html', 'children', 'task'];

export function markForRefresh(connectionId: string, taskKey: string) {
  const keys = pendingRefresh.get(connectionId) ?? new Set<string>();
  keys.add(taskKey);
  pendingRefresh.set(connectionId, keys);
}

// The popover is shown and hidden, not navigated; treat window focus as app focus.
export async function bindWindowFocus() {
  await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    focusManager.setFocused(focused);
    if (!focused || !pendingRefresh.size) return;
    const boards = [...pendingRefresh.entries()];
    pendingRefresh.clear();
    for (const [connectionId, keys] of boards) {
      void queryClient.invalidateQueries({ queryKey: ['tasks', connectionId] });
      for (const key of keys) {
        for (const family of TASK_FAMILIES) void queryClient.invalidateQueries({ queryKey: [family, connectionId, key] });
      }
    }
  });
}
