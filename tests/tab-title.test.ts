import { describe, expect, it } from "vitest";
import { tabTitleText } from "../src/lib/countdown-view";
import { countdown } from "./helpers";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("tab titles", () => {
  const c = countdown({ msg: "Christmas" });

  it("show days and hours, then hours and minutes, then minutes", () => {
    expect(tabTitleText(12 * DAY + 4 * HOUR + 30 * MIN, "before", c, "Christmas")).toBe("12d 4h · Christmas");
    expect(tabTitleText(4 * HOUR + 33 * MIN + 59_000, "before", c, "Christmas")).toBe("4h 33m · Christmas");
    expect(tabTitleText(33 * MIN + 10_000, "before", c, "Christmas")).toBe("33m · Christmas");
    expect(tabTitleText(40_000, "before", c, "Christmas")).toBe("<1m · Christmas");
  });

  it("group long day counts", () => {
    expect(tabTitleText(1234 * DAY, "before", c, "Retirement")).toBe("1,234d 0h · Retirement");
  });

  it("show the time left while it's on", () => {
    expect(tabTitleText(3 * HOUR + 20 * MIN, "during", countdown({ duration: 240 }), "Concert")).toBe("3h 20m left · Concert");
  });

  it("celebrate once it arrives, and go back to the page's title after an end", () => {
    expect(tabTitleText(0, "after", c, "Christmas")).toBe("🎉 Christmas");
    expect(tabTitleText(0, "after", countdown({ duration: 240 }), "Concert")).toBeNull();
  });

  it("say \"since\" for a count-up", () => {
    expect(tabTitleText(400 * DAY + 2 * HOUR, null, countdown({ countUp: true }), "Sober")).toBe("400d 2h since · Sober");
  });
});
