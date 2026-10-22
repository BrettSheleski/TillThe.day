import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { calendarLinks } from "../src/lib/calendar";
import { countdown } from "./helpers";

const url = "https://example.com/?c=hud7i.abc";

function parseEvent(ics: string) {
  const vevent = new ICAL.Component(ICAL.parse(ics)).getFirstSubcomponent("vevent")!;
  return {
    event: new ICAL.Event(vevent),
    alarms: vevent.getAllSubcomponents("valarm").map((a) => String(a.getFirstPropertyValue("trigger"))),
  };
}

describe(".ics file", () => {
  it("is a valid event at the countdown's moment", () => {
    const { event, alarms } = parseEvent(calendarLinks(countdown({ msg: "Party" }), url).ics);
    expect(event.summary).toBe("Party");
    expect(event.startDate.toJSDate().toISOString()).toBe("2026-12-25T16:30:00.000Z");
    expect(event.startDate.isDate).toBe(false);
    expect(alarms).toEqual(["-P1D", "PT0S"]);
  });

  it("is an all-day event for a date-only countdown", () => {
    const c = countdown({ dateOnly: true, target: new Date(2026, 11, 25), msg: "Christmas" });
    const { event } = parseEvent(calendarLinks(c, url).ics);
    expect(event.startDate.isDate).toBe(true);
    expect(event.startDate.toString()).toBe("2026-12-25");
    expect(event.endDate.toString()).toBe("2026-12-26");
  });

  it("names an event without a message", () => {
    expect(parseEvent(calendarLinks(countdown(), url).ics).event.summary).toBe("Countdown");
  });

  it("keeps special characters and long messages intact", () => {
    const msg = "Christmas, family; presents \\ 🎄 and a long message to make the line fold past seventy-five bytes";
    expect(parseEvent(calendarLinks(countdown({ msg }), url).ics).event.summary).toBe(msg);
  });

  it("follows the format's line rules: CRLF endings, at most 75 bytes per line", () => {
    const ics = calendarLinks(countdown({ msg: "é".repeat(120) }), url).ics;
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("gives the same countdown the same event ID", () => {
    const uid = (ics: string) => ics.match(/^UID:(.*)$/m)![1];
    const a = calendarLinks(countdown(), url).ics;
    const b = calendarLinks(countdown(), url).ics;
    expect(uid(a)).toBe(uid(b));
    expect(uid(a)).toBe("hud7i.abc@example.com");
  });
});

describe("location and notes", () => {
  const c = countdown({ msg: "Party", location: "Grand Hotel, Chicago", notes: "Bring a dish;\nDoors at 6" });
  const details = `Bring a dish;\nDoors at 6\n\nCountdown: ${url}`;

  it("go in the .ics event's location and description, above the link", () => {
    const { event } = parseEvent(calendarLinks(c, url).ics);
    expect(event.location).toBe("Grand Hotel, Chicago");
    expect(event.description).toBe(details);
  });

  it("fill in Google's and Outlook's location and details", () => {
    const { google, outlook } = calendarLinks(c, url);
    expect(new URL(google).searchParams.get("location")).toBe("Grand Hotel, Chicago");
    expect(new URL(google).searchParams.get("details")).toBe(details);
    expect(new URL(outlook).searchParams.get("location")).toBe("Grand Hotel, Chicago");
    expect(new URL(outlook).searchParams.get("body")).toContain("Bring a dish;");
  });

  it("are left out when there are none", () => {
    const { event } = parseEvent(calendarLinks(countdown({ msg: "Party" }), url).ics);
    expect(event.location).toBeNull();
    expect(event.description).toBe(`Countdown: ${url}`);
    expect(new URL(calendarLinks(countdown(), url).google).searchParams.has("location")).toBe(false);
  });
});

describe("events with an end", () => {
  it("end at the end time", () => {
    const concert = countdown({ target: new Date("2026-12-25T01:00:00Z"), duration: 240, msg: "Concert" });
    const links = calendarLinks(concert, url);
    const { event } = parseEvent(links.ics);
    expect(event.endDate.toJSDate().toISOString()).toBe("2026-12-25T05:00:00.000Z");
    expect(new URL(links.google).searchParams.get("dates")).toBe("20261225T010000Z/20261225T050000Z");
    expect(new URL(links.outlook).searchParams.get("enddt")).toBe("2026-12-25T05:00:00.000Z");
  });

  it("span every day of a multi-day date-only event", () => {
    const trip = countdown({ dateOnly: true, target: new Date(2027, 5, 12), duration: 7, msg: "Trip" });
    const links = calendarLinks(trip, url);
    const { event } = parseEvent(links.ics);
    expect([event.startDate.toString(), event.endDate.toString()]).toEqual(["2027-06-12", "2027-06-20"]);
    expect(new URL(links.google).searchParams.get("dates")).toBe("20270612/20270620");
    expect(new URL(links.outlook).searchParams.get("enddt")).toBe("2027-06-20");
  });
});

describe("yearly countdowns", () => {
  it("become a repeating event starting at the next occurrence", () => {
    const birthday = countdown({ yearly: true, dateOnly: true, target: new Date(1990, 4, 3), msg: "Sam" });
    const { ics, google } = calendarLinks(birthday, url);
    const vevent = new ICAL.Component(ICAL.parse(ics)).getFirstSubcomponent("vevent")!;
    expect(String(vevent.getFirstPropertyValue("rrule"))).toBe("FREQ=YEARLY");
    const start = new ICAL.Event(vevent).startDate;
    expect(start.isDate).toBe(true);
    expect(start.year).toBeGreaterThanOrEqual(new Date().getFullYear());
    expect([start.month, start.day]).toEqual([5, 3]);
    expect(new URL(google).searchParams.get("recur")).toBe("RRULE:FREQ=YEARLY");
  });

  it("repeat on the last day of February for a Feb 29 date", () => {
    const leap = countdown({ yearly: true, dateOnly: true, target: new Date(2024, 1, 29) });
    expect(calendarLinks(leap, url).ics).toContain("RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1");
  });

  it("only repeat when the countdown is yearly", () => {
    expect(calendarLinks(countdown(), url).ics).not.toContain("RRULE");
    expect(new URL(calendarLinks(countdown(), url).google).searchParams.has("recur")).toBe(false);
  });
});

describe("event IDs for pages without a countdown link", () => {
  it("come from the page's path, so each holiday gets its own", () => {
    const uid = (u: string) => calendarLinks(countdown(), u).ics.match(/^UID:(.*)$/m)![1];
    expect(uid("https://example.com/TimeUntil/christmas/")).toBe("TimeUntil-christmas@example.com");
    expect(uid("https://example.com/TimeUntil/halloween/")).toBe("TimeUntil-halloween@example.com");
    expect(uid("https://example.com/TimeUntil/christmas/?year=2028")).toBe("TimeUntil-christmas-2028@example.com");
  });
});

describe("Google and Outlook links", () => {
  it("fill in a timed event", () => {
    const links = calendarLinks(countdown({ msg: "Party time" }), url);
    const google = new URL(links.google).searchParams;
    expect(google.get("text")).toBe("Party time");
    expect(google.get("dates")).toBe("20261225T163000Z/20261225T163000Z");
    expect(google.get("details")).toContain(url);

    const outlook = new URL(links.outlook).searchParams;
    expect(outlook.get("subject")).toBe("Party time");
    expect(outlook.get("startdt")).toBe("2026-12-25T16:30:00.000Z");
    expect(outlook.get("allday")).toBe("false");
  });

  it("fill in an all-day event", () => {
    const c = countdown({ dateOnly: true, target: new Date(2026, 11, 25) });
    const links = calendarLinks(c, url);
    expect(new URL(links.google).searchParams.get("dates")).toBe("20261225/20261226");
    const outlook = new URL(links.outlook).searchParams;
    expect([outlook.get("startdt"), outlook.get("enddt"), outlook.get("allday")]).toEqual(["2026-12-25", "2026-12-26", "true"]);
  });

  it("encode spaces as %20, not +", () => {
    const links = calendarLinks(countdown({ msg: "a b" }), url);
    expect(links.google).not.toContain("+");
    expect(links.outlook).not.toContain("+");
  });
});
