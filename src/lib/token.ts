// A countdown is packed into a single URL parameter: ?c=<token>
//
// token   = <when>[<message>]
// when    = <minutes since epoch, base36>     exact moment (a time was picked)
//         | _<days since epoch, base36>       date only: midnight in each viewer's own time zone
// message = .<base64url UTF-8 message>        plain
//         | ~<base64url deflated message>     compressed, used when shorter
//
// An exact moment is stored in UTC, so everyone counts down to the same
// instant, shown in their own local time zone.

export interface Countdown {
  /** For date-only countdowns, local midnight at the start of the day. */
  target: Date;
  /** True when no time was picked. */
  dateOnly: boolean;
  msg: string;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

export async function encodeToken({ target, dateOnly, msg }: Countdown): Promise<string> {
  const when = dateOnly
    ? "_" + (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) / DAY).toString(36)
    : Math.round(target.getTime() / MINUTE).toString(36);
  if (!msg) return when;

  const bytes = new TextEncoder().encode(msg);
  let best = "." + toBase64Url(bytes);
  if (typeof CompressionStream !== "undefined") {
    const packed = "~" + toBase64Url(await transform(bytes, new CompressionStream("deflate-raw")));
    if (packed.length < best.length) best = packed;
  }
  return when + best;
}

/** Returns null if the token is malformed. */
export async function decodeToken(token: string): Promise<Countdown | null> {
  const m = token.match(/^(_?)(-?[0-9a-z]+)(?:([.~])([A-Za-z0-9_-]*))?$/);
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

  let msg = "";
  if (m[4]) {
    try {
      let bytes = fromBase64Url(m[4]);
      if (m[3] === "~") bytes = await transform(bytes, new DecompressionStream("deflate-raw"));
      msg = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }
  return { target, dateOnly, msg };
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
