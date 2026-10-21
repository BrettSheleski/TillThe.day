// The countdown display and its actions (copy, share, add to calendar), shared
// by every page that includes _includes/countdown.html.
import { calendarLinks } from "./calendar";
import { byId, copyToClipboard } from "./dom";
import { EMBED_HEIGHT, embedSnippet, embedUrl, type EmbedSource } from "./embed";
import { setUpPresenting } from "./present";
import { canShareNatively, shareLinks, shareNatively, type ShareInfo } from "./share";
import type { Countdown } from "./token";
import { ordinal, upcoming, yearsSince } from "./yearly";

export type Display = ReturnType<typeof createDisplay>;

/**
 * The ticking countdown display. `set(null)` shows an empty placeholder of the
 * same size, so the page doesn't shift when a date is first picked.
 *
 * Counting down, it shows zeros once the target has passed; with `celebrate`,
 * it also adds the "elapsed" class to <html>, which starts the current theme's
 * end animation (see _sass/themes/). Counting up, it shows the time since the
 * target, or zeros if that hasn't arrived yet.
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
  let celebrate = false;

  function tick(): void {
    if (!current) return;
    const remaining = current.target.getTime() - Date.now();
    const shown = current.countUp ? -remaining : remaining;
    const ended = !current.countUp && remaining <= 0;
    const s = shown > 0 ? Math.floor(shown / 1000) : 0;
    days.textContent = Math.floor(s / 86400).toLocaleString();
    days.classList.toggle("long", days.textContent.length > 3);
    hours.textContent = pad(Math.floor((s % 86400) / 3600));
    minutes.textContent = pad(Math.floor((s % 3600) / 60));
    seconds.textContent = pad(s % 60);
    status.textContent = (current.countUp ? "since" : "until") + (current.msg ? ":" : "");
    document.documentElement.classList.toggle("elapsed", celebrate && ended);
  }
  setInterval(tick, 1000);

  return {
    set(countdown: Countdown | null, options: { celebrate?: boolean } = {}): void {
      current = countdown;
      celebrate = options.celebrate ?? false;
      section.hidden = false;
      if (!countdown) {
        for (const unit of [days, hours, minutes, seconds]) unit.textContent = "--";
        status.textContent = "Pick a date";
        message.textContent = "";
        targetLabel.textContent = " "; // keeps the line's height
        return;
      }
      current = upcoming(countdown);
      message.textContent = countdown.msg;
      targetLabel.textContent = formatTarget(current);
      // Which anniversary this is, e.g. "· 37th"
      const years = countdown.yearly ? yearsSince(countdown.target, current.target) : 0;
      if (years > 0) targetLabel.textContent += ` · ${ordinal(years)}`;
      tick();
    },
  };
}

export function formatTarget({ target, dateOnly }: Countdown): string {
  return dateOnly
    ? target.toLocaleDateString(undefined, { dateStyle: "full" })
    : target.toLocaleString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
}

/**
 * Show the buttons under a countdown and wire them up for the given page URL.
 * `embed` says what the "Embed on a website" widget should show.
 */
export function showActions(countdown: Countdown, url: string, embed: EmbedSource): void {
  const actions = byId("view-actions");
  byId("copy-link").addEventListener("click", (e) =>
    copyToClipboard(url, e.currentTarget as HTMLElement)
  );
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
