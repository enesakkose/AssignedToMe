import { emptyFilters, parseSavedFilters, type TaskFilters } from "@mytask/core";
import { mmkvStorage } from "@/lib/storage/mmkv-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type FiltersState = { byBoard: Record<string, TaskFilters> };

/** Filters per tab (board id or "all"), remembered across launches. A UI preference, never secrets. */
const useFilters = create<FiltersState>()(
  persist(() => ({ byBoard: {} as Record<string, TaskFilters> }), {
    name: "filters",
    storage: createJSONStorage(() => mmkvStorage),
    // Anything saved that no longer parses is dropped rather than half-applied.
    merge: (saved, current) => ({
      ...current,
      byBoard: parseSavedFilters((saved as FiltersState | undefined)?.byBoard) ?? {},
    }),
  }),
);

export function useBoardFilters(board: string) {
  const filters = useFilters((s) => s.byBoard[board]) ?? emptyFilters();
  const set = (next: TaskFilters) =>
    useFilters.setState((s) => ({ byBoard: { ...s.byBoard, [board]: next } }));
  return [filters, set] as const;
}
