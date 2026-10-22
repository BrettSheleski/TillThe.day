// Facts about a holiday that don't depend on the viewer: its upcoming dates
// and a few questions and answers. Worked out when the site is built
// (scripts/holiday-data.ts) so holiday pages have them in their HTML for
// search engines, and shown as a visible FAQ with matching structured data
// (_layouts/holiday.html).

import { holidayDate, isExactTime, upcomingHolidays, type HolidayRule } from "./holidays";

export interface HolidayFacts {
  /** The next few occurrences, starting with the next one */
  dates: { year: number; text: string }[];
  faq: { q: string; a: string }[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NTH = ["", "first", "second", "third", "fourth", "fifth"];

// The dates are text in the page, so they're fixed to US English. Whole days
// are local midnight in the build's time zone; seasons are exact moments,
// given in UTC since the reader's time zone isn't known yet.
const DAY: Intl.DateTimeFormatOptions = { dateStyle: "full" };
const MOMENT: Intl.DateTimeFormatOptions = {
  dateStyle: "full", timeStyle: "short", timeZone: "UTC", hourCycle: "h12",
};

/** A date as page text, e.g. "Friday, December 25, 2026". */
export function formatHolidayDate(rule: HolidayRule, date: Date): string {
  return isExactTime(rule)
    ? date.toLocaleString("en-US", MOMENT).replace(/ at (.*)$/, " at $1 UTC")
    : date.toLocaleDateString("en-US", DAY);
}

export function holidayFacts(rule: HolidayRule, name: string, now = new Date(), count = 5): HolidayFacts {
  const upcoming = upcomingHolidays(rule, count, now);
  const dates = upcoming.map((date) => ({ year: date.getFullYear(), text: formatHolidayDate(rule, date) }));

  // When it is this year (or next, once it's passed) and the year after,
  // then whether the date changes. Seasons are asked about as starting.
  const season = isExactTime(rule) ? name.toLowerCase() : "";
  const faq = dates.slice(0, 2).map(({ year, text }) => {
    const when = text.replace(`, ${year}`, ""); // the year's already in the sentence
    return season
      ? { q: `When does ${season} start in ${year}?`, a: `${name} ${year} starts on ${when}.` }
      : { q: `When is ${name} ${year}?`, a: `${name} ${year} is on ${when}.` };
  });
  faq.push({
    q: season ? `Does ${season} start on the same date every year?` : `Is ${name} on the same date every year?`,
    a: sameDateAnswer(rule, name),
  });
  return { dates, faq };
}

function sameDateAnswer(rule: HolidayRule, name: string): string {
  const offset = rule.offset ? `${daysFrom(rule.offset)} ` : "";
  switch (rule.type) {
    case "fixed":
      return `Yes. ${name} is on ${MONTHS[rule.month - 1]} ${rule.day} every year, ` +
        "though the day of the week changes.";
    case "nth-weekday": {
      const which = rule.n < 0 ? (rule.n === -1 ? "last" : `${NTH[-rule.n]}-to-last`) : NTH[rule.n];
      return `No. ${name} is ${offset}the ${which} ${WEEKDAYS[rule.weekday]} in ` +
        `${MONTHS[rule.month - 1]}, so its date changes from year to year.`;
    }
    case "easter":
      return rule.offset
        ? `No. ${name} is ${offset}Easter Sunday, which moves every year, so its date moves too.`
        : `No. ${name} moves every year, falling anywhere from March 22 to April 25.`;
    case "dates":
      return `No. ${name}'s date comes from a traditional calendar that follows the moon, ` +
        "so in the everyday calendar it changes from year to year.";
    case "season": {
      const around = holidayDate(rule, 2000)!; // any year: just its month
      const marker = rule.season === "spring" || rule.season === "fall" ? "equinox" : "solstice";
      return `Not quite. ${name} starts at the ${MONTHS[around.getUTCMonth()]} ${marker}, an exact ` +
        "moment that shifts by a few hours each year, so it can land a day earlier or later.";
    }
  }
}

/** e.g. "the day after", "47 days before", "a week before" */
function daysFrom(offset: number): string {
  const days = Math.abs(offset);
  const amount = days === 1 ? "the day" : days === 7 ? "a week" : `${days} days`;
  return `${amount} ${offset > 0 ? "after" : "before"}`;
}
