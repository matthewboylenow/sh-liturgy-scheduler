import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays, format, parseISO } from "date-fns";
import { env } from "./env";

export const TZ = env.timezone();

/** Combine a local date (YYYY-MM-DD) and time (HH:mm) in parish time into a UTC Date. */
export function localToUtc(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, TZ);
}

export function todayLocal(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

export function nowLocal(): Date {
  return toZonedTime(new Date(), TZ);
}

/** "Sun, Oct 4" */
export function fmtDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "EEE, MMM d");
}

/** "Sunday, October 4, 2026" */
export function fmtDateLong(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "EEEE, MMMM d, yyyy");
}

/** "10:30" -> "10:30 AM" */
export function fmtTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function fmtInstant(d: Date, pattern = "EEE, MMM d 'at' h:mm a"): string {
  return formatInTimeZone(d, TZ, pattern);
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** All dates between start and end (inclusive, YYYY-MM-DD) that fall on the given weekday. */
export function datesForWeekday(start: string, end: string, dayOfWeek: number): string[] {
  const out: string[] = [];
  let d = parseISO(start);
  const last = parseISO(end);
  while (d <= last) {
    if (d.getDay() === dayOfWeek) out.push(format(d, "yyyy-MM-dd"));
    d = addDays(d, 1);
  }
  return out;
}

export function addDaysLocal(date: string, n: number): string {
  return format(addDays(parseISO(date), n), "yyyy-MM-dd");
}
