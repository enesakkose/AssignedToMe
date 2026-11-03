import { localized } from './i18n';

const rtf = localized((l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto', style: 'short' }));
const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf().format(Math.round(seconds / size), unit);
  }
  return rtf().format(0, 'minute');
}

const hours = localized((l) => new Intl.NumberFormat(l, { style: 'unit', unit: 'hour', unitDisplay: 'narrow' }));
const minutes = localized((l) => new Intl.NumberFormat(l, { style: 'unit', unit: 'minute', unitDisplay: 'narrow' }));

/** 5400 → "1h 30m" (localized). */
export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const parts = [h && hours().format(h), m && minutes().format(m)].filter(Boolean);
  return parts.length ? parts.join(' ') : minutes().format(0);
}
