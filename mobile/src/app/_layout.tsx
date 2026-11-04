import "../../global.css";
// Defines the background refresh task at startup, also when iOS launches the app headless just to run it.
import "@/features/tasks/background-refresh";

import { TaskSheets } from "@/features/tasks/components/task-sheets";
import { AppProviders } from "@/providers/app-providers";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
      <TaskSheets />
      <PortalHost />
    </AppProviders>
  );
}
