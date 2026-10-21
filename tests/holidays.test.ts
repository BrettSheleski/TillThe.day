import { describe, expect, it } from "vitest";
import {
  daysUntil,
  holidayCountdown,
  holidayDate,
  isExactTime,
  nextHoliday,
  upcomingHolidays,
  type HolidayRule,
  type Season,
} from "../src/lib/holidays";

const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("holiday dates", () => {
  const rules: Record<string, HolidayRule> = {
    christmas: { type: "fixed", month: 12, day: 25 },
    thanksgiving: { type: "nth-weekday", month: 11, weekday: 4, n: 4 },
    mothersDay: { type: "nth-weekday", month: 5, weekday: 0, n: 2 },
    fathersDay: { type: "nth-weekday", month: 6, weekday: 0, n: 3 },
    laborDay: { type: "nth-weekday", month: 9, weekday: 1, n: 1 },
    memorialDay: { type: "nth-weekday", month: 5, weekday: 1, n: -1 },
    easter: { type: "easter" },
  };

  // Checked against published calendars
  const known: [keyof typeof rules, number, number[]][] = [
    ["christmas", 2026, [2026, 12, 25]],
    ["thanksgiving", 2025, [2025, 11, 27]],
    ["thanksgiving", 2026, [2026, 11, 26]],
    ["thanksgiving", 2027, [2027, 11, 25]],
    ["mothersDay", 2026, [2026, 5, 10]],
    ["fathersDay", 2026, [2026, 6, 21]],
    ["laborDay", 2026, [2026, 9, 7]],
    ["memorialDay", 2026, [2026, 5, 25]],
    ["memorialDay", 2027, [2027, 5, 31]],
    ["easter", 2024, [2024, 3, 31]],
    ["easter", 2025, [2025, 4, 20]],
    ["easter", 2026, [2026, 4, 5]],
    ["easter", 2027, [2027, 3, 28]],
    ["easter", 2038, [2038, 4, 25]],
  ];

  for (const [name, year, expected] of known) {
    it(`puts ${name} ${year} on ${expected.join("-")}`, () => {
      expect(ymd(holidayDate(rules[name], year)!)).toEqual(expected);
    });
  }

  it("returns local midnight", () => {
    const d = holidayDate(rules.christmas, 2026)!;
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});

describe("next holiday", () => {
  const christmas: HolidayRule = { type: "fixed", month: 12, day: 25 };

  it("is this year's date before the day", () => {
    expect(ymd(nextHoliday(christmas, new Date(2026, 9, 21, 15))!)).toEqual([2026, 12, 25]);
  });

  it("is still today on the day itself, all day", () => {
    expect(ymd(nextHoliday(christmas, new Date(2026, 11, 25, 0, 1))!)).toEqual([2026, 12, 25]);
    expect(ymd(nextHoliday(christmas, new Date(2026, 11, 25, 23, 59))!)).toEqual([2026, 12, 25]);
  });

  it("rolls over to next year the day after", () => {
    expect(ymd(nextHoliday(christmas, new Date(2026, 11, 26, 0, 1))!)).toEqual([2027, 12, 25]);
  });

  it("lists upcoming dates year by year", () => {
    const dates = upcomingHolidays(christmas, 3, new Date(2026, 11, 26));
    expect(dates.map(ymd)).toEqual([[2027, 12, 25], [2028, 12, 25], [2029, 12, 25]]);
  });
});

describe("days until", () => {
  it("is 0 on the day and counts whole days", () => {
    expect(daysUntil(new Date(2026, 9, 21), new Date(2026, 9, 21, 22))).toBe(0);
    expect(daysUntil(new Date(2026, 9, 22), new Date(2026, 9, 21, 23, 59))).toBe(1);
    expect(daysUntil(new Date(2026, 11, 25), new Date(2026, 9, 21, 9))).toBe(65);
  });

  it("isn't thrown off by daylight saving changes", () => {
    // US clocks go back on Nov 1 2026 and forward on Mar 14 2027
    expect(daysUntil(new Date(2026, 10, 2), new Date(2026, 9, 31))).toBe(2);
    expect(daysUntil(new Date(2027, 2, 15), new Date(2027, 2, 13))).toBe(2);
  });
});

describe("offsets", () => {
  const thanksgiving: HolidayRule = { type: "nth-weekday", month: 11, weekday: 4, n: 4 };

  it("move a date by whole days, across months", () => {
    expect(ymd(holidayDate({ ...thanksgiving, offset: 1 }, 2026)!)).toEqual([2026, 11, 27]); // Black Friday
    expect(ymd(holidayDate({ ...thanksgiving, offset: 4 }, 2026)!)).toEqual([2026, 11, 30]); // Cyber Monday
    expect(ymd(holidayDate({ ...thanksgiving, offset: 4 }, 2024)!)).toEqual([2024, 12, 2]);
  });

  it("count back from Easter", () => {
    const easter: HolidayRule = { type: "easter" };
    expect(ymd(holidayDate({ ...easter, offset: -47 }, 2026)!)).toEqual([2026, 2, 17]); // Mardi Gras
    expect(ymd(holidayDate({ ...easter, offset: -46 }, 2026)!)).toEqual([2026, 2, 18]); // Ash Wednesday
    expect(ymd(holidayDate({ ...easter, offset: -21 }, 2026)!)).toEqual([2026, 3, 15]); // Mothering Sunday
    expect(ymd(holidayDate({ ...easter, offset: -2 }, 2026)!)).toEqual([2026, 4, 3]); // Good Friday
  });
});

describe("date lists", () => {
  const rule: HolidayRule = { type: "dates", dates: ["2026-12-05", "2027-12-25", "2029-12-02"] };

  it("give that year's date, or none", () => {
    expect(ymd(holidayDate(rule, 2027)!)).toEqual([2027, 12, 25]);
    expect(holidayDate(rule, 2028)).toBeNull();
  });

  it("skip a year with no date when finding the next", () => {
    expect(ymd(nextHoliday(rule, new Date(2028, 0, 1))!)).toEqual([2029, 12, 2]);
    expect(upcomingHolidays(rule, 5, new Date(2026, 0, 1)).map(ymd)).toEqual([[2026, 12, 5], [2027, 12, 25], [2029, 12, 2]]);
  });

  it("have no next date once they run out", () => {
    expect(nextHoliday(rule, new Date(2030, 0, 1))).toBeNull();
    expect(upcomingHolidays(rule, 5, new Date(2030, 0, 1))).toEqual([]);
  });
});

describe("seasons", () => {
  // Published times (UTC), e.g. from the US Naval Observatory; the formula is
  // good to about a minute
  const known: [Season, string][] = [
    ["spring", "2025-03-20T09:01Z"], ["summer", "2025-06-21T02:42Z"],
    ["fall", "2025-09-22T18:19Z"], ["winter", "2025-12-21T15:03Z"],
    ["spring", "2026-03-20T14:46Z"], ["summer", "2026-06-21T08:24Z"],
    ["fall", "2026-09-23T00:05Z"], ["winter", "2026-12-21T20:50Z"],
  ];

  for (const [season, time] of known) {
    it(`puts ${season} ${time.slice(0, 4)} within 2 minutes of ${time}`, () => {
      const got = holidayDate({ type: "season", season }, Number(time.slice(0, 4)))!;
      expect(Math.abs(got.getTime() - new Date(time).getTime())).toBeLessThan(2 * 60_000);
    });
  }

  it("count to the exact moment, then roll over", () => {
    const summer: HolidayRule = { type: "season", season: "summer" };
    expect(isExactTime(summer)).toBe(true);
    const moment = holidayDate(summer, 2026)!;
    expect(nextHoliday(summer, new Date(moment.getTime() - 1000))).toEqual(moment);
    expect(nextHoliday(summer, new Date(moment.getTime() + 1000))!.getFullYear()).toBe(2027);
  });
});

describe("holiday countdowns", () => {
  it("are whole days, except seasons", () => {
    const theme = { id: "generic", name: "Generic", code: "" };
    expect(holidayCountdown({ type: "fixed", month: 12, day: 25 }, "Christmas", theme)!.dateOnly).toBe(true);
    expect(holidayCountdown({ type: "season", season: "winter" }, "Winter", theme)!.dateOnly).toBe(false);
  });

  it("are null when no date is known", () => {
    const theme = { id: "generic", name: "Generic", code: "" };
    expect(holidayCountdown({ type: "dates", dates: ["2020-01-01"] }, "Old", theme)).toBeNull();
  });
});
