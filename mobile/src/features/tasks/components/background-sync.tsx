import { useConnectionsStore } from "@/features/connections/api/connections";
import { announceNewTasks } from "@/lib/notifications";
import { useBoot } from "@/stores/boot";
import { usePersistStore } from "@/stores/persist-store";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { registerBackgroundRefresh } from "../background-refresh";
import { useBoardTasks } from "../hooks/use-board-tasks";

/** Always mounted: keeps every board refreshing while the app is open and announces new tasks. */
export function BackgroundSync() {
  const { t } = useTranslation();
  const boards = useConnectionsStore((s) => s.connections);
  const results = useBoardTasks(boards);
  const refreshMinutes = usePersistStore((s) => s.refreshMinutes);
  const hasBoards = boards.length > 0;
  // Every board has data (cached or fetched) or an error: the splash may lift.
  const settled = results.every((r) => !r.isPending);
  useEffect(() => {
    if (settled) useBoot.setState({ tasksReady: true });
  }, [settled]);

  useEffect(() => {
    if (hasBoards) registerBackgroundRefresh(refreshMinutes).catch(() => undefined);
  }, [hasBoards, refreshMinutes]);

  // Runs only when a board's data actually changes (each refetch bumps its dataUpdatedAt).
  const signature = results.map((r, i) => `${boards[i]?.id}:${r.dataUpdatedAt}`).join("|");
  useEffect(() => {
    void announceNewTasks(
      boards.map((b, i) => ({
        id: b.id,
        name: b.name,
        tasks: results[i]?.isSuccess ? results[i]?.data : undefined,
      })),
      t,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` captures the inputs that matter
  }, [signature]);

  return null;
}
