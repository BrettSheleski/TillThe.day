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

describe("privacy policy", () => {
  const policy = fs.readFileSync(path.join(root, "privacy.md"), "utf8");

  // Every outside service the page templates load, and what the policy must
  // call it. A new one fails this test until it's explained in privacy.md and
  // added here.
  const known: Record<string, string> = {
    "fonts.googleapis.com": "Google Fonts",
    "fonts.gstatic.com": "Google Fonts",
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

  it("have unique positions in the holiday list", () => {
    const orders = pages.map((p) => p.data.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  for (const { file, data } of pages) {
    describe(file, () => {
      it("has a name, title and description", () => {
        for (const key of ["name", "title", "description"]) {
          expect(typeof data[key], key).toBe("string");
        }
      });

      it("uses a theme that exists", () => {
        expect(themes.map((t) => t.id)).toContain(data.theme);
      });

      it("has a rule that gives a valid date every year", () => {
        const rule = data.rule as HolidayRule;
        expect(["fixed", "nth-weekday", "easter"]).toContain(rule.type);
        for (let year = 2025; year <= 2035; year++) {
          const date = holidayDate(rule, year);
          expect(date.getFullYear(), `${year}`).toBe(year);
          if (rule.type !== "easter") expect(date.getMonth() + 1, `${year}`).toBe(rule.month);
        }
      });
    });
  }
});
