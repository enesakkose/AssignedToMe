import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { SOLVERS } from '../solvers';
import type { SolverId } from '../types';
import { SolverLogo } from './solver-logo';

/** Picks the AI CLI as a segmented control of logos; the name shows on hover. */
export function SolverPicker({
  value,
  onChange,
  available,
  disabled,
}: {
  value: SolverId;
  onChange: (id: SolverId) => void;
  available?: Record<string, boolean>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex rounded-control bg-paper-3 p-0.5">
      {SOLVERS.map((s) => (
        <Tooltip key={s.id} content={available && available[s.id] === false ? `${s.name} — ${t('solve.notInstalled')}` : s.name}>
          <button
            type="button"
            disabled={disabled}
            aria-label={s.name}
            aria-pressed={value === s.id}
            onClick={() => onChange(s.id)}
            className={cn(
              'grid size-6 place-items-center rounded-control transition-[background-color,opacity,filter] duration-[var(--dur-micro)]',
              value === s.id
                ? 'bg-accent-wash shadow-sm ring-1 ring-accent/30'
                : 'opacity-45 grayscale hover:opacity-90 hover:grayscale-0',
            )}
          >
            <SolverLogo solver={s.id} className="size-4" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
