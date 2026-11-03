import { SplashScreenView } from "@/features/splash/screens/splash-screen";
import { APP_FONTS } from "@/lib/theme";
import * as ExpoSplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { type PropsWithChildren, useEffect, useState } from "react";

const MOCK_BOOT_DELAY_MS = 3000;

void ExpoSplashScreen.preventAutoHideAsync();

export function SplashProvider({ children }: PropsWithChildren) {
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!fontsLoaded && !fontError) {
      return;
    }

    let isMounted = true;

    async function boot() {
      await new Promise((resolve) => setTimeout(resolve, MOCK_BOOT_DELAY_MS));

      if (!isMounted) {
        return;
      }

      setIsReady(true);
      await ExpoSplashScreen.hideAsync();
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, [fontError, fontsLoaded]);

  if (!isReady) {
    return <SplashScreenView />;
  }

  return children;
}
