// The countdown display and its actions (copy, share, add to calendar), shared
// by every page that includes _includes/countdown.html.
import { calendarLinks } from "./calendar";
import { byId, copyToClipboard } from "./dom";
import { EMBED_HEIGHT, embedSnippet, embedUrl, type EmbedSource } from "./embed";
import { setUpPresenting } from "./present";
import { canShareNatively, shareLinks, shareNatively, type ShareInfo } from "./share";
import type { Countdown } from "./token";
import { eventEnd, lastDay, phaseAt, type Phase } from "./schedule";
import { ordinal, upcoming, yearsSince } from "./yearly";

export type Display = ReturnType<typeof createDisplay>;

/**
 * The ticking countdown display. `set(null)` shows an empty placeholder of the
 * same size, so the page doesn't shift when a date is first picked.
 *
 * Counting down, it shows the time to the start. If the event has an end, it
 * then shows "happening now" with the time to the end, then "ended" with
 * zeros; without an end, it shows zeros from the start. While the event is
 * on (or from the start, without an end), `celebrate` adds the "elapsed"
 * class to <html>, which starts the current theme's end animation (see
 * _sass/themes/). Counting up, it shows the time since the target, or zeros
 * if that hasn't arrived yet.
 */
export function createDisplay() {
  const section = byId("countdown");
  const days = byId("days");
  const hours = byId("hours");
  const minutes = byId("minutes");
  const seconds = byId("seconds");
  const status = byId("status");
  const message = byId("message");
  const targetLabel = byId("target-label");
  const pad = (n: number) => String(n).padStart(2, "0");

  let current: Countdown | null = null;
  let anniversary = "";
  let celebrate = false;
  let shownPhase: Phase | null = null;

  function tick(): void {
    if (!current) return;
    const now = new Date();
    let ms: number;
    let label: string;
    let phase: Phase | null = null;

    if (current.countUp) {
      ms = now.getTime() - current.target.getTime();
      label = "since";
    } else {
      const state = phaseAt(current, now);
      phase = state.phase;
      ms = state.countTo.getTime() - now.getTime();
      label = phase === "during" ? "happening now" : phase === "after" && current.duration ? "ended" : "until";
    }

    const s = ms > 0 ? Math.floor(ms / 1000) : 0;
    days.textContent = Math.floor(s / 86400).toLocaleString();
    days.classList.toggle("long", days.textContent.length > 3);
    hours.textContent = pad(Math.floor((s % 86400) / 3600));
    minutes.textContent = pad(Math.floor((s % 3600) / 60));
    seconds.textContent = pad(s % 60);
    status.textContent = label + (current.msg ? ":" : "");

    // The date line changes with the phase: when it is, or when it ends
    if (phase !== shownPhase) {
      shownPhase = phase;
      targetLabel.textContent = phase === "during" ? formatEnding(current) : formatWhen(current) + anniversary;
    }
    const celebrating = phase === "during" || (phase === "after" && !current.duration);
    document.documentElement.classList.toggle("elapsed", celebrate && celebrating);
  }
  setInterval(tick, 1000);

  return {
    set(countdown: Countdown | null, options: { celebrate?: boolean } = {}): void {
      current = countdown;
      celebrate = options.celebrate ?? false;
      shownPhase = null;
      section.hidden = false;
      if (!countdown) {
        for (const unit of [days, hours, minutes, seconds]) unit.textContent = "--";
        status.textContent = "Pick a date";
        message.textContent = "";
        targetLabel.textContent = " "; // keeps the line's height
        showDetails({});
        return;
      }
      current = upcoming(countdown);
      message.textContent = countdown.msg;
      showDetails(countdown);
      // Which anniversary this is, e.g. "· 37th"
      const years = countdown.yearly ? yearsSince(countdown.target, current.target) : 0;
      anniversary = years > 0 ? ` · ${ordinal(years)}` : "";
      targetLabel.textContent = formatWhen(current) + anniversary;
      tick();
    },
  };
}

/** The location (with a map link) and notes under the date, or nothing if it has neither. */
function showDetails({ location, notes }: { location?: string; notes?: string }): void {
  byId("event-details").hidden = !location && !notes;
  byId("event-location").hidden = !location;
  byId("event-notes").hidden = !notes;
  const map = byId<HTMLAnchorElement>("event-map");
  map.textContent = location ?? "";
  if (location) {
    const link = mapLink(location);
    map.href = link.href;
    map.title = link.title;
    // Phones open their maps app, which would leave an empty tab behind
    if (link.newTab) map.target = "_blank";
    else map.removeAttribute("target");
  }
  byId("event-notes").textContent = notes ?? "";
}

/**
 * A link that opens the location in this device's maps: Apple Maps on an
 * iPhone or iPad, the default maps app on Android (geo: links), and Google
 * Maps in a new tab anywhere else.
 */
export function mapLink(
  location: string,
  ua = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
): { href: string; title: string; newTab: boolean } {
  const query = encodeURIComponent(location);
  // iPads ask for desktop sites, so they look like a Mac with a touch screen
  const appleMobile = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  if (appleMobile) return { href: `https://maps.apple.com/?q=${query}`, title: "Open in Maps", newTab: false };
  if (/Android/.test(ua)) return { href: `geo:0,0?q=${query}`, title: "Open in Maps", newTab: false };
  return { href: `https://www.google.com/maps/search/?api=1&query=${query}`, title: "Open in Google Maps", newTab: true };
}

const TIMED: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};
const DATE_ONLY: Intl.DateTimeFormatOptions = { dateStyle: "full" };

/** When the countdown is, without its end. */
export function formatTarget({ target, dateOnly }: Countdown): string {
  return target.toLocaleString(undefined, dateOnly ? DATE_ONLY : TIMED);
}

/** When the countdown is: its date, or the range from start to end. */
export function formatWhen(countdown: Countdown): string {
  if (!countdown.duration) return formatTarget(countdown);
  const format = new Intl.DateTimeFormat(undefined, countdown.dateOnly ? DATE_ONLY : TIMED);
  const end = countdown.dateOnly ? lastDay(countdown) : eventEnd(countdown)!;
  return format.formatRange(countdown.target, end);
}

/** While the event is on: when it ends. */
function formatEnding(countdown: Countdown): string {
  return countdown.dateOnly
    ? `Through ${lastDay(countdown).toLocaleString(undefined, DATE_ONLY)}`
    : `Ends ${eventEnd(countdown)!.toLocaleString(undefined, TIMED)}`;
}

/**
 * Show the buttons under a countdown and wire them up for the given page URL.
 * `embed` says what the "Embed on a website" widget should show.
 */
export function showActions(countdown: Countdown, url: string, embed: EmbedSource): void {
  const actions = byId("view-actions");
  // Copy link is in the Share menu, which closes when it's chosen, so the
  // result ("Copied!") shows on the Share button
  byId("copy-link").addEventListener("click", () => copyToClipboard(url, byId("share-label")));
  const info = shareInfo(countdown, url);
  setUpShareMenu(info);
  setUpEmbedDialog(info.title, embedUrl(new URL(actions.dataset.embed!, location.href).href, embed));
  setUpCalendarMenu(countdown, url);
  setUpPresenting(byId("present"), byId("exit-present"));
}

/** The "Embed on a website" pop-up: a live preview and the code to copy. */
function setUpEmbedDialog(title: string, src: string): void {
  const dialog = byId<HTMLDialogElement>("embed-dialog");
  setUpDialog(dialog, byId("embed-close"));
  const code = byId<HTMLTextAreaElement>("embed-code");
  code.value = embedSnippet(src, title);
  code.addEventListener("focus", () => code.select());

  byId("share-embed").addEventListener("click", () => {
    // The preview loads only when first opened
    const preview = byId("embed-preview");
    if (!preview.firstChild) {
      const frame = document.createElement("iframe");
      frame.src = src;
      frame.title = title;
      frame.height = String(EMBED_HEIGHT);
      preview.append(frame);
    }
    dialog.showModal();
  });
  byId("embed-copy").addEventListener("click", (e) =>
    copyToClipboard(code.value, e.currentTarget as HTMLElement)
  );
}

/** Close a <dialog> with its button or by clicking the backdrop around it. */
function setUpDialog(dialog: HTMLDialogElement, closeButton: HTMLElement): void {
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

function shareInfo(countdown: Countdown, url: string): ShareInfo {
  const what = countdown.msg || formatTarget(upcoming(countdown));
  return countdown.countUp
    ? { title: `Time since ${what}`, text: `See how long it's been since ${what}:`, url }
    : { title: `Countdown to ${what}`, text: `Count down to ${what} with me:`, url };
}

function setUpShareMenu(info: ShareInfo): void {
  const menu = byId<HTMLDetailsElement>("share-menu");
  setUpDropdown(menu);

  const native = byId("share-native");
  if (canShareNatively(info)) {
    native.hidden = false;
    native.addEventListener("click", () => shareNatively(info));
  }

  const links = shareLinks(info);
  byId<HTMLAnchorElement>("share-email").href = links.email;
  byId<HTMLAnchorElement>("share-whatsapp").href = links.whatsapp;
  byId<HTMLAnchorElement>("share-facebook").href = links.facebook;
  byId<HTMLAnchorElement>("share-x").href = links.x;

  // The QR code is drawn when first asked for
  const dialog = byId<HTMLDialogElement>("qr-dialog");
  byId("share-qr").addEventListener("click", async () => {
    const image = byId<HTMLImageElement>("qr-image");
    if (!image.src) {
      const { qrPng } = await import("./qr");
      image.src = qrPng(info.url);
      const download = byId<HTMLAnchorElement>("qr-download");
      download.href = image.src;
      download.download = `${fileName(info.title)}-qr.png`;
    }
    dialog.showModal();
  });
  setUpDialog(dialog, byId("qr-close"));
}

/** The "Add to calendar" menu; hidden for count-ups and ended countdowns (never for yearly ones). */
function setUpCalendarMenu(countdown: Countdown, url: string): void {
  const menu = byId<HTMLDetailsElement>("calendar-menu");
  if (countdown.countUp || upcoming(countdown).target.getTime() <= Date.now()) {
    menu.hidden = true;
    return;
  }
  setUpDropdown(menu);

  const links = calendarLinks(countdown, url);
  byId<HTMLAnchorElement>("calendar-google").href = links.google;
  byId<HTMLAnchorElement>("calendar-outlook").href = links.outlook;
  const ics = byId<HTMLAnchorElement>("calendar-ics");
  ics.href = URL.createObjectURL(new Blob([links.ics], { type: "text/calendar" }));
  ics.download = `${fileName(countdown.msg || "countdown")}.ics`;
}

const dropdowns: HTMLDetailsElement[] = [];

/**
 * A <details> dropdown menu: closes after an option is chosen, when clicking
 * anywhere else, or when another dropdown opens.
 */
function setUpDropdown(menu: HTMLDetailsElement): void {
  dropdowns.push(menu);
  menu.addEventListener("toggle", () => {
    if (menu.open) for (const other of dropdowns) if (other !== menu) other.open = false;
  });
  menu.addEventListener("click", (e) => {
    if ((e.target as Element).closest(".menu a, .menu button")) menu.open = false;
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target as Node)) menu.open = false;
  });
}

/** A safe, readable file name from free text. */
function fileName(text: string): string {
  return text.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "countdown";
}
