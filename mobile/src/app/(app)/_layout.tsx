import { Icon } from "@/components/ui/icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { APP_FONT_FAMILY } from "@/lib/theme";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { Home, PanelsTopLeft, Settings } from "lucide-react-native";
import { BackgroundSync } from "@/features/tasks/components/background-sync";
import { useTranslation } from "react-i18next";
import { Pressable, Text as RNText, useWindowDimensions, View } from "react-native";

const tabMeta: Record<string, { icon: typeof Home; label: string }> = {
  index: { icon: Home, label: "tabs.home" },
  playground: { icon: PanelsTopLeft, label: "tabs.playground" },
  settings: { icon: Settings, label: "tabs.settings" },
};

type TabItemProps = {
  activeColor: string;
  inactiveColor: string;
  isFocused: boolean;
  label: string;
  onPress: () => void;
  icon: typeof Home;
};

function TabItem({ activeColor, inactiveColor, icon, isFocused, label, onPress }: TabItemProps) {
  const color = isFocused ? activeColor : inactiveColor;

  return (
    <Pressable className="flex-1 items-center justify-center active:scale-[0.96]" onPress={onPress}>
      <View
        className={
          isFocused
            ? "h-12 w-24 items-center justify-center rounded-full bg-accent"
            : "h-12 w-20 items-center justify-center rounded-full"
        }
      >
        <Icon
          as={icon}
          color={color}
          size={isFocused ? 24 : 23}
          strokeWidth={isFocused ? 2.35 : 2}
        />
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

function MicaTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const dockWidth = Math.min(330, width - 72);

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
        className="flex-row items-center rounded-full border"
        style={{
          backgroundColor: theme.values.dockBackground,
          borderColor: theme.tokens.border,
          height: 62,
          paddingHorizontal: 8,
          width: dockWidth,
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const options = descriptors[route.key]?.options;
          const meta = tabMeta[route.name] ?? { icon: Home, label: options?.title ?? route.name };

          return (
            <TabItem
              activeColor={theme.tokens.foreground}
              icon={meta.icon}
              inactiveColor={theme.values.tabInactive}
              isFocused={isFocused}
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
  return (
    <>
      <BackgroundSync />
      <Tabs
        tabBar={(props) => <MicaTabBar {...props} />}
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
