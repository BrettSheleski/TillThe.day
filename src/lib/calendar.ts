// "Add to calendar" for a countdown: links that open Google Calendar and
// Outlook.com with the event filled in, and an .ics file for everything else
// (Apple Calendar, desktop Outlook, ...).
//
// A countdown with a time is an event at that exact moment. A date-only
// countdown is an all-day event on that date.

import type { Countdown } from "./token";

export interface CalendarLinks {
  google: string;
  outlook: string;
  /** Contents of an .ics file. */
  ics: string;
}

export function calendarLinks(countdown: Countdown, url: string): CalendarLinks {
  const title = countdown.msg || "Countdown";
  const details = `Countdown: ${url}`;
  return {
    google: googleUrl(countdown, title, details),
    outlook: outlookUrl(countdown, title, details),
    ics: icsFile(countdown, title, details, url),
  };
}

function googleUrl({ target, dateOnly }: Countdown, title: string, details: string): string {
  const dates = dateOnly
    ? `${compactDate(target)}/${compactDate(nextDay(target))}`
    : `${compactUtc(target)}/${compactUtc(target)}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates, details });
  return `https://calendar.google.com/calendar/render?${query(params)}`;
}

function outlookUrl({ target, dateOnly }: Countdown, title: string, details: string): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    body: details,
    startdt: dateOnly ? isoDate(target) : target.toISOString(),
    enddt: dateOnly ? isoDate(nextDay(target)) : target.toISOString(),
    allday: String(dateOnly),
  });
  return `https://outlook.live.com/calendar/0/action/compose?${query(params)}`;
}

function icsFile(countdown: Countdown, title: string, details: string, url: string): string {
  const { target, dateOnly } = countdown;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Time Until//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    // Stable per link, so adding the same countdown again updates the event
    `UID:${new URL(url).searchParams.get("c")}@${location.host}`,
    `DTSTAMP:${compactUtc(new Date())}`,
    ...(dateOnly
      ? [`DTSTART;VALUE=DATE:${compactDate(target)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(target))}`]
      : [`DTSTART:${compactUtc(target)}`]), // no DTEND: an instant
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(details)}`,
    `URL:${url}`,
    ...alarm("-P1D", `Tomorrow: ${title}`),
    ...alarm("PT0S", title),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

function alarm(trigger: string, description: string): string[] {
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `TRIGGER:${trigger}`,
    `DESCRIPTION:${escapeText(description)}`,
    "END:VALARM",
  ];
}

// --- Formatting helpers ---

/** Query string with spaces as %20, which every calendar service reads correctly. */
function query(params: URLSearchParams): string {
  return params.toString().replace(/\+/g, "%20");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYYMMDD. */
function compactDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Local calendar date as YYYY-MM-DD. */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** UTC timestamp as YYYYMMDDTHHMMSSZ. */
function compactUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function nextDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/** Escape text for an iCalendar TEXT value. */
function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a line to at most 75 bytes per line, as iCalendar requires. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines start with a space, which counts toward their 75
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
