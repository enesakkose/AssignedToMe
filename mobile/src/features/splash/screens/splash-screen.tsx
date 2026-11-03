import { Text } from "@/components/ui/text";
import { ActivityIndicator, View } from "react-native";

export function SplashScreenView() {
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background px-8">
      <View className="size-20 items-center justify-center rounded-2xl bg-primary">
        <Text className="text-3xl font-bold text-primary-foreground">RB</Text>
      </View>
      <View className="items-center gap-2">
        <Text variant="large">RN Base</Text>
        <Text className="text-center" variant="muted">
          Bootstrapping providers, theme and app state.
        </Text>
      </View>
      <ActivityIndicator color="hsl(225 12% 12%)" />
    </View>
  );
}
