import type { Task } from '@mytask/core';
import { create } from 'zustand';
import { getStore } from '@/lib/store';
import { broadcast } from '@/lib/windows';

const SHOW_TABS = 'showTabs';
const ONBOARDED = 'onboarded';
const REFRESH_MS = 'refreshMs';
// Read by the Rust side at launch too (lib.rs `opens_window_at_launch`); keep the key in sync.
const OPEN_WINDOW = 'openWindow';
const SIDEBAR_OPEN = 'sidebarOpen';
/** Default refresh cadence; the user can pick a shorter one in Settings. */
export const DEFAULT_REFRESH_MS = 60 * 60 * 1000;
/** Offered in Settings, in minutes. */
export const REFRESH_CHOICES_MIN = [1, 15, 30, 60] as const;

export type Screen =
  | { name: 'tasks' }
  | { name: 'settings' }
  | { name: 'connection'; id?: string }
  | { name: 'playground' };

export const ALL_BOARDS = 'all';

type NavState = {
  screen: Screen;
  /** The screen `go` left, so a sub-screen's Back returns where it was opened from. */
  from: Screen;
  board: string;
  /** The task whose detail page is open over the current screen (a snapshot; the page reads fresh data by id). */
  detail: Task | null;
  /** Detail pages opened before this one (task → sub-task → …), so Back returns to where you came from. */
  history: Task[];
  /** Board tabs on screen; off keeps board names out of sight (e.g. while screen sharing), boards switch from the menu. */
  showTabs: boolean;
  setShowTabs: (show: boolean) => void;
  /** How often boards refetch, in ms. */
  refreshMs: number;
  setRefreshMs: (ms: number) => void;
  /** Open the app window at launch; false = menubar only (the window still opens on demand). */
  openWindow: boolean;
  setOpenWindow: (open: boolean) => void;
  /** App window: the boards sidebar is shown. */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  /** False until the first-run intro is finished or skipped. */
  onboarded: boolean;
  finishOnboarding: () => void;
  go: (screen: Screen) => void;
  selectBoard: (board: string) => void;
  openTask: (task: Task) => void;
  closeTask: () => void;
};

export const useNav = create<NavState>((set) => ({
  screen: { name: 'tasks' },
  from: { name: 'tasks' },
  board: ALL_BOARDS,
  detail: null,
  history: [],
  showTabs: true,
  setShowTabs: (showTabs) => {
    set({ showTabs });
    persist(SHOW_TABS, showTabs);
  },
  refreshMs: DEFAULT_REFRESH_MS,
  setRefreshMs: (refreshMs) => {
    set({ refreshMs });
    persist(REFRESH_MS, refreshMs);
  },
  openWindow: true,
  setOpenWindow: (openWindow) => {
    set({ openWindow });
    persist(OPEN_WINDOW, openWindow);
  },
  sidebarOpen: true,
  toggleSidebar: () =>
    set(({ sidebarOpen }) => {
      persist(SIDEBAR_OPEN, !sidebarOpen);
      return { sidebarOpen: !sidebarOpen };
    }),
  onboarded: false,
  finishOnboarding: () => {
    set({ onboarded: true });
    persist(ONBOARDED, true);
  },
  go: (screen) => set(({ screen: from }) => ({ screen, from, detail: null, history: [] })),
  selectBoard: (board) => set({ board }),
  openTask: (task) =>
    set(({ detail, history }) => (detail?.id === task.id ? {} : { detail: task, history: detail ? [...history, detail] : [] })),
  closeTask: () => set(({ history }) => ({ detail: history.at(-1) ?? null, history: history.slice(0, -1) })),
}));

// Best effort: the preference still holds for this session if the store is unavailable (browser preview).
function persist(key: string, value: unknown) {
  try {
    void getStore()
      .set(key, value)
      .then(() => broadcast('prefs-changed', null))
      .catch(() => undefined);
  } catch {
    // No store outside Tauri.
  }
}

/** Called once at boot. */
export async function loadNavPrefs() {
  const store = getStore();
  const showTabs = await store.get<boolean>(SHOW_TABS);
  const refreshMs = await store.get<number>(REFRESH_MS);
  const onboarded = await store.get<boolean>(ONBOARDED);
  const openWindow = await store.get<boolean>(OPEN_WINDOW);
  const sidebarOpen = await store.get<boolean>(SIDEBAR_OPEN);
  useNav.setState({
    ...(typeof sidebarOpen === 'boolean' ? { sidebarOpen } : {}),
    ...(typeof showTabs === 'boolean' ? { showTabs } : {}),
    ...(typeof refreshMs === 'number' && refreshMs > 0 ? { refreshMs } : {}),
    ...(typeof openWindow === 'boolean' ? { openWindow } : {}),
    ...(onboarded ? { onboarded: true } : {}),
  });
}
