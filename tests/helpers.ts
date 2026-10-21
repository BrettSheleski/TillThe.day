import { themeById } from "../src/lib/themes";
import type { Countdown } from "../src/lib/token";

/**
 * Run fn with the process in another time zone, then switch back. Node picks
 * up TZ changes immediately, so Dates inside fn use that zone.
 */
export function inTimeZone<T>(zone: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    process.env.TZ = previous;
  }
}

export async function inTimeZoneAsync<T>(zone: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return await fn();
  } finally {
    process.env.TZ = previous;
  }
}

/** A countdown with sensible defaults, overridden as needed. */
export function countdown(overrides: Partial<Countdown> = {}): Countdown {
  return {
    target: new Date("2026-12-25T16:30:00Z"),
    dateOnly: false,
    msg: "",
    theme: themeById("generic"),
    countUp: false,
    ...overrides,
  };
}
