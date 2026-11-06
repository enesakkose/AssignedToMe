/** 19800 → "5h 30m"; under a minute → "0m". */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, (m || !h) && `${m}m`].filter(Boolean).join(" ");
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "12 min. ago", "yesterday", in the page's language. */
export function formatAge(iso: string, locale: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ["minute", 60];
  return rtf.format(Math.round(seconds / size), unit);
}
