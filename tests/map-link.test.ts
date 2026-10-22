import { describe, expect, it } from "vitest";
import { mapLink } from "../src/lib/countdown-view";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
// iPads ask for desktop sites, so they report a Mac
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const place = "Bob's Diner, 123 Main St & 1st";

describe("map links", () => {
  it("open Apple Maps on an iPhone, without a new tab", () => {
    expect(mapLink(place, IPHONE, 5)).toEqual({
      href: "https://maps.apple.com/?q=Bob's%20Diner%2C%20123%20Main%20St%20%26%201st",
      title: "Open in Maps",
      newTab: false,
    });
  });

  it("open Apple Maps on an iPad, which looks like a Mac with a touch screen", () => {
    expect(mapLink(place, MAC, 5).href).toMatch(/^https:\/\/maps\.apple\.com\/\?q=/);
  });

  it("open the default maps app on Android", () => {
    expect(mapLink(place, ANDROID, 5)).toMatchObject({ href: "geo:0,0?q=Bob's%20Diner%2C%20123%20Main%20St%20%26%201st", newTab: false });
  });

  it("open Google Maps in a new tab on a computer, Macs included", () => {
    for (const ua of [WINDOWS, MAC]) {
      expect(mapLink(place, ua, 0)).toEqual({
        href: "https://www.google.com/maps/search/?api=1&query=Bob's%20Diner%2C%20123%20Main%20St%20%26%201st",
        title: "Open in Google Maps",
        newTab: true,
      });
    }
  });
});
