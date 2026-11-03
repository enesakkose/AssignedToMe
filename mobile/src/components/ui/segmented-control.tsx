import { Text } from "@/components/ui/text";
import { hapticSelection } from "@/lib/utils/haptics";
import { cn } from "@/lib/utils";
import { Pressable, View } from "react-native";

type Option<T extends string> = { value: T; label: string };

/** One-of-few choice shown inline (desktop's SegmentedControl): a paper-3 track, the chosen pill on paper. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="radiogroup"
      className={cn("flex-row rounded-full bg-paper-3 p-0.5", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={cn(
              "h-9 items-center justify-center rounded-full px-3.5 active:scale-[0.96]",
              selected && "bg-background",
            )}
            hitSlop={{ bottom: 4, top: 4 }}
            key={o.value}
            onPress={() => {
              if (selected) return;
              void hapticSelection();
              onValueChange(o.value);
            }}
          >
            <Text
              className={cn(
                "text-sm font-medium",
                selected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
