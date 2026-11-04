import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

/** A token/password field with show/hide, like desktop's SecretInput. */
export function SecretInput(props: React.ComponentProps<typeof Input>) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <View className="justify-center">
      <Input {...props} className="pr-12" secureTextEntry={!shown} />
      <Pressable
        accessibilityLabel={shown ? t("ui.hide") : t("ui.show")}
        accessibilityRole="button"
        className="absolute right-1 size-11 items-center justify-center rounded-full active:bg-paper-3"
        onPress={() => setShown((v) => !v)}
      >
        <Icon as={shown ? EyeOff : Eye} className="text-muted-foreground" size={18} />
      </Pressable>
    </View>
  );
}
