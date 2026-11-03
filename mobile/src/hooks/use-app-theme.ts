import { NAV_THEME, THEME } from "@/lib/theme";
import { useColorScheme } from "nativewind";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedColorScheme = "dark" | "light";

export function useAppTheme() {
  const nativeWindTheme = useColorScheme();
  const colorScheme = (nativeWindTheme.colorScheme ?? "light") as ResolvedColorScheme;
  const isDark = colorScheme === "dark";

  return {
    colorScheme,
    isDark,
    navigationTheme: NAV_THEME[colorScheme],
    rootClassName: isDark ? "dark flex-1" : "flex-1",
    setColorScheme: nativeWindTheme.setColorScheme,
    tokens: THEME[colorScheme],
    toggleColorScheme: nativeWindTheme.toggleColorScheme,
    values: {
      bottomSheetBackdropOpacity: isDark ? 0.54 : 0.22,
      // Paper-2 at 97% (raised from the page), muted ink and the paper-2 fill (global.css).
      dockBackground: isDark ? "hsla(217, 5.1%, 10.9%, 0.97)" : "hsla(211, 19.9%, 96.6%, 0.97)",
      handleIndicator: isDark ? "hsl(214 3% 59.9%)" : "hsl(217 4% 34.9%)",
      mutedInk: isDark ? "hsl(214 3% 59.9%)" : "hsl(217 4% 34.9%)",
      surface: isDark ? "hsl(217 5.1% 10.9%)" : "hsl(211 10% 93.1%)",
      tabInactive: isDark ? "hsl(214 3% 59.9%)" : "hsl(217 4% 34.9%)",
    },
  };
}
