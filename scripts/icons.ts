// Exports the site's icons and link-preview image from their SVG sources:
//   assets/images/favicon.svg     → favicon-32.png, apple-touch-icon.png,
//                                   icon-192.png, icon-512.png, icon-maskable-512.png
//   src/images/og-image.svg       → og-image.png
//
// Run with `npm run icons` after changing either SVG, and commit the PNGs.
// The link-preview image's text uses the system's Segoe UI, so export it on
// Windows (elsewhere it falls back to another font).
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

// Run from the project root by npm
const images = path.join("assets", "images");

function render(svg: string, size: number, file: string): void {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" },
  }).render().asPng();
  fs.writeFileSync(path.join(images, file), png);
  console.log(`${file}: ${size}px wide, ${png.length} bytes`);
}

/**
 * The icon filling the whole square, with the calendar shrunk by `scale`:
 * for icons whose corners the device shapes itself (iOS rounds them and shows
 * transparent ones as black; Android crops "maskable" ones to a circle or
 * squircle, keeping only the middle 80% safe).
 */
function fullSquare(svg: string, scale: number): string {
  const result = svg
    .replace('<rect width="64" height="64" rx="14"', '<rect width="64" height="64"')
    .replace('<path d="M12 21a7', `<g transform="translate(32 34) scale(${scale}) translate(-32 -34)"><path d="M12 21a7`)
    .replace("</svg>", "</g></svg>");
  if (!result.includes("<g transform")) throw new Error("The full-square icon edits didn't apply; has favicon.svg changed shape?");
  return result;
}

const favicon = fs.readFileSync(path.join(images, "favicon.svg"), "utf8");
render(favicon, 32, "favicon-32.png");
render(favicon, 192, "icon-192.png");
render(favicon, 512, "icon-512.png");
render(fullSquare(favicon, 0.86), 180, "apple-touch-icon.png");
render(fullSquare(favicon, 0.72), 512, "icon-maskable-512.png");

render(fs.readFileSync(path.join("src", "images", "og-image.svg"), "utf8"), 1200, "og-image.png");
