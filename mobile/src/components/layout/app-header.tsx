import { Text } from "@/components/ui/text";
import { View } from "react-native";

type AppHeaderProps = {
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

export function AppHeader({ eyebrow, subtitle, title }: AppHeaderProps) {
  return (
    <View className="gap-3 rounded-[32px] border border-border bg-card p-5">
      {eyebrow ? (
        <Text className="text-muted-foreground" variant="small">
          {eyebrow}
        </Text>
      ) : null}
      <Text className="max-w-2xl text-left" variant="h1">
        {title}
      </Text>
      {subtitle ? (
        <Text className="max-w-2xl text-base leading-6" variant="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
