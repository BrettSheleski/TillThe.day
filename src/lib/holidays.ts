// Date rules for the holiday pages (_holidays/*.md). Each page's front matter
// has a `rule`; these work out the date it falls on in a given year.

import type { Theme } from "./themes";
import type { Countdown } from "./token";

export type HolidayRule = (
  /** The same date every year, e.g. December 25 */
  | { type: "fixed"; month: number; day: number }
  /**
   * The nth weekday of a month, e.g. the 4th Thursday of November. A negative
   * n counts from the end of the month: -1 is the last.
   * month is 1-12; weekday is 0 (Sunday) to 6 (Saturday).
   */
  | { type: "nth-weekday"; month: number; weekday: number; n: number }
  /** Western (Gregorian) Easter Sunday */
  | { type: "easter" }
  /**
   * A list of dates ("YYYY-MM-DD"), for holidays on lunar calendars that no
   * simple rule covers. Each must come from a reliable published source.
   */
  | { type: "dates"; dates: string[] }
  /**
   * The exact moment a season starts (Northern Hemisphere): the March or
   * September equinox, or the June or December solstice.
   */
  | { type: "season"; season: Season }
) & {
  /** Days after (or, if negative, before) the date above, e.g. Easter - 47 for Mardi Gras */
  offset?: number;
};

export type Season = "spring" | "summer" | "fall" | "winter";

/** Whether the rule gives an exact moment (a season) rather than a whole day. */
export function isExactTime(rule: HolidayRule): boolean {
  return rule.type === "season";
}

/**
 * The holiday's date in the given year: local midnight, or for seasons the
 * exact moment. Null if a date list has nothing for that year.
 */
export function holidayDate(rule: HolidayRule, year: number): Date | null {
  const base = baseDate(rule, year);
  if (!base || !rule.offset) return base;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + rule.offset);
}

function baseDate(rule: HolidayRule, year: number): Date | null {
  switch (rule.type) {
    case "fixed":
      return new Date(year, rule.month - 1, rule.day);
    case "nth-weekday":
      return nthWeekday(year, rule.month - 1, rule.weekday, rule.n);
    case "easter":
      return easter(year);
    case "dates": {
      const found = rule.dates.find((d) => d.startsWith(`${year}-`));
      if (!found) return null;
      const [y, m, d] = found.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    case "season":
      return seasonStart(rule.season, year);
  }
}

/**
 * The next time the holiday happens. Whole-day holidays count today, so the
 * page celebrates all day before rolling over; seasons count until their exact
 * moment. Null if no upcoming date is known (a date list has run out).
 */
export function nextHoliday(rule: HolidayRule, now = new Date()): Date | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isAhead = (d: Date) => (isExactTime(rule) ? d > now : d >= today);
  // A few years ahead, since a date list can skip a year
  for (let year = now.getFullYear(); year <= now.getFullYear() + 3; year++) {
    const date = holidayDate(rule, year);
    if (date && isAhead(date)) return date;
  }
  return null;
}

/**
 * The occurrence in `year` if it's still to come (or today), otherwise the
 * next one; with no year, the next one. Null if no upcoming date is known.
 */
export function holidayOccurrence(rule: HolidayRule, year: number | null, now = new Date()): Date | null {
  const next = nextHoliday(rule, now);
  if (!next || year === null) return next;
  const date = holidayDate(rule, year);
  return date && date >= next ? date : next;
}

/** A ?year= value: a four-digit year, or null for anything else. */
export function parseYear(value: string | null): number | null {
  const year = Number(value);
  return value && Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null;
}

/** Up to `count` upcoming dates, starting with nextHoliday(). */
export function upcomingHolidays(rule: HolidayRule, count: number, now = new Date()): Date[] {
  const first = nextHoliday(rule, now);
  if (!first) return [];
  const dates: Date[] = [];
  for (let year = first.getFullYear(); dates.length < count && year <= first.getFullYear() + count + 3; year++) {
    const date = holidayDate(rule, year);
    if (date && date >= first) dates.push(date);
  }
  return dates;
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

// --- Equinoxes and solstices ---
// Jean Meeus, "Astronomical Algorithms", chapter 27: accurate to about a
// minute for years 1000-3000.

/** Mean moment (Julian Ephemeris Day) for each season, as polynomial coefficients in Y. */
const SEASON_MEAN: Record<Season, number[]> = {
  spring: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  summer: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  fall: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  winter: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
};

/** Periodic terms [A, B, C] */
const SEASON_TERMS = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
  [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
  [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
  [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
  [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
  [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
  [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];

/** Terrestrial Time runs about 69 seconds ahead of clock time (UTC) in the 2020s. */
const DELTA_T_SECONDS = 69;

function seasonStart(season: Season, year: number): Date {
  const rad = Math.PI / 180;
  const y = (year - 2000) / 1000;
  const mean = SEASON_MEAN[season].reduce((sum, c, i) => sum + c * y ** i, 0);
  const t = (mean - 2451545.0) / 36525;
  const w = (35999.373 * t - 2.47) * rad;
  const dl = 1 + 0.0334 * Math.cos(w) + 0.0007 * Math.cos(2 * w);
  const s = SEASON_TERMS.reduce((sum, [a, b, c]) => sum + a * Math.cos((b + c * t) * rad), 0);
  const jde = mean + (0.00001 * s) / dl;
  // Julian Day to Unix time, then Terrestrial Time to UTC
  return new Date((jde - 2440587.5) * 86_400_000 - DELTA_T_SECONDS * 1000);
}

/**
 * A holiday as a countdown: to its next date, or to its date in `year` if
 * that's still to come (see holidayOccurrence). A whole day, or for seasons
 * the exact moment. Null if no upcoming date is known.
 */
export function holidayCountdown(
  rule: HolidayRule,
  name: string,
  theme: Theme,
  year: number | null = null,
  now = new Date()
): Countdown | null {
  const target = holidayOccurrence(rule, year, now);
  if (!target) return null;
  return {
    target,
    dateOnly: !isExactTime(rule),
    msg: name,
    theme,
    countUp: false,
    // Holidays roll over by their own rule, not as yearly countdowns
    yearly: false,
  };
}
