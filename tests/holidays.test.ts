import { describe, expect, it } from "vitest";
import { daysUntil, holidayDate, nextHoliday, upcomingHolidays, type HolidayRule } from "../src/lib/holidays";

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
      expect(ymd(holidayDate(rules[name], year))).toEqual(expected);
    });
  }

  it("returns local midnight", () => {
    const d = holidayDate(rules.christmas, 2026);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});

describe("next holiday", () => {
  const christmas: HolidayRule = { type: "fixed", month: 12, day: 25 };

  it("is this year's date before the day", () => {
    expect(ymd(nextHoliday(christmas, new Date(2026, 9, 21, 15)))).toEqual([2026, 12, 25]);
  });

  it("is still today on the day itself, all day", () => {
    expect(ymd(nextHoliday(christmas, new Date(2026, 11, 25, 0, 1)))).toEqual([2026, 12, 25]);
    expect(ymd(nextHoliday(christmas, new Date(2026, 11, 25, 23, 59)))).toEqual([2026, 12, 25]);
  });

  it("rolls over to next year the day after", () => {
    expect(ymd(nextHoliday(christmas, new Date(2026, 11, 26, 0, 1)))).toEqual([2027, 12, 25]);
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
