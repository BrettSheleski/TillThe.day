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
