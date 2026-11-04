import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

/** A search input with its icon and a clear button (desktop's SearchField). */
export function SearchField({
  value,
  onChangeText,
  label,
}: {
  value: string;
  onChangeText: (v: string) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 flex-1 justify-center">
      <View className="absolute left-3.5 z-10" pointerEvents="none">
        <Icon as={Search} className="text-muted-foreground" size={16} />
      </View>
      <Input
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        className="border-0 bg-paper-3 pl-10 pr-11"
        clearButtonMode="never"
        onChangeText={onChangeText}
        placeholder={label}
        returnKeyType="search"
        value={value}
      />
      {value ? (
        <Pressable
          accessibilityLabel={t("ui.clearSearch")}
          accessibilityRole="button"
          className="absolute right-0 size-11 items-center justify-center"
          onPress={() => onChangeText("")}
        >
          <Icon as={X} className="text-muted-foreground" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}
