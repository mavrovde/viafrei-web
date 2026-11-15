/**
 * #992: the business page as rendered in every language over loopback stubs (the e2e fixture digest and the asks
 * stub; no database, no provider, no public server), and the parts it is built from.
 *
 *   - the proof band: every fact is the digest's own figure with its Stand, or the error state saying it could not be
 *     read — never an older number; the catalogue figures are `siteFacts()`'s, so no count is typed into the copy;
 *   - the licence table: one row per class the register holds, with the register's count, in the ruling's order;
 *   - no example older than a day, and no answer crediting a consumer-only or terms source of any class member, recorded or live (#1190);
 *   - the calls to action carry `data-vf-cta`, which the one listener sends as `cta_business_click`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, first, text, type El } from "@viafrei/design/testing";
import contract from "../src/generated/contract.json" with { type: "json" };
import { clickEvent, devCopyEvent, factsOf } from "../src/analytics/listener.js";
import { t, type MessageKey } from "../src/i18n/index.js";
import { EXAMPLE_MAX_AGE_MS, withinDay, type AskEntry, type AskKey } from "../src/lib/ask.js";
import { setLogSink } from "../src/lib/log.js";
import type { TileResult } from "../src/lib/tiles.js";
import { FACTS } from "../src/lib/tiles.js";
import { BUSINESS_ASK_KEYS, businessAnswers, creditableToBusiness, shownOnBusinessPage } from "../src/site/business-cases.js";
import { siteFacts } from "../src/site/facts.js";
import { LICENCE_CLASSES } from "../src/site/licence-classes.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { BUSINESS, HOME, exampleAges, startPages, tooOld, type Pages } from "./pages-992.js";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/asks.json", import.meta.url), "utf8")) as { examples: { key: string; projection: { sources: readonly string[] } }[] };
const CONTACT = "pilot@example.org";
const COUNTS = new Map(LICENCE_CLASSES.map((c) => [c, Object.values(contract.licenceClasses).filter((x) => x === c).length]));
/** The roads fact credits road sources the gate refuses, on the fixture digest as in production (data-steward B6). */
const SHOWN_FACTS = FACTS.filter((f) => f !== "roads");
const norm = (s: string): string => s.replace(/\s+/gu, " ").trim();

let pages: Pages;
const saved = { CONTACT_EMAIL: process.env["CONTACT_EMAIL"] };
beforeAll(async () => {
  process.env["CONTACT_EMAIL"] = CONTACT;
  pages = await startPages();
}, 20_000);
afterAll(async () => {
  await (pages as Pages | undefined)?.close(); // undefined when beforeAll timed out
  if (saved.CONTACT_EMAIL === undefined) delete process.env["CONTACT_EMAIL"];
  else process.env["CONTACT_EMAIL"] = saved.CONTACT_EMAIL;
});

describe("the business page in every language (#992)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: live proof band, catalogue figures, CTAs, licence table, no stale example, ≤ 80 KB gzip`, async () => {
      const html = await pages.render(BUSINESS, lang);
      // the proof band: one cell per fact, each the digest's own (an example with its age) or the error state
      const cells = all(html, ".proof__cell");
      expect(cells.map((c) => c.attrs["data-proof"])).toEqual(SHOWN_FACTS.map((f) => `fact-${f}`));
      for (const c of cells) {
        const ok = c.attrs["data-example"] !== undefined;
        const failed = (c.attrs.class ?? "").split(" ").includes("is-error") && c.attrs.role === "status";
        expect(ok !== failed, `${lang} ${String(c.attrs["data-proof"])}: neither a figure nor the error state`).toBe(true);
        if (failed) expect(norm(text(c))).toBe(norm(t(lang, "bizPage.proofError")));
      }
      // over the fixture digest every fact the gate passes answers, and none is older than a day
      expect(cells.filter((c) => c.attrs["data-example"] !== undefined)).toHaveLength(SHOWN_FACTS.length);
      // the catalogue figures are the generated catalogue's, never typed
      const site = siteFacts();
      expect(all(html, ".proof__catalogue strong").map((s) => Number(text(s)))).toEqual([site.credits, site.tools, site.motorways, site.languages]);
      expect(site.languages).toBe(LIVE_LANGS.length);
      // the calls to action: pilot and contact mail the configured address, live opens the cases; all carry data-vf-cta
      const ctas = all(html, "a").filter((a) => a.attrs["data-vf-cta"] !== undefined);
      expect(ctas.map((a) => a.attrs["data-vf-cta"]).sort()).toEqual(["contact", "live", "pilot"]);
      for (const a of ctas.filter((x) => x.attrs["data-vf-cta"] !== "live")) expect(a.attrs.href).toBe(`mailto:${CONTACT}`);
      expect(ctas.find((a) => a.attrs["data-vf-cta"] === "live")?.attrs.href).toBe("#cases");
      // the licence table: the register's classes in the ruling's order, with the register's counts
      const rows = all(html, "tr").filter((r) => r.attrs["data-licence"] !== undefined);
      expect(rows.map((r) => r.attrs["data-licence"])).toEqual(LICENCE_CLASSES.filter((c) => (COUNTS.get(c) ?? 0) > 0));
      for (const r of rows) {
        const c = r.attrs["data-licence"] as (typeof LICENCE_CLASSES)[number];
        expect(Number(text(first(r, "td")!))).toBe(COUNTS.get(c));
        expect(norm(text(first(r, "th")!))).toBe(norm(t(lang, `bizPage.lic.${c}.name` as MessageKey)));
      }
      // six cases, each opening onto what is shown live
      expect(all(html, "article").filter((a) => a.attrs["data-case"] !== undefined)).toHaveLength(6);
      // six answers, and six DIFFERENT ones: the hero's and the five asks the cases open onto
      const answers = all(html, ".qa-answer").map((a) => norm(text(a)));
      expect(answers, `${lang}: six answers`).toHaveLength(6);
      expect(new Set(answers).size, `${lang}: the same answer twice`).toBe(6);
      // no example older than a day (what the answers may credit: below, over the fixture and over a live answer)
      expect(tooOld(exampleAges(html, new Date()))).toEqual([]);
      expect(gzipSync(html).length).toBeLessThanOrEqual(80 * 1024);
    });
  }

  it("a digest that does not answer: every proof cell is the error state, the six cases still stand", async () => {
    const html = await pages.render(BUSINESS, "de", { digest: pages.deadUrl });
    const cells = all(html, ".proof__cell");
    expect(cells).toHaveLength(FACTS.length);
    for (const c of cells) {
      expect((c.attrs.class ?? "").split(" ")).toContain("is-error");
      expect(c.attrs.role).toBe("status");
      expect(c.attrs["data-example"]).toBeUndefined();
      expect(norm(text(c))).toBe(norm(t("de", "bizPage.proofError")));
    }
    expect(all(html, "article").filter((a) => a.attrs["data-case"] !== undefined)).toHaveLength(6);
  });

  it("answers older than a day are left out, never shown as stale", async () => {
    const fresh = await pages.render(BUSINESS, "de");
    expect(all(fresh, ".qa-answer").length).toBeGreaterThan(0);
    const stale = await pages.render(BUSINESS, "de", { mcp: await pages.staleAsks(25 * 60) });
    expect(all(stale, ".qa-answer")).toHaveLength(0);
    expect(all(stale, ".biz-steps")).toHaveLength(0);
    expect(tooOld(exampleAges(stale, new Date()))).toEqual([]);
  });

  it("the hero and the five cases credit no consumer-only or terms source: every class member, read from the contract, over the recorded answers (#1190)", () => {
    const byKey = new Map(FIXTURE.examples.map((e) => [e.key, e] as const));
    const classes: Readonly<Record<string, string>> = contract.licenceClasses;
    expect(Object.values(classes).filter((c) => c === "consumerOnly").length, "the contract classes nothing consumer-only: this test would read nothing").toBeGreaterThan(0);
    expect(new Set(BUSINESS_ASK_KEYS).size, "six different asks").toBe(6);
    for (const key of BUSINESS_ASK_KEYS) {
      const sources = byKey.get(key)?.projection.sources ?? [];
      expect(sources.length, `${key} has no recorded answer`).toBeGreaterThan(0);
      for (const s of sources) {
        expect(classes[s], `${key} credits ${s}, which the contract does not class`).toBeDefined();
        expect(creditableToBusiness(s), `${key} credits ${s} (${String(classes[s])})`).toBe(true);
      }
    }
  });

  it("the rule refuses every consumer-only and terms source of the contract and an id it does not class, and passes the other classes (#1190)", () => {
    for (const [id, c] of Object.entries(contract.licenceClasses)) expect(creditableToBusiness(id), `${id} (${c})`).toBe(c !== "consumerOnly" && c !== "terms");
    expect(["autobahn", "toll_collect_sid"].filter(creditableToBusiness), "the two terms sources of the review").toEqual([]);
    expect(creditableToBusiness("not_a_register_id")).toBe(false);
    expect(creditableToBusiness("toString"), "an inherited name is no register id").toBe(false);
  });

  it("a live answer crediting a consumer-only source is dropped from the page, the other five stand (#1190)", async () => {
    const restricted = Object.entries(contract.licenceClasses).find(([, c]) => c === "consumerOnly")![0];
    for (const key of BUSINESS_ASK_KEYS) {
      const mcp = await pages.crediting({ [key]: ["dwd", restricted] });
      expect(all(await pages.render(BUSINESS, "de", { mcp }), ".qa-answer"), `${key} was still shown`).toHaveLength(5);
    }
    // the road-wide ask as production answered it on 2026-11-05 (A8): why `roads` is not on this page
    expect(["autobahn", "mobilithek_traffic_bw", "mobilithek_roadworks_akd"].every(creditableToBusiness)).toBe(false);
    // an id the contract does not class is refused the same way
    const unknown = await pages.crediting({ transit: ["a_source_nobody_classed"] });
    expect(all(await pages.render(BUSINESS, "de", { mcp: unknown }), ".qa-answer")).toHaveLength(5);
  });

  it("a dropped answer is logged once, with the answer and the source it refused; a kept one logs nothing (#1190)", () => {
    const lines: string[] = [];
    const restore = setLogSink((l) => lines.push(l));
    try {
      const entry = (key: AskKey, sources: readonly string[]): AskEntry => ({ key, tool: "find_parking", askedAt: "2026-11-05T12:00:00Z", projection: { variant: "x", values: {}, names: {}, asOf: "2026-11-05T12:00:00Z", attribution: "a", sources } });
      const asks = new Map<AskKey, AskEntry>([["poi", entry("poi", ["toll_collect_sid", "dwd"])], ["nearby", entry("nearby", ["dwd"])]]);
      expect([...businessAnswers(asks).keys()]).toEqual(["nearby"]);
      expect([...businessAnswers(asks).keys()], "the second render drops it too").toEqual(["nearby"]);
      expect(lines.map((l) => JSON.parse(l) as { kind: string; key: string; level: number })).toMatchObject([{ kind: "business_page_dropped", key: "answer:poi:toll_collect_sid", level: 40 }]);
    } finally {
      restore();
    }
  });

  describe("the gate over tiles and facts (#1190, data-steward B6, B7)", () => {
    const cases = (html: string): El[] => all(html, "article").filter((a) => a.attrs["data-case"] !== undefined);
    const caseOf = (html: string, n: number): El => cases(html).find((a) => a.attrs["data-case"] === String(n))!;
    const SAFE = "dwd";

    it("over the fixture digest: no tile or fact credits a refused source, jams is not on the page, and what is held stands", async () => {
      const html = await pages.render(BUSINESS, "de");
      expect(html).not.toContain('id="tile-jams"');
      // the fixture's lorry tile credits `autobahn` (B8: its answer stays), the reports tile any road source
      expect(html).not.toContain('id="tile-lorry"');
      expect(html).not.toContain('id="tile-reports"');
      expect(all(caseOf(html, 1), ".qa-answer")).toHaveLength(1);
      for (const id of ["charging", "carparks", "punctuality", "station"]) expect(html, id).toContain(`id="tile-${id}"`);
    });

    for (const [name, credits] of [
      ["a refused credit", "autobahn,dwd"],
      ["a consumer-only credit", `${Object.entries(contract.licenceClasses).find(([, c]) => c === "consumerOnly")![0]},dwd`],
      ["an id the contract does not class", "a_source_nobody_classed"],
      ["no credit statement", null],
      ["an unreadable credit statement", "Autobahn GmbH"],
    ] as const) {
      it(`${name}: that tile is omitted, with no error state, and the others stand`, async () => {
        const digest = await pages.digestCrediting({ charging: credits });
        const html = await pages.render(BUSINESS, "de", { digest });
        expect(html).not.toContain('id="tile-charging"');
        expect(all(caseOf(html, 2), ".is-error"), "a refused tile is not the error state").toHaveLength(0);
        expect(all(caseOf(html, 2), ".qa-answer"), "its answer stays").toHaveLength(1);
        expect(html).toContain('id="tile-carparks"');
      });
    }

    it("a refused fact leaves the band with no cell for it, and no error state", async () => {
      const digest = await pages.digestCrediting({ roads: "autobahn", charging: null });
      const html = await pages.render(BUSINESS, "de", { digest });
      const cells = all(html, ".proof__cell");
      expect(cells.map((c) => c.attrs["data-proof"])).toEqual(FACTS.filter((f) => f !== "roads" && f !== "charging").map((f) => `fact-${f}`));
      expect(cells.filter((c) => (c.attrs.class ?? "").split(" ").includes("is-error"))).toHaveLength(0);
    });

    it("an empty fact the digest answered is judged on its credits: roads crediting autobahn leaves no cell, not the error state", async () => {
      const digest = await pages.digestCrediting({ roads: "autobahn" }, ["roads"]);
      const html = await pages.render(BUSINESS, "de", { digest });
      const cells = all(html, ".proof__cell");
      expect(cells.map((c) => c.attrs["data-proof"])).toEqual(SHOWN_FACTS.map((f) => `fact-${f}`));
      expect(cells.filter((c) => (c.attrs.class ?? "").split(" ").includes("is-error")), "the empty roads fact is no \"could not be read\" cell").toHaveLength(0);
      // the control: the same empty fact crediting a source the page may credit is judged too, and stands as the error state
      const safe = await pages.render(BUSINESS, "de", { digest: await pages.digestCrediting({ roads: SAFE }, ["roads"]) });
      const roads = all(safe, ".proof__cell").find((c) => c.attrs["data-proof"] === "fact-roads");
      expect(roads?.attrs.class ?? "", "an empty fact that passes the gate is the error state").toContain("is-error");
    });

    it("a dead digest leaves every fact the error state: nothing answered, nothing judged", async () => {
      const cells = all(await pages.render(BUSINESS, "de", { digest: pages.deadUrl }), ".proof__cell");
      expect(cells.map((c) => c.attrs["data-proof"])).toEqual(FACTS.map((f) => `fact-${f}`));
      expect(cells.every((c) => (c.attrs.class ?? "").split(" ").includes("is-error"))).toBe(true);
    });

    it("a case left with neither tile nor answer shows no disclosure, and still stands", async () => {
      const digest = await pages.digestCrediting({ station: "autobahn" });
      const c4 = caseOf(await pages.render(BUSINESS, "de", { digest }), 4);
      expect(c4).toBeDefined();
      expect(all(c4, "details")).toHaveLength(0);
      const kept = caseOf(await pages.render(BUSINESS, "de", { digest: await pages.digestCrediting({ station: SAFE }) }), 4);
      expect(all(kept, "details"), "the control: a tile that passes keeps it").toHaveLength(1);
    });

    it("a tile the digest did not answer is still the error state: it was not refused", async () => {
      const html = await pages.render(BUSINESS, "de", { digest: pages.deadUrl });
      expect(all(caseOf(html, 2), ".is-error").length).toBeGreaterThan(0);
    });

    it("what is left out is logged once, with the tile and the refused id; a kept one logs nothing", () => {
      // The gate itself, in this module: the page runs in Vite's module graph, whose log sink is not this test's.
      const lines: string[] = [];
      const restore = setLogSink((l) => lines.push(l));
      try {
        const tile = (credits: readonly string[] | null | undefined): TileResult => ({ id: "carparks", fetched: "ok", html: "<p>x</p>", cadenceSeconds: null, ...(credits === undefined ? {} : { credits }) });
        expect(shownOnBusinessPage(tile(["dwd", "toll_collect_sid"]))).toBe(false);
        expect(shownOnBusinessPage(tile(["dwd", "toll_collect_sid"])), "the second render refuses it too").toBe(false);
        expect(shownOnBusinessPage(tile(null))).toBe(false);
        expect(shownOnBusinessPage(tile(undefined)), "absent is no statement either").toBe(false);
        expect(shownOnBusinessPage(tile(["dwd"]))).toBe(true);
        expect(shownOnBusinessPage(tile([])), "credits nothing: nothing to refuse").toBe(true);
        expect(shownOnBusinessPage({ id: "carparks", fetched: "error", html: "", cadenceSeconds: null }), "not answered: not judged").toBe(true);
        const notLive = (credits: readonly string[] | null): TileResult => ({ id: "fact-roads", fetched: "error", html: "", cadenceSeconds: null, reason: "fact not live", credits });
        expect(shownOnBusinessPage(notLive(["autobahn"])), "answered without a figure: judged, and refused").toBe(false);
        expect(shownOnBusinessPage(notLive(["dwd"])), "answered without a figure, crediting what may be credited").toBe(true);
        expect(shownOnBusinessPage(notLive(null)), "answered without a statement").toBe(false);
      } finally {
        restore();
      }
      expect(lines.map((l) => JSON.parse(l) as { kind: string; key: string; level: number })).toMatchObject([
        { kind: "business_page_dropped", key: "carparks:toll_collect_sid", level: 40 },
        { kind: "business_page_dropped", key: "carparks:no_credit_statement", level: 40 },
        { kind: "business_page_dropped", key: "fact-roads:autobahn", level: 40 },
        { kind: "business_page_dropped", key: "fact-roads:no_credit_statement", level: 40 },
      ]);
    });

    it("the gate is this page's alone: nothing else in the site imports it, and the home still embeds the refused tiles", async () => {
      const users = readdirSync(new URL("../src", import.meta.url), { recursive: true, encoding: "utf8" })
        .filter((f) => /\.(?:ts|astro)$/u.test(f))
        .filter((f) => /\bshownOnBusinessPage\b/u.test(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")));
      expect(users.sort()).toEqual(["layouts/BusinessPage.astro", "site/business-cases.ts"]);
      const home = await pages.render(HOME, "de");
      for (const id of ["jams", "reports", "lorry"]) expect(home, id).toContain(`id="tile-${id}"`);
    });
  });

  it("no contact configured: no empty mailto, the pilot CTA points at the contact section", async () => {
    const was = { c: process.env["CONTACT_EMAIL"], i: process.env["IMPRESSUM_EMAIL"] };
    delete process.env["CONTACT_EMAIL"];
    delete process.env["IMPRESSUM_EMAIL"];
    try {
      const html = await pages.render(BUSINESS, "en");
      expect(html).not.toContain("mailto:");
      const ctas = all(html, "a").filter((a) => a.attrs["data-vf-cta"] !== undefined);
      expect(ctas.map((a) => a.attrs["data-vf-cta"]).sort()).toEqual(["live", "pilot"]);
      expect(ctas.find((a) => a.attrs["data-vf-cta"] === "pilot")?.attrs.href).toBe("#contact");
    } finally {
      if (was.c !== undefined) process.env["CONTACT_EMAIL"] = was.c;
      if (was.i !== undefined) process.env["IMPRESSUM_EMAIL"] = was.i;
    }
  });
});

describe("withinDay (#992)", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const entry = (askedMin: number, asOfMin: number): AskEntry => ({ askedAt: new Date(now.getTime() - askedMin * 60_000).toISOString(), projection: { asOf: new Date(now.getTime() - asOfMin * 60_000).toISOString() } }) as unknown as AskEntry;
  it("keeps an answer whose question and Stand are both younger than a day, drops either older or far in the future", () => {
    const day = EXAMPLE_MAX_AGE_MS / 60_000;
    const asks = new Map<string, AskEntry>([
      ["fresh", entry(4, 4)],
      ["edge", entry(day, day)],
      ["oldAsk", entry(day + 1, 4)],
      ["oldStand", entry(4, day + 1)],
      ["future", entry(-10, 4)],
    ]);
    expect([...withinDay(asks, now).keys()]).toEqual(["fresh", "edge"]);
  });
});

describe("the business and developer events (#992)", () => {
  const at = (attrs: Record<string, string>, inside: readonly string[] = []) => ({
    getAttribute: (n: string) => attrs[n] ?? null,
    closest: (sel: string) => (inside.some((i) => sel.split(", ").includes(i)) ? {} : null),
  });
  it("#1177: the sticky button is counted, on the home too where it goes to the page's own #start", () => {
    expect(clickEvent({ href: "#start", insideTile: false, insideLangs: false, where: "sticky", source: null, cta: null }, "de")).toEqual({ name: "cta_connect_click", params: { lang: "de", where: "sticky" } });
  });
  it("a CTA is cta_business_click whatever its href (a mailto: counts), never inside a tile, never off the closed list", () => {
    for (const cta of ["contact", "pilot", "live"] as const) {
      const href = cta === "live" ? "#cases" : `mailto:${CONTACT}`;
      expect(clickEvent(factsOf(at({ href, "data-vf-cta": cta })), "de")).toEqual({ name: "cta_business_click", params: { lang: "de", cta } });
    }
    expect(clickEvent(factsOf(at({ href: `mailto:${CONTACT}`, "data-vf-cta": "contact" }, [".tile"])), "de")).toBeNull();
    expect(factsOf(at({ href: "#x", "data-vf-cta": "pricing" })).cta).toBeNull();
    expect(clickEvent(factsOf(at({ href: `mailto:${CONTACT}` })), "de")).toBeNull();
  });
  it("a copy is dev_copy with the closed-list what and client, and nothing else", () => {
    expect(devCopyEvent({ what: "config", client: "cursor" }, "en")).toEqual({ name: "dev_copy", params: { lang: "en", what: "config", client: "cursor" } });
    expect(devCopyEvent({ what: "curl", client: "http" }, "de")?.params).toEqual({ lang: "de", what: "curl", client: "http" });
    expect(devCopyEvent({ what: "secret", client: "cursor" }, "de")).toBeNull();
    expect(devCopyEvent({ what: "config", client: "emacs" }, "de")).toBeNull();
    expect(devCopyEvent(null, "de")).toBeNull();
  });
});
