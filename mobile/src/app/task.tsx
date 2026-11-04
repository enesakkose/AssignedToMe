import { TaskDetailScreen } from "@/features/tasks/screens/task-detail-screen";
import { useLocalSearchParams } from "expo-router";

export default function TaskRoute() {
  const { connectionId, key } = useLocalSearchParams<{ connectionId: string; key: string }>();
  return <TaskDetailScreen connectionId={connectionId} taskKey={key} />;
}
