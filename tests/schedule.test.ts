import { describe, expect, it } from "vitest";
import { eventEnd, lastDay, phaseAt } from "../src/lib/schedule";
import { nextOccurrence } from "../src/lib/yearly";
import { countdown } from "./helpers";

const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("event ends", () => {
  it("are minutes after an exact moment", () => {
    const concert = countdown({ target: new Date("2026-12-25T01:00:00Z"), duration: 240 });
    expect(eventEnd(concert)!.toISOString()).toBe("2026-12-25T05:00:00.000Z");
  });

  it("are midnight after the last day for a date-only event", () => {
    const trip = countdown({ dateOnly: true, target: new Date(2027, 5, 12), duration: 7 });
    expect(ymd(lastDay(trip))).toEqual([2027, 6, 19]);
    const end = eventEnd(trip)!;
    expect(ymd(end)).toEqual([2027, 6, 20]);
    expect([end.getHours(), end.getMinutes()]).toEqual([0, 0]);
  });

  it("stay on whole days across a daylight saving change", () => {
    // US clocks go back on Nov 7 2027
    const stay = countdown({ dateOnly: true, target: new Date(2027, 10, 5), duration: 4 });
    expect(ymd(eventEnd(stay)!)).toEqual([2027, 11, 10]);
    expect(eventEnd(stay)!.getHours()).toBe(0);
  });

  it("don't exist without a duration", () => {
    expect(eventEnd(countdown())).toBeNull();
  });
});

describe("phases", () => {
  const concert = countdown({ target: new Date("2026-12-25T01:00:00Z"), duration: 240 });

  it("count to the start, then the end, then stop", () => {
    expect(phaseAt(concert, new Date("2026-12-24T00:00:00Z"))).toEqual({ phase: "before", countTo: concert.target });
    expect(phaseAt(concert, new Date("2026-12-25T02:00:00Z"))).toEqual({ phase: "during", countTo: eventEnd(concert) });
    expect(phaseAt(concert, new Date("2026-12-25T05:00:00Z")).phase).toBe("after");
  });

  it("go straight to after at the start when there's no end", () => {
    const once = countdown({ target: new Date("2026-12-25T01:00:00Z") });
    expect(phaseAt(once, new Date("2026-12-25T01:00:01Z")).phase).toBe("after");
  });

  it("cover every day of a multi-day event", () => {
    const trip = countdown({ dateOnly: true, target: new Date(2027, 5, 12), duration: 7 });
    expect(phaseAt(trip, new Date(2027, 5, 11, 23, 59)).phase).toBe("before");
    expect(phaseAt(trip, new Date(2027, 5, 12, 0, 1)).phase).toBe("during");
    expect(phaseAt(trip, new Date(2027, 5, 19, 23, 59)).phase).toBe("during");
    expect(phaseAt(trip, new Date(2027, 5, 20, 0, 1)).phase).toBe("after");
  });
});

describe("yearly events with an end", () => {
  it("stay on this year's occurrence until it ends", () => {
    // A three-day festival starting June 12 each year
    const festival = countdown({ yearly: true, dateOnly: true, target: new Date(2020, 5, 12), duration: 2 });
    expect(ymd(nextOccurrence(festival, new Date(2027, 5, 13)))).toEqual([2027, 6, 12]);
    expect(ymd(nextOccurrence(festival, new Date(2027, 5, 14, 23)))).toEqual([2027, 6, 12]);
    expect(ymd(nextOccurrence(festival, new Date(2027, 5, 15, 1)))).toEqual([2028, 6, 12]);
  });

  it("stay current for a timed event until its end time", () => {
    const party = countdown({ yearly: true, target: new Date("2020-07-04T23:00:00Z"), duration: 180 });
    expect(nextOccurrence(party, new Date("2027-07-05T01:00:00Z")).toISOString()).toBe("2027-07-04T23:00:00.000Z");
    expect(nextOccurrence(party, new Date("2027-07-05T02:00:01Z")).toISOString()).toBe("2028-07-04T23:00:00.000Z");
  });
});
