import { providers } from "@mytask/core";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ProviderLogo } from "@/features/connections/components/provider-logo";
import { requestNotificationPermission } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { usePersistStore } from "@/stores/persist-store";
import { router } from "expo-router";
import { ArrowRight, Bell, KeyRound, Layers, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const LOGO = require("../../../../assets/images/splash-icon.png");

type Step = { key: string; icon?: LucideIcon };

// Desktop's steps minus "surfaces" (menubar vs window), which a phone doesn't have.
const STEPS: Step[] = [
  { key: "welcome" }, // uses the app mark
  { key: "boards", icon: Layers },
  { key: "providers" }, // uses the provider logo grid
  { key: "notify", icon: Bell },
  { key: "privacy", icon: KeyRound },
];

export function OnboardingScreen() {
  const { t } = useTranslation();
  const setOnboardingCompleted = usePersistStore((s) => s.setOnboardingCompleted);
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;

  const finish = () => {
    setOnboardingCompleted(true);
    router.replace("/(app)");
  };

  const next = async () => {
    // Ask right after the user reads what notifications are for; iOS shows its own dialog once.
    if (step.key === "notify") await requestNotificationPermission().catch(() => false);
    if (last) finish();
    else setI((n) => n + 1);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-8">
        {/* Re-keyed per step so the entrance replays. First-run only, so it may animate. */}
        <Animated.View
          className="w-full max-w-sm items-center"
          entering={FadeIn.duration(220)}
          key={step.key}
        >
          {step.key === "providers" ? (
            <View className="mb-6 w-full flex-row flex-wrap gap-2">
              {providers.map((p) => (
                <View
                  className="grow basis-[45%] flex-row items-center gap-2.5 rounded-lg border border-border bg-background p-2"
                  key={p.id}
                >
                  <ProviderLogo provider={p} />
                  <Text className="shrink text-sm font-medium" numberOfLines={1}>
                    {p.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : step.icon ? (
            <View className="mb-6 size-16 items-center justify-center rounded-2xl bg-brand-tile">
              <Icon as={step.icon} className="text-brand-mark" size={28} />
            </View>
          ) : (
            <Image
              accessibilityIgnoresInvertColors
              className="mb-6"
              source={LOGO}
              style={{ height: 64, width: 64 }}
            />
          )}
          <Text className="text-center text-2xl font-semibold">
            {t(`onboarding.${step.key}.title`)}
          </Text>
          <Text className="mt-2 text-center text-base leading-6 text-ink-2">
            {t(`onboarding.${step.key}.body`)}
          </Text>
        </Animated.View>
      </View>

      <View className="gap-5 px-6 pb-4">
        <View accessibilityElementsHidden className="flex-row items-center justify-center gap-1.5">
          {STEPS.map((s, n) => (
            <View
              className={cn("h-1.5 rounded-full", n === i ? "w-5 bg-primary" : "w-1.5 bg-border")}
              key={s.key}
            />
          ))}
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <Button onPress={finish} variant="ghost">
            <Text>{t("onboarding.skip")}</Text>
          </Button>
          <Button onPress={() => void next()}>
            <Text>{last ? t("onboarding.start") : t("onboarding.next")}</Text>
            {!last ? <Icon as={ArrowRight} className="text-primary-foreground" size={18} /> : null}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
