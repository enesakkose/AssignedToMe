import { APP_FONTS } from "@/lib/theme";
import { useBoot } from "@/stores/boot";
import { usePersistStore } from "@/stores/persist-store";
import * as ExpoSplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { type PropsWithChildren, useEffect, useState } from "react";

void ExpoSplashScreen.preventAutoHideAsync();
// Lifting the splash fades instead of cutting, so the hand-over to the app (and its theme) isn't a flash.
ExpoSplashScreen.setOptions({ duration: 250, fade: true });

// First launch without a cache waits for the network at most this long before showing what it has.
const MAX_WAIT_MS = 5000;

/**
 * The native splash stays up while the app renders underneath, and lifts once the fonts are in and the task list is
 * whole (from the cache, or the first fetch), so nothing fills in board by board on screen.
 */
export function SplashProvider({ children }: PropsWithChildren) {
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);
  const fontsReady = fontsLoaded || !!fontError;
  const onboarded = usePersistStore((s) => s.onboardingCompleted);
  const tasksReady = useBoot((s) => s.tasksReady);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(id);
  }, []);

  // Onboarding has no task list to wait for.
  const ready = fontsReady && (!onboarded || tasksReady || timedOut);
  useEffect(() => {
    if (ready) void ExpoSplashScreen.hideAsync();
  }, [ready]);

  // Until the fonts are in, render nothing: the native splash is still covering the screen.
  return fontsReady ? children : null;
}
