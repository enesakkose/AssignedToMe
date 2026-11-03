import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnections } from '@/features/connections/hooks/use-connections';
import { announceNewTasks } from '@/lib/notifications';
import { setTrayCount } from '@/lib/tray';
import { useBoardTasks } from '../hooks/use-board-tasks';

/** Always mounted: keeps the hourly refresh running on every screen, the menubar count current, and announces new tasks. */
export function BackgroundSync() {
  const { t } = useTranslation();
  const { data: boards = [] } = useConnections();
  const results = useBoardTasks(boards);
  const count = results.reduce((n, r) => n + (r.data?.length ?? 0), 0);

  useEffect(() => {
    setTrayCount(count).catch(console.error);
  }, [count]);

  // Runs only when a board's data actually changes (each hourly refetch bumps its dataUpdatedAt).
  const signature = results.map((r, i) => `${boards[i]?.id}:${r.dataUpdatedAt}`).join('|');
  useEffect(() => {
    void announceNewTasks(
      boards.map((b, i) => ({ id: b.id, name: b.name, tasks: results[i]?.isSuccess ? (results[i]?.data ?? []) : undefined })),
      t,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` captures the inputs that matter
  }, [signature]);

  return null;
}
