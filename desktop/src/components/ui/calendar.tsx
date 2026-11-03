import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { DayPicker } from 'react-day-picker';
import { enUS, tr } from 'react-day-picker/locale';
import { cn } from '@/lib/cn';
import { locale } from '@/lib/i18n';

/** Month grid styled from tokens; pass DayPicker props (mode, selected, disabled…). */
export function Calendar({ className, classNames, ...props }: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={locale === 'tr' ? tr : enUS}
      showOutsideDays
      className={cn('w-fit select-none', className)}
      classNames={{
        months: 'relative',
        month: 'flex flex-col gap-2',
        month_caption: 'flex h-7 items-center pl-1',
        caption_label: 'font-display text-md font-semibold capitalize',
        nav: 'absolute top-0 right-0 flex gap-0.5',
        button_previous:
          'inline-flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-paper-3 disabled:opacity-35 [&_svg]:size-3.5',
        button_next:
          'inline-flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-paper-3 disabled:opacity-35 [&_svg]:size-3.5',
        month_grid: 'border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 pb-1 text-xs font-normal text-muted',
        week: 'flex',
        day: 'size-8 p-0 text-center',
        day_button: cn(
          'num size-8 rounded-full text-md text-ink transition-colors duration-[var(--dur-micro)]',
          'hover:bg-paper-3 focus-visible:outline-offset-0',
        ),
        today: '[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4',
        selected: '[&>button]:bg-accent [&>button]:text-accent-ink [&>button]:hover:bg-accent-hover',
        outside: '[&>button]:text-muted/60',
        disabled: '[&>button]:pointer-events-none [&>button]:text-muted/35',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => (orientation === 'left' ? <ChevronLeft /> : <ChevronRight />),
      }}
      {...props}
    />
  );
}
