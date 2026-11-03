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
      dockBackground: isDark ? "hsla(225, 14%, 11%, 0.97)" : "hsla(220, 24%, 99%, 0.97)",
      handleIndicator: isDark ? "hsl(220 8% 58%)" : "hsl(222 8% 43%)",
      mutedInk: isDark ? "hsl(220 8% 67%)" : "hsl(222 8% 43%)",
      surface: isDark ? "hsl(225 11% 14%)" : "hsl(220 15% 93%)",
      tabInactive: isDark ? "hsl(220 8% 58%)" : "hsl(222 8% 43%)",
    },
  };
}
