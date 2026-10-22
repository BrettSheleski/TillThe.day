import { describe, expect, it } from "vitest";
import { EMBED_HEIGHT, embedSnippet, embedUrl } from "../src/lib/embed";

const page = "https://example.com/TimeUntil/embed/";

describe("embed address", () => {
  it("carries a countdown link's token", () => {
    expect(embedUrl(page, { token: "hud96P.SGk" })).toBe("https://example.com/TimeUntil/embed/?c=hud96P.SGk");
  });

  it("carries a holiday", () => {
    expect(embedUrl(page, { holiday: "christmas" })).toBe("https://example.com/TimeUntil/embed/?holiday=christmas");
  });

  it("carries a holiday in a given year", () => {
    expect(embedUrl(page, { holiday: "christmas", year: 2028 })).toBe("https://example.com/TimeUntil/embed/?holiday=christmas&year=2028");
  });

  it("handles tokens with every character links can contain", () => {
    const token = "_dxqRUY~a-b_c";
    expect(new URL(embedUrl(page, { token })).searchParams.get("c")).toBe(token);
  });
});

describe("embed snippet", () => {
  const parse = (html: string) => {
    // A tiny parser for one <iframe ...> tag's attributes
    const attrs: Record<string, string> = {};
    for (const [, name, value] of html.matchAll(/(\w[\w-]*)="([^"]*)"/g)) attrs[name] = value;
    return attrs;
  };

  it("is an iframe for the widget", () => {
    const html = embedSnippet(`${page}?c=abc`, "Countdown to Christmas");
    expect(html).toMatch(/^<iframe [^<>]*><\/iframe>$/);
    const attrs = parse(html);
    expect(attrs.src).toBe(`${page}?c=abc`);
    expect(attrs.title).toBe("Countdown to Christmas");
    expect(attrs.height).toBe(String(EMBED_HEIGHT));
    expect(attrs.loading).toBe("lazy");
  });

  it("can't be broken out of by the message", () => {
    const html = embedSnippet(`${page}?c=abc`, `Party" onload="alert(1)"><script>alert(2)</script> & 'friends'`);
    // Still exactly one tag, with no extra attributes or elements
    expect(html).toMatch(/^<iframe [^<>]*><\/iframe>$/);
    expect(html).not.toContain("<script");
    expect(Object.keys(parse(html))).toEqual(["src", "title", "width", "height", "loading", "style"]);
    expect(html).toContain("&quot;");
    expect(html).toContain("&#39;");
    expect(html).toContain("&amp;");
  });

  it("escapes the address too", () => {
    expect(embedSnippet(`${page}?c=a&holiday=x`, "t")).toContain('src="https://example.com/TimeUntil/embed/?c=a&amp;holiday=x"');
  });
});
