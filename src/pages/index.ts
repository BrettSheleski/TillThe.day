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
    showView(countdown, token);
  } else {
    showError();
  }
} else {
  showCreate();
}

function showView(countdown: Countdown, token: string): void {
  display.set(countdown, { celebrate: true });
  if (countdown.msg) document.title = `${countdown.msg} | ${document.title}`;
  showActions(countdown, location.href, { token });
}

/** A link that can't be read: the error instead of the countdown and its buttons. */
function showError(): void {
  byId("countdown").hidden = true;
  byId("view-actions").hidden = true;
  byId("error-view").hidden = false;
}

function showCreate(): void {
  const form = byId<HTMLFormElement>("create-form");
  const dateInput = byId<HTMLInputElement>("date");
  const timeInput = byId<HTMLInputElement>("time");
  const themeSelect = byId<HTMLSelectElement>("theme");
  const clearTime = byId("clear-time");
  const yearlyInput = byId<HTMLInputElement>("yearly");
  const countingUp = () => (form.elements.namedItem("mode") as RadioNodeList).value === "up";
  // Repeating doesn't apply to count-ups; disabled rather than hidden so the form doesn't jump
  const repeating = () => yearlyInput.checked && !countingUp();

  // The optional end: an end time (and date, if different) for a countdown
  // with a time, or an end date for a date-only one
  const addEnd = byId<HTMLButtonElement>("add-end");
  const endFields = byId("end-fields");
  const endDateInput = byId<HTMLInputElement>("end-date");
  const endTimeInput = byId<HTMLInputElement>("end-time");
  const hasEnd = () => !endFields.hidden && !countingUp();

  /** How long the event lasts (see Countdown.duration), or what's wrong with the end; 0 with no end. */
  function readEnd(): { duration: number; problem?: [HTMLInputElement, string] } {
    if (!hasEnd() || !dateInput.value) return { duration: 0 };
    if (timeInput.value) {
      if (!endTimeInput.value) return { duration: 0, problem: [endTimeInput, "Pick an end time."] };
      const start = new Date(`${dateInput.value}T${timeInput.value}`);
      const end = new Date(`${endDateInput.value || dateInput.value}T${endTimeInput.value}`);
      const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
      if (!(minutes > 0)) return { duration: 0, problem: [endTimeInput, "The end must be after the start."] };
      return { duration: minutes };
    }
    if (!endDateInput.value) return { duration: 0, problem: [endDateInput, "Pick an end date."] };
    const days = Math.round((utcDay(endDateInput.value) - utcDay(dateInput.value)) / 86_400_000);
    if (!(days > 0)) return { duration: 0, problem: [endDateInput, "The end date must be after the start date."] };
    return { duration: days };
  }

  addEnd.addEventListener("click", () => {
    endFields.hidden = false;
    // Start from the shortest valid end: an hour after the start time, or with
    // only a date, the following day (the end date is the last day, inclusive)
    if (dateInput.value && !endDateInput.value && !endTimeInput.value) {
      if (timeInput.value) {
        endAnHourAfterStart();
      } else {
        const [y, m, d] = dateInput.value.split("-").map(Number);
        endDateInput.value = localDate(new Date(y, m - 1, d + 1));
      }
    }
    update();
    endDateInput.focus();
  });
  function endAnHourAfterStart(): void {
    const later = new Date(new Date(`${dateInput.value}T${timeInput.value}`).getTime() + 3_600_000);
    endDateInput.value = localDate(later);
    endTimeInput.value = later.toTimeString().slice(0, 5);
  }

  // Adding a start time to a date-only event with an end: end at the same
  // time on its end date (a day later is 24 hours). Runs before the form's
  // update, which listens on the form.
  let hadTime = false; // as of the last update()
  timeInput.addEventListener("input", () => {
    if (hadTime || !timeInput.value || !hasEnd() || !dateInput.value || endTimeInput.value) return;
    if (endDateInput.value > dateInput.value) endTimeInput.value = timeInput.value;
    else endAnHourAfterStart();
  });

  byId("remove-end").addEventListener("click", () => {
    endFields.hidden = true;
    endDateInput.value = endTimeInput.value = "";
    update();
    addEnd.focus();
  });

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
      duration: readEnd().duration,
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
    hadTime = !!timeInput.value;
    yearlyInput.disabled = countingUp();

    // An end doesn't apply to count-ups
    addEnd.hidden = !endFields.hidden;
    addEnd.disabled = endDateInput.disabled = countingUp();
    // The end time only applies once there's a start time; shown either way so
    // the row keeps its two columns. Clearing the start time clears it too.
    if (!timeInput.value) endTimeInput.value = "";
    endTimeInput.disabled = countingUp() || !timeInput.value;
    endTimeInput.title = timeInput.value ? "" : "Pick a start time first";
    endDateInput.min = dateInput.value;
    endDateInput.setCustomValidity("");
    endTimeInput.setCustomValidity("");
    const problem = readEnd().problem;
    if (problem) problem[0].setCustomValidity(problem[1]);

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

/** A date input's YYYY-MM-DD as a UTC day, for counting whole days between dates. */
function utcDay(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** YYYY-MM-DD in local time, the format date inputs use. */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
