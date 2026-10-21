// Runs before the page is first drawn: loaded as a classic (blocking) script
// in <head>, unlike the page scripts. It sets up what the first frame needs,
// so nothing jumps or flashes when the page script and fonts arrive:
// - data-mode: "view" when the URL has a countdown (?c=...), otherwise
//   "create"; pages that know their mode set it in their layout instead
// - data-theme: the countdown's theme, from the link
// - starts downloading the theme's main fonts, so they're usually ready for
//   the first frame instead of re-flowing the text after it
//
// Keep this small: the page waits for it.
import { themeById } from "../lib/themes";
import { peekTheme } from "../lib/token";

const root = document.documentElement;
const token = new URLSearchParams(location.search).get("c");
root.dataset.mode ||= token ? "view" : "create";
if (token && !root.dataset.theme) root.dataset.theme = peekTheme(token).id;

// Fonts live next to this script's folder: assets/js/early.js → assets/fonts/
const script = document.currentScript as HTMLScriptElement;
for (const font of themeById(root.dataset.theme ?? "").preload) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "font";
  link.type = "font/woff2";
  link.crossOrigin = "anonymous";
  link.href = new URL(`../fonts/${font}.woff2`, script.src).href;
  document.head.append(link);
}
