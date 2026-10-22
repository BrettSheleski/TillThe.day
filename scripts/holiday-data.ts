// Writes, for the holiday pages (_layouts/holiday.html):
// - _data/holiday_facts.json: each holiday's upcoming dates and FAQ
//   (src/lib/holiday-facts.ts), keyed by page slug
// - _data/holidays_soonest.json: every holiday with a known next date, soonest
//   first, with that date in the forms the lists show (listingDates), for the
//   "Coming up" card (_includes/coming-up.html) and the holidays page
//
// Part of `npm run build`, so it's regenerated on every deploy; the deploy
// workflow also runs daily so the "next" dates move on once a holiday passes.
// The files are build output and aren't committed.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { holidayFacts, listingDates, type HolidayFacts, type ListingDates } from "../src/lib/holiday-facts";
import { nextHoliday, type HolidayRule } from "../src/lib/holidays";

// Run from the project root by npm
const holidaysDir = path.join("_holidays");
const out = path.join("_data", "holiday_facts.json");
const soonestOut = path.join("_data", "holidays_soonest.json");
const now = new Date();

const facts: Record<string, HolidayFacts> = {};
const soonest: ({ slug: string; time: number } & ListingDates)[] = [];
for (const file of fs.readdirSync(holidaysDir).filter((f) => f.endsWith(".md")).sort()) {
  const text = fs.readFileSync(path.join(holidaysDir, file), "utf8");
  const data = yaml.load(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]) as { name: string; rule: HolidayRule };
  const slug = path.basename(file, ".md");
  facts[slug] = holidayFacts(data.rule, data.name, now);
  const next = nextHoliday(data.rule, now);
  if (next) soonest.push({ slug, time: next.getTime(), ...listingDates(data.rule, next, now, true) });
}
soonest.sort((a, b) => a.time - b.time);

fs.writeFileSync(out, JSON.stringify(facts, null, 2) + "\n");
fs.writeFileSync(soonestOut, JSON.stringify(soonest.map(({ time, ...listing }) => listing), null, 2) + "\n");
console.log(`Wrote ${out} and ${soonestOut} (${Object.keys(facts).length} holidays)`);
