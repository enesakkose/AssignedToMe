import { useMutation, useQuery } from '@tanstack/react-query';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

const SIX_HOURS = 6 * 60 * 60 * 1000;

/**
 * A newer release than this one (from latest.json on GitHub Releases), or null. Checked at launch and every 6 hours.
 * The plugin verifies the download against the pubkey in tauri.conf.json, so only builds we signed can install.
 */
export function useAvailableUpdate() {
  return useQuery({
    queryKey: ['app-update'],
    queryFn: (): Promise<Update | null> => check(),
    refetchInterval: SIX_HOURS,
    staleTime: SIX_HOURS,
    // Offline or GitHub unreachable: try again at the next interval rather than right away.
    retry: false,
  });
}

/** A thin bar under the task list while an update is waiting: one click downloads, installs and restarts into it. */
export function UpdateBanner() {
  const { t } = useTranslation();
  const update = useAvailableUpdate().data;
  const install = useMutation({
    mutationFn: async (u: Update) => {
      await u.downloadAndInstall();
      await relaunch();
    },
    onError: () => toast.error(t('update.failed')),
  });
  if (!update) return null;
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-rule bg-paper-2 py-1.5 pr-1.5 pl-3 text-sm">
      <span className="min-w-0 truncate text-ink-2">{t('update.available', { version: update.version })}</span>
      <Button size="sm" variant="primary" loading={install.isPending} onClick={() => install.mutate(update)}>
        {install.isPending ? t('update.installing') : t('update.install')}
      </Button>
    </div>
  );
}
