// When a countdown's event ends, and where it stands at a given moment. A
// countdown with a duration (see Countdown.duration) counts down to its start,
// then shows "happening now" counting down to its end, then "ended".

import type { Countdown } from "./token";

const MINUTE = 60_000;

export type Phase =
  /** Not started: counting down to the start */
  | "before"
  /** Started and not yet ended: counting down to the end */
  | "during"
  /** Over: for a countdown with an end, after it; without one, after the start */
  | "after";

/**
 * The moment the event ends, or null if it has no end. For a date-only
 * countdown that's midnight after its last day.
 */
export function eventEnd({ target, dateOnly, duration }: Countdown): Date | null {
  if (!duration) return null;
  if (dateOnly) return new Date(target.getFullYear(), target.getMonth(), target.getDate() + duration + 1);
  return new Date(target.getTime() + duration * MINUTE);
}

/** The last day of a date-only countdown's event (its start day if it has no end). */
export function lastDay({ target, duration }: Countdown): Date {
  return new Date(target.getFullYear(), target.getMonth(), target.getDate() + duration);
}

/** Which phase the countdown is in, and the moment the clock counts down to. */
export function phaseAt(countdown: Countdown, now = new Date()): { phase: Phase; countTo: Date } {
  const end = eventEnd(countdown);
  if (now < countdown.target) return { phase: "before", countTo: countdown.target };
  if (end && now < end) return { phase: "during", countTo: end };
  return { phase: "after", countTo: end ?? countdown.target };
}
