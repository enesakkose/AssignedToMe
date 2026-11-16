import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SecretInput } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { cliAvailable, setAiKey } from '../api';
import { SOLVERS } from '../solvers';
import type { SolverId } from '../types';
import { SolverLogo } from './solver-logo';

/** Per-solver: whether its CLI is installed, and an optional API key (the CLI can use its own login instead). */
export function AiSettings() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const available = useQuery({
    queryKey: ['solve-cli'],
    queryFn: async () => Object.fromEntries(await Promise.all(SOLVERS.map(async (s) => [s.id, await cliAvailable(s.id).catch(() => false)] as const))),
    staleTime: 60_000,
  });

  const save = async (id: SolverId) => {
    const key = keys[id]?.trim();
    if (!key) return;
    await setAiKey(id, key);
    setKeys((k) => ({ ...k, [id]: '' }));
    toast.success(t('solve.keySaved'));
  };

  return (
    <div className="flex flex-col gap-3">
      {SOLVERS.map((s) => {
        const ok = available.data?.[s.id];
        return (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-md">
              <SolverLogo solver={s.id} className="size-4" />
              <span className="font-display font-medium">{s.name}</span>
              {available.isSuccess &&
                (ok ? (
                  <span className="flex items-center gap-1 text-sm text-ink-2">
                    <Check className="size-3.5" aria-hidden /> {t('solve.installed')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted">
                    <X className="size-3.5" aria-hidden /> {t('solve.notInstalled')}
                  </span>
                ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <SecretInput
                  value={keys[s.id] ?? ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [s.id]: e.target.value }))}
                  placeholder={t('solve.apiKeyPlaceholder')}
                />
              </div>
              <Button onClick={() => void save(s.id)} disabled={!keys[s.id]?.trim()}>
                {t('ui.save')}
              </Button>
            </div>
          </div>
        );
      })}
      <p className="text-sm text-muted">{t('solve.apiKeyHint')}</p>
    </div>
  );
}
