import { type ThemePreference } from "@/hooks/use-app-theme";
import { type AppLocale } from "@/lib/localization";
import { mmkvStorage } from "@/lib/storage/mmkv-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Same choices as desktop's Settings → Refresh.
export const REFRESH_CHOICES_MIN = [1, 15, 30, 60] as const;

// Non-secret preferences only; API keys live in SecureStore (src/lib/secrets.ts).
type PersistState = {
  onboardingCompleted: boolean;
  setOnboardingCompleted: (value: boolean) => void;
  /** null follows the device language. */
  locale: AppLocale | null;
  setLocale: (value: AppLocale) => void;
  refreshMinutes: number;
  setRefreshMinutes: (value: number) => void;
  theme: ThemePreference;
  setTheme: (value: ThemePreference) => void;
};

export const usePersistStore = create<PersistState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      setOnboardingCompleted: (value) => set({ onboardingCompleted: value }),
      locale: null,
      setLocale: (value) => set({ locale: value }),
      refreshMinutes: 60,
      setRefreshMinutes: (value) => set({ refreshMinutes: value }),
      theme: "system",
      setTheme: (value) => set({ theme: value }),
    }),
    {
      name: "persist-store",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
