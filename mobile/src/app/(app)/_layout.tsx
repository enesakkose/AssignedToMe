import { Icon } from "@/components/ui/icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { APP_FONT_FAMILY } from "@/lib/theme";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { Home, PanelsTopLeft, Settings } from "lucide-react-native";
import { Pressable, Text as RNText, useWindowDimensions, View } from "react-native";

const tabMeta: Record<string, { icon: typeof Home; label: string }> = {
  index: { icon: Home, label: "Home" },
  playground: { icon: PanelsTopLeft, label: "Playground" },
  settings: { icon: Settings, label: "Settings" },
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
            fontFamily: isFocused ? APP_FONT_FAMILY.extraBold : APP_FONT_FAMILY.bold,
            fontSize: 11,
            fontWeight: isFocused ? "800" : "700",
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
        className="flex-row items-center rounded-[30px] border"
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
              label={meta.label}
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
  );
}
