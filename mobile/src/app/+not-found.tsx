import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Link } from "expo-router";

export default function NotFoundScreen() {
  return (
    <Screen contentClassName="justify-center">
      <AppHeader
        subtitle="The route you opened does not exist in this base app."
        title="Not found"
      />
      <Link asChild href="/(app)">
        <Button>
          <Text>Back to home</Text>
        </Button>
      </Link>
    </Screen>
  );
}
