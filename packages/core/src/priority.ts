import type { PriorityLevel } from './types';

/** Reads a level from common priority names (en/tr); custom schemes without a match get none. */
export function priorityLevel(name: string | undefined): PriorityLevel | undefined {
  const n = name?.toLocaleLowerCase('tr') ?? '';
  if (/highest|blocker|critical|urgent|en yüksek|kritik|acil/.test(n)) return 5;
  if (/lowest|trivial|en düşük/.test(n)) return 1;
  if (/high|major|yüksek/.test(n)) return 4;
  if (/low|minor|düşük/.test(n)) return 2;
  if (/medium|normal|orta/.test(n)) return 3;
  return undefined;
}
