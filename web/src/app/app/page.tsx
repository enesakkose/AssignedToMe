import { TasksScreen } from "@/features/tasks/components/tasks-screen";
import { parseQueueParams, type RawParams } from "@/features/tasks/lib/queue-params";
import { listBoards } from "@/server/boards";

/** The boards this browser holds go to the screen as ids and names only; their sign-ins stay in the sealed cookies. */
export default async function AppPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const [raw, stored] = await Promise.all([searchParams, listBoards()]);
  const boards = stored.map(({ connection: c }) => ({
    id: c.id,
    name: c.name,
    providerId: c.providerId,
  }));
  return <TasksScreen boards={boards} params={parseQueueParams(raw)} />;
}
