import { startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const NZ_TIMEZONE = "Pacific/Auckland";

export function getNZNow(): Date {
  return toZonedTime(new Date(), NZ_TIMEZONE);
}

export function getNZWeekStart(date?: Date): Date {
  const nzDate = date ? toZonedTime(date, NZ_TIMEZONE) : getNZNow();
  return startOfWeek(nzDate, { weekStartsOn: 1 });
}

export function getNZWeekEnd(date?: Date): Date {
  const nzDate = date ? toZonedTime(date, NZ_TIMEZONE) : getNZNow();
  const end = endOfWeek(nzDate, { weekStartsOn: 1 });
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getNZThisWeek(): { start: Date; end: Date } {
  return { start: getNZWeekStart(), end: getNZWeekEnd() };
}

export function getNZLastWeek(): { start: Date; end: Date } {
  const now = getNZNow();
  const lastWeek = subWeeks(now, 1);
  return { start: getNZWeekStart(lastWeek), end: getNZWeekEnd(lastWeek) };
}

export function getNZWeekFor(date: Date): { start: Date; end: Date } {
  return { start: getNZWeekStart(date), end: getNZWeekEnd(date) };
}

export function toNZDate(date: Date): Date {
  return toZonedTime(date, NZ_TIMEZONE);
}

export function fromNZDate(nzDate: Date): Date {
  return fromZonedTime(nzDate, NZ_TIMEZONE);
}

export { NZ_TIMEZONE };
