import { create } from "zustand";

/** Set once every board's first data is in (from cache or network), so the splash can lift on a whole list. */
export const useBoot = create<{ tasksReady: boolean }>(() => ({ tasksReady: false }));
