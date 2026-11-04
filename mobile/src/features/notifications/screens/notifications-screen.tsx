import { getProvider } from "@mytask/core";
import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { Text } from "@/components/ui/text";
import { useConnectionsStore } from "@/features/connections/api/connections";
import { ProviderLogo } from "@/features/connections/components/provider-logo";
import { openTask } from "@/features/tasks/components/task-row";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNotificationHistory } from "@/stores/notification-history";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

/** The new-task alerts this device raised, newest first; tap one to open its task. */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const { items, seenAt, markSeen, clear } = useNotificationHistory();
  const connections = useConnectionsStore((s) => s.connections);
  // What was unseen when the tab opened keeps its mark until the next visit, so you can see what's new.
  const [newSince, setNewSince] = useState(seenAt);
  useFocusEffect(
    useCallback(() => {
      setNewSince(useNotificationHistory.getState().seenAt);
      markSeen();
    }, [markSeen]),
  );

  return (
    <Screen
      header={
        <AppHeader
          actions={
            items.length ? (
              <Button onPress={clear} size="sm" variant="ghost">
                <Text>{t("notifications.clear")}</Text>
              </Button>
            ) : null
          }
          title={t("notifications.title")}
        />
      }
    >
      {items.length === 0 ? (
        <EmptyState
          description={t("notifications.emptyDescription")}
          title={t("notifications.emptyTitle")}
        />
      ) : (
        items.map((n) => {
          const connection = connections.find((c) => c.id === n.connectionId);
          const provider = getProvider(connection?.providerId ?? "");
          const fresh = n.at > newSince;
          return (
            <Pressable
              accessibilityHint={t("tasks.viewDetails")}
              accessibilityRole="button"
              className="flex-row gap-3 border-b border-rule px-5 py-3.5 active:bg-paper-2"
              // A board removed since then has nothing to open.
              disabled={!connection}
              key={n.id}
              onPress={() => openTask({ connectionId: n.connectionId, key: n.key })}
            >
              {provider ? <ProviderLogo provider={provider} /> : null}
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  {fresh ? (
                    <View accessibilityLabel="new" className="size-2 rounded-full bg-progress" />
                  ) : null}
                  <Text className="shrink text-sm" numberOfLines={1} variant="muted">
                    {t("notifications.assigned", { board: n.board })}
                  </Text>
                  <Text className="ml-auto text-xs" variant="muted">
                    {timeAgo(new Date(n.at).toISOString())}
                  </Text>
                </View>
                <Text className={cn("leading-[21px]", fresh && "font-semibold")} numberOfLines={2}>
                  <Text className="font-mono text-sm text-ink-2">{n.key}</Text> {n.title}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
