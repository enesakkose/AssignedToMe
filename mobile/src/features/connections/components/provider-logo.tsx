import type { Provider } from "@mytask/core";
import { useAppTheme } from "@/hooks/use-app-theme";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";

/** The provider's built-in SVG mark (a trusted constant in core, not fetched data) on a small paper tile; `bare` drops the tile. */
export function ProviderLogo({ provider, bare }: { provider: Provider; bare?: boolean }) {
  const theme = useAppTheme();
  if (bare)
    return (
      <SvgXml color={theme.tokens.foreground} height="100%" width="100%" xml={provider.logo} />
    );
  return (
    <View
      accessibilityLabel={provider.name}
      accessibilityRole="image"
      className="size-9 items-center justify-center rounded-md border border-border bg-background p-1.5"
    >
      {/* Monochrome marks use currentColor, which follows the theme's ink through `color`. */}
      <SvgXml color={theme.tokens.foreground} height="100%" width="100%" xml={provider.logo} />
    </View>
  );
}
