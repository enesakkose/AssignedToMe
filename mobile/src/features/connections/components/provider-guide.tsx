import { fillGuide, isSafeUrl, type Provider } from "@mytask/core";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { currentLocale } from "@/lib/i18n";
import { ExternalLink } from "lucide-react-native";
import { Linking, View } from "react-native";

/** Step-by-step "how to get your key", generated from the provider definition. */
export function ProviderGuide({
  provider,
  values,
}: {
  provider: Provider;
  values: Record<string, string>;
}) {
  const locale = currentLocale();
  return (
    <View className="gap-4">
      {provider.guide.map((step, i) => (
        <View className="flex-row gap-3" key={i}>
          <View className="size-6 items-center justify-center rounded-full border border-border">
            <Text className="font-mono text-xs text-muted-foreground">{i + 1}</Text>
          </View>
          <View className="min-w-0 flex-1 gap-2">
            <Text className="text-[15px] leading-[22px] text-ink-2">{step.text[locale]}</Text>
            {step.link && isSafeUrl(step.link) ? (
              <Button
                className="self-start"
                onPress={() => void Linking.openURL(step.link!)}
                size="sm"
                variant="secondary"
              >
                <Icon as={ExternalLink} size={16} />
                <Text>{new URL(step.link).hostname}</Text>
              </Button>
            ) : null}
            {step.copy ? (
              // Long-press to copy; selectable text avoids a clipboard dependency.
              <Text
                className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm"
                selectable
              >
                {fillGuide(step.copy, values)}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
