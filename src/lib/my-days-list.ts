// How each countdown on the My Days page (my-days.html) is listed: which group
// it's in, where it sorts, and the short "12 days to go" and date lines.
import { eventEnd, lastDay, phaseAt } from "./schedule";
import type { Countdown } from "./token";
import { ordinal, upcoming, yearsSince } from "./yearly";

export type Group =
  /** Counting down, or happening now */
  | "upcoming"
  /** Count-ups (time since) */
  | "counting-up"
  /** Over (after its day, for one without an end), and not repeating */
  | "ended";

export interface ListStatus {
  group: Group;
  /** Sorts the group, smallest first: soonest upcoming, newest count-up, most recently ended */
  order: number;
  /** "12 days", "3h 20m"; "Today!" on its day once it's arrived; "Ended" once over */
  amount: string;
  /** What the amount means: "to go", "left" (happening now), "since"; empty once over */
  label: string;
}

export function listStatus(countdown: Countdown, now = new Date()): ListStatus {
  if (countdown.countUp) {
    const ms = now.getTime() - countdown.target.getTime();
    return { group: "counting-up", order: -countdown.target.getTime(), amount: timeText(ms), label: "since" };
  }
  const current = upcoming(countdown, now);
  const { phase, countTo } = phaseAt(current, now);
  const ms = countTo.getTime() - now.getTime();
  if (phase === "before") return { group: "upcoming", order: countTo.getTime(), amount: timeText(ms), label: "to go" };
  // Happening now: before everything still to come, which starts later
  if (phase === "during") return { group: "upcoming", order: current.target.getTime(), amount: timeText(ms), label: "left" };
  // One without an end stays up for the rest of its day, as holidays do on theirs
  if (!current.duration && sameDay(current.target, now)) {
    return { group: "upcoming", order: current.target.getTime(), amount: "Today!", label: "" };
  }
  return { group: "ended", order: -countTo.getTime(), amount: "Ended", label: "" };
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Days for a day or more, otherwise hours and minutes: "12 days", "1 day", "3h 20m", "20m". */
export function timeText(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(m / 1440);
  if (d > 0) return d === 1 ? "1 day" : `${d.toLocaleString()} days`;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return m > 0 ? `${m}m` : "<1m";
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { weekday: "short", year: "numeric", month: "short", day: "numeric" };
const SHORT_TIME: Intl.DateTimeFormatOptions = { ...SHORT_DATE, hour: "numeric", minute: "2-digit" };

/**
 * When it is, short enough for a list: "Fri, Dec 25, 2026", with the time if
 * one was picked, as a range if it has an end, and which anniversary for a
 * yearly one ("· 37th").
 */
export function shortWhen(countdown: Countdown, now = new Date()): string {
  const current = upcoming(countdown, now);
  const format = new Intl.DateTimeFormat(undefined, current.dateOnly ? SHORT_DATE : SHORT_TIME);
  const when = current.duration
    ? format.formatRange(current.target, current.dateOnly ? lastDay(current) : eventEnd(current)!)
    : format.format(current.target);
  const years = countdown.yearly ? yearsSince(countdown.target, current.target) : 0;
  return years > 0 ? `${when} · ${ordinal(years)}` : when;
}
