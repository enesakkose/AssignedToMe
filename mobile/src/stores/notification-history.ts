import { mmkvStorage } from "@/lib/storage/mmkv-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** One "new task assigned to you" event, as the Notifications tab lists it. Non-secret, so MMKV. */
export type NotificationEntry = {
  id: string;
  connectionId: string;
  board: string;
  key: string;
  title: string;
  /** Epoch ms. */
  at: number;
};

// Newest first; older entries fall off so the list (and storage) stays small.
const LIMIT = 100;

type State = {
  items: NotificationEntry[];
  /** Entries after this were not seen on the Notifications tab yet (drives the tab's dot). */
  seenAt: number;
  add: (entries: NotificationEntry[]) => void;
  markSeen: () => void;
  clear: () => void;
};

// Readable without React: the background refresh adds to it while the app is closed.
export const useNotificationHistory = create<State>()(
  persist(
    (set) => ({
      add: (entries) => set((s) => ({ items: [...entries, ...s.items].slice(0, LIMIT) })),
      clear: () => set({ items: [], seenAt: Date.now() }),
      items: [],
      markSeen: () => set({ seenAt: Date.now() }),
      seenAt: 0,
    }),
    { name: "notification-history", storage: createJSONStorage(() => mmkvStorage) },
  ),
);
