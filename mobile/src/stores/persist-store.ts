import { mmkvStorage } from "@/lib/storage/mmkv-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PersistState = {
  onboardingCompleted: boolean;
  setOnboardingCompleted: (value: boolean) => void;
};

export const usePersistStore = create<PersistState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      setOnboardingCompleted: (value) => set({ onboardingCompleted: value }),
    }),
    {
      name: "persist-store",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
