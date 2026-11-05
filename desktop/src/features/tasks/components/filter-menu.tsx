import { activeFilterCount, emptyFilters, NO_SPRINT, type FilterGroup, type TaskFilters } from '@mytask/core';
import { ListFilter, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

type Option = { value: string; label: string };
type Props = {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  /** Types and sprints present in the list. */
  options: { type: string[]; sprint: string[] };
};

function useGroups(options: Props['options'], filters: TaskFilters) {
  const { t } = useTranslation();
  // Keep a selected value listed even if no task has it any more, so it can still be turned off.
  const present = (values: string[], selected: string[]) => [...values, ...selected.filter((v) => !values.includes(v))];
  const sprintLabel = (v: string) => (v === NO_SPRINT ? t('filters.noSprint') : v);
  const groups: { key: FilterGroup; title: string; options: Option[] }[] = [
    {
      key: 'status',
      title: t('filters.status'),
      options: [
        { value: 'in_progress', label: t('filters.inProgress') },
        { value: 'todo', label: t('filters.todo') },
      ],
    },
    {
      key: 'priority',
      title: t('filters.priority'),
      options: [
        { value: 'high', label: t('filters.high') },
        { value: 'medium', label: t('filters.medium') },
        { value: 'low', label: t('filters.low') },
      ],
    },
    { key: 'type', title: t('filters.type'), options: present(options.type, filters.type).map((v) => ({ value: v, label: v })) },
    {
      key: 'sprint',
      title: t('filters.sprint'),
      options: present(options.sprint, filters.sprint).map((v) => ({ value: v, label: sprintLabel(v) })),
    },
    {
      key: 'time',
      title: t('filters.time'),
      options: [
        { value: 'unlogged', label: t('filters.unlogged') },
        { value: 'over', label: t('filters.over') },
        { value: 'unestimated', label: t('filters.unestimated') },
      ],
    },
  ];
  return groups.filter((g) => g.options.length > 0);
}

const toggle = (filters: TaskFilters, key: FilterGroup, value: string): TaskFilters => {
  const current = filters[key] as string[];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...filters, [key]: next };
};

/** Filter button next to search: a popup of toggle chips grouped by field. */
export function FilterMenu({ filters, onChange, options }: Props) {
  const { t } = useTranslation();
  const groups = useGroups(options, filters);
  const count = activeFilterCount(filters);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={count ? t('filters.buttonActive', { count }) : t('filters.button')}
            title={t('filters.button')}
            className={cn(
              'relative flex size-8 shrink-0 items-center justify-center rounded-full border border-rule-2 text-ink-2 transition-colors hover:bg-paper-3 data-[popup-open]:bg-paper-3',
              count > 0 && 'border-ink-2 text-ink',
            )}
          />
        }
      >
        <ListFilter className="size-3.5" aria-hidden />
        {count > 0 && (
          <span
            className="num absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-ink"
            aria-hidden
          >
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 max-w-[calc(100vw-24px)] flex-col gap-3">
        <PopoverHeader title={t('filters.title')}>
          {count > 0 && (
            <Button size="sm" variant="ghost" className="-my-1 px-2" onClick={() => onChange(emptyFilters())}>
              {t('filters.clear')}
            </Button>
          )}
        </PopoverHeader>
        {groups.map((g) => (
          <fieldset key={g.key} className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-muted">{g.title}</legend>
            <div className="flex flex-wrap gap-1">
              {g.options.map((o) => (
                <Chip
                  key={o.value}
                  pressed={(filters[g.key] as string[]).includes(o.value)}
                  onClick={() => onChange(toggle(filters, g.key, o.value))}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={children}
      className={cn(
        'h-6 max-w-full truncate rounded-full border px-2.5 text-sm transition-colors',
        pressed ? 'border-accent bg-accent text-accent-ink' : 'border-rule-2 text-ink-2 hover:bg-paper-3',
      )}
    >
      {children}
    </button>
  );
}

/** The active filters as removable chips under the search field. */
export function ActiveFilters({ filters, onChange, options }: Props) {
  const { t } = useTranslation();
  const groups = useGroups(options, filters);
  const active = groups.flatMap((g) =>
    g.options.filter((o) => (filters[g.key] as string[]).includes(o.value)).map((o) => ({ group: g.key, ...o })),
  );
  if (!active.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {active.map((a) => (
        <button
          key={`${a.group}:${a.value}`}
          type="button"
          onClick={() => onChange(toggle(filters, a.group, a.value))}
          aria-label={t('filters.remove', { name: a.label })}
          className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-paper-3 pr-1.5 pl-2.5 text-sm text-ink-2 hover:text-ink"
        >
          <span className="truncate">{a.label}</span>
          <X className="size-3 shrink-0" aria-hidden />
        </button>
      ))}
    </div>
  );
}
