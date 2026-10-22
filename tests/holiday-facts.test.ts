import { describe, expect, it } from "vitest";
import { holidayFacts } from "../src/lib/holiday-facts";
import type { HolidayRule } from "../src/lib/holidays";

// Mid-afternoon, so local midnight is the same day in any test time zone
const now = new Date(2026, 9, 22, 15);

describe("holidayFacts", () => {
  it("lists the next five dates, starting this year if it hasn't passed", () => {
    const { dates } = holidayFacts({ type: "fixed", month: 12, day: 25 }, "Christmas", now);
    expect(dates.map((d) => d.year)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(dates[0].text).toBe("Friday, December 25, 2026");
  });

  it("starts next year once this year's date has passed", () => {
    const { dates, faq } = holidayFacts({ type: "easter" }, "Easter", now);
    expect(dates[0]).toEqual({ year: 2027, text: "Sunday, March 28, 2027" });
    expect(faq[0]).toEqual({ q: "When is Easter 2027?", a: "Easter 2027 is on Sunday, March 28." });
    expect(faq[1].q).toBe("When is Easter 2028?");
  });

  it("asks about the next two years, then whether the date changes", () => {
    const { faq } = holidayFacts({ type: "fixed", month: 12, day: 25 }, "Christmas", now);
    expect(faq.map((f) => f.q)).toEqual([
      "When is Christmas 2026?",
      "When is Christmas 2027?",
      "Is Christmas on the same date every year?",
    ]);
    expect(faq[2].a).toBe("Yes. Christmas is on December 25 every year, though the day of the week changes.");
  });

  it.each<[HolidayRule, string, string]>([
    [{ type: "nth-weekday", month: 11, weekday: 4, n: 4 }, "Thanksgiving",
      "No. Thanksgiving is the fourth Thursday in November, so its date changes from year to year."],
    [{ type: "nth-weekday", month: 5, weekday: 1, n: -1 }, "Memorial Day",
      "No. Memorial Day is the last Monday in May, so its date changes from year to year."],
    [{ type: "nth-weekday", month: 11, weekday: 4, n: 4, offset: 1 }, "Black Friday",
      "No. Black Friday is the day after the fourth Thursday in November, so its date changes from year to year."],
    [{ type: "easter", offset: -47 }, "Mardi Gras",
      "No. Mardi Gras is 47 days before Easter Sunday, which moves every year, so its date moves too."],
    [{ type: "easter", offset: -7 }, "Palm Sunday",
      "No. Palm Sunday is a week before Easter Sunday, which moves every year, so its date moves too."],
  ])("explains how %o's date is set", (rule, name, answer) => {
    expect(holidayFacts(rule, name, now).faq.at(-1)!.a).toBe(answer);
  });

  it("gives seasons as exact moments in UTC, asked about as starting", () => {
    const { dates, faq } = holidayFacts({ type: "season", season: "spring" }, "Spring", now);
    expect(dates[0].text).toMatch(/^Saturday, March 20, 2027 at \d{1,2}:\d\d [AP]M UTC$/);
    expect(faq[0].q).toBe("When does spring start in 2027?");
    expect(faq[0].a).toMatch(/^Spring 2027 starts on Saturday, March 20 at .* UTC\.$/);
    expect(faq[2].q).toBe("Does spring start on the same date every year?");
    expect(faq[2].a).toContain("March equinox");
  });

  it("only asks about the years a date list covers", () => {
    const { dates, faq } = holidayFacts({ type: "dates", dates: ["2026-11-08"] }, "Diwali", now);
    expect(dates).toEqual([{ year: 2026, text: "Sunday, November 8, 2026" }]);
    expect(faq.map((f) => f.q)).toEqual(["When is Diwali 2026?", "Is Diwali on the same date every year?"]);
  });

  it("has only the general question once a date list has run out", () => {
    const { dates, faq } = holidayFacts({ type: "dates", dates: ["2025-10-20"] }, "Diwali", now);
    expect(dates).toEqual([]);
    expect(faq).toHaveLength(1);
  });
});
