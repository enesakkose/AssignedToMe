import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation";

export const THEME = {
  dark: {
    accent: "hsl(225 10% 21%)",
    background: "hsl(225 15% 8%)",
    border: "hsl(225 9% 25%)",
    card: "hsl(225 14% 11%)",
    destructive: "hsl(358 58% 58%)",
    foreground: "hsl(220 18% 93%)",
    input: "hsl(225 9% 25%)",
    muted: "hsl(225 10% 16%)",
    popover: "hsl(225 14% 11%)",
    primary: "hsl(220 18% 93%)",
    radius: "1.25rem",
    ring: "hsl(220 18% 93%)",
    secondary: "hsl(225 10% 17%)",
  },
  light: {
    accent: "hsl(220 14% 89%)",
    background: "hsl(220 18% 96%)",
    border: "hsl(220 11% 82%)",
    card: "hsl(220 24% 99%)",
    destructive: "hsl(358 58% 44%)",
    foreground: "hsl(225 12% 12%)",
    input: "hsl(220 11% 82%)",
    muted: "hsl(220 14% 92%)",
    popover: "hsl(220 24% 99%)",
    primary: "hsl(225 12% 12%)",
    radius: "1.25rem",
    ring: "hsl(225 12% 12%)",
    secondary: "hsl(220 13% 91%)",
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
