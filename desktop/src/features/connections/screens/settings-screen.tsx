import { getProvider, type Locale } from '@mytask/core';
import { getVersion } from '@tauri-apps/api/app';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { ArrowLeft, ChevronRight, Monitor, Moon, Plus, Sun } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/app-header';
import { Section } from '@/components/layout/section';
import { Button, IconButton } from '@/components/ui/button';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { setLanguage } from '@/lib/i18n';
import { getTheme, setTheme, type ThemePreference } from '@/lib/theme';
import { REFRESH_CHOICES_MIN, useNav } from '@/stores/nav';
import { UpdateBanner, useAvailableUpdate } from '@/features/updates/update-banner';
import { useConnections } from '../hooks/use-connections';

function useLaunchAtLogin() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['autostart'], queryFn: isEnabled });
  const mutation = useMutation({
    mutationFn: (on: boolean) => (on ? enable() : disable()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autostart'] }),
  });
  return { query, mutation };
}

function useThemePreference() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['theme'], queryFn: getTheme, staleTime: Infinity });
  const mutation = useMutation({
    mutationFn: setTheme,
    onMutate: (theme) => qc.setQueryData(['theme'], theme),
    onError: () => qc.invalidateQueries({ queryKey: ['theme'] }),
  });
  return { theme: query.data ?? 'system', setTheme: mutation.mutate };
}

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const go = useNav((s) => s.go);
  const connections = useConnections();
  const { query: autostart, mutation: setAutostart } = useLaunchAtLogin();
  const version = useQuery({ queryKey: ['app-version'], queryFn: getVersion, staleTime: Infinity });
  const update = useAvailableUpdate();
  const refreshMs = useNav((s) => s.refreshMs);
  const setRefreshMs = useNav((s) => s.setRefreshMs);
  const openWindow = useNav((s) => s.openWindow);
  const setOpenWindow = useNav((s) => s.setOpenWindow);
  const { theme, setTheme: changeTheme } = useThemePreference();

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title={t('settings.title')}
        leading={
          <IconButton label={t('ui.back')} onClick={() => go({ name: 'tasks' })}>
            <ArrowLeft />
          </IconButton>
        }
      />
      <ScrollArea className="flex-1">
        <Section title={t('settings.boards')} description={t('settings.boardsHint')}>
          {connections.isPending ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            connections.data &&
            connections.data.length > 0 && (
              <ul className="cut -mx-1 flex flex-col overflow-hidden border border-rule">
                {connections.data.map((c) => {
                  const provider = getProvider(c.providerId);
                  return (
                    <li key={c.id} className="border-b border-rule last:border-b-0">
                      <button
                        type="button"
                        onClick={() => go({ name: 'connection', id: c.id })}
                        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-paper-2 focus-visible:outline-offset-[-2px]"
                      >
                        {provider && <ProviderLogo provider={provider} />}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-display font-medium">{c.name}</span>
                          <span className="truncate text-sm text-muted">
                            {provider?.name} {c.values.domain}
                          </span>
                        </span>
                        <ChevronRight className="size-3.5 text-muted" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
          <Button className="self-start" onClick={() => go({ name: 'connection' })}>
            <Plus />
            {t('connections.add')}
          </Button>
        </Section>

        <Section title={t('settings.general')} description={t('settings.refreshHint')}>
          <div className="flex items-center justify-between gap-3 text-md">
            {t('settings.theme')}
            <SegmentedControl<ThemePreference>
              label={t('settings.theme')}
              value={theme}
              onValueChange={changeTheme}
              options={[
                { value: 'system', label: t('settings.themeSystem'), icon: <Monitor /> },
                { value: 'light', label: t('settings.themeLight'), icon: <Sun /> },
                { value: 'dark', label: t('settings.themeDark'), icon: <Moon /> },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-md">
            {t('settings.refreshEvery')}
            <SegmentedControl<string>
              label={t('settings.refreshEvery')}
              value={String(refreshMs / 60000)}
              onValueChange={(v) => setRefreshMs(Number(v) * 60000)}
              options={REFRESH_CHOICES_MIN.map((m) => ({ value: String(m), label: m < 60 ? t('settings.minutesShort', { m }) : t('settings.hourShort') }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-md">
            {t('settings.language')}
            {/* Each language names itself, so it can be found whatever the current one is. */}
            <SegmentedControl<Locale>
              label={t('settings.language')}
              value={i18n.language as Locale}
              onValueChange={(next) => setLanguage(next).catch(() => toast.error(t('errors.generic')))}
              options={[
                { value: 'en', label: 'English' },
                { value: 'tr', label: 'Türkçe' },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-md">
            <span className="flex min-w-0 flex-col">
              {t('settings.notifications')}
              <span className="text-sm text-muted">{t('settings.notificationsHint')}</span>
            </span>
            {/* The real on/off lives in macOS; send the user there instead of a toggle that can't change OS permission. */}
            <Button size="sm" className="shrink-0" onClick={() => void invoke('open_notification_settings').catch(() => undefined)}>
              {t('settings.openSystem')}
            </Button>
          </div>
          <label className="flex items-center justify-between gap-3 text-md">
            {t('settings.launchAtLogin')}
            <Switch
              checked={autostart.data ?? false}
              disabled={autostart.isPending || setAutostart.isPending}
              onCheckedChange={(on) => setAutostart.mutate(on, { onError: () => toast.error(t('errors.generic')) })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-md">
            <span className="flex min-w-0 flex-col">
              {t('window.openAtLaunch')}
              <span className="text-sm text-muted">{t('window.openAtLaunchHint')}</span>
            </span>
            <Switch checked={openWindow} onCheckedChange={setOpenWindow} />
          </label>
          <div className="flex items-center justify-between gap-3 text-md">
            <span className="num">{t('update.version', { version: version.data ?? '' })}</span>
            <Button
              size="sm"
              className="shrink-0"
              loading={update.isFetching}
              onClick={() =>
                void update.refetch().then((r) => {
                  if (r.isError) toast.error(t('update.checkFailed'));
                  // A newer one shows as the update bar below.
                  else if (!r.data) toast.success(t('update.upToDate'));
                })
              }
            >
              {t('update.check')}
            </Button>
          </div>
        </Section>

        {import.meta.env.DEV && (
          <Section title={t('settings.developer')}>
            <Button size="sm" className="self-start" onClick={() => go({ name: 'playground' })}>
              {t('playground.title')}
            </Button>
          </Section>
        )}
      </ScrollArea>
      <UpdateBanner />
    </div>
  );
}
