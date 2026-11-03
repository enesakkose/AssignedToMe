import { Text } from "@/components/ui/text";
import { type ReactNode } from "react";
import { View } from "react-native";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  actions?: ReactNode;
};

/** Desktop's slim top bar: title on the left, actions on the right, a hairline under it. */
export function AppHeader({ title, subtitle, leading, actions }: AppHeaderProps) {
  return (
    <View className="border-b border-rule">
      <View className="h-14 flex-row items-center gap-1 px-3">
        {leading}
        <Text
          accessibilityRole="header"
          className="min-w-0 flex-1 px-2 text-[17px] font-semibold"
          numberOfLines={1}
        >
          {title}
        </Text>
        {actions ? <View className="flex-row items-center gap-1">{actions}</View> : null}
      </View>
      {subtitle ? (
        <Text className="px-5 pb-3 text-sm leading-5" variant="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
