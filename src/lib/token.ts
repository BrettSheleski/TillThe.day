// A countdown is packed into a single URL parameter: ?c=<token>
//
// token   = <when>[_<length>][<letters>][<message>]
// when    = <minutes since epoch, base36>     exact moment (a time was picked)
//         | _<days since epoch, base36>       date only: midnight in each viewer's own time zone
// length  = how long the event lasts, base36: minutes for an exact moment,
//           extra days for a date-only one (e.g. 7 for a week-long trip);
//           omitted when it has no end
// letters = uppercase letters, in any order:
//           the theme's code (see _data/themes.json); omitted for the default theme
//           U for count-up mode (time since the date)
//           Y for a yearly repeat: counts down to the next anniversary of the date
//           U and Y are reserved and never used as theme codes
// message = .<base64url UTF-8 text>           plain
//         | ~<base64url deflated text>        compressed, used when shorter
//           The text is the message, then, if there are any, the location
//           and notes, each after a U+001F (unit separator). Older links have
//           just the message.
//
// An exact moment is stored in UTC, so everyone counts down to the same
// instant, shown in their own local time zone.

import { type Theme, themeByCode } from "./themes";

export interface Countdown {
  /** For date-only countdowns, local midnight at the start of the day. */
  target: Date;
  /** True when no time was picked. */
  dateOnly: boolean;
  msg: string;
  theme: Theme;
  /** Where it is, e.g. an address; shown with a map link and added to calendars. */
  location?: string;
  /** Anything else to know, e.g. "Bring a dish"; shown and added to calendars. */
  notes?: string;
  /** Count up from the date (time since) instead of down to it. */
  countUp: boolean;
  /** Repeats every year; target is the original date (see ./yearly.ts). */
  yearly: boolean;
  /**
   * How long the event lasts: minutes after `target` for an exact moment, or
   * extra days after the first for a date-only one. 0 for no end. See
   * ./schedule.ts.
   */
  duration: number;
}

const MINUTE = 60_000;
const COUNT_UP = "U";
const YEARLY = "Y";
const FLAGS = [COUNT_UP, YEARLY];
const DAY = 86_400_000;
/** Separates the message, location and notes in a link's text. */
const SEPARATOR = "\u001f";

export async function encodeToken(countdown: Countdown): Promise<string> {
  const { target, dateOnly, theme, countUp, yearly, duration } = countdown;
  const when = dateOnly
    ? "_" + (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) / DAY).toString(36)
    : Math.round(target.getTime() / MINUTE).toString(36);
  const length = duration > 0 ? `_${Math.round(duration).toString(36)}` : "";
  const prefix = when + length + theme.code + (countUp ? COUNT_UP : "") + (yearly ? YEARLY : "");
  // Message, location, notes, leaving off empty ones from the end
  const clean = (text = "") => text.replaceAll(SEPARATOR, " ");
  const parts = [clean(countdown.msg), clean(countdown.location), clean(countdown.notes)];
  while (parts.length && !parts[parts.length - 1]) parts.pop();
  const text = parts.join(SEPARATOR);
  if (!text) return prefix;

  const bytes = new TextEncoder().encode(text);
  let best = "." + toBase64Url(bytes);
  if (typeof CompressionStream !== "undefined") {
    const packed = "~" + toBase64Url(await transform(bytes, new CompressionStream("deflate-raw")));
    if (packed.length < best.length) best = packed;
  }
  return prefix + best;
}

// Groups: 1 date-only marker, 2 when, 3 length, 4 letters, 5 message marker, 6 message
const TOKEN = /^(_?)(-?[0-9a-z]+)(?:_([0-9a-z]+))?([A-Z]*)(?:([.~])([A-Za-z0-9_-]*))?$/;

/** The theme among a token's letters; the default if none (or none known). */
function themeFromLetters(letters: string): Theme {
  const code = [...letters].find((l) => !FLAGS.includes(l)) ?? "";
  return themeByCode(code);
}

/**
 * Read just the theme, synchronously, so the page can apply it before the
 * (possibly async) message decode and avoid flashing the default theme.
 */
export function peekTheme(token: string): Theme {
  return themeFromLetters(token.match(TOKEN)?.[4] ?? "");
}

/** Returns null if the token is malformed. */
export async function decodeToken(token: string): Promise<Countdown | null> {
  const m = token.match(TOKEN);
  if (!m) return null;
  const dateOnly = m[1] === "_";
  const n = parseInt(m[2], 36);

  let target: Date;
  if (dateOnly) {
    const day = new Date(n * DAY);
    target = new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  } else {
    target = new Date(n * MINUTE);
  }
  if (isNaN(target.getTime())) return null;

  let text = "";
  if (m[6]) {
    try {
      let bytes = fromBase64Url(m[6]);
      if (m[5] === "~") bytes = await transform(bytes, new DecompressionStream("deflate-raw"));
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }
  const [msg = "", location, notes] = text.split(SEPARATOR);
  return {
    target,
    dateOnly,
    msg,
    ...(location ? { location } : {}),
    ...(notes ? { notes } : {}),
    theme: themeFromLetters(m[4]),
    countUp: m[4].includes(COUNT_UP),
    yearly: m[4].includes(YEARLY),
    duration: m[3] ? parseInt(m[3], 36) : 0,
  };
}

async function transform(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
