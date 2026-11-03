import { emptyFilters, parseSavedFilters, type TaskFilters } from '@mytask/core';
import { create } from 'zustand';
import { getStore } from '@/lib/store';

const KEY = 'filters';

type FiltersState = {
  byBoard: Record<string, TaskFilters>;
  set: (board: string, filters: TaskFilters) => void;
};

/** Filters per tab (board id or "all"), remembered across launches. A UI preference, never secrets. */
export const useFilters = create<FiltersState>((set, get) => ({
  byBoard: {},
  set: (board, filters) => {
    const byBoard = { ...get().byBoard, [board]: filters };
    set({ byBoard });
    // Saving is best effort: the filter still applies for this session if the store is unavailable.
    try {
      void getStore()
        .set(KEY, byBoard)
        .catch(() => undefined);
    } catch {
      // No store outside Tauri (browser preview).
    }
  },
}));

export function useBoardFilters(board: string) {
  const filters = useFilters((s) => s.byBoard[board]) ?? emptyFilters();
  const set = useFilters((s) => s.set);
  return [filters, (next: TaskFilters) => set(board, next)] as const;
}

/** Called once at boot. */
export async function loadFilters() {
  const saved = parseSavedFilters(await getStore().get(KEY));
  if (saved) useFilters.setState({ byBoard: saved });
}
