import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/tr";
import advancedFormatPlugin from "dayjs/plugin/advancedFormat";
import customParseFormatPlugin from "dayjs/plugin/customParseFormat";
import durationPlugin from "dayjs/plugin/duration";
import isSameOrAfterPlugin from "dayjs/plugin/isSameOrAfter";
import isSameOrBeforePlugin from "dayjs/plugin/isSameOrBefore";
import localizedFormatPlugin from "dayjs/plugin/localizedFormat";
import relativeTimePlugin from "dayjs/plugin/relativeTime";
import utcPlugin from "dayjs/plugin/utc";

dayjs.extend(relativeTimePlugin);
dayjs.extend(localizedFormatPlugin);
dayjs.extend(advancedFormatPlugin);
dayjs.extend(customParseFormatPlugin);
dayjs.extend(durationPlugin);
dayjs.extend(isSameOrBeforePlugin);
dayjs.extend(isSameOrAfterPlugin);
dayjs.extend(utcPlugin);

export { dayjs };

export type DateInput = dayjs.ConfigType;

export function setDateLocale(locale: "en" | "tr"): void {
  dayjs.locale(locale);
}

export function formatDate(value?: DateInput, format = "DD MMM YYYY"): string {
  return dayjs(value).format(format);
}

export function formatTime(value?: DateInput, format = "HH:mm"): string {
  return dayjs(value).format(format);
}

export function formatDateTime(value?: DateInput, format = "DD MMM YYYY, HH:mm"): string {
  return dayjs(value).format(format);
}

export function formatRelativeTime(value?: DateInput): string {
  return dayjs(value).fromNow();
}

export function toISO(value?: DateInput): string {
  return dayjs(value).toISOString();
}

export function toDate(value?: DateInput): Date {
  return dayjs(value).toDate();
}

export function fromISO(value?: string): dayjs.Dayjs {
  return dayjs(value);
}

export function isValidDate(value: DateInput): boolean {
  return dayjs(value).isValid();
}

export function isToday(value: DateInput): boolean {
  return dayjs(value).isSame(dayjs(), "day");
}

export function isSameDay(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isSame(dayjs(b), "day");
}

export function isBefore(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isBefore(dayjs(b));
}

export function isAfter(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isAfter(dayjs(b));
}

export function isSameOrBefore(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isSameOrBefore(dayjs(b));
}

export function isSameOrAfter(a: DateInput, b: DateInput): boolean {
  return dayjs(a).isSameOrAfter(dayjs(b));
}

export function startOfDay(value?: DateInput): Date {
  return dayjs(value).startOf("day").toDate();
}

export function endOfDay(value?: DateInput): Date {
  return dayjs(value).endOf("day").toDate();
}

export function startOfMonth(value?: DateInput): Date {
  return dayjs(value).startOf("month").toDate();
}

export function endOfMonth(value?: DateInput): Date {
  return dayjs(value).endOf("month").toDate();
}

export function addDays(value?: DateInput, amount = 1): Date {
  return dayjs(value).add(amount, "day").toDate();
}

export function subtractDays(value?: DateInput, amount = 1): Date {
  return dayjs(value).subtract(amount, "day").toDate();
}

export function addHours(value?: DateInput, amount = 1): Date {
  return dayjs(value).add(amount, "hour").toDate();
}

export function subtractHours(value?: DateInput, amount = 1): Date {
  return dayjs(value).subtract(amount, "hour").toDate();
}

export function diffInDays(a: DateInput, b: DateInput): number {
  return dayjs(a).diff(dayjs(b), "day");
}

export function diffInHours(a: DateInput, b: DateInput): number {
  return dayjs(a).diff(dayjs(b), "hour");
}

export function diffInMinutes(a: DateInput, b: DateInput): number {
  return dayjs(a).diff(dayjs(b), "minute");
}

export function humanizeDuration(seconds: number): string {
  return dayjs.duration(seconds, "seconds").humanize();
}

export function formatDuration(seconds: number, format = "HH:mm:ss"): string {
  return dayjs.duration(seconds, "seconds").format(format);
}
