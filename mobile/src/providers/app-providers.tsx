import "@/lib/i18n";

import { useAppTheme } from "@/hooks/use-app-theme";
import { APP_FONT_FAMILY } from "@/lib/theme";
import { queryClient } from "@/lib/query";
import { SplashProvider } from "@/providers/splash-provider";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider } from "expo-router/react-navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { usePersistStore } from "@/stores/persist-store";
import { type PropsWithChildren, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DropProvider } from "react-native-reanimated-dnd";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";

export function AppProviders({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const themePreference = usePersistStore((s) => s.theme);
  const { setColorScheme } = theme;

  useEffect(() => setColorScheme(themePreference), [setColorScheme, themePreference]);

  return (
    <GestureHandlerRootView className={theme.rootClassName}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={theme.navigationTheme}>
            <BottomSheetModalProvider>
              <DropProvider>
                <SplashProvider>
                  {children}
                  {/* Desktop's toast: paper, a hairline, cut corners; colour only on the icon. */}
                  <Toaster
                    position="top-center"
                    theme={theme.colorScheme}
                    toastOptions={{
                      descriptionStyle: {
                        color: theme.values.mutedInk,
                        fontFamily: APP_FONT_FAMILY.regular,
                      },
                      style: {
                        backgroundColor: theme.tokens.popover,
                        borderBottomLeftRadius: 3,
                        borderBottomRightRadius: 10,
                        borderColor: theme.tokens.border,
                        borderTopLeftRadius: 10,
                        borderTopRightRadius: 3,
                        borderWidth: 1,
                      },
                      titleStyle: {
                        color: theme.tokens.foreground,
                        fontFamily: APP_FONT_FAMILY.medium,
                      },
                    }}
                  />
                </SplashProvider>
              </DropProvider>
            </BottomSheetModalProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
