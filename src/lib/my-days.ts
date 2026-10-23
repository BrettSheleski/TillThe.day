// Countdowns and holidays saved in this browser, listed on the My Days page
// (my-days.html). A countdown is kept as its link's token, which holds
// everything else, the message included (see ./token.ts). A holiday is kept
// as its page's name, and always counts down to its next date.
//
// They're in localStorage, so they stay on this device and never reach the
// server. Browsers may still clear them: Safari does after 7 days without a
// visit, unless the site was added to the home screen. Storage can also be
// missing or refuse writes (private browsing, blocked site data), so every
// function here copes with that instead of throwing.

/** What's saved: a countdown link's ?c= value, or a holiday page's name (_holidays/<name>.md) */
export type SavedSource = { token: string } | { holiday: string };

export type SavedCountdown = SavedSource & {
  /** When it was saved, in ms since 1970 */
  savedAt: number;
};

function same(a: SavedSource, b: SavedSource): boolean {
  return "token" in a ? "token" in b && a.token === b.token : "holiday" in b && a.holiday === b.holiday;
}

/** Also read by src/head/early.ts, to show the header's "My Days" link */
export const STORAGE_KEY = "saved-countdowns";

/**
 * Which Safari this is, if it's one that clears what sites save after a week
 * without a visit: "ios" (iPhone, iPad) or "mac". Null for other browsers,
 * and for the site opened from the Home Screen or Dock, which Safari leaves
 * alone. Other iPhone browsers (Chrome, Firefox, ...) are left out too: their
 * names are in the user agent, and only Safari is known to do this.
 */
export function safariClears(
  ua = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
  standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
): "ios" | "mac" | null {
  if (standalone) return null;
  const safari = /Version\/[\d.]+.*Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Edg\/|OPR\/|Firefox|Android/.test(ua);
  if (!safari) return null;
  // iPads ask for desktop sites, so they look like a Mac with a touch screen
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "ios";
  return /Macintosh/.test(ua) ? "mac" : null;
}

function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Whether this browser will keep what's saved, so the Save button is worth showing. */
export function canSave(storage = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(`${STORAGE_KEY}-test`, "1");
    storage.removeItem(`${STORAGE_KEY}-test`);
    return true;
  } catch {
    return false;
  }
}

/** Everything saved, in the order it was saved. Anything unreadable is left out. */
export function savedCountdowns(storage = browserStorage()): SavedCountdown[] {
  try {
    const data: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter(isSavedCountdown) : [];
  } catch {
    return [];
  }
}

export function isSaved(source: SavedSource, storage = browserStorage()): boolean {
  return savedCountdowns(storage).some((s) => same(s, source));
}

/** Adds a countdown or holiday, unless it's already saved. Also puts a removed one back (Undo). */
export function saveCountdown(entry: SavedCountdown, storage = browserStorage()): boolean {
  const list = savedCountdowns(storage);
  if (list.some((s) => same(s, entry))) return true;
  return write([...list, entry], storage);
}

export function removeSaved(source: SavedSource, storage = browserStorage()): boolean {
  return write(savedCountdowns(storage).filter((s) => !same(s, source)), storage);
}

function write(list: SavedCountdown[], storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    if (list.length) storage.setItem(STORAGE_KEY, JSON.stringify(list));
    else storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false; // e.g. storage full
  }
}

function isSavedCountdown(value: unknown): value is SavedCountdown {
  const s = value as { token?: unknown; holiday?: unknown; savedAt?: unknown } | null;
  if (typeof s !== "object" || s === null || typeof s.savedAt !== "number") return false;
  const name = (x: unknown) => typeof x === "string" && x !== "";
  // One or the other, not both
  return "token" in s ? name(s.token) && !("holiday" in s) : name(s.holiday);
}
