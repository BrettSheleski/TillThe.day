// Script for my-days.html: lists the countdowns and holidays saved in this
// browser (see ../lib/my-days), soonest first, with their time to go kept up to
// date, and lets each be removed, leaving an Undo in its place.
import { byId } from "../lib/dom";
import { holidayCountdown, type HolidayRule } from "../lib/holidays";
import { canSave, removeSaved, safariClears, saveCountdown, savedCountdowns, type SavedCountdown } from "../lib/my-days";
import { listStatus, shortWhen, type Group, type ListStatus } from "../lib/my-days-list";
import { themeById } from "../lib/themes";
import { decodeToken, type Countdown } from "../lib/token";

const GROUPS: { group: Group; heading: string }[] = [
  { group: "upcoming", heading: "Coming up" },
  { group: "counting-up", heading: "Counting up" },
  { group: "ended", heading: "Ended" },
];

/** How a saved countdown or holiday is shown */
interface Listing {
  /** Null for a holiday whose next date isn't published yet */
  countdown: Countdown | null;
  name: string;
  /** The line under the name: its date, unless that's the name already */
  summary: string;
  href: string;
  emoji: string;
  theme: string;
}

interface Row {
  entry: SavedCountdown;
  listing: Listing;
  status: ListStatus;
  item: HTMLLIElement;
}

/** A holiday whose date list has run out: last among those coming up */
const UNDATED: ListStatus = { group: "upcoming", order: Number.MAX_SAFE_INTEGER, amount: "", label: "Date TBA" };

const container = byId("saved-groups");
const home = container.dataset.home!;
const occasionEmoji = JSON.parse(container.dataset.emoji ?? "{}") as Record<string, string>;
const template = byId<HTMLTemplateElement>("saved-item");
// Each holiday's name, emoji, theme, rule and page (_includes/holiday-data.html)
const holidays = new Map(
  [...byId("holiday-data").querySelectorAll<HTMLElement>("li")].map((li) => [li.dataset.slug!, li.dataset])
);
let rows: Row[] = [];
// Each render waits on decoding; only the latest one draws
let renderCount = 0;

async function render(): Promise<void> {
  const count = ++renderCount;
  const now = new Date();
  const entries = savedCountdowns();
  const listed = await Promise.all(entries.map(async (entry) => ({ entry, listing: await listingFor(entry, now) })));
  if (count !== renderCount) return;

  rows = listed
    .filter((l): l is { entry: SavedCountdown; listing: Listing } => l.listing !== null)
    .map(({ entry, listing }) => ({ entry, listing, status: statusOf(listing, now), item: itemFor(entry, listing) }))
    .sort((a, b) => a.status.order - b.status.order);

  const sections = GROUPS.flatMap(({ group, heading }) => {
    const inGroup = rows.filter((r) => r.status.group === group);
    if (!inGroup.length) return [];
    const section = document.createElement("section");
    section.className = "month";
    const h2 = document.createElement("h2");
    h2.textContent = heading;
    const ul = document.createElement("ul");
    ul.className = "holiday-cards";
    ul.append(...inGroup.map((r) => r.item));
    section.append(h2, ul);
    return [section];
  });
  container.replaceChildren(...sections);
  showStatus(now);

  const available = canSave();
  byId("saved-unavailable").hidden = available;
  byId("saved-empty").hidden = !available || rows.length > 0;
  byId("saved-note").hidden = rows.length === 0;
  // The header's "My Days" link (see src/head/early.ts)
  if (entries.length) document.documentElement.dataset.saved = "";
  else delete document.documentElement.dataset.saved;
}

/**
 * What to show for a saved entry, or null if it can't be shown: a link that
 * can't be read (only possible if the stored data was changed), or a holiday
 * the site no longer has.
 */
async function listingFor(entry: SavedCountdown, now: Date): Promise<Listing | null> {
  if ("holiday" in entry) {
    const data = holidays.get(entry.holiday);
    if (!data) return null;
    const theme = themeById(data.theme!);
    // Its next date, worked out again on each render, so it rolls over like its page
    const countdown = holidayCountdown(JSON.parse(data.rule!) as HolidayRule, data.name!, theme, null, now);
    return {
      countdown,
      name: data.name!,
      summary: countdown ? shortWhen(countdown, now) : "Next date not yet published",
      href: data.url!,
      emoji: data.emoji!,
      theme: theme.id,
    };
  }
  const countdown = await decodeToken(entry.token);
  if (!countdown) return null;
  // Named by its message; without one, its date takes the name's place
  const when = shortWhen(countdown, now);
  return {
    countdown,
    name: countdown.msg || when,
    summary: countdown.msg ? when : "",
    href: `${home}?c=${encodeURIComponent(entry.token)}`,
    emoji: (countdown.occasion && occasionEmoji[countdown.occasion]) || (countdown.countUp ? "🌱" : "⏳"),
    theme: countdown.theme.id,
  };
}

function statusOf({ countdown }: Listing, now: Date): ListStatus {
  return countdown ? listStatus(countdown, now) : UNDATED;
}

function itemFor(entry: SavedCountdown, listing: Listing): HTMLLIElement {
  const item = (template.content.firstElementChild as HTMLLIElement).cloneNode(true) as HTMLLIElement;
  const { name } = listing;
  const card = item.querySelector<HTMLAnchorElement>(".holiday-card")!;
  card.href = listing.href;
  // Its theme's tint (see _sass/_holidays.scss)
  card.classList.add(`tint-${listing.theme}`);
  item.querySelector(".holiday-emoji")!.textContent = listing.emoji;
  item.querySelector(".holiday-name")!.textContent = name;
  const summary = item.querySelector<HTMLElement>(".holiday-summary")!;
  summary.textContent = listing.summary;
  summary.hidden = !listing.summary;

  const remove = item.querySelector<HTMLButtonElement>(".remove")!;
  remove.setAttribute("aria-label", `Remove ${name}`);
  remove.addEventListener("click", () => {
    if (!removeSaved(entry)) return;
    rows = rows.filter((r) => r.item !== item);
    item.replaceChildren(undoLine(entry, name));
    item.querySelector("button")!.focus();
  });
  return item;
}

/** What's left where a removed countdown or holiday was: "Removed Our wedding. Undo" */
function undoLine(entry: SavedCountdown, name: string): HTMLElement {
  const line = document.createElement("p");
  line.className = "saved-removed";
  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "link-button";
  undo.textContent = "Undo";
  undo.addEventListener("click", () => {
    saveCountdown(entry);
    render();
  });
  line.append(`Removed “${name}”. `, undo);
  return line;
}

/**
 * The time to go on each card. Lists them again if one has moved group, e.g.
 * just ended, which also moves a holiday on to its next date.
 */
function showStatus(now = new Date()): void {
  for (const row of rows) {
    const status = statusOf(row.listing, now);
    if (status.group !== row.status.group) {
      render();
      return;
    }
    row.status = status;
    row.item.querySelector(".days")!.textContent = status.amount;
    row.item.querySelector(".date")!.textContent = status.label;
  }
}

// In Safari, how to keep them from being cleared, for this device
const safari = safariClears();
if (safari) {
  byId("safari-note").hidden = false;
  for (const line of document.querySelectorAll<HTMLElement>("[data-safari]")) line.hidden = line.dataset.safari !== safari;
}

// Saved or removed in another tab
addEventListener("storage", () => render());
// Minutes are the smallest unit shown
setInterval(showStatus, 15_000);
render();
