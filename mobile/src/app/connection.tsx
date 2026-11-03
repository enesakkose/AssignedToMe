import { ConnectionScreen } from "@/features/connections/screens/connection-screen";
import { useLocalSearchParams } from "expo-router";

export default function ConnectionRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ConnectionScreen id={id} />;
}
