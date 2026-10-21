// Yearly repeats (birthdays, anniversaries). A yearly countdown's link keeps
// the original date; these work out the next time it comes around.
import type { Countdown } from "./token";

/**
 * The next occurrence of a yearly countdown. Date-only ones count today all
 * day, then roll over; timed ones roll over once the moment has passed. An
 * original date still in the future is its own first occurrence.
 */
export function nextOccurrence({ target, dateOnly }: Countdown, now = new Date()): Date {
  // Years in the same calendar inYear() uses: local for date-only, else UTC
  const yearOf = (d: Date) => (dateOnly ? d.getFullYear() : d.getUTCFullYear());
  const firstYear = Math.max(yearOf(now), yearOf(target));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isAhead = (d: Date) => (dateOnly ? d >= today : d > now);

  const thisYear = inYear(target, dateOnly, firstYear);
  return isAhead(thisYear) ? thisYear : inYear(target, dateOnly, firstYear + 1);
}

/** The countdown as it applies now: a yearly one moved to its next occurrence. */
export function upcoming(countdown: Countdown, now = new Date()): Countdown {
  return countdown.yearly ? { ...countdown, target: nextOccurrence(countdown, now) } : countdown;
}

/** How many years the occurrence is after the original date: 37 for a 37th birthday. */
export function yearsSince(original: Date, occurrence: Date): number {
  return occurrence.getFullYear() - original.getFullYear();
}

/**
 * The original date moved to another year. Feb 29 falls on Feb 28 in other
 * years. Date-only dates use local calendar dates; timed ones keep the same
 * UTC time of day, which keeps the creator's local time too, since the same
 * date each year has the same daylight saving status.
 */
export function inYear(original: Date, dateOnly: boolean, year: number): Date {
  if (dateOnly) {
    const month = original.getMonth();
    const day = Math.min(original.getDate(), daysInMonth(year, month));
    return new Date(year, month, day);
  }
  const month = original.getUTCMonth();
  const day = Math.min(original.getUTCDate(), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day, original.getUTCHours(), original.getUTCMinutes()));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** English ordinal: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 112th... */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
