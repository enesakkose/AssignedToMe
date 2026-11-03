const CANCELLED = /cancel|reject|declin|won['’]?t (do|fix)|abandon|iptal|redded|vazgeç/;

/** Done-category statuses that mean "not done" (cancelled, rejected, won't do), in en/tr. */
export function isCancelled(status: string): boolean {
  // Both locales: Turkish lowercases "İ" correctly, English keeps "I" as "i".
  return CANCELLED.test(status.toLocaleLowerCase('tr')) || CANCELLED.test(status.toLocaleLowerCase('en'));
}
