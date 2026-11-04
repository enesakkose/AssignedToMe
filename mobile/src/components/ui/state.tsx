import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { CircleAlert } from "lucide-react-native";
import { type ReactNode } from "react";
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

/** What belongs here and the one action that fills it (desktop's EmptyState). */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center gap-2 px-8 py-16">
      <Text className="text-center text-[17px] font-semibold">{title}</Text>
      {description ? (
        <Text className="max-w-72 text-center text-sm leading-5" variant="muted">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}
