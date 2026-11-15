/**
 * #944: the one place a map URL is built — the OSM link and the platform link
 * beside it — and the reduction of a `User-Agent` to `android | ios | other`
 * (data steward 2026-10-23, conditions 1, 2, 3, 5, 8, 9).
 */
import { describe, expect, it } from "vitest";
import { MAP_LABEL_MAX, MAP_PLATFORMS, appMapLink, appMapUrl, esc, mapLinks, mapPlatformOf, mapPlatformOfUserAgent, mapPoint, osmMapUrl, type MapTarget } from "../src/index.js";

const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  samsungAndroid: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromeIpad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
  ipadInApp: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
} as const;

describe("condition 9: the User-Agent is reduced to android | ios | other", () => {
  it("maps each kind of browser to its platform", () => {
    expect(mapPlatformOfUserAgent(UA.chromeWindows)).toBe("other");
    expect(mapPlatformOfUserAgent(UA.safariMac)).toBe("other");
    expect(mapPlatformOfUserAgent(UA.firefoxLinux)).toBe("other");
    expect(mapPlatformOfUserAgent(UA.googlebot)).toBe("other");
    expect(mapPlatformOfUserAgent(UA.chromeAndroid)).toBe("android");
    expect(mapPlatformOfUserAgent(UA.samsungAndroid)).toBe("android");
    expect(mapPlatformOfUserAgent(UA.safariIphone)).toBe("ios");
    expect(mapPlatformOfUserAgent(UA.chromeIpad)).toBe("ios");
    expect(mapPlatformOfUserAgent(UA.ipadInApp)).toBe("ios");
  });
  it("no header, an empty one or a non-string is other", () => {
    for (const x of [undefined, null, "", 42 as unknown as string]) expect(mapPlatformOfUserAgent(x)).toBe("other");
  });
  it("the digest takes only the three values: anything else is other", () => {
    expect(mapPlatformOf("android")).toBe("android");
    expect(mapPlatformOf("ios")).toBe("ios");
    for (const x of [undefined, "", "desktop", "ANDROID", ["android"], "ios ", UA.chromeAndroid]) expect(mapPlatformOf(x)).toBe("other");
    expect([...MAP_PLATFORMS]).toEqual(["other", "android", "ios"]);
  });
});

describe("condition 1: a point is five decimals inside Germany's box, or nothing", () => {
  it("rounds to five decimals", () => expect(mapPoint(49.456789123, 11.081111149)).toEqual({ lat: "49.45679", lon: "11.08111" }));
  it("refuses a missing, non-finite, swapped or outside point", () => {
    for (const [a, b] of [
      [null, 11],
      [49, undefined],
      [Number.NaN, 11],
      [49, Number.POSITIVE_INFINITY],
      [11.07, 49.45],
      [46.99, 11],
      [56.01, 11],
      [49, 4.99],
      [49, 16.01],
      [0, 0],
    ] as const)
      expect(mapPoint(a, b), `${String(a)}, ${String(b)}`).toBeNull();
  });
});

describe("the URLs (#944, steward 2026-10-23)", () => {
  const P: MapTarget = { kind: "point", lat: "49.45679", lon: "11.08111" };
  const S: MapTarget = { kind: "search", query: "Fürther Str. 12, Nürnberg" };
  it("the OSM link is unchanged: a marker at the point, zoom 15, or a search", () => {
    expect(osmMapUrl(P)).toBe("https://www.openstreetmap.org/?mlat=49.45679&mlon=11.08111#map=15/49.45679/11.08111");
    expect(osmMapUrl(P, 18)).toBe("https://www.openstreetmap.org/?mlat=49.45679&mlon=11.08111#map=18/49.45679/11.08111");
    expect(osmMapUrl(S)).toBe("https://www.openstreetmap.org/search?query=F%C3%BCrther%20Str.%2012%2C%20N%C3%BCrnberg");
  });
  it("a point: Google Maps URLs api=1, geo:, Apple's unified place URL — the same digits", () => {
    expect(appMapUrl(P, "other")).toBe("https://www.google.com/maps/search/?api=1&query=49.45679%2C11.08111");
    expect(appMapUrl(P, "android")).toBe("geo:49.45679,11.08111?q=49.45679,11.08111");
    expect(appMapUrl(P, "ios")).toBe("https://maps.apple.com/place?coordinate=49.45679,11.08111");
  });
  it("an address search (condition 2): no coordinate in any of the three, geo: at 0,0", () => {
    expect(appMapUrl(S, "other")).toBe("https://www.google.com/maps/search/?api=1&query=F%C3%BCrther%20Str.%2012%2C%20N%C3%BCrnberg");
    expect(appMapUrl(S, "android")).toBe("geo:0,0?q=F%C3%BCrther%20Str.%2012%2C%20N%C3%BCrnberg");
    expect(appMapUrl(S, "ios")).toBe("https://maps.apple.com/search?query=F%C3%BCrther%20Str.%2012%2C%20N%C3%BCrnberg");
    for (const p of MAP_PLATFORMS) expect(appMapUrl(S, p, "Aral")).not.toContain("Aral");
  });
  it("condition 3: a label on Android and Apple only, percent-encoded, at most 80 characters; never on the Google link", () => {
    expect(appMapUrl(P, "other", "Parkhaus Süd")).toBe(appMapUrl(P, "other"));
    expect(appMapUrl(P, "android", "Parkhaus (Süd)")).toBe("geo:49.45679,11.08111?q=49.45679,11.08111(Parkhaus%20%28S%C3%BCd%29)");
    expect(appMapUrl(P, "ios", "Parkhaus & Süd")).toBe("https://maps.apple.com/place?coordinate=49.45679,11.08111&name=Parkhaus%20%26%20S%C3%BCd");
    const long = "ä".repeat(MAP_LABEL_MAX + 20);
    const name = new URL(appMapUrl(P, "ios", long)).searchParams.get("name") ?? "";
    expect([...name]).toHaveLength(MAP_LABEL_MAX);
    expect(appMapUrl(P, "ios", "   ")).toBe(appMapUrl(P, "ios"));
  });
  it("condition 5 and 8: plain-text anchors, the OSM link's rel, no target, no image, the words escaped", () => {
    const w = { google: "Google Maps", apple: "Apple Karten", android: "In Karten-App öffnen" };
    for (const p of MAP_PLATFORMS) {
      const a = appMapLink(P, p, w);
      // #449: Google's and Apple's map names are brands, marked as names on every page; Android's words are ours
      expect(a).toMatch(p === "android" ? /^<a href="[^"<>]*" rel="noopener noreferrer nofollow">[^<]*<\/a>$/ : /^<a href="[^"<>]*" rel="noopener noreferrer nofollow" translate="no">[^<]*<\/a>$/);
      expect(a).not.toMatch(/target=|<img|<svg|style=|class=/);
    }
    expect(appMapLink(P, "other", { ...w, google: '<b>"x"</b>' })).toContain(">&lt;b&gt;&quot;x&quot;&lt;/b&gt;</a>");
    expect(mapLinks(P, "android", { osmWords: esc("Karte"), words: w })).toBe(
      '<a href="https://www.openstreetmap.org/?mlat=49.45679&amp;mlon=11.08111#map=15/49.45679/11.08111" rel="noopener noreferrer nofollow">Karte</a> · <a href="geo:49.45679,11.08111?q=49.45679,11.08111" rel="noopener noreferrer nofollow">In Karten-App öffnen</a>',
    );
  });
});
