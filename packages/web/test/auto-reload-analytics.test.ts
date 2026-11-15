/**
 * The home's automatic 20-minute reload is no visit (2.4.3). GA read 519 page views of `/de` from 2 users in a
 * week: every reload of an open tab sent `page_view`, and `location_source` beside it. The reload goes to
 * `HOME_REFRESH_URL` (`?r=auto`); a render at that address sends neither page-load event, and an event a person
 * causes there (a click) is still sent.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isAutomaticReload } from "../src/analytics/listener.js";
import { HOME_REFRESH_URL } from "../src/site/pages.js";

const CONSENT = readFileSync(join(fileURLToPath(new URL("..", import.meta.url)), "src/components/Consent.svelte"), "utf8");

describe("the automatic reload is no visit", () => {
  it("recognises the meta refresh's own target, and nothing else", () => {
    expect(isAutomaticReload(new URL(HOME_REFRESH_URL, "https://viafrei.de/de").href)).toBe(true);
    expect(isAutomaticReload("https://viafrei.de/de?r=auto")).toBe(true);
    expect(isAutomaticReload("https://viafrei.de/en?x=1&r=auto#tiles")).toBe(true);
    expect(isAutomaticReload("https://viafrei.de/de")).toBe(false);
    expect(isAutomaticReload("https://viafrei.de/de?r=manual")).toBe(false);
    expect(isAutomaticReload("https://viafrei.de/de?auto")).toBe(false);
    expect(isAutomaticReload("not a url")).toBe(false);
    // Accepted trade-off (2.4.3 review): a person who opens a bookmarked or shared `?r=auto` address is not counted
    // as a page view either — the parameter is the meta refresh's own, and no page links to it.
  });

  it("the consent island sends page_view and location_source only when the render is not the automatic reload", () => {
    const pageViewSends = CONSENT.split("\n").filter((l) => l.includes("send(pageView("));
    expect(pageViewSends).toHaveLength(1);
    expect(pageViewSends[0]).toMatch(/if \(!isAutomaticReload\(window\.location\.href\)\) send\(pageView\(/);
    const locate = CONSENT.slice(CONSENT.indexOf("const locate = "), CONSENT.indexOf('send(event("location_source"'));
    expect(locate).toContain("isAutomaticReload(window.location.href)) return;");
    // a person's click on the reloaded render is still an event: the click listener carries no such guard
    const click = CONSENT.slice(CONSENT.indexOf('document.addEventListener("click"'), CONSENT.indexOf("ENDPOINT_COPY_EVENT, (ev)"));
    expect(click).not.toContain("isAutomaticReload");
  });
});
