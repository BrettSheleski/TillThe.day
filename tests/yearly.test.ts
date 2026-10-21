import { describe, expect, it } from "vitest";
import { inYear, nextOccurrence, ordinal, upcoming, yearsSince } from "../src/lib/yearly";
import { countdown, inTimeZone } from "./helpers";

const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];
// Sam's birthday: May 3, 1990, no time
const birthday = countdown({ yearly: true, dateOnly: true, target: new Date(1990, 4, 3) });

describe("next occurrence of a date-only yearly countdown", () => {
  it("is this year's date when it hasn't come yet", () => {
    expect(ymd(nextOccurrence(birthday, new Date(2027, 0, 10)))).toEqual([2027, 5, 3]);
  });

  it("is today, all day, on the day itself", () => {
    expect(ymd(nextOccurrence(birthday, new Date(2027, 4, 3, 0, 1)))).toEqual([2027, 5, 3]);
    expect(ymd(nextOccurrence(birthday, new Date(2027, 4, 3, 23, 59)))).toEqual([2027, 5, 3]);
  });

  it("is next year's date once the day is over", () => {
    expect(ymd(nextOccurrence(birthday, new Date(2027, 4, 4)))).toEqual([2028, 5, 3]);
  });

  it("is the original date when that's still ahead", () => {
    const future = countdown({ yearly: true, dateOnly: true, target: new Date(2030, 6, 1) });
    expect(ymd(nextOccurrence(future, new Date(2027, 0, 1)))).toEqual([2030, 7, 1]);
  });

  it("is local midnight", () => {
    const d = nextOccurrence(birthday, new Date(2027, 0, 10));
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });

  it("is the same calendar date in any time zone", () => {
    for (const zone of ["Pacific/Honolulu", "UTC", "Asia/Tokyo"]) {
      inTimeZone(zone, () => {
        const c = countdown({ yearly: true, dateOnly: true, target: new Date(1990, 4, 3) });
        expect(ymd(nextOccurrence(c, new Date(2027, 0, 10)))).toEqual([2027, 5, 3]);
      });
    }
  });
});

describe("next occurrence of a timed yearly countdown", () => {
  // An anniversary at 3:00 pm Chicago time (CDT, UTC-5) on June 12, 2015
  const anniversary = countdown({ yearly: true, target: new Date("2015-06-12T20:00:00Z") });

  it("keeps the time of day", () => {
    expect(nextOccurrence(anniversary, new Date("2027-01-01T00:00:00Z")).toISOString()).toBe("2027-06-12T20:00:00.000Z");
  });

  it("is still today if the moment hasn't passed", () => {
    expect(nextOccurrence(anniversary, new Date("2027-06-12T19:59:00Z")).toISOString()).toBe("2027-06-12T20:00:00.000Z");
  });

  it("moves to next year once the moment has passed", () => {
    expect(nextOccurrence(anniversary, new Date("2027-06-12T20:00:01Z")).toISOString()).toBe("2028-06-12T20:00:00.000Z");
  });
});

describe("Feb 29", () => {
  it("falls on Feb 28 in other years and Feb 29 in leap years", () => {
    const leapDay = new Date(2024, 1, 29);
    expect(ymd(inYear(leapDay, true, 2027))).toEqual([2027, 2, 28]);
    expect(ymd(inYear(leapDay, true, 2028))).toEqual([2028, 2, 29]);
  });

  it("works for timed countdowns too", () => {
    const leapMoment = new Date("2024-02-29T18:00:00Z");
    expect(inYear(leapMoment, false, 2027).toISOString()).toBe("2027-02-28T18:00:00.000Z");
  });
});

describe("which anniversary", () => {
  it("counts the years since the original date", () => {
    expect(yearsSince(new Date(1990, 4, 3), new Date(2027, 4, 3))).toBe(37);
    expect(yearsSince(new Date(2030, 6, 1), new Date(2030, 6, 1))).toBe(0);
  });

  it("is written as an ordinal", () => {
    const cases: [number, string][] = [
      [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [10, "10th"], [11, "11th"], [12, "12th"],
      [13, "13th"], [21, "21st"], [22, "22nd"], [23, "23rd"], [101, "101st"], [111, "111th"], [112, "112th"],
    ];
    for (const [n, expected] of cases) expect(ordinal(n)).toBe(expected);
  });
});

describe("upcoming", () => {
  it("moves a yearly countdown to its next occurrence", () => {
    expect(ymd(upcoming(birthday, new Date(2027, 0, 10)).target)).toEqual([2027, 5, 3]);
  });

  it("leaves other countdowns alone", () => {
    const once = countdown();
    expect(upcoming(once)).toBe(once);
  });
});
