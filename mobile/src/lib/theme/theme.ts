import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation";

// JS mirror of global.css for places that need a color value, not a class (navigation, native props).
export const THEME = {
  dark: {
    accent: "hsl(216 3.9% 14.3%)",
    background: "hsl(217 8.4% 6.6%)",
    border: "hsl(216 3.7% 15.2%)",
    card: "hsl(217 8.4% 6.6%)",
    destructive: "hsl(5 91.7% 70%)",
    foreground: "hsl(211 8.7% 92.3%)",
    input: "hsl(216 3.7% 15.2%)",
    muted: "hsl(217 5.1% 10.9%)",
    popover: "hsl(217 5.1% 10.9%)",
    primary: "hsl(211 5.8% 88.4%)",
    radius: "10px",
    ring: "hsl(214 7.4% 77.2%)",
    secondary: "hsl(216 3.9% 14.3%)",
  },
  light: {
    accent: "hsl(212 7.3% 90.5%)",
    background: "hsl(211 19.9% 96.6%)",
    border: "hsl(212 5.8% 87.9%)",
    card: "hsl(211 19.9% 96.6%)",
    destructive: "hsl(0 68.8% 44.1%)",
    foreground: "hsl(217 8.9% 9.8%)",
    input: "hsl(212 5.8% 87.9%)",
    muted: "hsl(211 10% 93.1%)",
    popover: "hsl(211 19.9% 96.6%)",
    primary: "hsl(217 6.4% 14.4%)",
    radius: "10px",
    ring: "hsl(217 5.6% 30.7%)",
    secondary: "hsl(212 7.3% 90.5%)",
  },
};

export const NAV_THEME: Record<"dark" | "light", Theme> = {
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
};
