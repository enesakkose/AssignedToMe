import { usePersistStore } from "@/stores/persist-store";
import { Redirect } from "expo-router";

export default function IndexRoute() {
  const onboarded = usePersistStore((s) => s.onboardingCompleted);
  return <Redirect href={onboarded ? "/(app)" : "/onboarding"} />;
}
