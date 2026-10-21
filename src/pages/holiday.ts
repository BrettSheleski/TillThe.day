// Script for holiday pages (_holidays/*.md, laid out by _layouts/holiday.html):
// counts down to the holiday's next date, worked out from the page's rule.
import { createDisplay, formatTarget, showActions } from "../lib/countdown-view";
import { byId } from "../lib/dom";
import { nextHoliday, upcomingHolidays, type HolidayRule } from "../lib/holidays";
import { themeById } from "../lib/themes";
import type { Countdown } from "../lib/token";

const page = byId("holiday");
const rule = JSON.parse(page.dataset.rule!) as HolidayRule;

const countdown: Countdown = {
  target: nextHoliday(rule),
  dateOnly: true,
  msg: page.dataset.name!,
  theme: themeById(page.dataset.theme!),
  countUp: false,
  // Holidays roll over by their own rule (see ../lib/holidays.ts)
  yearly: false,
};

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
