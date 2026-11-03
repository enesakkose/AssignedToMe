import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppTheme, type ThemePreference } from "@/hooks/use-app-theme";
import { appMetadata } from "@/lib/app";
import { getNetworkState } from "@/lib/network";
import { asyncStorage } from "@/lib/storage";
import { useState } from "react";
import { View } from "react-native";
import { toast } from "sonner-native";

const themeModes: ThemePreference[] = ["light", "dark"];

export function SettingsScreen() {
  const theme = useAppTheme();
  const [networkValue, setNetworkValue] = useState<string>("not checked yet");
  const [savedValue, setSavedValue] = useState<string | null>(null);

  async function savePreference() {
    await asyncStorage.setItem("settings.lastThemeScheme", theme.colorScheme);
    const value = await asyncStorage.getItem("settings.lastThemeScheme");
    setSavedValue(value);
    toast.success("Preference stored", { description: `Saved resolved theme: ${value}` });
  }

  async function checkNetwork() {
    const state = await getNetworkState();
    const value = state.isOnline ? `online via ${state.type}` : "offline";

    setNetworkValue(value);
    toast.info("Network checked", { description: value });
  }

  return (
    <Screen>
      <AppHeader
        eyebrow="Settings"
        subtitle="Theme and storage examples live outside domain features."
        title="Settings"
      />

      <Section description="NativeWind controls the resolved color scheme directly." title="Theme">
        <ToggleGroup
          onValueChange={(value) => value && theme.setColorScheme(value as ThemePreference)}
          type="single"
          value={theme.colorScheme}
        >
          {themeModes.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              <Text className="capitalize">{item}</Text>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button onPress={() => theme.setColorScheme("system")} variant="outline">
          <Text>Use system theme</Text>
        </Button>
      </Section>

      <Section
        description="Non-sensitive settings use AsyncStorage; tokens should use SecureStore."
        title="Storage"
      >
        <Button onPress={savePreference}>
          <Text>Save theme preference</Text>
        </Button>
        <View className="rounded-md border border-border bg-surface p-3">
          <Text variant="muted">Stored value: {savedValue ?? "not saved yet"}</Text>
        </View>
      </Section>

      <Section
        description="Expo native metadata and network helpers are centralized in src/lib."
        title="Native metadata"
      >
        <View className="gap-2 rounded-md border border-border bg-surface p-4">
          <Text>Version {appMetadata.version}</Text>
          <Text variant="muted">Build {appMetadata.buildNumber}</Text>
          <Text variant="muted">Bundle {appMetadata.bundleIdentifier}</Text>
          <Text variant="muted">
            Device {appMetadata.device.modelName ?? "unknown"} /{" "}
            {appMetadata.device.osName ?? "unknown"}
          </Text>
        </View>
        <Button haptic="light" onPress={checkNetwork} variant="outline">
          <Text>Check network</Text>
        </Button>
        <View className="rounded-md border border-border bg-surface p-3">
          <Text variant="muted">Network: {networkValue}</Text>
        </View>
      </Section>
    </Screen>
  );
}
