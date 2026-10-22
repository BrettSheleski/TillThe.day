// Script for index.html: create a countdown or count-up (with a live preview),
// or show the one in the URL. Which it is comes from the dates: a start that
// has passed counts up, unless the event has an end still to come or repeats
// yearly, in which case it counts toward the next start or end.
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

  // The optional end: an end time (and date, if different) for a countdown
  // with a time, or an end date for a date-only one
  const addEnd = byId<HTMLButtonElement>("add-end");
  const endFields = byId("end-fields");
  const endDateInput = byId<HTMLInputElement>("end-date");
  const endTimeInput = byId<HTMLInputElement>("end-time");
  const hasEnd = () => !endFields.hidden;

  /** Whether the start has passed: an earlier day, or with a time, a moment before now. */
  function startPassed(): boolean {
    if (!timeInput.value) return dateInput.value < localDate(new Date()); // today still counts down
    return new Date(`${dateInput.value}T${timeInput.value}`).getTime() <= Date.now();
  }
  const countingUp = () => startPassed() && !yearlyInput.checked && !hasEnd();

  /** How long the event lasts (see Countdown.duration), or what's wrong with the end; 0 with no end. */
  function readEnd(): { duration: number; problem?: [HTMLInputElement, string] } {
    if (!hasEnd() || !dateInput.value) return { duration: 0 };
    if (timeInput.value) {
      if (!endTimeInput.value) return { duration: 0, problem: [endTimeInput, "Pick an end time."] };
      const start = new Date(`${dateInput.value}T${timeInput.value}`);
      const end = new Date(`${endDateInput.value || dateInput.value}T${endTimeInput.value}`);
      const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
      if (!(minutes > 0)) return { duration: 0, problem: [endTimeInput, "The end must be after the start."] };
      if (end.getTime() <= Date.now() && !yearlyInput.checked) {
        return { duration: 0, problem: [endTimeInput, "The end has already passed."] };
      }
      return { duration: minutes };
    }
    if (!endDateInput.value) return { duration: 0, problem: [endDateInput, "Pick an end date."] };
    const days = Math.round((utcDay(endDateInput.value) - utcDay(dateInput.value)) / 86_400_000);
    if (!(days > 0)) return { duration: 0, problem: [endDateInput, "The end date must be after the start date."] };
    if (endDateInput.value < localDate(new Date()) && !yearlyInput.checked) {
      return { duration: 0, problem: [endDateInput, "The end has already passed."] };
    }
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

  // Changing the start moves the end with it, keeping the event's length, as
  // calendar apps do. The length is whatever the end says at the time, so
  // editing the end sets a new one. Adding or clearing a start time has its
  // own rules (above, and in update()).
  let lastStart: { date: string; time: string } | null = null; // the last valid start
  function moveEndWithStart(): void {
    const prev = lastStart;
    if (!dateInput.value) return; // e.g. half-typed; keep the last valid start
    lastStart = { date: dateInput.value, time: timeInput.value };
    if (!prev || !hasEnd() || !endDateInput.value || !prev.time !== !timeInput.value) return;
    if (timeInput.value) {
      if (!endTimeInput.value) return;
      const length = wallClock(endDateInput.value, endTimeInput.value) - wallClock(prev.date, prev.time);
      const end = new Date(wallClock(dateInput.value, timeInput.value) + length);
      endDateInput.value = isoDate(end);
      endTimeInput.value = end.toISOString().slice(11, 16);
    } else {
      const length = wallClock(endDateInput.value) - wallClock(prev.date);
      endDateInput.value = isoDate(new Date(wallClock(dateInput.value) + length));
    }
  }
  dateInput.addEventListener("input", moveEndWithStart);
  timeInput.addEventListener("input", moveEndWithStart);

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
      yearly: yearlyInput.checked,
      duration: readEnd().duration,
    };
  }

  function update(): void {
    applyTheme(themeById(themeSelect.value));
    clearTime.hidden = !timeInput.value;
    hadTime = !!timeInput.value;

    addEnd.hidden = !endFields.hidden;
    // The end time only applies once there's a start time; shown either way so
    // the row keeps its two columns. Clearing the start time clears it too.
    if (!timeInput.value) endTimeInput.value = "";
    endTimeInput.disabled = !timeInput.value;
    endTimeInput.title = timeInput.value ? "" : "Pick a start time first";
    endDateInput.min = dateInput.value;
    endDateInput.setCustomValidity("");
    endTimeInput.setCustomValidity("");
    const problem = readEnd().problem;
    if (problem) problem[0].setCustomValidity(problem[1]);

    display.set(readForm());
  }

  form.addEventListener("input", update);
  clearTime.addEventListener("click", () => {
    timeInput.value = "";
    update();
  });
  update(); // also picks up values the browser restores, e.g. after Back
  if (dateInput.value) lastStart = { date: dateInput.value, time: timeInput.value };

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

/**
 * A date (and time) input's value as a number for date maths: the wall-clock
 * time as if it were UTC, so daylight saving changes don't shift the result.
 * Read back with isoDate() and toISOString(). Years below 100 are kept as is.
 */
function wallClock(date: string, time = "00:00"): number {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const result = new Date(0);
  result.setUTCFullYear(y, m - 1, d);
  result.setUTCHours(h, min);
  return result.getTime();
}

/** YYYY-MM-DD of a wallClock() value. */
function isoDate(d: Date): string {
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${d.toISOString().slice(5, 10)}`;
}

/** YYYY-MM-DD in local time, the format date inputs use. */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
