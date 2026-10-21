// Script for index.html: create a countdown or count-up (with a live preview),
// or show the one in the URL.
import { createDisplay, showActions } from "../lib/countdown-view";
import { byId } from "../lib/dom";
import { applyTheme, themeById } from "../lib/themes";
import { decodeToken, encodeToken, peekTheme, type Countdown } from "../lib/token";

const display = createDisplay();
const token = new URLSearchParams(location.search).get("c");

if (token) {
  applyTheme(peekTheme(token));
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
  display.set(countdown, { celebrate: true });
  if (countdown.msg) document.title = `${countdown.msg} | ${document.title}`;
  showActions(countdown, location.href);
}

function showCreate(): void {
  byId("create-intro").hidden = false;
  byId("create-view").hidden = false;
  byId("countdown").classList.add("preview");

  const form = byId<HTMLFormElement>("create-form");
  const dateInput = byId<HTMLInputElement>("date");
  const timeInput = byId<HTMLInputElement>("time");
  const themeSelect = byId<HTMLSelectElement>("theme");
  const clearTime = byId("clear-time");
  const yearlyInput = byId<HTMLInputElement>("yearly");
  const countingUp = () => (form.elements.namedItem("mode") as RadioNodeList).value === "up";
  // Repeating doesn't apply to count-ups; disabled rather than hidden so the form doesn't jump
  const repeating = () => yearlyInput.checked && !countingUp();

  function readForm(): Countdown | null {
    const date = dateInput.value;
    if (!date) return null;
    const time = timeInput.value;
    // A picked time is in the creator's local time zone. With no time, the
    // countdown is to the start of the date wherever the viewer is.
    const target = new Date(`${date}T${time || "00:00"}`);
    if (isNaN(target.getTime())) return null;
    return {
      target,
      dateOnly: !time,
      msg: byId<HTMLInputElement>("msg").value.trim(),
      theme: themeById(themeSelect.value),
      countUp: countingUp(),
      yearly: repeating(),
    };
  }

  /**
   * Counting down: today or later, and no time that has already passed.
   * Counting up: today or earlier, and no time that hasn't happened yet.
   * Repeating yearly: any date, e.g. a birth date, since it counts down to
   * the next anniversary.
   * Flags the field to fix, which also blocks submitting.
   */
  function validate(countdown: Countdown | null): void {
    const today = localDate(new Date());
    const up = countingUp();
    const anyDate = repeating();
    // Greys out the days that can't be picked
    dateInput.min = up || anyDate ? "" : today;
    dateInput.max = up ? today : "";
    dateInput.setCustomValidity("");
    timeInput.setCustomValidity("");
    if (!countdown || anyDate) return;

    const timePassed = countdown.target.getTime() <= Date.now();
    if (up) {
      if (dateInput.value > today) {
        dateInput.setCustomValidity("Pick today or an earlier date.");
      } else if (!countdown.dateOnly && !timePassed) {
        timeInput.setCustomValidity("Pick a time earlier than now.");
      }
    } else if (dateInput.value < today) {
      dateInput.setCustomValidity("Pick today or a later date.");
    } else if (!countdown.dateOnly && timePassed) {
      timeInput.setCustomValidity("Pick a time later than now.");
    }
  }

  function update(): void {
    applyTheme(themeById(themeSelect.value));
    clearTime.hidden = !timeInput.value;
    yearlyInput.disabled = countingUp();
    const countdown = readForm();
    validate(countdown);
    display.set(countdown);
  }

  form.addEventListener("input", update);
  clearTime.addEventListener("click", () => {
    timeInput.value = "";
    update();
  });
  update(); // also picks up values the browser restores, e.g. after Back

  // Go straight to the countdown; its page has the buttons for sharing.
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    update(); // time has moved on since the last edit, so check again
    if (!form.reportValidity()) return;
    const countdown = readForm();
    if (!countdown) return;
    location.assign(`${location.pathname}?c=${await encodeToken(countdown)}`);
  });
}

/** YYYY-MM-DD in local time, the format date inputs use. */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
