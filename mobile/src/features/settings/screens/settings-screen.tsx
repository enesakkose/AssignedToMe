import { getProvider } from "@mytask/core";
import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { useConnectionsStore } from "@/features/connections/api/connections";
import { ProviderLogo } from "@/features/connections/components/provider-logo";
import { type ThemePreference } from "@/hooks/use-app-theme";
import { appMetadata } from "@/lib/app";
import { i18n } from "@/lib/i18n";
import { type AppLocale } from "@/lib/localization";
import {
  isNotificationGranted,
  openNotificationSettings,
  requestNotificationPermission,
} from "@/lib/notifications";
import { REFRESH_CHOICES_MIN, usePersistStore } from "@/stores/persist-store";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

/** A setting: its label (and hint) on the left, the control on the right, as on desktop. */
function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <View className="min-h-11 flex-row items-center justify-between gap-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text>{label}</Text>
        {hint ? (
          <Text className="text-sm leading-5" variant="muted">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const connections = useConnectionsStore((s) => s.connections);
  const { theme, setTheme, refreshMinutes, setRefreshMinutes, setLocale } = usePersistStore();
  // Re-read on return to the app, since it can only be changed in iOS Settings.
  const permission = useQuery({
    queryKey: ["notification-permission"],
    queryFn: isNotificationGranted,
  });
  const refreshOptions = REFRESH_CHOICES_MIN.map((m) => ({
    label: m < 60 ? t("settings.minutesShort", { m }) : t("settings.hourShort"),
    value: String(m),
  }));

  return (
    <Screen header={<AppHeader title={t("settings.title")} />}>
      <Section description={t("settings.boardsHint")} flush title={t("settings.boards")}>
        <View>
          {connections.map((c) => {
            const provider = getProvider(c.providerId);
            return (
              <Pressable
                accessibilityRole="button"
                className="min-h-16 flex-row items-center gap-3 border-t border-rule px-5 py-3 active:bg-paper-2"
                key={c.id}
                onPress={() => router.push({ params: { id: c.id }, pathname: "/connection" })}
              >
                {provider ? <ProviderLogo provider={provider} /> : null}
                <View className="min-w-0 flex-1">
                  <Text className="font-medium" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text className="text-sm" numberOfLines={1} variant="muted">
                    {[provider?.name, c.values.domain].filter(Boolean).join(" ")}
                  </Text>
                </View>
                <Icon as={ChevronRight} className="text-muted-foreground" size={16} />
              </Pressable>
            );
          })}
          <View className={connections.length ? "border-t border-rule px-5 py-4" : "px-5 pb-5"}>
            <Button className="self-start" onPress={() => router.push("/connection")}>
              <Icon as={Plus} className="text-primary-foreground" size={16} />
              <Text>{t("connections.add")}</Text>
            </Button>
          </View>
        </View>
      </Section>

      <Section title={t("settings.general")}>
        <Row label={t("settings.theme")}>
          <SegmentedControl<ThemePreference>
            label={t("settings.theme")}
            onValueChange={setTheme}
            options={[
              { label: t("settings.themeSystem"), value: "system" },
              { label: t("settings.themeLight"), value: "light" },
              { label: t("settings.themeDark"), value: "dark" },
            ]}
            value={theme}
          />
        </Row>
        <Row label={t("settings.language")}>
          {/* Each language names itself, so it can be found whatever the current one is. */}
          <SegmentedControl<AppLocale>
            label={t("settings.language")}
            onValueChange={(v) => {
              setLocale(v);
              void i18n.changeLanguage(v);
            }}
            options={[
              { label: "English", value: "en" },
              { label: "Türkçe", value: "tr" },
            ]}
            value={i18n.language as AppLocale}
          />
        </Row>
        <Row hint={t("settings.refreshHint")} label={t("settings.refreshEvery")}>
          <Select
            onValueChange={(option) => option && setRefreshMinutes(Number(option.value))}
            value={refreshOptions.find((o) => o.value === String(refreshMinutes))}
          >
            <SelectTrigger className="h-9 border-0 bg-paper-3 shadow-none">
              <SelectValue
                className="text-sm font-medium"
                placeholder={t("settings.refreshEvery")}
              />
            </SelectTrigger>
            <SelectContent align="end" className="min-w-36" insets={{ left: 20, right: 20 }}>
              {refreshOptions.map((o) => (
                <SelectItem key={o.value} label={o.label} value={o.value}>
                  <Text>{o.label}</Text>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row
          hint={
            permission.data === false
              ? t("settings.notificationsOff")
              : t("settings.notificationsHint")
          }
          label={t("settings.notifications")}
        >
          {/* iOS asks once; after that the switch lives in iOS Settings, so send the user there. */}
          <Button
            onPress={async () => {
              const granted = await requestNotificationPermission().catch(() => false);
              if (!granted || permission.data) await openNotificationSettings();
              void permission.refetch();
            }}
            size="sm"
            variant="secondary"
          >
            <Text>{permission.data ? t("settings.openSystem") : t("settings.allow")}</Text>
          </Button>
        </Row>
      </Section>

      <Text className="px-5 py-4 font-mono text-xs" variant="muted">
        {t("settings.version", { version: appMetadata.version })}
      </Text>
    </Screen>
  );
}
