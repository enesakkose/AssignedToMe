import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";

// Same families as desktop (desktop/DESIGN.md): Instrument Sans for everything, JetBrains Mono for machine values
// (task keys, tokens, commands). Display and body differ by weight only.
export const FONT_VARIABLE = "--font-instrument-sans";

export const APP_FONT_FAMILY = {
  bold: "InstrumentSans_700Bold",
  medium: "InstrumentSans_500Medium",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  regular: "InstrumentSans_400Regular",
  semiBold: "InstrumentSans_600SemiBold",
} as const;

export const APP_FONTS = {
  [APP_FONT_FAMILY.bold]: InstrumentSans_700Bold,
  [APP_FONT_FAMILY.medium]: InstrumentSans_500Medium,
  [APP_FONT_FAMILY.mono]: JetBrainsMono_400Regular,
  [APP_FONT_FAMILY.monoMedium]: JetBrainsMono_500Medium,
  [APP_FONT_FAMILY.regular]: InstrumentSans_400Regular,
  [APP_FONT_FAMILY.semiBold]: InstrumentSans_600SemiBold,
};

/** React Native picks a weight by font file, not fontWeight, so map the weight class to the right file. */
export function getFontFamilyForClassName(className?: string) {
  if (!className) {
    return APP_FONT_FAMILY.regular;
  }

  const heavier = /font-(medium|semibold|bold|extrabold)/.test(className);
  if (className.includes("font-mono")) {
    return heavier ? APP_FONT_FAMILY.monoMedium : APP_FONT_FAMILY.mono;
  }

  if (/font-(bold|extrabold)/.test(className)) {
    return APP_FONT_FAMILY.bold;
  }

  if (className.includes("font-semibold")) {
    return APP_FONT_FAMILY.semiBold;
  }

  if (className.includes("font-medium")) {
    return APP_FONT_FAMILY.medium;
  }

  return APP_FONT_FAMILY.regular;
}
