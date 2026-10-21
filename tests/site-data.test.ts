// Checks that the site's data files, Sass and pages agree with each other.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import themes from "../_data/themes.json";
import { holidayDate, type HolidayRule } from "../src/lib/holidays";

const root = path.resolve(__dirname, "..");

describe("themes", () => {
  it("has the default (generic) theme first, with no link letter", () => {
    expect(themes[0]).toMatchObject({ id: "generic", code: "" });
  });

  it("gives every other theme a unique single uppercase letter", () => {
    const codes = themes.slice(1).map((t) => t.code);
    for (const code of codes) expect(code).toMatch(/^[A-Z]$/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("never uses U or Y, which links reserve for count-up and yearly repeats", () => {
    const codes = themes.map((t) => t.code);
    expect(codes).not.toContain("U");
    expect(codes).not.toContain("Y");
  });

  it("has unique ids", () => {
    expect(new Set(themes.map((t) => t.id)).size).toBe(themes.length);
  });

  const sassIndex = fs.readFileSync(path.join(root, "_sass/themes/_index.scss"), "utf8");
  for (const theme of themes) {
    it(`has Sass for ${theme.id}, imported in themes/_index.scss`, () => {
      expect(fs.existsSync(path.join(root, `_sass/themes/${theme.id}/_theme.scss`))).toBe(true);
      expect(fs.existsSync(path.join(root, `_sass/themes/${theme.id}/_elapsed.scss`))).toBe(true);
      expect(sassIndex).toContain(`@import "themes/${theme.id}/theme";`);
    });
  }
});

describe("fonts", () => {
  // Fonts that come with the visitor's own computer, so they aren't self-hosted
  const systemFonts = new Set(["Segoe UI", "Roboto", "Trebuchet MS", "Georgia", "Consolas"]);
  const hosted = fs.readFileSync(path.join(root, "_sass/_fonts.scss"), "utf8");

  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
    );
  const used = new Set(
    walk(path.join(root, "_sass"))
      .filter((f) => !f.endsWith("_fonts.scss"))
      .flatMap((f) => fs.readFileSync(f, "utf8").split("\n"))
      .filter((line) => /font/.test(line))
      .flatMap((line) => [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]))
      // Skip system fonts, paths, escaped characters and Sass placeholders like #{$font}
      .filter((name) => !systemFonts.has(name) && !/[/\\#]/.test(name))
  );

  it("finds the fonts the themes use", () => {
    expect(used.size).toBeGreaterThan(5);
  });

  for (const name of used) {
    it(`serves "${name}" from this site`, () => {
      expect(hosted, `add it to FONTS in scripts/self-host-fonts.mjs and run npm run fonts`).toContain(`font-family: "${name}";`);
    });
  }

  it("has each font file the rules point to", () => {
    for (const [, file] of hosted.matchAll(/url\("\.\.\/fonts\/([^"]+)"\)/g)) {
      expect(fs.existsSync(path.join(root, "assets/fonts", file)), file).toBe(true);
    }
  });
});

describe("privacy policy", () => {
  const policy = fs.readFileSync(path.join(root, "privacy.md"), "utf8");

  // Every outside service the page templates load, and what the policy must
  // call it. A new one fails this test until it's explained in privacy.md and
  // added here.
  const known: Record<string, string> = {
    "static.cloudflareinsights.com": "Cloudflare Web Analytics",
  };

  const templates = ["_includes", "_layouts"].flatMap((dir) =>
    fs.readdirSync(path.join(root, dir)).map((f) => fs.readFileSync(path.join(root, dir, f), "utf8"))
  );
  const hosts = new Set(templates.flatMap((t) => [...t.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1])));

  it("finds the outside services the templates load", () => {
    expect(hosts.size).toBeGreaterThan(0);
  });

  for (const host of hosts) {
    it(`explains ${host}`, () => {
      expect(known[host], `${host} isn't covered: explain it in privacy.md, then add it to this test`).toBeDefined();
      expect(policy).toContain(known[host]);
    });
  }

  it("is linked from the footer on every page", () => {
    expect(fs.readFileSync(path.join(root, "_includes/footer.html"), "utf8")).toContain("'/privacy/' | relative_url");
  });
});

describe("pages kept out of search results", () => {
  for (const file of ["404.html", "embed.html"]) {
    it(`${file} isn't in the sitemap`, () => {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      const frontMatter = yaml.load(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]) as Record<string, unknown>;
      expect(frontMatter.sitemap).toBe(false);
    });
  }
});

describe("404 page", () => {
  // GitHub Pages shows 404.html at whatever missing address was asked for,
  // e.g. /TimeUntil/a/b/c, so a relative link would point somewhere wrong
  it("only uses links that work from any address", () => {
    const html = fs.readFileSync(path.join(root, "404.html"), "utf8");
    const links = [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link, link).toMatch(/^(\{\{.*relative_url|\{%|https?:)/);
  });
});

describe("holiday pages", () => {
  const dir = path.join(root, "_holidays");
  const pages = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((file) => {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const frontMatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1];
    return { file, data: yaml.load(frontMatter) as Record<string, unknown> };
  });

  it("exist", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("feature a manageable number in the holiday links", () => {
    const featured = pages.filter((p) => p.data.featured === true).length;
    expect(featured).toBeGreaterThan(5);
    expect(featured).toBeLessThanOrEqual(20);
  });

  for (const { file, data } of pages) {
    describe(file, () => {
      const rule = data.rule as HolidayRule;

      it("has a name, title, description and calendar position", () => {
        for (const key of ["name", "title", "description"]) {
          expect(typeof data[key], key).toBe("string");
        }
        // Typical month and day as MMDD, e.g. 1225 for Christmas
        expect(data.order).toBeGreaterThanOrEqual(101);
        expect(data.order).toBeLessThanOrEqual(1231);
      });

      it("uses a theme that exists", () => {
        expect(themes.map((t) => t.id)).toContain(data.theme);
      });

      it("has a known kind of rule", () => {
        expect(["fixed", "nth-weekday", "easter", "dates", "season"]).toContain(rule.type);
      });

      if (rule.type === "dates") {
        it("lists dates as quoted YYYY-MM-DD text, in order", () => {
          // Unquoted, YAML reads them as date objects, which Jekyll and the
          // tests would turn into different text
          for (const d of rule.dates) expect(d, String(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect([...rule.dates].sort()).toEqual(rule.dates);
        });

        it("lists dates at least a year ahead", () => {
          // Fails a year before the list runs out, as a reminder to add more
          // dates from a reliable source (the page shows "not yet published"
          // once it does run out)
          const yearAhead = new Date();
          yearAhead.setFullYear(yearAhead.getFullYear() + 1);
          const last = new Date(rule.dates[rule.dates.length - 1]);
          expect(last > yearAhead, `last listed date is ${rule.dates.at(-1)}`).toBe(true);
        });
      } else {
        it("gives a date in each year", () => {
          for (let year = 2025; year <= 2035; year++) {
            const date = holidayDate(rule, year);
            expect(date, `${year}`).not.toBeNull();
            // An offset can move it into the next month, but not the next year
            expect(date!.getFullYear(), `${year}`).toBe(year);
            if ((rule.type === "fixed" || rule.type === "nth-weekday") && !rule.offset) {
              expect(date!.getMonth() + 1, `${year}`).toBe(rule.month);
            }
          }
        });
      }
    });
  }
});
