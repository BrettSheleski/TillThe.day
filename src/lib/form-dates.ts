// The home page form's date rules (src/pages/index.ts), as plain functions of
// the fields' values, so they can be tested without a page.
//
// Dates and times are the inputs' own strings: "YYYY-MM-DD" and "HH:MM", or
// "" when empty. A picked time is in the creator's local time zone.

/** What the form's date fields say. */
export interface FormDates {
  date: string;
  /** "" for a date-only countdown */
  time: string;
  /** Whether the end fields are showing */
  hasEnd: boolean;
  endDate: string;
  endTime: string;
  yearly: boolean;
}

/** An end's date and time fields ("" time for a date-only one). */
export interface EndFields {
  endDate: string;
  endTime: string;
}

export interface EndReading {
  /** See Countdown.duration: minutes for a timed event, extra days for a date-only one; 0 for none */
  duration: number;
  /** What's wrong with the end, and which field to flag */
  problem?: { field: "endDate" | "endTime"; message: string };
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Whether the start has passed: an earlier day, or with a time, a moment before now. Today with no time hasn't. */
export function startPassed({ date, time }: FormDates, now = new Date()): boolean {
  if (!time) return date < localDate(now);
  return new Date(`${date}T${time}`).getTime() <= now.getTime();
}

/**
 * Whether to count up rather than down: the start has passed, and there's
 * nothing still to come (no yearly repeat, no end).
 */
export function isCountingUp(form: FormDates, now = new Date()): boolean {
  return startPassed(form, now) && !form.yearly && !form.hasEnd;
}

/** How long the event lasts, or what's wrong with its end. */
export function readEnd(form: FormDates, now = new Date()): EndReading {
  const { date, time, hasEnd, endDate, endTime, yearly } = form;
  if (!hasEnd || !date) return { duration: 0 };
  const problem = (field: "endDate" | "endTime", message: string): EndReading => ({ duration: 0, problem: { field, message } });

  if (time) {
    if (!endTime) return problem("endTime", "Pick an end time.");
    const start = new Date(`${date}T${time}`);
    const end = new Date(`${endDate || date}T${endTime}`);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (!(minutes > 0)) return problem("endTime", "The end must be after the start.");
    // A yearly event's next one is what counts
    if (end.getTime() <= now.getTime() && !yearly) return problem("endTime", "The end has already passed.");
    return { duration: minutes };
  }

  if (!endDate) return problem("endDate", "Pick an end date.");
  const days = Math.round((wallClock(endDate) - wallClock(date)) / DAY);
  if (!(days > 0)) return problem("endDate", "The end date must be after the start date.");
  if (endDate < localDate(now) && !yearly) return problem("endDate", "The end has already passed.");
  return { duration: days };
}

/**
 * Where a newly added end starts: the shortest valid one. An hour after the
 * start time, or with only a date, the next day (an end date is the event's
 * last day, so the same day isn't an end).
 */
export function defaultEnd(date: string, time: string): EndFields {
  if (time) return fromWallClock(wallClock(date, time) + HOUR);
  return { endDate: fromWallClock(wallClock(date) + DAY).endDate, endTime: "" };
}

/**
 * The end time when a start time is added to a date-only event with an end:
 * the same time on its end date (a day later is 24 hours), or an hour after
 * the start if the end date isn't after it.
 */
export function endForAddedTime(date: string, time: string, endDate: string): EndFields {
  return endDate > date ? { endDate, endTime: time } : defaultEnd(date, time);
}

/**
 * The end after the start moves from `before` to `after`, keeping the event's
 * length, as calendar apps do. Null when it doesn't move: no end yet, or a
 * start time was added or cleared (which have their own rules).
 */
export function movedEnd(
  before: { date: string; time: string },
  after: { date: string; time: string },
  { endDate, endTime }: EndFields,
): EndFields | null {
  if (!endDate || !before.time !== !after.time) return null;
  if (after.time) {
    if (!endTime) return null;
    const length = wallClock(endDate, endTime) - wallClock(before.date, before.time);
    return fromWallClock(wallClock(after.date, after.time) + length);
  }
  const length = wallClock(endDate) - wallClock(before.date);
  return { endDate: fromWallClock(wallClock(after.date) + length).endDate, endTime: "" };
}

/**
 * An address copied over several lines (from an email or a maps app) as one
 * line with commas, as calendars and map searches expect.
 */
export function oneLineAddress(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .join(", ");
}

/** YYYY-MM-DD in local time, the format date inputs use. */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A date (and time) as a number for date maths: the wall-clock time as if it
 * were UTC, so daylight saving changes don't shift the result. Years below
 * 100 are kept as is (Chrome passes years like 0002 while one is typed).
 */
function wallClock(date: string, time = "00:00"): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const result = new Date(0);
  result.setUTCFullYear(y, m - 1, d);
  result.setUTCHours(h, min);
  return result.getTime();
}

/** A wallClock() value back as input values. */
function fromWallClock(ms: number): EndFields {
  const d = new Date(ms);
  const iso = d.toISOString();
  return { endDate: `${String(d.getUTCFullYear()).padStart(4, "0")}-${iso.slice(5, 10)}`, endTime: iso.slice(11, 16) };
}
