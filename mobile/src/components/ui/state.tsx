import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { CircleAlert } from "lucide-react-native";
import { View } from "react-native";

/** What broke and what to do about it (desktop's ErrorState). */
export function ErrorState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      className={cn("cut flex-row gap-2.5 border border-error/30 bg-error-wash p-3", className)}
    >
      <Icon as={CircleAlert} className="mt-0.5 text-error" size={16} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-medium">{title}</Text>
        {description ? <Text className="text-sm leading-5 text-ink-2">{description}</Text> : null}
      </View>
    </View>
  );
}
