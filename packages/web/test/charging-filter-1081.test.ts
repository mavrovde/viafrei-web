/**
 * #1081 in the shell: the charging filter's address keys (`ev_*`) travel to the digest from every surface that lists
 * chargers — the place page and the home (and the island's re-ask), the pager's next page and the card's refresh of
 * the charging card only, a station page's live part, a motorway page and its radius view — cut to their shape and
 * nothing else (D3); any of them makes the page a person's view (D2: noindex, noarchive, the canonical unfiltered;
 * robots.txt and the sitemaps never name one); a topic choice without the charging card ignores them (D8); the
 * re-fetch sends no analytics event of its own (D10).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { all, first } from "@viafrei/design/testing";
import { describe, expect, it } from "vitest";
import { EVENTS } from "../src/analytics/events.js";
import { cardMoreTarget } from "../src/lib/card-more.js";
import { REFRESH_JS, cardRefreshTarget } from "../src/lib/card-refresh.js";
import { CHARGING_FILTER_KEYS, CHARGING_FILTER_PAIR_SOURCE, carriesChargingFilterForm, chargingFilterForTopics, chargingFilterForward, hasChargingFilter, keepChoicesInChargingForm } from "../src/lib/charging-filter.js";
import { placeRoute } from "../src/lib/fragment-route.js";
import { motorwayChoice, motorwayViewQuery, carriesMotorwayForm } from "../src/lib/motorway.js";
import { fetchPlaceAnswer } from "../src/lib/place.js";
import { stationLiveChoice } from "../src/lib/station.js";
import { robotsTxt } from "../src/site/discovery.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";

const q = (s: string): URLSearchParams => new URLSearchParams(s);
const o = { baseUrl: "http://digest:8791" };
const src = (...p: string[]): string => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", ...p), "utf8");

describe("the keys the shell forwards (#1081 D3)", () => {
  it("each value by its shape, lower-cased, in a fixed order", () => {
    expect(chargingFilterForward(q("ev_kw=hpc,ac&ev_op=EnBW&ev_free=1&ev_plug=ccs2&ev_plug=type2"))).toBe("ev_op=enbw&ev_kw=hpc%2Cac&ev_plug=ccs2&ev_plug=type2&ev_free=1");
    expect(chargingFilterForward(q("ev_op=-"))).toBe("ev_op=-");
    // #1081 phase 2: the terms of use travel too, after "free now"
    expect(chargingFilterForward(q("ev_term=open247,card&ev_free=1"))).toBe("ev_free=1&ev_term=open247%2Ccard");
  });

  it("#1081 phase 2: the browser scripts carry every key of the list — the refresh by construction, the island's literal held equal", () => {
    expect(CHARGING_FILTER_PAIR_SOURCE).toBe("^ev_(?:op|kw|plug|free|term)=[A-Za-z0-9%,._-]{1,200}$");
    expect(REFRESH_JS).toContain(`/${CHARGING_FILTER_PAIR_SOURCE}/.test(p)`);
    expect(src("location", "island.ts")).toContain(`/${CHARGING_FILTER_PAIR_SOURCE}/.test(p)`);
  });

  it("drops markup, a value of 300 characters, other keys, and stops at 16 values a key", () => {
    expect(chargingFilterForward(q(`ev_op=${encodeURIComponent("<script>alert(1)</script>")}`))).toBe("");
    expect(chargingFilterForward(q(`ev_op=${"a".repeat(300)}`))).toBe("");
    expect(chargingFilterForward(q("topics=charging&lang=de&at=pt:1,2"))).toBe("");
    expect(chargingFilterForward(q(Array.from({ length: 40 }, () => "ev_kw=hpc").join("&"))).split("&")).toHaveLength(16);
  });

  it("any ev_* key — even one whose value is dropped — is a filtered view (D2)", () => {
    for (const k of CHARGING_FILTER_KEYS) expect(hasChargingFilter(q(`${k}=x`)), k).toBe(true);
    expect(hasChargingFilter(q("ev_kw=abc"))).toBe(true);
    expect(hasChargingFilter(q("topics=charging"))).toBe(false);
  });

  it("D8: a topic choice without the charging card ignores the keys", () => {
    expect(chargingFilterForTopics(q("topics=charging&ev_kw=hpc"), ["charging"])).toBe("ev_kw=hpc");
    expect(chargingFilterForTopics(q("topics=fuel&ev_kw=hpc"), ["fuel"])).toBe("");
    expect(chargingFilterForTopics(q("ev_kw=hpc"), null)).toBe("ev_kw=hpc");
  });
});

describe("every surface forwards them (#1081 C7, D9)", () => {
  it("the pager's next page of the charging card, and of no other card", () => {
    expect(cardMoreTarget(q("place=koeln&card=charging&lang=de&from=4&ev_kw=hpc&ev_op=enbw"), o)).toBe("http://digest:8791/internal/place/koeln/charging?lang=de&from=4&ev_op=enbw&ev_kw=hpc");
    expect(cardMoreTarget(q("place=koeln&card=parking&lang=de&from=4&ev_kw=hpc"), o)).toBe("http://digest:8791/internal/place/koeln/parking?lang=de&from=4");
    expect(cardMoreTarget(q("road=A7&card=charging&lang=de&from=13&ev_plug=ccs2"), o)).toBe("http://digest:8791/internal/motorway/A7/more/charging?lang=de&from=13&ev_plug=ccs2");
  });

  it("the charging card's refresh keeps its filter", () => {
    expect(cardRefreshTarget(q("place=koeln&card=charging&lang=de&ev_free=1"), o)).toBe("http://digest:8791/internal/place/koeln/card/charging?lang=de&ev_free=1");
    expect(cardRefreshTarget(q("place=koeln&card=roads&lang=de&ev_free=1"), o)).toBe("http://digest:8791/internal/place/koeln/card/roads?lang=de");
    expect(cardRefreshTarget(q("station=koeln-hbf&card=around&lang=de&ev_kw=ac"), o)).toBe("http://digest:8791/internal/station/koeln-hbf/card/around?lang=de&ev_kw=ac");
  });

  it("a station page's live part and a motorway page (kept across its redirect)", () => {
    expect(stationLiveChoice(q("platform=4&ev_op=ionity"))).toBe("platform=4&ev_op=ionity");
    expect(motorwayChoice(q("ev_kw=hpc&ev_plug=ccs2"))).toBe("ev_kw=hpc&ev_plug=ccs2");
    expect(motorwayViewQuery(q("r=30&ev_kw=hpc"))).toBe("r=30&ev_kw=hpc");
  });

  it("the place's cards, and the island's re-ask", async () => {
    const asked: string[] = [];
    const digest: FetchLike = (url) => {
      asked.push(url);
      return Promise.resolve({
        status: 200,
        headers: { get: (n: string) => ({ "content-type": "text/html; charset=utf-8", "place-key": "ags:05315000", "place-label": "K%C3%B6ln", "place-point": "0" })[n] ?? null },
        text: () => Promise.resolve('<section class="place" id="place-cards"><h2>Köln</h2></section>'),
      });
    };
    await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest, ev: "ev_kw=hpc&ev_op=enbw" });
    expect(asked[0]).toContain("&ev_kw=hpc&ev_op=enbw");
    // anything that is not an ev_* pair is never appended
    await fetchPlaceAnswer("ags:05315000", "de", { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest, ev: "lang=en&ev_kw=hpc" });
    expect(asked[1]).not.toContain("ev_kw");
    const post = new Request("http://shell/fragment/place", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ at: "pt:50.94,6.96", lang: "de", ev: "ev_plug=ccs2&x=<b>" }) });
    await placeRoute(post, { baseUrl: "http://digest", timeoutMs: 500, fetchImpl: digest });
    expect(asked.at(-1)).toContain("&ev_plug=ccs2");
    expect(asked.at(-1)).not.toContain("x=");
    // the island reads the address and sends it in the body (#1081), as shipped
    expect(INLINE_SCRIPTS.island).toContain(`/${CHARGING_FILTER_PAIR_SOURCE}/.test(`);
  });
});

describe("a filtered page is a person's view (#1081 D2)", () => {
  it("the place page and the home are noindex; the station page noindex, follow, noarchive", () => {
    expect(src("pages", "[lang]", "place", "[slug].astro")).toContain("hasChargingFilter(Astro.url.searchParams)");
    expect(src("layouts", "PlacePage.astro")).toContain('robots={opened || filtered ? "noindex, noarchive" : "noarchive"}');
    expect(src("layouts", "Home.astro")).toContain("const filtered = isFilteredView(Astro.url.searchParams) || hasChargingFilter(Astro.url.searchParams);");
    expect(src("layouts", "StationPage.astro")).toContain('"noindex, follow, noarchive"');
  });

  it("robots.txt names no ev_* key (the sitemaps list paths only)", () => {
    expect(robotsTxt()).not.toMatch(/ev_/);
  });

  it("a fragment carrying the bar lets its page submit to itself (form-action 'self')", () => {
    const bar = '<form class="tpf evf" method="get" action="#mw-charging">';
    expect(carriesChargingFilterForm(bar)).toBe(true);
    expect(carriesMotorwayForm(bar)).toBe(true);
    expect(carriesMotorwayForm("<section></section>")).toBe(false);
    expect(src("layouts", "StationPage.astro")).toContain("carriesChargingFilterForm(head.html)");
  });
});

describe("the re-fetch (#1081 D1, D10)", () => {
  it("compiles, re-fetches the card alone, follows the address, announces the count and keeps focus", () => {
    expect(() => new Script(REFRESH_JS)).not.toThrow();
    expect(REFRESH_JS).toContain('document.addEventListener("submit", evForm);');
    expect(REFRESH_JS).toContain('document.addEventListener("change", evForm);');
    expect(REFRESH_JS).toContain("history.replaceState(history.state");
    expect(REFRESH_JS).toContain('a.querySelector(".evf__count, .evf__none")');
    expect(REFRESH_JS).toContain("if (back) back.focus();");
    expect(REFRESH_JS).toContain('(evCard(a) ? evq() : "")');
  });

  it("D10: EVENTS gained no filter event, and a filter's re-fetch tells nobody", () => {
    // the nine of #1081's day plus #992's two (the business CTA, the developer copy) — none of them a filter's
    expect(EVENTS).toHaveLength(11);
    expect(EVENTS.filter((e) => /filter/u.test(e))).toEqual([]);
    expect(REFRESH_JS).toContain('refresh(a, "filter", function () {');
    expect(REFRESH_JS).toContain('if (how === "filter") return;');
    const filterPart = REFRESH_JS.slice(REFRESH_JS.indexOf("function applyEv"));
    expect(filterPart).not.toMatch(/dispatchEvent|gtag|dataLayer/);
  });
});

describe("a no-script submit keeps the page's other choices (#1081 review 5)", () => {
  const FORM = '<section><form class="tpf evf" method="get" action="#pcard-charging" aria-label="Filter"><select name="ev_op"></select></form></section>';
  it("the topic choice, a station's board choice and a motorway page's view ride along as escaped hidden inputs", () => {
    const out = keepChoicesInChargingForm(FORM, q("topics=charging,parking&platform=4&to=K%C3%B6ln&mode=rail&access=1&f=1&layer=closures&layer=charging&r=50&from=12&dir=pos"));
    const form = first(out, "form.tpf.evf");
    expect(form?.attrs.action).toBe("#pcard-charging");
    expect(form?.attrs["aria-label"]).toBe("Filter");
    const hidden = all(out, 'form.evf input[type="hidden"]').map((e) => [e.attrs.name, e.attrs.value]);
    // right after the form opens, in CHARGING_FORM_KEEPS order, the form's own select after them
    expect(hidden).toEqual([["topics", "charging,parking"], ["f", "1"], ["layer", "closures"], ["layer", "charging"], ["r", "50"], ["from", "12"], ["to", "Köln"], ["dir", "pos"], ["platform", "4"], ["mode", "rail"], ["access", "1"]]);
    expect(all(out, "form.evf select")).toHaveLength(1);
  });
  it("never carries the form's own ev_* keys nor an unnamed key; a value cannot break out of its attribute", () => {
    const out = keepChoicesInChargingForm(FORM, q('ev_op=enbw&utm_source=x&topics="><script>x</script>'));
    expect(out).not.toContain('name="ev_op" value');
    expect(out).not.toContain("utm_source");
    expect(all(out, "script")).toHaveLength(0);
    expect(all(out, 'input[type="hidden"]').map((e) => e.attrs.value)).toEqual(['"><script>x</script>']);
    expect(out).toContain('value="&quot;&gt;&lt;script&gt;x&lt;/script&gt;"');
  });
  it("a fragment without the form, or a page with no other choice, is unchanged", () => {
    expect(keepChoicesInChargingForm("<p>x</p>", q("topics=charging"))).toBe("<p>x</p>");
    expect(keepChoicesInChargingForm(FORM, q("ev_op=enbw"))).toBe(FORM);
  });
  it("the place block, the station page and the motorway page embed their fragments through it", () => {
    expect(src("components", "PlaceBlock.astro")).toContain("keepChoicesInChargingForm(applyTopics(place.html, topics), Astro.url.searchParams)");
    expect(src("layouts", "StationPage.astro")).toContain("keepChoicesInChargingForm(head.html, Astro.url.searchParams)");
    expect(src("layouts", "MotorwayPage.astro")).toContain("keepChoicesInChargingForm(html, Astro.url.searchParams)");
  });
});
