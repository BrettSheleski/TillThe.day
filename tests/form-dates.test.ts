import { describe, expect, it } from "vitest";
import {
  defaultEnd,
  endForAddedTime,
  isCountingUp,
  localDate,
  movedEnd,
  oneLineAddress,
  readEnd,
  startPassed,
  type FormDates,
} from "../src/lib/form-dates";

// Thursday, October 22, 2026, 3:00 PM local time
const now = new Date(2026, 9, 22, 15, 0);

function form(fields: Partial<FormDates>): FormDates {
  return { date: "", time: "", hasEnd: false, endDate: "", endTime: "", yearly: false, ...fields };
}

describe("whether the start has passed", () => {
  it("counts today as still to come without a time", () => {
    expect(startPassed(form({ date: "2026-10-22" }), now)).toBe(false);
    expect(startPassed(form({ date: "2026-10-21" }), now)).toBe(true);
    expect(startPassed(form({ date: "2026-10-23" }), now)).toBe(false);
  });

  it("goes by the moment with a time", () => {
    expect(startPassed(form({ date: "2026-10-22", time: "14:59" }), now)).toBe(true);
    expect(startPassed(form({ date: "2026-10-22", time: "15:00" }), now)).toBe(true);
    expect(startPassed(form({ date: "2026-10-22", time: "15:01" }), now)).toBe(false);
  });
});

describe("counting down or up", () => {
  it("counts down to a date to come, and up from one that's passed", () => {
    expect(isCountingUp(form({ date: "2026-12-25" }), now)).toBe(false);
    expect(isCountingUp(form({ date: "2024-03-15" }), now)).toBe(true);
    expect(isCountingUp(form({ date: "2026-10-22", time: "09:00" }), now)).toBe(true);
  });

  it("counts down to the next anniversary of a past date that repeats yearly", () => {
    expect(isCountingUp(form({ date: "2000-05-01", yearly: true }), now)).toBe(false);
  });

  it("counts down to the end of an event that's already started", () => {
    expect(isCountingUp(form({ date: "2026-10-20", hasEnd: true, endDate: "2026-10-25" }), now)).toBe(false);
  });
});

describe("reading the end", () => {
  it("is no length without an end", () => {
    expect(readEnd(form({ date: "2026-12-10", endDate: "2026-12-12" }), now)).toEqual({ duration: 0 });
  });

  describe("with a start time", () => {
    const start = { date: "2026-12-10", time: "14:00", hasEnd: true };

    it("is the minutes from start to end", () => {
      expect(readEnd(form({ ...start, endDate: "2026-12-10", endTime: "15:30" }), now)).toEqual({ duration: 90 });
      expect(readEnd(form({ ...start, endDate: "2026-12-11", endTime: "14:00" }), now)).toEqual({ duration: 1440 });
    });

    it("uses the start date when the end date is empty", () => {
      expect(readEnd(form({ ...start, endTime: "16:00" }), now)).toEqual({ duration: 120 });
    });

    it("asks for an end time", () => {
      expect(readEnd(form({ ...start, endDate: "2026-12-10" }), now).problem).toEqual({ field: "endTime", message: "Pick an end time." });
    });

    it("flags an end that isn't after the start", () => {
      for (const endTime of ["14:00", "13:00"]) {
        expect(readEnd(form({ ...start, endDate: "2026-12-10", endTime }), now).problem?.message).toBe("The end must be after the start.");
      }
    });

    it("flags an end that has passed, unless it repeats yearly", () => {
      const past = form({ date: "2026-10-22", time: "09:00", hasEnd: true, endDate: "2026-10-22", endTime: "12:00" });
      expect(readEnd(past, now).problem?.message).toBe("The end has already passed.");
      expect(readEnd({ ...past, yearly: true }, now)).toEqual({ duration: 180 });
    });

    it("accepts an end still to come for an event that's already started", () => {
      const underway = form({ date: "2026-10-22", time: "09:00", hasEnd: true, endDate: "2026-10-22", endTime: "17:00" });
      expect(readEnd(underway, now)).toEqual({ duration: 480 });
    });
  });

  describe("date only", () => {
    const start = { date: "2026-12-10", hasEnd: true };

    it("is the extra days after the first", () => {
      expect(readEnd(form({ ...start, endDate: "2026-12-11" }), now)).toEqual({ duration: 1 });
      expect(readEnd(form({ ...start, endDate: "2026-12-17" }), now)).toEqual({ duration: 7 });
    });

    it("counts whole days across a daylight saving change", () => {
      expect(readEnd(form({ date: "2027-03-08", hasEnd: true, endDate: "2027-03-15" }), now)).toEqual({ duration: 7 });
    });

    it("asks for an end date, and one after the start", () => {
      expect(readEnd(form(start), now).problem).toEqual({ field: "endDate", message: "Pick an end date." });
      expect(readEnd(form({ ...start, endDate: "2026-12-10" }), now).problem?.message).toBe("The end date must be after the start date.");
    });

    it("flags an end date that has passed, but not one that's today", () => {
      expect(readEnd(form({ date: "2026-10-15", hasEnd: true, endDate: "2026-10-21" }), now).problem?.message).toBe("The end has already passed.");
      expect(readEnd(form({ date: "2026-10-15", hasEnd: true, endDate: "2026-10-22" }), now)).toEqual({ duration: 7 });
    });
  });
});

describe("a new end", () => {
  it("is an hour after the start time", () => {
    expect(defaultEnd("2026-12-10", "10:00")).toEqual({ endDate: "2026-12-10", endTime: "11:00" });
  });

  it("moves to the next day, month or year past midnight", () => {
    expect(defaultEnd("2026-12-10", "23:30")).toEqual({ endDate: "2026-12-11", endTime: "00:30" });
    expect(defaultEnd("2026-12-31", "23:30")).toEqual({ endDate: "2027-01-01", endTime: "00:30" });
  });

  it("is the next day for a date-only start", () => {
    expect(defaultEnd("2026-12-10", "")).toEqual({ endDate: "2026-12-11", endTime: "" });
    expect(defaultEnd("2027-01-31", "")).toEqual({ endDate: "2027-02-01", endTime: "" });
    expect(defaultEnd("2028-02-28", "")).toEqual({ endDate: "2028-02-29", endTime: "" });
  });
});

describe("adding a start time to an event with an end date", () => {
  it("ends at the same time on its end date", () => {
    expect(endForAddedTime("2026-12-10", "09:00", "2026-12-11")).toEqual({ endDate: "2026-12-11", endTime: "09:00" });
    expect(endForAddedTime("2026-12-10", "18:00", "2026-12-13")).toEqual({ endDate: "2026-12-13", endTime: "18:00" });
  });

  it("ends an hour later if the end date isn't after the start", () => {
    expect(endForAddedTime("2026-12-10", "09:00", "2026-12-10")).toEqual({ endDate: "2026-12-10", endTime: "10:00" });
  });
});

describe("moving the start", () => {
  it("moves a date-only end by the same number of days", () => {
    const end = { endDate: "2026-12-12", endTime: "" };
    expect(movedEnd({ date: "2026-12-10", time: "" }, { date: "2026-12-20", time: "" }, end)).toEqual({ endDate: "2026-12-22", endTime: "" });
    expect(movedEnd({ date: "2026-12-10", time: "" }, { date: "2026-12-05", time: "" }, end)).toEqual({ endDate: "2026-12-07", endTime: "" });
  });

  it("keeps a timed event's length, across midnight", () => {
    const end = { endDate: "2026-12-05", endTime: "15:00" };
    expect(movedEnd({ date: "2026-12-05", time: "14:00" }, { date: "2026-12-05", time: "16:00" }, end)).toEqual({ endDate: "2026-12-05", endTime: "17:00" });
    expect(movedEnd({ date: "2026-12-05", time: "14:00" }, { date: "2026-12-05", time: "23:30" }, end)).toEqual({ endDate: "2026-12-06", endTime: "00:30" });
  });

  it("keeps the clock length across a daylight saving change", () => {
    const end = { endDate: "2027-03-13", endTime: "00:30" };
    expect(movedEnd({ date: "2027-03-12", time: "23:30" }, { date: "2027-03-13", time: "23:30" }, end)).toEqual({ endDate: "2027-03-14", endTime: "00:30" });
  });

  it("follows a year typed one digit at a time", () => {
    let start = { date: "2026-03-13", time: "" };
    let end = { endDate: "2026-03-14", endTime: "" };
    for (const date of ["0002-03-13", "0020-03-13", "0202-03-13", "2028-03-13"]) {
      end = movedEnd(start, { date, time: "" }, end)!;
      start = { date, time: "" };
    }
    expect(end).toEqual({ endDate: "2028-03-14", endTime: "" });
  });

  it("leaves the end alone when a start time is added or cleared, or there's no end", () => {
    const end = { endDate: "2026-12-12", endTime: "" };
    expect(movedEnd({ date: "2026-12-10", time: "" }, { date: "2026-12-10", time: "09:00" }, end)).toBeNull();
    expect(movedEnd({ date: "2026-12-10", time: "09:00" }, { date: "2026-12-10", time: "" }, { endDate: "2026-12-12", endTime: "10:00" })).toBeNull();
    expect(movedEnd({ date: "2026-12-10", time: "" }, { date: "2026-12-11", time: "" }, { endDate: "", endTime: "" })).toBeNull();
    expect(movedEnd({ date: "2026-12-10", time: "09:00" }, { date: "2026-12-11", time: "09:00" }, { endDate: "2026-12-10", endTime: "" })).toBeNull();
  });
});

describe("a pasted address", () => {
  it("becomes one line with commas", () => {
    expect(oneLineAddress("Grand Hotel\n123 Main St\nChicago, IL 60601")).toBe("Grand Hotel, 123 Main St, Chicago, IL 60601");
  });

  it("drops blank lines, extra spaces and commas already at line ends", () => {
    expect(oneLineAddress("Grand Hotel\r\n123 Main St,\r\n\r\n   Chicago, IL 60601\n")).toBe("Grand Hotel, 123 Main St, Chicago, IL 60601");
  });

  it("leaves one line as it is", () => {
    expect(oneLineAddress("Bob's house")).toBe("Bob's house");
  });
});

describe("local dates", () => {
  it("are YYYY-MM-DD in local time, like date inputs", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
