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

  // Fill the lines the page reserved; drop any left over
  const items = [...byId("upcoming").children];
  const dates = upcomingHolidays(rule, items.length);
  items.forEach((item, i) => {
    if (dates[i]) item.textContent = formatTarget({ ...countdown, target: dates[i] });
    else item.remove();
  });
} else {
  // A date list has run out (see the rule in this page's front matter)
  byId("holiday-none").hidden = false;
  byId("countdown").hidden = true;
  byId("view-actions").hidden = true;
  byId("upcoming-dates").hidden = true;
}
