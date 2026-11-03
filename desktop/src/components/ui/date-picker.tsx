import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { localized } from '@/lib/i18n';
import { Calendar } from './calendar';
import { inputClass } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const format = localized((l) => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' }));

type DatePickerProps = {
  value: Date;
  onChange: (date: Date) => void;
  /** Days after this are not selectable. */
  max?: Date;
  min?: Date;
  className?: string;
  id?: string;
};

/** A pill like the inputs that opens the calendar; closes on pick. */
export function DatePicker({ value, onChange, max, min, className, id }: DatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isToday = sameDay(value, new Date());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        render={<button type="button" className={cn(inputClass, 'flex items-center gap-2 text-left', className)} />}
      >
        <CalendarDays className="size-3.5 shrink-0 text-muted" aria-hidden />
        <span className="num flex-1 truncate">{format().format(value)}</span>
        {isToday && <span className="text-xs text-muted">{t('ui.today')}</span>}
      </PopoverTrigger>
      <PopoverContent align="start">
        <Calendar
          mode="single"
          required
          selected={value}
          defaultMonth={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          disabled={[...(max ? [{ after: max }] : []), ...(min ? [{ before: min }] : [])]}
          endMonth={max}
          startMonth={min}
        />
      </PopoverContent>
    </Popover>
  );
}
