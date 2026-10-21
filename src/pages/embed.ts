// Script for embed.html, the widget shown inside other websites: displays the
// countdown from ?c=<token> or the holiday from ?holiday=<name>.
import { createDisplay } from "../lib/countdown-view";
import { byId } from "../lib/dom";
import { holidayCountdown, type HolidayRule } from "../lib/holidays";
import { applyTheme, themeById } from "../lib/themes";
import { decodeToken, peekTheme, type Countdown } from "../lib/token";

const params = new URLSearchParams(location.search);
const credit = byId<HTMLAnchorElement>("embed-credit");
const token = params.get("c");
const holiday = params.get("holiday");

const shown = token ? await fromToken(token) : holiday ? fromHoliday(holiday) : null;
if (shown) {
  createDisplay().set(shown, { celebrate: true });
} else {
  byId("embed-error").hidden = false;
}

async function fromToken(token: string): Promise<Countdown | null> {
  applyTheme(peekTheme(token));
  const countdown = await decodeToken(token);
  // The credit opens this countdown's full page
  if (countdown) credit.href = `${credit.href}?c=${token}`;
  return countdown;
}

function fromHoliday(slug: string): Countdown | null {
  const item = [...byId("holiday-data").querySelectorAll<HTMLElement>("li")].find((li) => li.dataset.slug === slug);
  if (!item) return null;
  const theme = themeById(item.dataset.theme!);
  applyTheme(theme);
  credit.href = new URL(item.dataset.url!, location.href).href;
  return holidayCountdown(JSON.parse(item.dataset.rule!) as HolidayRule, item.dataset.name!, theme);
}
