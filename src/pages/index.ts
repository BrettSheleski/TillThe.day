// Script for index.html: create a countdown or count-up (with a live preview),
// or show the one in the URL. Which it is comes from the dates: a start that
// has passed counts up, unless the event has an end still to come or repeats
// yearly, in which case it counts toward the next start or end. The date
// rules themselves are in ../lib/form-dates.
import { createDisplay, showActions } from "../lib/countdown-view";
import { byId, setHomeScreenName } from "../lib/dom";
import {
  defaultEnd,
  endForAddedTime,
  isCountingUp,
  movedEnd,
  oneLineAddress,
  readEnd,
  type EndFields,
  type FormDates,
} from "../lib/form-dates";
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
  if (countdown.msg) {
    document.title = `${countdown.msg} | ${document.title}`;
    setHomeScreenName(countdown.msg);
  }
  // The tab shows the time left, e.g. "12d 4h · Christmas"
  display.set(countdown, { celebrate: true, tabTitle: "always" });
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
  const createButton = byId<HTMLButtonElement>("create-button");

  // The optional end: an end time (and date, if different) for a countdown
  // with a time, or an end date for a date-only one
  const addEnd = byId<HTMLButtonElement>("add-end");
  const endFields = byId("end-fields");
  const endDateInput = byId<HTMLInputElement>("end-date");
  const endTimeInput = byId<HTMLInputElement>("end-time");
  const hasEnd = () => !endFields.hidden;

  /** The date fields' values, for ../lib/form-dates */
  const dates = (): FormDates => ({
    date: dateInput.value,
    time: timeInput.value,
    hasEnd: hasEnd(),
    endDate: endDateInput.value,
    endTime: endTimeInput.value,
    yearly: yearlyInput.checked,
  });
  function setEnd({ endDate, endTime }: EndFields): void {
    endDateInput.value = endDate;
    endTimeInput.value = endTime;
  }

  addEnd.addEventListener("click", () => {
    endFields.hidden = false;
    if (dateInput.value && !endDateInput.value && !endTimeInput.value) setEnd(defaultEnd(dateInput.value, timeInput.value));
    update();
    endDateInput.focus();
  });
  byId("remove-end").addEventListener("click", () => {
    endFields.hidden = true;
    setEnd({ endDate: "", endTime: "" });
    update();
    addEnd.focus();
  });

  // Adding a start time to a date-only event with an end gives the end a time
  // too. Runs before the form's update, which listens on the form.
  let hadTime = false; // as of the last update()
  timeInput.addEventListener("input", () => {
    if (hadTime || !timeInput.value || !hasEnd() || !dateInput.value || endTimeInput.value) return;
    setEnd(endForAddedTime(dateInput.value, timeInput.value, endDateInput.value));
  });

  // Changing the start moves the end with it, keeping the event's length
  let lastStart: { date: string; time: string } | null = null; // the last valid start
  function moveEndWithStart(): void {
    const before = lastStart;
    if (!dateInput.value) return; // e.g. half-typed; keep the last valid start
    lastStart = { date: dateInput.value, time: timeInput.value };
    if (!before || !hasEnd()) return;
    const moved = movedEnd(before, lastStart, { endDate: endDateInput.value, endTime: endTimeInput.value });
    if (moved) setEnd(moved);
  }
  dateInput.addEventListener("input", moveEndWithStart);
  timeInput.addEventListener("input", moveEndWithStart);

  // The optional location and notes, hidden until asked for
  const addDetails = byId<HTMLButtonElement>("add-details");
  const detailsFields = byId("details-fields");
  const locationInput = byId<HTMLInputElement>("location");
  const notesInput = byId<HTMLTextAreaElement>("notes");
  function showDetailsFields(show: boolean): void {
    detailsFields.hidden = !show;
    addDetails.hidden = show;
  }
  addDetails.addEventListener("click", () => {
    showDetailsFields(true);
    locationInput.focus();
  });
  byId("remove-details").addEventListener("click", () => {
    locationInput.value = notesInput.value = "";
    showDetailsFields(false);
    update();
    addDetails.focus();
  });
  // An address pasted over several lines becomes one line with commas; a
  // single-line field would otherwise run the lines together
  locationInput.addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!/[\r\n]/.test(text)) return;
    e.preventDefault();
    const { selectionStart: start, selectionEnd: end } = locationInput;
    // Inserting from code skips maxlength, so keep to the room that's left
    const room = locationInput.maxLength - (locationInput.value.length - ((end ?? 0) - (start ?? 0)));
    locationInput.setRangeText(oneLineAddress(text).slice(0, Math.max(0, room)), start ?? 0, end ?? 0, "end");
    locationInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // Values the browser restored, e.g. after Back
  if (locationInput.value || notesInput.value) showDetailsFields(true);

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
      location: locationInput.value.trim(),
      notes: notesInput.value.trim(),
      // Set by an occasion page (_includes/create-form.html)
      occasion: byId<HTMLInputElement>("occasion").value,
      theme: themeById(themeSelect.value),
      countUp: isCountingUp(dates()),
      yearly: yearlyInput.checked,
      duration: readEnd(dates()).duration,
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
    const { problem } = readEnd(dates());
    if (problem) (problem.field === "endDate" ? endDateInput : endTimeInput).setCustomValidity(problem.message);

    display.set(readForm());
    // Nothing to create until there's a date
    createButton.disabled = !dateInput.value;
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
    // Countdowns open on the home page, wherever they were made (an occasion page too)
    location.assign(`${form.dataset.home}?c=${await encodeToken(countdown)}`);
  });
}
