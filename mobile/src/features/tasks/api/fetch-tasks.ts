import { getProvider, ProviderError, type Task } from "@mytask/core";
import { withSecrets, type StoredConnection } from "@/features/connections/api/connections";
import { cacheTasks } from "./task-cache";

/** A board's tasks. React Native's fetch has no CORS, so providers get it as is. */
export async function fetchTasks(connection: StoredConnection): Promise<Task[]> {
  const provider = getProvider(connection.providerId);
  if (!provider)
    throw new ProviderError("invalid_input", `Unknown provider ${connection.providerId}`);
  const tasks = await provider.fetchMyTasks(await withSecrets(connection), fetch);
  cacheTasks(connection.id, tasks);
  return tasks;
}
