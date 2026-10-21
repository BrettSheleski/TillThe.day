// Script for holidays.html: fills in each holiday's next date and days to go,
// then lists the soonest first.
import { byId } from "../lib/dom";
import { daysUntil, nextHoliday, type HolidayRule } from "../lib/holidays";

const list = byId("holiday-list");
const items = [...list.querySelectorAll<HTMLElement>("li[data-rule]")].map((item) => {
  const date = nextHoliday(JSON.parse(item.dataset.rule!) as HolidayRule);
  const days = daysUntil(date);
  item.querySelector(".days")!.textContent =
    days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `${days.toLocaleString()} days`;
  item.querySelector(".date")!.textContent = date.toLocaleDateString(undefined, { dateStyle: "long" });
  return { item, days };
});

items.sort((a, b) => a.days - b.days);
list.append(...items.map(({ item }) => item));
