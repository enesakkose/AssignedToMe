import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { formatExampleStatus } from "@/features/example/utils/format-example-status";
import type { ExampleItem } from "@/features/example/types";
import { View } from "react-native";

type ExampleItemCardProps = {
  item: ExampleItem;
};

export function ExampleItemCard({ item }: ExampleItemCardProps) {
  return (
    <View className="gap-3 rounded-[24px] border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 font-semibold">{item.title}</Text>
        <Badge variant="outline">
          <Text>{formatExampleStatus(item.status)}</Text>
        </Badge>
      </View>
      <Text variant="muted">Owner: {item.owner}</Text>
    </View>
  );
}
