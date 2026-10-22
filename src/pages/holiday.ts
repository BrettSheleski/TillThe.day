// Script for holiday pages (_holidays/*.md, laid out by _layouts/holiday.html):
// counts down to the holiday's next date, worked out from the page's rule, or
// with ?year=2028 to its date in that year.
import { createDisplay, formatTarget, showActions } from "../lib/countdown-view";
import { byId } from "../lib/dom";
import { holidayCountdown, nextHoliday, parseYear, upcomingHolidays, type HolidayRule } from "../lib/holidays";
import { themeById } from "../lib/themes";

const page = byId("holiday");
const rule = JSON.parse(page.dataset.rule!) as HolidayRule;
const name = page.dataset.name!;
const requestedYear = parseYear(new URLSearchParams(location.search).get("year"));
const countdown = holidayCountdown(rule, name, themeById(page.dataset.theme!), requestedYear);

if (countdown) {
  const year = countdown.target.getFullYear();
  const isNext = countdown.target.getTime() === nextHoliday(rule)?.getTime();

  // The next occurrence is the page's own address; later ones add ?year=.
  // A past, missing or unreadable year has fallen back to the next one, so
  // tidy the address to match what's shown.
  const pageUrl = `${location.origin}${location.pathname}${isNext ? "" : `?year=${year}`}`;
  if (location.href !== pageUrl) history.replaceState(null, "", pageUrl);
  if (!isNext) document.title = `${name} ${year} | ${document.title}`;

  byId("holiday-year").textContent = String(year);
  createDisplay().set(countdown, { celebrate: true });
  // The holiday's summary goes in calendar events' description (not on the page,
  // which has it in its About section)
  const withNotes = { ...countdown, notes: page.dataset.summary };
  showActions(withNotes, pageUrl, { holiday: page.dataset.slug!, ...(isNext ? {} : { year }) });

  // Fill the lines the page reserved with links to each occurrence; drop any left over
  const items = [...byId("upcoming").children];
  const dates = upcomingHolidays(rule, items.length);
  items.forEach((item, i) => {
    const date = dates[i];
    if (!date) return item.remove();
    const link = document.createElement("a");
    link.href = i === 0 ? location.pathname : `${location.pathname}?year=${date.getFullYear()}`;
    link.textContent = formatTarget({ ...countdown, target: date });
    if (date.getTime() === countdown.target.getTime()) link.setAttribute("aria-current", "page");
    item.replaceChildren(link);
  });
} else {
  // A date list has run out (see the rule in this page's front matter)
  byId("holiday-none").hidden = false;
  byId("countdown").hidden = true;
  byId("view-actions").hidden = true;
  byId("upcoming-dates").hidden = true;
}
