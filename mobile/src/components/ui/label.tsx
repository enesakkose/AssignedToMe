import { APP_FONT_FAMILY } from "@/lib/theme";
import { cn } from "@/lib/utils";
import * as LabelPrimitive from "@rn-primitives/label";
import { Platform } from "react-native";

function Label({
  className,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  disabled,
  style,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Text>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "flex select-none flex-row items-center gap-2",
        Platform.select({
          web: "cursor-default leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        }),
        disabled && "opacity-50",
      )}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <LabelPrimitive.Text
        className={cn(
          "text-foreground text-sm font-medium",
          Platform.select({ web: "leading-none" }),
          className,
        )}
        style={[{ fontFamily: APP_FONT_FAMILY.medium }, style]}
        {...props}
      />
    </LabelPrimitive.Root>
  );
}

export { Label };
