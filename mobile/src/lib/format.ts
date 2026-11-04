import { currentLocale } from "@/lib/i18n";

// Hermes has no Intl.RelativeTimeFormat on every platform, so ages are short words of our own: "3d", "2 sa".
const units = {
  en: { day: "d", hour: "h", minute: "m", month: "mo", week: "w", year: "y" },
  tr: { day: "g", hour: "sa", minute: "dk", month: "ay", week: "hf", year: "y" },
} as const;
const steps: [keyof (typeof units)["en"], number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3d" / "3g": how long ago, at the coarsest unit that fits. */
export function timeAgo(iso: string, now = Date.now()): string {
  const u = units[currentLocale()];
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  for (const [unit, size] of steps)
    if (seconds >= size) return `${Math.floor(seconds / size)}${u[unit]}`;
  return `0${u.minute}`;
}

/** 5400 → "1h 30m" ("1sa 30dk" in Turkish). */
export function duration(seconds: number): string {
  const u = units[currentLocale()];
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const parts = [h && `${h}${u.hour}`, m && `${m}${u.minute}`].filter(Boolean);
  return parts.length ? parts.join(" ") : `0${u.minute}`;
}
