import { Icon } from "@/components/ui/icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { APP_FONT_FAMILY } from "@/lib/theme";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { Bell, ListTodo, PanelsTopLeft, Settings } from "lucide-react-native";
import { BackgroundSync } from "@/features/tasks/components/background-sync";
import { useOpenTaskFromNotification } from "@/features/tasks/hooks/use-open-task-from-notification";
import { useNotificationHistory } from "@/stores/notification-history";
import { useTranslation } from "react-i18next";
import { Pressable, Text as RNText, useWindowDimensions, View } from "react-native";

const tabMeta: Record<string, { icon: typeof ListTodo; label: string }> = {
  index: { icon: ListTodo, label: "tabs.home" },
  notifications: { icon: Bell, label: "tabs.notifications" },
  playground: { icon: PanelsTopLeft, label: "tabs.playground" },
  settings: { icon: Settings, label: "tabs.settings" },
};

type TabItemProps = {
  activeColor: string;
  inactiveColor: string;
  isFocused: boolean;
  label: string;
  onPress: () => void;
  icon: typeof ListTodo;
  /** Something new behind this tab (unseen notifications). */
  dot?: boolean;
};

function TabItem({
  activeColor,
  inactiveColor,
  icon,
  isFocused,
  label,
  onPress,
  dot,
}: TabItemProps) {
  const color = isFocused ? activeColor : inactiveColor;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      className="flex-1 items-center justify-center px-0.5 active:scale-[0.97]"
      onPress={onPress}
    >
      <View
        className={
          isFocused
            ? "h-12 w-full items-center justify-center rounded-full bg-accent"
            : "h-12 w-full items-center justify-center rounded-full"
        }
      >
        <Icon
          as={icon}
          color={color}
          // Same size either way, so switching tabs doesn't make the icons jump.
          size={22}
          strokeWidth={isFocused ? 2.25 : 2}
        />
        {dot ? (
          <View className="absolute right-[30%] top-2 size-2 rounded-full bg-progress" />
        ) : null}
        <RNText
          style={{
            color,
            fontFamily: isFocused ? APP_FONT_FAMILY.semiBold : APP_FONT_FAMILY.medium,
            fontSize: 11,
            fontWeight: isFocused ? "600" : "500",
            lineHeight: 13,
            marginTop: 1,
          }}
        >
          {label}
        </RNText>
      </View>
    </Pressable>
  );
}

function DockTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // The playground is a developer tool, as on desktop: release builds don't show its tab.
  const routes = state.routes.filter((route) => __DEV__ || route.name !== "playground");
  const dockWidth = Math.min(16 + routes.length * 92, width - 40);
  const unseen = useNotificationHistory((h) => h.items.some((n) => n.at > h.seenAt));

  return (
    <View
      pointerEvents="box-none"
      style={{
        alignItems: "center",
        bottom: 28,
        left: 0,
        position: "absolute",
        right: 0,
      }}
    >
      <View
        accessibilityRole="tablist"
        className="flex-row items-center rounded-full border"
        style={{
          backgroundColor: theme.values.dockBackground,
          borderColor: theme.tokens.border,
          height: 62,
          paddingHorizontal: 8,
          width: dockWidth,
        }}
      >
        {routes.map((route) => {
          const isFocused = state.routes[state.index]?.key === route.key;
          const options = descriptors[route.key]?.options;
          const meta = tabMeta[route.name] ?? {
            icon: ListTodo,
            label: options?.title ?? route.name,
          };

          return (
            <TabItem
              activeColor={theme.tokens.foreground}
              icon={meta.icon}
              inactiveColor={theme.values.tabInactive}
              isFocused={isFocused}
              dot={route.name === "notifications" && unseen && !isFocused}
              key={route.key}
              label={t(meta.label)}
              onPress={() => {
                const event = navigation.emit({
                  canPreventDefault: true,
                  target: route.key,
                  type: "tabPress",
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function AppLayout() {
  useOpenTaskFromNotification();
  return (
    <>
      <BackgroundSync />
      <Tabs
        tabBar={(props) => <DockTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />
        <Tabs.Screen name="notifications" />
        <Tabs.Screen
          name="playground"
          options={{
            title: "Playground",
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
          }}
        />
      </Tabs>
    </>
  );
}
