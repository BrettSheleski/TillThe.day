// Draws a link-preview image (1200x630) for each holiday page, in the
// holiday's theme, and points the page's `image` front matter at it:
//   assets/images/holidays/<name>.png
//
// The images show no dates or numbers, since holidays repeat every year.
// Run with `npm run holiday-images` after adding a holiday or changing a
// theme's look. Commit the results.
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import yaml from "js-yaml";
import * as fontkit from "fontkit";
import wawoff2 from "wawoff2";

const root = path.resolve(import.meta.dirname, "..");
const W = 1200;
const H = 630;
const CARD = { x: 90, y: 60, w: 1020, h: 510 };

// --- Fonts
// Text is drawn as vector shapes straight from the font files (with fontkit),
// not as SVG <text>: the image renderer matches fonts by the names stored
// inside them, and the Fontsource files' names aren't ones it can read, so it
// would quietly fall back to another font.

const FONT_FILES = [
  "inter-latin-400-normal", "inter-latin-600-normal", "inter-latin-800-normal",
  "fredoka-latin-500-normal", "fredoka-latin-700-normal",
  "baloo-2-latin-400-normal", "baloo-2-latin-700-normal",
  "cormorant-garamond-latin-600-normal", "great-vibes-latin-400-normal",
  "lora-latin-400-normal", "lora-latin-600-normal", "mountains-of-christmas-latin-700-normal",
  "quicksand-latin-600-normal", "quicksand-latin-700-normal", "pacifico-latin-400-normal",
  "share-tech-mono-latin-400-normal", "orbitron-latin-700-normal",
  "press-start-2p-latin-400-normal",
  "jost-latin-300-normal", "jost-latin-400-normal", "jost-latin-500-normal",
];

/** "Family|weight" → fontkit font, e.g. "Fredoka|700" */
const fonts = new Map();

async function loadFonts() {
  // The site's name for each file's family, from _sass/_fonts.scss
  const sass = fs.readFileSync(path.join(root, "_sass/_fonts.scss"), "utf8");
  const familyOf = new Map(
    [...sass.matchAll(/font-family: "([^"]+)";[\s\S]*?url\("\.\.\/fonts\/([^"]+)\.woff2"\)/g)].map(([, family, file]) => [file, family])
  );
  for (const name of FONT_FILES) {
    const family = familyOf.get(name);
    if (!family) throw new Error(`${name} isn't in _sass/_fonts.scss`);
    const weight = Number(name.match(/-(\d{3})-normal$/)[1]);
    const ttf = Buffer.from(await wawoff2.decompress(fs.readFileSync(path.join(root, "assets/fonts", `${name}.woff2`))));
    fonts.set(`${family}|${weight}`, fontkit.create(ttf));
  }
}

function fontFor(s) {
  const font = fonts.get(`${s.family}|${s.weight}`);
  if (!font) throw new Error(`No font file for ${s.family} ${s.weight}: add it to FONT_FILES`);
  return font;
}

/** Lay out a line of text: its glyphs with positions, and its total width. */
function layout(text, s, size) {
  const font = fontFor(s);
  const scale = size / font.unitsPerEm;
  const run = font.layout(s.upper ? text.toUpperCase() : text);
  const spacing = s.spacing ?? 0;
  let x = 0;
  const glyphs = run.glyphs.map((glyph, i) => {
    const pos = run.positions[i];
    const placed = { glyph, x: x + pos.xOffset * scale, y: pos.yOffset * scale };
    x += pos.xAdvance * scale + spacing;
    return placed;
  });
  return { glyphs, width: x - spacing, scale };
}

// --- Theme looks, simplified from _sass/themes/ for a still image

/** A tiled pattern of dots: [x, y, radius, colour, opacity] */
function dots(id, size, list) {
  const circles = list.map(([x, y, r, c, o = 1]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity="${o}"/>`).join("");
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${circles}</pattern>`;
}

const glow = (id, color, blur) =>
  `<filter id="${id}" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${blur}" result="b"/><feFlood flood-color="${color}"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

const shadow = (id, color, opacity, dy, blur) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="${color}" flood-opacity="${opacity}"/></filter>`;

const card = (fill, extra = "") => `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" ${fill} ${extra}/>`;

const THEMES = {
  generic: {
    defs: `<linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="90"/></filter>${shadow("cs", "#0f1222", 0.14, 28, 30)}`,
    background: `<rect width="${W}" height="${H}" fill="#f5f6fb"/><g filter="url(#blur)"><circle cx="150" cy="60" r="260" fill="#6366f1" fill-opacity="0.32"/><circle cx="1080" cy="110" r="230" fill="#ec4899" fill-opacity="0.22"/><circle cx="720" cy="660" r="280" fill="#14b8a6" fill-opacity="0.24"/></g>`,
    card: card('rx="40" fill="#ffffff" fill-opacity="0.75" stroke="#ffffff" stroke-width="2"', 'filter="url(#cs)"'),
    title: { family: "Inter", weight: 800, fill: "url(#accent)", max: 110, spacing: -2 },
    intro: { family: "Inter", weight: 400, fill: "#5f6680" },
    pill: { fill: "url(#accent)", text: "#ffffff", family: "Inter", weight: 600 },
  },
  party: {
    defs: dots("confetti", 220, [[18, 26, 6, "#ea005e"], [80, 130, 6, "#ffc93c"], [140, 40, 6, "#0e837c"], [180, 150, 6, "#7757ff"], [40, 190, 6, "#b85c00"], [200, 80, 6, "#0e837c"], [110, 205, 6, "#ea005e"]])
      + `<linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#ffd6ec"/><stop offset="0.5" stop-color="#fff4cc"/><stop offset="1" stop-color="#d4f1ff"/></linearGradient>${shadow("cs", "#7757ff", 0.25, 14, 22)}`,
    background: `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#confetti)"/>`,
    card: card('rx="56" fill="#ffffff"', 'filter="url(#cs)"'),
    title: { family: "Fredoka", weight: 700, fill: "#ea005e", max: 120 },
    intro: { family: "Fredoka", weight: 500, fill: "#86699d" },
    pill: { fill: "#7757ff", text: "#ffffff", family: "Fredoka", weight: 500 },
  },
  birthday: {
    defs: `<pattern id="sprinkles" width="120" height="120" patternUnits="userSpaceOnUse"><g fill-opacity="0.6"><rect x="10" y="14" width="14" height="5" rx="2.5" fill="#ff8fbd" transform="rotate(25 16 16)"/><rect x="70" y="20" width="14" height="5" rx="2.5" fill="#6fd6a8" transform="rotate(-35 76 22)"/><rect x="40" y="60" width="14" height="5" rx="2.5" fill="#ffcf4d" transform="rotate(60 46 62)"/><rect x="92" y="80" width="14" height="5" rx="2.5" fill="#9f8cff" transform="rotate(10 98 82)"/><rect x="18" y="96" width="14" height="5" rx="2.5" fill="#5bc0ff" transform="rotate(-60 24 98)"/></g></pattern>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0f7"/><stop offset="1" stop-color="#f0fbff"/></linearGradient>${shadow("cs", "#e9005c", 0.18, 14, 20)}`,
    background: `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#sprinkles)"/>`,
    card: card('rx="52" fill="#ffffff"', 'filter="url(#cs)"'),
    title: { family: "Baloo 2", weight: 700, fill: "#e9005c", max: 120 },
    intro: { family: "Baloo 2", weight: 400, fill: "#75587b" },
    pill: { fill: "#e9005c", text: "#ffffff", family: "Baloo 2", weight: 700 },
  },
  romantic: {
    defs: `<pattern id="hearts" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M36 52s-12-7.6-16-15.2A9 9 0 0 1 36 28a9 9 0 0 1 16 8.8C48 44.4 36 52 36 52z" fill="#e91e63" fill-opacity="0.1"/></pattern>
      <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#ffe4ec"/><stop offset="0.5" stop-color="#fff5f7"/><stop offset="1" stop-color="#fde2e4"/></linearGradient>${shadow("cs", "#c2185b", 0.14, 14, 24)}`,
    background: `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#hearts)"/>`,
    card: card('rx="44" fill="#ffffff" fill-opacity="0.92"', 'filter="url(#cs)"'),
    title: { family: "Great Vibes", weight: 400, fill: "#c2185b", max: 150 },
    intro: { family: "Cormorant Garamond", weight: 600, fill: "#926273" },
    pill: { fill: "#c2185b", text: "#ffffff", family: "Cormorant Garamond", weight: 600 },
  },
  holiday: {
    defs: dots("snow", 140, [[14, 21, 2.5, "#ffffff", 0.55], [42, 98, 3.5, "#ffffff", 0.55], [77, 35, 2, "#ffffff", 0.55], [105, 84, 3, "#ffffff", 0.55], [126, 14, 2.5, "#ffffff", 0.55], [21, 119, 3.5, "#ffffff", 0.55], [63, 70, 2, "#ffffff", 0.55], [91, 126, 2.5, "#ffffff", 0.55]])
      + `<radialGradient id="bg" cx="0.5" cy="0" r="0.9"><stop offset="0" stop-color="#1f6b50"/><stop offset="0.7" stop-color="#0d3b2e"/></radialGradient>${shadow("cs", "#000000", 0.35, 16, 22)}`,
    background: `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#snow)"/>`,
    card: card('rx="36" fill="#fffaf2" stroke="#d4af37" stroke-width="8"', 'filter="url(#cs)"'),
    title: { family: "Mountains of Christmas", weight: 700, fill: "#c62828", max: 130 },
    intro: { family: "Lora", weight: 400, fill: "#7c6a58" },
    pill: { fill: "#1b5e45", text: "#ffffff", family: "Lora", weight: 600 },
  },
  vacation: {
    defs: `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3f4"/><stop offset="0.45" stop-color="#c9f0ff"/><stop offset="0.45" stop-color="#4dd0e1"/><stop offset="0.72" stop-color="#26a6b8"/><stop offset="0.72" stop-color="#f6d6a8"/><stop offset="1" stop-color="#f3c98b"/></linearGradient>${shadow("cs", "#0b3c49", 0.18, 14, 22)}`,
    background: `<rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="1060" cy="60" r="110" fill="#ffe082" fill-opacity="0.4"/><circle cx="1060" cy="60" r="72" fill="#ffe082"/>`,
    card: card('rx="48" fill="#ffffff" fill-opacity="0.92"', 'filter="url(#cs)"'),
    title: { family: "Pacifico", weight: 400, fill: "#c8442c", max: 115 },
    intro: { family: "Quicksand", weight: 600, fill: "#4f7f8a" },
    pill: { fill: "#1e818f", text: "#ffffff", family: "Quicksand", weight: 700 },
  },
  space: {
    defs: dots("stars", 180, [[22, 32, 1.5, "#ffffff", 0.9], [68, 130, 2, "#ffffff", 0.7], [115, 54, 1.5, "#ffffff", 0.6], [148, 115, 2.5, "#ffffff", 0.9], [40, 162, 1.5, "#ffffff", 0.5], [162, 22, 2, "#ffffff", 0.8], [94, 86, 1.5, "#ffffff", 0.7]])
      + `<radialGradient id="neb1" cx="0.2" cy="0.2" r="0.5"><stop offset="0" stop-color="#7b5cff" stop-opacity="0.35"/><stop offset="1" stop-color="#7b5cff" stop-opacity="0"/></radialGradient>
      <radialGradient id="neb2" cx="0.8" cy="0.75" r="0.5"><stop offset="0" stop-color="#4fd1ff" stop-opacity="0.22"/><stop offset="1" stop-color="#4fd1ff" stop-opacity="0"/></radialGradient>${glow("tg", "#4fd1ff", 8)}`,
    background: `<rect width="${W}" height="${H}" fill="#05060f"/><rect width="${W}" height="${H}" fill="url(#neb1)"/><rect width="${W}" height="${H}" fill="url(#neb2)"/><rect width="${W}" height="${H}" fill="url(#stars)"/>`,
    card: card('rx="24" fill="#0c0e24" fill-opacity="0.85" stroke="#2a2f5a" stroke-width="2"'),
    title: { family: "Orbitron", weight: 700, fill: "#e6f7ff", max: 100, filter: "url(#tg)", spacing: 2 },
    intro: { family: "Share Tech Mono", weight: 400, fill: "#8a93c0", upper: true, spacing: 4 },
    pill: { fill: "none", stroke: "#4fd1ff", text: "#4fd1ff", family: "Share Tech Mono", weight: 400, upper: true },
  },
  arcade: {
    defs: `<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#00f0ff" stroke-opacity="0.12" stroke-width="1"/></pattern>
      <radialGradient id="glow" cx="0.5" cy="1" r="0.6"><stop offset="0" stop-color="#ff2bd6" stop-opacity="0.3"/><stop offset="1" stop-color="#ff2bd6" stop-opacity="0"/></radialGradient>`,
    background: `<rect width="${W}" height="${H}" fill="#000000"/><rect width="${W}" height="${H}" fill="url(#glow)"/><rect width="${W}" height="${H}" fill="url(#grid)"/>`,
    card: `<rect x="${CARD.x + 16}" y="${CARD.y + 16}" width="${CARD.w}" height="${CARD.h}" fill="#ff2bd6"/>` + card('fill="#0b0b1a" stroke="#00f0ff" stroke-width="8"'),
    title: { family: "Press Start 2P", weight: 400, fill: "#ffe600", max: 72, shadowColor: "#ff2bd6", shadowOffset: 6 },
    intro: { family: "Press Start 2P", weight: 400, fill: "#00f0ff", size: 26 },
    pill: { fill: "#ff2bd6", text: "#000000", family: "Press Start 2P", weight: 400, size: 18, radius: 0 },
  },
  zen: {
    defs: `<radialGradient id="bg" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#faf8f3"/><stop offset="0.8" stop-color="#efebe2"/></radialGradient>${shadow("cs", "#000000", 0.06, 14, 30)}`,
    background: `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    card: card('rx="16" fill="#fbfaf6"', 'filter="url(#cs)"'),
    title: { family: "Jost", weight: 300, fill: "#3d3d38", max: 120, spacing: 1 },
    intro: { family: "Jost", weight: 400, fill: "#6f6d65", spacing: 3 },
    pill: { fill: "none", stroke: "#69775f", text: "#69775f", family: "Jost", weight: 500 },
  },
  doomsday: {
    defs: `<pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ff0000" fill-opacity="0.05"/></pattern>
      <pattern id="hazard" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="17" height="34" fill="#ffcc00"/><rect x="17" width="17" height="34" fill="#111111"/></pattern>
      <radialGradient id="bg" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="#a00000" stop-opacity="0.45"/><stop offset="0.7" stop-color="#a00000" stop-opacity="0"/></radialGradient>${glow("tg", "#ff2020", 10)}
      <clipPath id="cardclip"><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="8"/></clipPath>`,
    background: `<rect width="${W}" height="${H}" fill="#070000"/><rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#scan)"/>`,
    card: card('rx="8" fill="#120303" stroke="#4a0e0e" stroke-width="2"') + `<rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="16" fill="url(#hazard)" clip-path="url(#cardclip)"/>`,
    title: { family: "Share Tech Mono", weight: 400, fill: "#ff3030", max: 110, upper: true, filter: "url(#tg)", spacing: 4 },
    intro: { family: "Share Tech Mono", weight: 400, fill: "#a86a6a", upper: true, spacing: 6 },
    pill: { fill: "#ff2a2a", text: "#0a0000", family: "Share Tech Mono", weight: 400, upper: true },
  },
};

// --- Drawing

/** A line of text as a vector shape, centred on x with its baseline at y. */
function textEl(text, cx, y, s, size) {
  const { glyphs, width, scale } = layout(text, s, size);
  const left = cx - width / 2;
  const d = glyphs
    .map(({ glyph, x, y: dy }) => glyph.path.scale(scale, -scale).translate(left + x, y - dy).toSVG())
    .join("");
  const filter = s.filter ? ` filter="${s.filter}"` : "";
  return `<path d="${d}" fill="${s.fill}"${filter}/>`;
}

const measure = (text, s, size) => layout(text, s, size).width;

/** The title's lines and size: one line if it fits at a readable size, else two. */
function fitTitle(name, s) {
  const maxWidth = CARD.w - 140;
  const sizeFor = (line) => Math.min(s.max, (100 * maxWidth) / measure(line, s, 100));
  const single = sizeFor(name);
  const words = name.split(" ");
  if (single >= s.max * 0.62 || words.length < 2) return { lines: [name], size: Math.floor(single) };
  // Split where the two lines come out most even
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
    const size = Math.min(...lines.map(sizeFor), s.max * 0.8);
    if (!best || size > best.size) best = { lines, size: Math.floor(size) };
  }
  return best;
}

function drawHoliday(name, themeId) {
  const t = THEMES[themeId];
  if (!t) throw new Error(`No image look for theme "${themeId}"`);
  const cx = W / 2;
  const { lines, size } = fitTitle(name, t.title);

  const pillSize = t.pill.size ?? 26;
  const pillH = pillSize * 2.2;
  const pillY = CARD.y + CARD.h - 50 - pillH;

  // Center "Days until" and the title in the space above the pill
  const introSize = t.intro.size ?? 44;
  const gap = 24;
  const lineHeight = size * 1.1;
  const blockHeight = introSize + gap + lineHeight * lines.length;
  const top = CARD.y + (pillY - CARD.y - blockHeight) / 2;
  const introY = top + introSize * 0.8;
  const titleYs = lines.map((_, i) => top + introSize + gap + lineHeight * i + size * 0.8);
  const title = lines
    .map((line, i) => {
      const shadowText = t.title.shadowColor
        ? textEl(line, cx + t.title.shadowOffset, titleYs[i] + t.title.shadowOffset, { ...t.title, fill: t.title.shadowColor, filter: undefined }, size)
        : "";
      return shadowText + textEl(line, cx, titleYs[i], t.title, size);
    })
    .join("");

  const pillText = "Live countdown · Time Until";
  const pillW = measure(pillText, t.pill, pillSize) + 64;
  const pill =
    `<rect x="${cx - pillW / 2}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${t.pill.radius ?? pillH / 2}" fill="${t.pill.fill}"${t.pill.stroke ? ` stroke="${t.pill.stroke}" stroke-width="3"` : ""}/>` +
    textEl(pillText, cx, pillY + pillH / 2 + pillSize * 0.36, { ...t.pill, fill: t.pill.text }, pillSize);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${t.defs}</defs>${t.background}${t.card}${textEl("Days until", cx, introY, t.intro, introSize)}${title}${pill}</svg>`;
}

// --- Main

await loadFonts();
const outDir = path.join(root, "assets/images/holidays");
fs.mkdirSync(outDir, { recursive: true });

const holidaysDir = path.join(root, "_holidays");
let count = 0;
for (const file of fs.readdirSync(holidaysDir).filter((f) => f.endsWith(".md")).sort()) {
  const slug = file.replace(/\.md$/, "");
  const full = path.join(holidaysDir, file);
  const text = fs.readFileSync(full, "utf8");
  const [, frontMatter] = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const data = yaml.load(frontMatter);

  const svg = drawHoliday(data.name, data.theme);
  const png = new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: "width", value: W } }).render().asPng();
  fs.writeFileSync(path.join(outDir, `${slug}.png`), png);

  // Point the page's link preview at the image
  const image = `image: /assets/images/holidays/${slug}.png`;
  const updated = /^image: .*$/m.test(text) ? text.replace(/^image: .*$/m, image) : text.replace(/^(description: .*)$/m, `$1\n${image}`);
  if (updated !== text) fs.writeFileSync(full, updated);
  count++;
}

console.log(`Drew ${count} holiday images in assets/images/holidays/`);
