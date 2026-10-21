import { describe, expect, it } from "vitest";
import { themeById } from "../src/lib/themes";
import { decodeToken, encodeToken, peekTheme } from "../src/lib/token";
import { countdown, inTimeZoneAsync } from "./helpers";

describe("links already shared", () => {
  // Real links from the wild. Whatever changes, these must keep opening the
  // same countdown, so never edit an expectation here to make a test pass.
  const links = [
    {
      token: "hsg90.RG9vciBDb3VudHkhIQ",
      target: "2026-10-24T15:00:00.000Z",
      dateOnly: false,
      msg: "Door County!!",
      theme: "generic",
      countUp: false,
    },
    {
      token: "hud96P.SGk",
      target: "2026-12-25T17:30:00.000Z",
      dateOnly: false,
      msg: "Hi",
      theme: "party",
      countUp: false,
    },
    {
      token: "hukjnD.VGhlIGVuZCBpcyBuZWFy",
      target: "2027-01-01T06:59:00.000Z",
      dateOnly: false,
      msg: "The end is near",
      theme: "doomsday",
      countUp: false,
    },
    {
      token: "hud7i~hYsxCoAwEAS_svbiO_yB9cWsJghJuDuF_F7sBAvLnZmdpbWOkNVTlD5g_tkLIUrsNZcdXpHkIjwRgeZoot7BizrCSPR6PlIJKRFBn5MVWQ97gU0zS7RPMt0",
      target: "2026-12-25T16:30:00.000Z",
      dateOnly: false,
      msg: "Happy birthday! Happy birthday! Happy birthday! We are going to have the best party ever, see you there and bring snacks and bring friends and bring snacks.",
      theme: "generic",
      countUp: false,
    },
  ];

  for (const link of links) {
    it(`opens ${link.token.slice(0, 16)}… as before`, async () => {
      const c = await decodeToken(link.token);
      expect(c).not.toBeNull();
      expect(c!.target.toISOString()).toBe(link.target);
      expect(c!.dateOnly).toBe(link.dateOnly);
      expect(c!.msg).toBe(link.msg);
      expect(c!.theme.id).toBe(link.theme);
      expect(c!.countUp).toBe(link.countUp);
      expect(c!.yearly).toBe(false);
    });
  }

  it("opens a date-only link as that date, in the viewer's time zone", async () => {
    const c = await decodeToken("_g24.SGk");
    expect(c!.dateOnly).toBe(true);
    expect(c!.msg).toBe("Hi");
    expect(c!.target.getFullYear()).toBe(2026);
    expect(c!.target.getMonth()).toBe(11);
    expect(c!.target.getDate()).toBe(25);
    expect(c!.target.getHours()).toBe(0);
  });

  it("opens a count-up link", async () => {
    const c = await decodeToken("_dxqRU.V2UgbWV0");
    expect(c!.countUp).toBe(true);
    expect(c!.theme.id).toBe("romantic");
    expect(c!.msg).toBe("We met");
    expect([c!.target.getFullYear(), c!.target.getMonth() + 1, c!.target.getDate()]).toEqual([2019, 6, 15]);
  });
});

describe("encode and decode", () => {
  const cases = {
    "a time, no message": countdown(),
    "a short message": countdown({ msg: "Christmas!" }),
    "punctuation and emoji": countdown({ msg: "Our trip to Japan 🇯🇵 — can't wait! (50% off; a,b)" }),
    "a long message (compressed)": countdown({ msg: "Happy birthday! ".repeat(12).trim() }),
    "a theme": countdown({ theme: themeById("arcade"), msg: "Game night" }),
    "count-up": countdown({ countUp: true, target: new Date("2020-02-29T12:00:00Z") }),
    "count-up with a theme": countdown({ countUp: true, theme: themeById("zen"), msg: "Calm" }),
    "a yearly repeat": countdown({ yearly: true, dateOnly: true, target: new Date(1990, 4, 3), msg: "Sam's birthday" }),
    "a yearly repeat with a theme and time": countdown({ yearly: true, theme: themeById("birthday") }),
  };

  for (const [name, original] of Object.entries(cases)) {
    it(`round-trips ${name}`, async () => {
      const token = await encodeToken(original);
      // Must survive being put in a URL unchanged
      expect(encodeURIComponent(token)).toBe(token);
      const decoded = await decodeToken(token);
      expect(decoded).toEqual(original);
    });
  }

  it("round-trips a date-only countdown", async () => {
    const original = countdown({ dateOnly: true, target: new Date(2027, 6, 4), msg: "Fireworks" });
    expect(await decodeToken(await encodeToken(original))).toEqual(original);
  });

  it("keeps times to the minute", async () => {
    const token = await encodeToken(countdown({ target: new Date("2026-12-25T16:30:42Z") }));
    const decoded = await decodeToken(token);
    expect(decoded!.target.toISOString()).toBe("2026-12-25T16:31:00.000Z");
  });

  it("compresses long messages only when that's shorter", async () => {
    expect(await encodeToken(countdown({ msg: "Hi" }))).toContain(".");
    expect(await encodeToken(countdown({ msg: "Happy birthday! ".repeat(12) }))).toContain("~");
  });

  it("leaves the default theme and count-down out of the link", async () => {
    expect(await encodeToken(countdown())).toMatch(/^[0-9a-z]+$/);
  });
});

describe("date-only links", () => {
  it("are the same wherever they're made", async () => {
    const zones = ["Pacific/Honolulu", "America/Los_Angeles", "UTC", "Asia/Tokyo", "Pacific/Kiritimati"];
    const tokens = new Set<string>();
    for (const zone of zones) {
      await inTimeZoneAsync(zone, async () => {
        tokens.add(await encodeToken(countdown({ dateOnly: true, target: new Date(2026, 11, 25) })));
      });
    }
    expect(tokens.size).toBe(1);
  });

  it("open as that date wherever they're viewed", async () => {
    for (const zone of ["Pacific/Honolulu", "UTC", "Asia/Tokyo"]) {
      await inTimeZoneAsync(zone, async () => {
        const c = await decodeToken("_g24");
        expect([c!.target.getMonth() + 1, c!.target.getDate(), c!.target.getHours()]).toEqual([12, 25, 0]);
      });
    }
  });
});

describe("timed links", () => {
  it("are the same moment wherever they're viewed", async () => {
    const moments = new Set<number>();
    for (const zone of ["Pacific/Honolulu", "UTC", "Asia/Tokyo"]) {
      await inTimeZoneAsync(zone, async () => {
        moments.add((await decodeToken("hud96"))!.target.getTime());
      });
    }
    expect(moments.size).toBe(1);
  });
});

describe("bad links", () => {
  for (const token of ["", "garbage!", "HELLO", "hud7i~notvalid", "hud7i.@@@", "hud7i.x.y", "_"]) {
    it(`rejects ${JSON.stringify(token)}`, async () => {
      expect(await decodeToken(token)).toBeNull();
    });
  }

  it("rejects a message that isn't valid text", async () => {
    // Base64url for the bytes FF FE, which aren't valid UTF-8
    expect(await decodeToken("hud7i.__4")).toBeNull();
  });
});

describe("theme letters", () => {
  it("uses the default theme for unknown letters", async () => {
    const c = await decodeToken("hud96Q");
    expect(c!.theme.id).toBe("generic");
  });

  it("reads the yearly letter and still finds the theme", async () => {
    const c = await decodeToken("hud96YB");
    expect(c!.yearly).toBe(true);
    expect(c!.theme.id).toBe("birthday");
    expect(peekTheme("hud96YB").id).toBe("birthday");
  });

  it("reads theme and count-up letters in any order", async () => {
    for (const token of ["hud96RU", "hud96UR"]) {
      const c = await decodeToken(token);
      expect(c!.theme.id).toBe("romantic");
      expect(c!.countUp).toBe(true);
    }
  });

  it("can be read without decoding the whole link", () => {
    expect(peekTheme("hud96P.SGk").id).toBe("party");
    expect(peekTheme("hud96UD").id).toBe("doomsday");
    expect(peekTheme("not a token").id).toBe("generic");
  });
});
