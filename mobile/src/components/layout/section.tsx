import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { type PropsWithChildren } from "react";
import { View } from "react-native";

type SectionProps = PropsWithChildren<{
  description?: string;
  title: string;
  /** Content runs edge to edge (lists); the heading keeps its inset. */
  flush?: boolean;
}>;

/** Desktop's section: a heading and its content, divided from the next by a hairline rule. No card. */
export function Section({ children, description, title, flush }: SectionProps) {
  return (
    <View className={cn("gap-3 border-b border-rule py-5", flush ? "pb-0" : "px-5")}>
      <View className={cn("gap-0.5", flush && "px-5")}>
        <Text className="text-base font-semibold">{title}</Text>
        {description ? (
          <Text className="text-sm leading-5" variant="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
