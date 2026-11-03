import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

export const FONT_VARIABLE = "--font-plus-jakarta-sans";

export const APP_FONT_FAMILY = {
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
  medium: "PlusJakartaSans_500Medium",
  regular: "PlusJakartaSans_400Regular",
  semiBold: "PlusJakartaSans_600SemiBold",
} as const;

export const APP_FONTS = {
  [APP_FONT_FAMILY.bold]: PlusJakartaSans_700Bold,
  [APP_FONT_FAMILY.extraBold]: PlusJakartaSans_800ExtraBold,
  [APP_FONT_FAMILY.medium]: PlusJakartaSans_500Medium,
  [APP_FONT_FAMILY.regular]: PlusJakartaSans_400Regular,
  [APP_FONT_FAMILY.semiBold]: PlusJakartaSans_600SemiBold,
};

export function getFontFamilyForClassName(className?: string) {
  if (!className || className.includes("font-mono")) {
    return undefined;
  }

  if (className.includes("font-extrabold")) {
    return APP_FONT_FAMILY.extraBold;
  }

  if (className.includes("font-bold")) {
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
