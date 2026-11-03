import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Section } from "@/components/layout/section";
import { Text } from "@/components/ui/text";
import { ExampleItemCard } from "@/features/example/components/example-item-card";
import { useExampleItems } from "@/features/example/hooks/use-example-items";
import { View } from "react-native";

export function ExampleScreen() {
  const itemsQuery = useExampleItems();

  return (
    <Screen>
      <AppHeader
        eyebrow="Example feature"
        subtitle="A mock feature that demonstrates the recommended feature folder shape."
        title="Feature structure"
      />

      <Section
        description="Screens compose feature-local hooks, components, types, schemas, api and utils."
        title="Mock items"
      >
        {itemsQuery.isLoading ? <Text variant="muted">Loading example items...</Text> : null}
        <View className="gap-3">
          {itemsQuery.data?.map((item) => (
            <ExampleItemCard item={item} key={item.id} />
          ))}
        </View>
      </Section>
    </Screen>
  );
}
