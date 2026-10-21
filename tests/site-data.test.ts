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

  it("never uses U, which links reserve for count-up", () => {
    expect(themes.map((t) => t.code)).not.toContain("U");
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
