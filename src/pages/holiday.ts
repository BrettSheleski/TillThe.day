// Script for holiday pages (_holidays/*.md, laid out by _layouts/holiday.html):
// counts down to the holiday's next date, worked out from the page's rule.
import { createDisplay, formatTarget, showActions } from "../lib/countdown-view";
import { byId } from "../lib/dom";
import { holidayCountdown, upcomingHolidays, type HolidayRule } from "../lib/holidays";
import { themeById } from "../lib/themes";

const page = byId("holiday");
const rule = JSON.parse(page.dataset.rule!) as HolidayRule;
const countdown = holidayCountdown(rule, page.dataset.name!, themeById(page.dataset.theme!));

if (countdown) {
  byId("holiday-year").textContent = String(countdown.target.getFullYear());
  createDisplay().set(countdown, { celebrate: true });
  // Share the page itself, without any query string
  showActions(countdown, `${location.origin}${location.pathname}`, { holiday: page.dataset.slug! });

  const upcoming = byId("upcoming");
  for (const date of upcomingHolidays(rule, 5)) {
    const item = document.createElement("li");
    item.textContent = formatTarget({ ...countdown, target: date });
    upcoming.append(item);
  }
} else {
  // A date list has run out (see the rule in this page's front matter)
  byId("holiday-none").hidden = false;
  byId("upcoming-dates").hidden = true;
}
