import { providers } from '@mytask/core';
import { AppWindowMac, ArrowRight, Bell, KeyRound, Layers, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/ui/app-logo';
import { Button } from '@/components/ui/button';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/cn';
import { ensureNotificationPermission } from '@/lib/notifications';
import { useNav } from '@/stores/nav';

type Step = { key: string; icon?: LucideIcon };

// First-run only, so the delight budget applies; each step explains one thing.
const STEPS: Step[] = [
  { key: 'welcome' }, // uses the app mark
  { key: 'boards', icon: Layers },
  { key: 'providers' }, // uses the provider logo grid
  { key: 'surfaces', icon: AppWindowMac }, // window + menubar, and the launch choice
  { key: 'notify', icon: Bell },
  { key: 'privacy', icon: KeyRound },
];

export function OnboardingScreen() {
  const { t } = useTranslation();
  const finish = useNav((s) => s.finishOnboarding);
  const openWindow = useNav((s) => s.openWindow);
  const setOpenWindow = useNav((s) => s.setOpenWindow);
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-paper">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {/* Re-keyed per step so the entrance replays; children stagger via their own delay. */}
        <div key={step.key} className={cn('flex flex-col items-center', step.key === 'providers' ? 'max-w-sm' : 'max-w-xs')}>
          {step.key === 'providers' ? (
            // Shows which tools can be connected, as a non-interactive echo of the real board picker.
            <div className="mb-5 grid w-full grid-cols-2 gap-2">
              {providers.map((p, n) => (
                <div
                  key={p.id}
                  className="onboard-item flex min-w-0 items-center gap-2.5 rounded-input border border-rule bg-paper p-2 text-left"
                  style={{ animationDelay: `${40 + n * 45}ms` }}
                >
                  <ProviderLogo provider={p} />
                  <span className="truncate font-display text-sm font-medium text-ink">{p.name}</span>
                </div>
              ))}
            </div>
          ) : Icon ? (
            <div className="onboard-item mb-5 flex size-16 items-center justify-center rounded-2xl bg-brand-tile text-brand-mark shadow-float">
              <Icon className="size-7" aria-hidden />
            </div>
          ) : (
            // The app mark already is a tile, so it fills the box edge to edge instead of sitting inside another box.
            <AppLogo className="onboard-item mb-5 size-16 rounded-2xl shadow-float" />
          )}
          <h1 className="onboard-item font-display text-xl font-semibold text-ink [animation-delay:60ms]">{t(`onboarding.${step.key}.title`)}</h1>
          <p className="onboard-item mt-2 text-md leading-relaxed text-ink-2 [animation-delay:120ms]">{t(`onboarding.${step.key}.body`)}</p>
          {step.key === 'surfaces' && (
            // The same setting as Settings → "Open the window at launch"; changeable any time.
            <SegmentedControl<'window' | 'menubar'>
              label={t('onboarding.surfaces.title')}
              value={openWindow ? 'window' : 'menubar'}
              onValueChange={(v) => setOpenWindow(v === 'window')}
              options={[
                { value: 'window', label: t('onboarding.surfaces.window') },
                { value: 'menubar', label: t('onboarding.surfaces.menubar') },
              ]}
              className="onboard-item mt-5 [animation-delay:180ms]"
            />
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-4 px-8 pb-7">
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {STEPS.map((s, n) => (
            <span
              key={s.key}
              className={cn(
                'h-1.5 rounded-full bg-rule-2 transition-[width,background-color] duration-[var(--dur-short)] ease-out',
                n === i ? 'w-5 bg-accent' : 'w-1.5',
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={finish}>
            {t('onboarding.skip')}
          </Button>
          <Button variant="primary" className="gap-1" onClick={() => {
              // Ask for notification access right after the user reads what it's for.
              if (step.key === 'notify') void ensureNotificationPermission();
              if (last) finish();
              else setI((n) => n + 1);
            }}>
            {last ? t('onboarding.start') : t('onboarding.next')}
            {!last && <ArrowRight className="size-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
