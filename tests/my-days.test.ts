import { describe, expect, it } from "vitest";
import {
  backupFileName,
  backupText,
  canSave,
  readBackup,
  restoreSaved,
  isSaved,
  removeSaved,
  safariClears,
  saveCountdown,
  savedCountdowns,
  STORAGE_KEY,
  type SavedCountdown,
} from "../src/lib/my-days";
import { listStatus, shortWhen, timeText } from "../src/lib/my-days-list";
import { countdown } from "./helpers";

/** An in-memory stand-in for localStorage; `full` makes every write fail. */
function memoryStorage(full = false): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (full) throw new DOMException("Quota exceeded", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
  };
}

const entry = (token: string, savedAt = 1_700_000_000_000): SavedCountdown => ({ token, savedAt });
const holiday = (name: string, savedAt = 1_700_000_000_000): SavedCountdown => ({ holiday: name, savedAt });

describe("saved countdowns", () => {
  it("starts empty", () => {
    expect(savedCountdowns(memoryStorage())).toEqual([]);
  });

  it("saves, finds and removes a countdown", () => {
    const storage = memoryStorage();
    expect(saveCountdown(entry("_kx8B"), storage)).toBe(true);
    expect(isSaved({ token: "_kx8B" }, storage)).toBe(true);
    expect(isSaved({ token: "_kx9B" }, storage)).toBe(false);
    expect(removeSaved({ token: "_kx8B" }, storage)).toBe(true);
    expect(savedCountdowns(storage)).toEqual([]);
  });

  it("saves holidays alongside countdowns, telling them apart", () => {
    const storage = memoryStorage();
    saveCountdown(entry("christmas"), storage);
    saveCountdown(holiday("christmas"), storage);
    saveCountdown(holiday("christmas"), storage);
    expect(savedCountdowns(storage)).toEqual([entry("christmas"), holiday("christmas")]);
    expect(isSaved({ holiday: "christmas" }, storage)).toBe(true);
    expect(isSaved({ holiday: "easter" }, storage)).toBe(false);
    removeSaved({ holiday: "christmas" }, storage);
    expect(savedCountdowns(storage)).toEqual([entry("christmas")]);
  });

  it("doesn't save the same link twice", () => {
    const storage = memoryStorage();
    saveCountdown(entry("_kx8B"), storage);
    saveCountdown(entry("_kx8B", 1_800_000_000_000), storage);
    expect(savedCountdowns(storage)).toEqual([entry("_kx8B")]);
  });

  it("keeps the order they were saved in", () => {
    const storage = memoryStorage();
    for (const token of ["b", "a", "c"]) saveCountdown(entry(token), storage);
    expect(savedCountdowns(storage)).toEqual(["b", "a", "c"].map((token) => entry(token)));
  });

  it("clears the stored value once the last one is removed, which hides the header link", () => {
    const storage = memoryStorage();
    saveCountdown(entry("a"), storage);
    removeSaved({ token: "a" }, storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores stored data it can't read", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "not json");
    expect(savedCountdowns(storage)).toEqual([]);
    storage.setItem(STORAGE_KEY, JSON.stringify({ token: "a" }));
    expect(savedCountdowns(storage)).toEqual([]);
    const kept = [entry("a"), holiday("easter")];
    const unreadable = [null, { token: 5 }, { token: "b" }, entry(""), holiday(""), { token: "c", holiday: "easter", savedAt: 1 }];
    storage.setItem(STORAGE_KEY, JSON.stringify([...kept, ...unreadable]));
    expect(savedCountdowns(storage)).toEqual(kept);
  });

  it("reports failure, without throwing, when storage is missing or full", () => {
    expect(canSave(null)).toBe(false);
    expect(saveCountdown(entry("a"), null)).toBe(false);
    expect(savedCountdowns(null)).toEqual([]);
    const full = memoryStorage(true);
    expect(canSave(full)).toBe(false);
    expect(saveCountdown(entry("a"), full)).toBe(false);
    expect(canSave(memoryStorage())).toBe(true);
  });
});

describe("backup files", () => {
  it("restores what it was made from", () => {
    const list = [entry("_kx8B"), holiday("christmas")];
    expect(readBackup(backupText(list))).toEqual(list);
  });

  it("is dated in its file name", () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe("till-the-day-2026-10-03.json");
  });

  it("refuses files that aren't a backup, or are from a newer version", () => {
    expect(readBackup("not json")).toBeNull();
    expect(readBackup("[]")).toBeNull();
    expect(readBackup(JSON.stringify({ days: [entry("a")] }))).toBeNull();
    expect(readBackup(JSON.stringify({ kind: "till-the-day/my-days", version: 2, days: [entry("a")] }))).toBeNull();
    expect(readBackup(JSON.stringify({ kind: "till-the-day/my-days", version: 1, days: "a" }))).toBeNull();
  });

  it("leaves out entries it can't read, keeping the rest", () => {
    const text = JSON.stringify({ kind: "till-the-day/my-days", version: 1, days: [entry("a"), { token: 5 }, null] });
    expect(readBackup(text)).toEqual([entry("a")]);
  });

  it("adds to what's saved, skipping what's already there", () => {
    const storage = memoryStorage();
    saveCountdown(entry("a"), storage);
    const result = restoreSaved([entry("a", 1), holiday("easter"), entry("b"), entry("b")], storage);
    expect(result).toEqual({ added: 2, alreadySaved: 2 });
    expect(savedCountdowns(storage)).toEqual([entry("a"), holiday("easter"), entry("b")]);
  });

  it("keeps only the fields it uses", () => {
    const storage = memoryStorage();
    restoreSaved([{ ...entry("a"), extra: "<script>" } as unknown as SavedCountdown], storage);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual([entry("a")]);
  });

  it("says so when the browser won't save", () => {
    expect(restoreSaved([entry("a")], memoryStorage(true))).toBeNull();
    // Nothing new needs no write, so it can't fail
    expect(restoreSaved([], memoryStorage(true))).toEqual({ added: 0, alreadySaved: 0 });
  });
});

describe("saved list", () => {
  const now = new Date("2026-12-20T16:30:00Z");

  it("counts down to what's coming up, soonest first", () => {
    const soon = listStatus(countdown({ target: new Date("2026-12-25T16:30:00Z") }), now);
    const later = listStatus(countdown({ target: new Date("2027-01-01T16:30:00Z") }), now);
    expect(soon).toMatchObject({ group: "upcoming", amount: "5 days", label: "to go" });
    expect(soon.order).toBeLessThan(later.order);
  });

  it("puts what's happening now first, with the time left", () => {
    const during = listStatus(
      countdown({ target: new Date("2026-12-20T15:30:00Z"), duration: 90 }),
      now,
    );
    const soon = listStatus(countdown({ target: new Date("2026-12-20T17:00:00Z") }), now);
    expect(during).toMatchObject({ group: "upcoming", amount: "30m", label: "left" });
    expect(during.order).toBeLessThan(soon.order);
  });

  it("moves a yearly one on to its next date instead of ending it", () => {
    const birthday = countdown({ target: new Date("1990-03-01T00:00:00"), dateOnly: true, yearly: true });
    expect(listStatus(birthday, now)).toMatchObject({ group: "upcoming", amount: "70 days" });
  });

  it("lists count-ups newest first", () => {
    const older = listStatus(countdown({ target: new Date("2025-12-20T16:30:00Z"), countUp: true }), now);
    const newer = listStatus(countdown({ target: new Date("2026-12-19T16:30:00Z"), countUp: true }), now);
    expect(newer).toMatchObject({ group: "counting-up", amount: "1 day", label: "since" });
    expect(newer.order).toBeLessThan(older.order);
  });

  it("keeps one without an end up as \"Today!\" for the rest of its day", () => {
    const today = listStatus(countdown({ target: new Date("2026-12-20T00:00:00"), dateOnly: true }), now);
    const thisMorning = listStatus(countdown({ target: new Date("2026-12-20T14:00:00Z") }), now);
    const later = listStatus(countdown({ target: new Date("2026-12-25T00:00:00"), dateOnly: true }), now);
    expect(today).toMatchObject({ group: "upcoming", amount: "Today!", label: "" });
    expect(thisMorning).toMatchObject({ group: "upcoming", amount: "Today!" });
    expect(today.order).toBeLessThan(later.order);
    // Yesterday's is over
    expect(listStatus(countdown({ target: new Date("2026-12-19T00:00:00"), dateOnly: true }), now).group).toBe("ended");
  });

  it("lists what's over as ended, most recent first", () => {
    const longAgo = listStatus(countdown({ target: new Date("2026-01-01T00:00:00Z") }), now);
    const recent = listStatus(countdown({ target: new Date("2026-12-01T00:00:00Z") }), now);
    expect(recent).toMatchObject({ group: "ended", amount: "Ended", label: "" });
    expect(recent.order).toBeLessThan(longAgo.order);
  });

  it("shows days, then hours and minutes in the last day", () => {
    expect(timeText(3 * 86_400_000)).toBe("3 days");
    expect(timeText(86_400_000)).toBe("1 day");
    expect(timeText(3 * 3_600_000 + 20 * 60_000)).toBe("3h 20m");
    expect(timeText(20 * 60_000)).toBe("20m");
    expect(timeText(10_000)).toBe("<1m");
    expect(timeText(-5)).toBe("<1m");
  });

  it("shows the date briefly, with which anniversary for a yearly one", () => {
    const birthday = countdown({ target: new Date("1990-03-01T00:00:00"), dateOnly: true, yearly: true });
    expect(shortWhen(birthday, now)).toBe("Mon, Mar 1, 2027 · 37th");
    expect(shortWhen(countdown({ target: new Date("2026-12-25T00:00:00"), dateOnly: true }), now)).toBe("Fri, Dec 25, 2026");
  });

});

describe("Safari's clearing note", () => {
  const ua = {
    iphoneSafari:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    iphoneChrome:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
    iphoneFirefox:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15",
    macSafari:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    macChrome:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
    windowsEdge:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    android:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  };

  it("shows the Home Screen tip in Safari on an iPhone or iPad", () => {
    expect(safariClears(ua.iphoneSafari, 5, false)).toBe("ios");
    // iPads ask for desktop sites, so they look like a Mac with a touch screen
    expect(safariClears(ua.macSafari, 5, false)).toBe("ios");
  });

  it("shows the Dock tip in Safari on a Mac", () => {
    expect(safariClears(ua.macSafari, 0, false)).toBe("mac");
  });

  it("isn't shown once the site is opened from the Home Screen or Dock", () => {
    expect(safariClears(ua.iphoneSafari, 5, true)).toBeNull();
    expect(safariClears(ua.macSafari, 0, true)).toBeNull();
  });

  it("isn't shown in other browsers, including other iPhone browsers", () => {
    for (const other of [ua.iphoneChrome, ua.iphoneFirefox, ua.macChrome, ua.macFirefox, ua.windowsEdge, ua.android]) {
      expect(safariClears(other, 0, false), other).toBeNull();
    }
  });
});
