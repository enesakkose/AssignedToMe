// Jira's defaults: 1 day = 8 hours, 1 week = 5 days.
const UNIT_SECONDS: Record<string, number> = {
  w: 5 * 8 * 3600,
  hf: 5 * 8 * 3600,
  hafta: 5 * 8 * 3600,
  d: 8 * 3600,
  g: 8 * 3600,
  gün: 8 * 3600,
  h: 3600,
  sa: 3600,
  saat: 3600,
  m: 60,
  dk: 60,
  dakika: 60,
};

const PART = /(\d+(?:[.,]\d+)?)\s*([a-zçğıöşü]+)/g;

/** "1h 30m", "45m", "1.5h", "1g 2sa" → seconds. Every number needs a unit; returns undefined otherwise. */
export function parseDuration(text: string): number | undefined {
  const input = text.trim().toLocaleLowerCase('tr');
  if (!input) return undefined;
  let total = 0;
  let consumed = '';
  for (const [whole, amount, unit] of input.matchAll(PART)) {
    const size = UNIT_SECONDS[unit!];
    if (!size) return undefined;
    total += Number(amount!.replace(',', '.')) * size;
    consumed += whole;
  }
  // Reject leftovers like "abc" or a bare "2".
  if (consumed.replace(/\s/g, '') !== input.replace(/\s/g, '')) return undefined;
  const seconds = Math.round(total);
  return seconds >= 60 ? seconds : undefined;
}
