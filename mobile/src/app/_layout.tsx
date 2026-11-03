import "../../global.css";

import { AppProviders } from "@/providers/app-providers";
import { PortalHost } from "@rn-primitives/portal";
import { Slot } from "expo-router";

export default function RootLayout() {
  return (
    <AppProviders>
      <Slot />
      <PortalHost />
    </AppProviders>
  );
}
