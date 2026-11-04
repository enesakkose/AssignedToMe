import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, View } from "react-native";

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * Desktop's DatePicker: a pill showing the date ("Today", "3 Nov"); tapping it opens the system calendar (inline under
 * the pill on iOS, a dialog on Android). Never the bare native field.
 */
export function DatePicker({
  value,
  onChange,
  max,
  label,
  className,
}: {
  value: Date;
  onChange: (date: Date) => void;
  max?: Date;
  /** For screen readers: what the date is for. */
  label: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const text = sameDay(value, now)
    ? t("ui.today")
    : value.toLocaleDateString(i18n.language, {
        day: "numeric",
        month: "short",
        ...(value.getFullYear() !== now.getFullYear() && { year: "numeric" }),
        weekday: "short",
      });

  return (
    <View className={cn("items-start gap-2", className)}>
      <Pressable
        accessibilityLabel={`${label}: ${text}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className={cn(
          "h-10 flex-row items-center gap-2 rounded-full bg-paper-3 px-4 active:scale-[0.97]",
          open && "bg-rule",
        )}
        onPress={() => setOpen((v) => !v)}
      >
        <Icon as={Calendar} className="text-muted-foreground" size={16} />
        <Text className="text-sm font-medium">{text}</Text>
        <Icon
          as={ChevronDown}
          className="text-muted-foreground"
          size={14}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open ? (
        <DateTimePicker
          accentColor={theme.tokens.primary}
          display={Platform.OS === "ios" ? "inline" : "default"}
          locale={i18n.language}
          maximumDate={max}
          mode="date"
          onChange={(event, picked) => {
            setOpen(false);
            if (event.type === "set" && picked) onChange(picked);
          }}
          themeVariant={theme.colorScheme}
          value={value}
        />
      ) : null}
    </View>
  );
}
