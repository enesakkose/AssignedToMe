import { Text } from "@/components/ui/text";
import { type PropsWithChildren } from "react";
import { View } from "react-native";

type SectionProps = PropsWithChildren<{
  description?: string;
  title: string;
}>;

export function Section({ children, description, title }: SectionProps) {
  return (
    <View className="gap-4 rounded-[28px] border border-border bg-card p-5">
      <View className="gap-1">
        <Text className="text-xl font-semibold leading-tight">{title}</Text>
        {description ? (
          <Text className="max-w-2xl" variant="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <View className="gap-4">{children}</View>
    </View>
  );
}
