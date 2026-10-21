// Date rules for the holiday pages (_holidays/*.md). Each page's front matter
// has a `rule`; these work out the date it falls on in a given year.

export type HolidayRule =
  /** The same date every year, e.g. December 25 */
  | { type: "fixed"; month: number; day: number }
  /**
   * The nth weekday of a month, e.g. the 4th Thursday of November. A negative
   * n counts from the end of the month: -1 is the last.
   * month is 1-12; weekday is 0 (Sunday) to 6 (Saturday).
   */
  | { type: "nth-weekday"; month: number; weekday: number; n: number }
  /** Western (Gregorian) Easter Sunday */
  | { type: "easter" };

/** The holiday's date in the given year, as local midnight. */
export function holidayDate(rule: HolidayRule, year: number): Date {
  switch (rule.type) {
    case "fixed":
      return new Date(year, rule.month - 1, rule.day);
    case "nth-weekday":
      return nthWeekday(year, rule.month - 1, rule.weekday, rule.n);
    case "easter":
      return easter(year);
  }
}

/**
 * The next time the holiday happens, counting today: on the day itself this
 * returns today, so the page celebrates all day before rolling over.
 */
export function nextHoliday(rule: HolidayRule, now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYear = holidayDate(rule, today.getFullYear());
  return thisYear >= today ? thisYear : holidayDate(rule, today.getFullYear() + 1);
}

/** The next `count` dates, starting with nextHoliday(). */
export function upcomingHolidays(rule: HolidayRule, count: number, now = new Date()): Date[] {
  const first = nextHoliday(rule, now);
  return Array.from({ length: count }, (_, i) => holidayDate(rule, first.getFullYear() + i));
}

/** Whole days from today until the date (0 on the day itself). */
export function daysUntil(date: Date, now = new Date()): number {
  // Compare calendar dates in UTC so daylight saving changes don't skew it
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(date) - day(now)) / 86_400_000);
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + (n - 1) * 7);
  }
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset + (n + 1) * 7);
}

/** Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
