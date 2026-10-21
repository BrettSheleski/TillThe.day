// Script for index.html: create a countdown (with a live preview),
// or show the countdown in the URL.
import { byId, copyToClipboard } from "../lib/dom";
import { decodeToken, encodeToken, type Countdown } from "../lib/token";

const display = createDisplay();
const token = new URLSearchParams(location.search).get("c");

if (token) {
  const countdown = await decodeToken(token);
  if (countdown) {
    showView(countdown);
  } else {
    byId("error-view").hidden = false;
  }
} else {
  showCreate();
}

function showView(countdown: Countdown): void {
  display.set(countdown);
  if (countdown.msg) document.title = `${countdown.msg} | ${document.title}`;
  byId("view-actions").hidden = false;
  byId("copy-link").addEventListener("click", (e) =>
    copyToClipboard(location.href, e.currentTarget as HTMLElement)
  );
}

function showCreate(): void {
  byId("create-intro").hidden = false;
  byId("create-view").hidden = false;
  byId("countdown").classList.add("preview");

  const form = byId<HTMLFormElement>("create-form");
  const timeInput = byId<HTMLInputElement>("time");
  const clearTime = byId("clear-time");

  function readForm(): Countdown | null {
    const date = byId<HTMLInputElement>("date").value;
    if (!date) return null;
    const time = timeInput.value;
    // A picked time is in the creator's local time zone. With no time, the
    // countdown is to the start of the date wherever the viewer is.
    const target = new Date(`${date}T${time || "00:00"}`);
    if (isNaN(target.getTime())) return null;
    return { target, dateOnly: !time, msg: byId<HTMLInputElement>("msg").value.trim() };
  }

  function update(): void {
    clearTime.hidden = !timeInput.value;
    display.set(readForm());
  }

  form.addEventListener("input", update);
  clearTime.addEventListener("click", () => {
    timeInput.value = "";
    update();
  });
  update(); // also picks up values the browser restores, e.g. after Back

  // Go straight to the countdown; its page has the Copy link button for sharing.
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const countdown = readForm();
    if (!countdown) return;
    location.assign(`${location.pathname}?c=${await encodeToken(countdown)}`);
  });
}

/**
 * The ticking countdown display. `set(null)` shows an empty placeholder of the
 * same size, so the page doesn't shift when a date is first picked.
 */
function createDisplay() {
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

  function tick(): void {
    if (!current) return;
    const diff = current.target.getTime() - Date.now();
    const s = Math.floor(Math.abs(diff) / 1000);
    days.textContent = Math.floor(s / 86400).toLocaleString();
    hours.textContent = pad(Math.floor((s % 86400) / 3600));
    minutes.textContent = pad(Math.floor((s % 3600) / 60));
    seconds.textContent = pad(s % 60);
    status.textContent = (diff < 0 ? "since" : "until") + (current.msg ? ":" : "");
  }
  setInterval(tick, 1000);

  return {
    set(countdown: Countdown | null): void {
      current = countdown;
      section.hidden = false;
      if (!countdown) {
        for (const unit of [days, hours, minutes, seconds]) unit.textContent = "--";
        status.textContent = "Pick a date";
        message.textContent = "";
        targetLabel.textContent = " "; // keeps the line's height
        return;
      }
      message.textContent = countdown.msg;
      targetLabel.textContent = countdown.dateOnly
        ? countdown.target.toLocaleDateString(undefined, { dateStyle: "full" })
        : countdown.target.toLocaleString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          });
      tick();
    },
  };
}
