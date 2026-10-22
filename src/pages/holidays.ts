// Script for holidays.html. The page is laid out when the site is built; this
// redoes each holiday's next date and days to go in the reader's own time
// zone, regroups them by month (only different if a holiday has passed since
// the build, or across a time zone's date line), and ticks the "Next up" clock.
import { byId } from "../lib/dom";
import { listingDates, type ListingDates } from "../lib/holiday-facts";
import { nextHoliday, type HolidayRule } from "../lib/holidays";

interface Item {
  item: HTMLElement;
  date: Date | null;
  listing: ListingDates | null;
}

const items: Item[] = [...document.querySelectorAll<HTMLElement>("#holiday-groups li[data-rule]")].map((item) => {
  const rule = JSON.parse(item.dataset.rule!) as HolidayRule;
  const date = nextHoliday(rule);
  const listing = date && listingDates(rule, date);
  item.querySelector(".days")!.textContent = listing ? daysText(listing.days) : "";
  item.querySelector(".date")!.textContent = listing ? listing.short : "Not yet published";
  return { item, date, listing };
});

// Soonest first; a date list that has run out goes last
items.sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity));
byId("holiday-groups").replaceChildren(...groupByMonth(items));

const first = items.find((i) => i.date);
if (first) showNextUp(first);

function daysText(days: number): string {
  return days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `${days.toLocaleString()} days`;
}

/** A heading and list for each month, the same markup the page is built with. */
function groupByMonth(list: Item[]): HTMLElement[] {
  const sections: HTMLElement[] = [];
  let current = "";
  let ul: HTMLUListElement | null = null;
  for (const { item, listing } of list) {
    const month = listing?.month ?? "Date to be announced";
    if (month !== current || !ul) {
      current = month;
      const section = document.createElement("section");
      section.className = "month";
      const heading = document.createElement("h2");
      heading.textContent = month;
      ul = document.createElement("ul");
      ul.className = "holiday-cards";
      section.append(heading, ul);
      sections.push(section);
    }
    ul.append(item);
  }
  return sections;
}

/** Fills the "Next up" card from the soonest holiday's card, and ticks its clock. */
function showNextUp({ item, date, listing }: Item): void {
  const card = item.querySelector<HTMLAnchorElement>(".holiday-card")!;
  const hero = byId<HTMLAnchorElement>("next-up");
  const text = (selector: string) => card.querySelector(selector)!.firstChild!.textContent!.trim();
  hero.href = card.href;
  // Its theme's tint (the card's tint-<theme> class)
  hero.className = [...card.classList].map((c) => (c === "holiday-card" ? "next-up" : c)).join(" ");
  hero.querySelector(".next-up-emoji")!.textContent = text(".holiday-emoji");
  hero.querySelector(".next-up-name")!.textContent = text(".holiday-name");
  hero.querySelector(".next-up-summary")!.textContent = text(".holiday-summary");
  hero.querySelector(".next-up-date")!.textContent = listing!.days === 0 ? `Today! ${listing!.long}` : listing!.long;

  const numbers = new Map(
    [...hero.querySelectorAll<HTMLElement>("[data-unit]")].map((el) => [el.dataset.unit!, el])
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const tick = () => {
    const s = Math.max(0, Math.floor((date!.getTime() - Date.now()) / 1000));
    numbers.get("days")!.textContent = Math.floor(s / 86400).toLocaleString();
    numbers.get("hours")!.textContent = pad(Math.floor((s % 86400) / 3600));
    numbers.get("minutes")!.textContent = pad(Math.floor((s % 3600) / 60));
    numbers.get("seconds")!.textContent = pad(s % 60);
  };
  tick();
  setInterval(tick, 1000);
}
