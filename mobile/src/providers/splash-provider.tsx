import { SplashScreenView } from "@/features/splash/screens/splash-screen";
import { APP_FONTS } from "@/lib/theme";
import * as ExpoSplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { type PropsWithChildren, useEffect, useState } from "react";

void ExpoSplashScreen.preventAutoHideAsync();

export function SplashProvider({ children }: PropsWithChildren) {
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!fontsLoaded && !fontError) {
      return;
    }

    // Ready as soon as the fonts are in (or failed, then the system font stands in): no artificial wait.
    setIsReady(true);
    void ExpoSplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!isReady) {
    return <SplashScreenView />;
  }

  return children;
}
