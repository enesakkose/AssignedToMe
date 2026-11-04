import { isCancelled, type StatusCategory } from "@mytask/core";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { CircleCheck, CircleDashed, CircleDot, CircleX } from "lucide-react-native";
import { View } from "react-native";

const statuses = {
  done: { icon: CircleCheck, tone: "text-success" },
  in_progress: { icon: CircleDot, tone: "text-progress" },
  todo: { icon: CircleDashed, tone: "text-muted-foreground" },
} satisfies Record<StatusCategory, unknown>;

/** Status is coloured text with one icon, never a filled chip (same as desktop). */
export function Status({ category, label }: { category: StatusCategory; label: string }) {
  const { icon, tone } =
    category === "done" && isCancelled(label)
      ? { icon: CircleX, tone: "text-error" }
      : statuses[category];
  return (
    <View className="min-w-0 flex-row items-center gap-1">
      <Icon as={icon} className={tone} size={13} />
      <Text className={`shrink text-sm font-medium ${tone}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
