/**
 * #992: the developers page — the quickstart, the try-it and the tool catalogue, as rendered in every language over
 * loopback stubs (no live call: the try-it's recorded `tools/call` is `test/fixtures/try-it.json`, served by
 * `e2e/asks-stub.ts`), and the parts the page is built from.
 *
 *   - the catalogue IS the server's: the cards' `data-tool` list equals `contract.json`'s tools, which equal what the
 *     booted server registers (`mcp:contract --names` boots the same `connectInMemory`; `contract-992.test.ts`);
 *   - a new tool needs no page edit: the layout names no tool but the one its first-call box asks about, and a tool
 *     without its example question in every language fails here;
 *   - every quickstart tab parses as what it says it is (JSON, TOML, a shell line) and names the one endpoint; the
 *     stdio tab names the package at this release's version;
 *   - the try-it is a real recorded call, younger than a day, with its time; no call, a dead listener, a stale call or
 *     a placeholder is the error state, never a sample.
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { parse as parseToml } from "smol-toml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, first, text } from "@viafrei/design/testing";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import contract from "../src/generated/contract.json" with { type: "json" };
import { catalogue as deckOf, t, type MessageKey } from "../src/i18n/index.js";
import { TRY_IT_MAX_AGE_MS, TRY_IT_MAX_BYTES, parseTryIt } from "../src/lib/try-it.js";
import { MCP_ENDPOINT } from "../src/site/endpoints.js";
import { TRY_IT_FALLBACK, quickTabs, stdioPackage } from "../src/site/dev-quickstart.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { DEVELOPERS, exampleAges, startPages, tooOld, type Pages } from "./pages-992.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/try-it.json", import.meta.url), "utf8")) as { call: Record<string, unknown> };
const TOOL_NAMES = contract.tools.map((x) => x.name);
const KB = 1024;

let pages: Pages;
beforeAll(async () => {
  pages = await startPages();
}, 30_000);
afterAll(async () => {
  await (pages as Pages | undefined)?.close(); // undefined when beforeAll timed out
});

describe("#992 the developers page, every language", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: the catalogue is the server's, the quickstart parses, the try-it is a recorded call under a day old`, async () => {
      const html = await pages.render(DEVELOPERS, lang);
      // the cards are the registered tools, each with its own question in this language
      const cards = all(html, "article[data-tool]");
      expect(cards.map((c) => c.attrs["data-tool"]).sort(), lang).toEqual([...TOOL_NAMES].sort());
      for (const c of cards) {
        const name = c.attrs["data-tool"]!;
        expect(all(c, ".tool-card__prompt .ask__text").map(text), `${lang}:${name}`).toEqual([t(lang, `devPage.ask.${name}` as MessageKey)]);
        expect(all(c, "details.tool-card__schema pre code").length, `${lang}:${name} schema`).toBe(1);
      }
      // the count in the lead comes from the catalogue ({n}), never typed
      expect(text(first(html, "#catalogue")!), lang).toContain(t(lang, "devPage.toolsLead", { n: catalogue.tools.length }));
      // one radio and one panel per tab, the first checked
      const tabs = quickTabs();
      expect(all(html, "input.qs__radio").map((r) => r.attrs.id), lang).toEqual(tabs.map((x) => `qs-${x.id}`));
      expect(all(html, "input.qs__radio[checked]").map((r) => r.attrs.id), lang).toEqual([`qs-${tabs[0]!.id}`]);
      for (const tab of tabs) {
        const code = all(html, `#qs-panel-${tab.id} pre code`).map(text);
        expect(code, `${lang}:${tab.id}`).toEqual([tab.code]);
        expect(first(html, `#qs-panel-${tab.id} .code-box`)?.attrs["data-vf-client"], `${lang}:${tab.id}`).toBe(tab.id);
      }
      // the try-it: a recorded call, its time, the response as the curl receives it
      const ok = first(html, '.try__response[data-try="ok"]');
      expect(ok, lang).not.toBeNull();
      const at = Date.parse(first(ok!, "time[datetime]")?.attrs.datetime ?? "");
      expect(Date.now() - at, lang).toBeLessThan(TRY_IT_MAX_AGE_MS);
      const response = JSON.parse(text(first(ok!, "pre code")!)) as { jsonrpc: string; id: number; result: { structuredContent?: unknown; content?: unknown } };
      expect(response.jsonrpc).toBe("2.0");
      expect(response.result.structuredContent ?? response.result.content).toBeDefined();
      const curl = all(html, '.code-box[data-vf-copy="curl"] pre code').map(text);
      expect(curl.length, lang).toBe(1);
      expect(curl[0], lang).toContain(`E=${MCP_ENDPOINT}`);
      expect(curl[0], lang).toContain(`"name":"${String(fixture.call["tool"])}"`);
      expect(all(html, ".try__response.is-error").length, lang).toBe(0);
      // no example older than a day; nothing consumer-only (Tankerkönig / MTS-K) anywhere on the page
      expect(tooOld(exampleAges(html, new Date())), lang).toEqual([]);
      expect(html, lang).not.toMatch(/tankerk(?:oe|ö)nig|MTS-K/iu);
      // the page's weight (#992: at most 80 KB gzip a page)
      expect(gzipSync(html).length, lang).toBeLessThanOrEqual(80 * KB);
    });
  }

  it("no call held (no listener configured): the error state, a status line, and the curl still asks the same question", async () => {
    const html = await pages.render(DEVELOPERS, "de", { mcp: null });
    expect(all(html, '.try__response[data-try="ok"]').length).toBe(0);
    expect(all(html, '.try__response.is-error[role="status"]').map((e) => text(e).replace(/\s+/gu, " ").trim())).toEqual([t("de", "devPage.tryError")]);
    expect(all(html, '.code-box[data-vf-copy="curl"] pre code').map(text)[0]).toContain(`"name":"${TRY_IT_FALLBACK.name}"`);
  });

  it("a dead listener: the error state, not a failed page", async () => {
    const html = await pages.render(DEVELOPERS, "en", { mcp: pages.deadUrl });
    expect(all(html, '.try__response.is-error[role="status"]').length).toBe(1);
    expect(all(html, "article[data-tool]").length).toBe(TOOL_NAMES.length);
  });

  it("a call older than a day (25 h): refused, the error state", async () => {
    const html = await pages.render(DEVELOPERS, "de", { mcp: await pages.staleAsks(25 * 60) });
    expect(all(html, '.try__response[data-try="ok"]').length).toBe(0);
    expect(all(html, '.try__response.is-error[role="status"]').length).toBe(1);
    // and no live answer older than a day either
    expect(tooOld(exampleAges(html, new Date()))).toEqual([]);
  });
});

describe("#992 a new tool appears with no page edit; a tool without its example question fails", () => {
  it("the layout names no tool but the first-call box's one: the cards come from contract.json", () => {
    const src = readFileSync(new URL("../src/layouts/DevelopersPage.astro", import.meta.url), "utf8");
    const named = TOOL_NAMES.filter((n) => new RegExp(`\\b${n}\\b`, "u").test(src));
    expect(named).toEqual([TRY_IT_FALLBACK.name]);
  });

  it("every registered tool has its purpose and its example question in every language, and no question names a tool that is gone", () => {
    const missing: string[] = [];
    const stale: string[] = [];
    for (const lang of LIVE_LANGS) {
      const deck = deckOf(lang);
      for (const n of TOOL_NAMES) for (const k of [`devPage.ask.${n}`, `devPage.tools.${n}`]) if ((deck[k] ?? "").trim() === "") missing.push(`${lang}: ${k}`);
      for (const k of Object.keys(deck)) if (k.startsWith("devPage.ask.") && !TOOL_NAMES.includes(k.slice("devPage.ask.".length))) stale.push(`${lang}: ${k}`);
    }
    expect({ missing, stale }).toEqual({ missing: [], stale: [] });
  });
});

describe("#992 the quickstart tabs", () => {
  it("each config parses as JSON or TOML and names the endpoint; each shell line names it; stdio names the bridge unpinned (it is published after the public sync, #992 review S1)", () => {
    const tabs = quickTabs();
    expect(tabs.map((x) => x.id)).toEqual(["claudeCode", "cursor", "vscode", "windsurf", "codex", "stdio", "http"]);
    for (const tab of tabs) {
      if (tab.format === "json") {
        const v = JSON.parse(tab.code) as unknown;
        expect(typeof v, tab.id).toBe("object");
      }
      if (tab.format === "toml") expect(parseToml(tab.code), tab.id).toEqual({ mcp_servers: { viafrei: { url: MCP_ENDPOINT } } });
      // the stdio bridge carries the endpoint itself; every other tab names it
      if (tab.id === "stdio") {
        expect(JSON.parse(tab.code)).toEqual({ mcpServers: { viafrei: { command: "npx", args: ["-y", "viafrei"] } } });
      } else expect(tab.code, tab.id).toContain(MCP_ENDPOINT);
    }
    expect(stdioPackage()).toBe("viafrei");
    // the endpoint is the one constant: another endpoint moves every tab with it
    for (const tab of quickTabs("https://example.test/mcp")) {
      expect(tab.code, tab.id).not.toContain(MCP_ENDPOINT);
      if (tab.id === "stdio") expect(tab.code).not.toContain("viafrei@");
      else expect(tab.code, tab.id).toContain("https://example.test/mcp");
    }
  });
});

describe("#992 parseTryIt: only a real, young, readable call", () => {
  const now = new Date("2026-11-04T03:00:00.000Z");
  const at = (minutesAgo: number): string => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const body = (call: Record<string, unknown>): unknown => ({ call: { ...fixture.call, askedAt: at(4), ...call } });
  const result = fixture.call["result"] as Record<string, unknown>;

  it("the recorded call is accepted, its tool, arguments and time kept", () => {
    const c = parseTryIt(body({}), now);
    expect(c?.tool).toBe("find_charging_station");
    expect(c?.args).toEqual(fixture.call["args"]);
    expect(c?.askedAt).toBe(at(4));
  });

  it("a placeholder fails: an empty result, empty text blocks, no content at all, an error result", () => {
    expect(parseTryIt(body({ result: { content: [] } }), now)).toBeNull();
    expect(parseTryIt(body({ result: { content: [{ type: "text", text: "  " }] } }), now)).toBeNull();
    expect(parseTryIt(body({ result: { structuredContent: result["structuredContent"] } }), now)).toBeNull();
    expect(parseTryIt(body({ result: { ...result, isError: true } }), now)).toBeNull();
    expect(parseTryIt(body({ result: { content: [{ type: "text", text: "Leipzig: 3 sites" }] } }), now)?.tool).toBe("find_charging_station");
  });

  it("an age past a day, a time from the future or no time fails", () => {
    expect(parseTryIt(body({ askedAt: at(24 * 60 + 1) }), now)).toBeNull();
    expect(parseTryIt(body({ askedAt: at(24 * 60 - 1) }), now)).not.toBeNull();
    expect(parseTryIt(body({ askedAt: at(-6) }), now)).toBeNull();
    expect(parseTryIt(body({ askedAt: "yesterday" }), now)).toBeNull();
    expect(parseTryIt(body({ askedAt: undefined }), now)).toBeNull();
  });

  it("an unknown shape, a consumer-only source or an answer too big to print whole fails", () => {
    expect(parseTryIt(null, now)).toBeNull();
    expect(parseTryIt({ call: [] }, now)).toBeNull();
    expect(parseTryIt(body({ tool: "Find Charging" }), now)).toBeNull();
    expect(parseTryIt(body({ args: null }), now)).toBeNull();
    expect(parseTryIt(body({ result: { content: [{ type: "text", text: "Preise: Tankerkönig (MTS-K)" }] } }), now)).toBeNull();
    expect(parseTryIt(body({ result: { content: [{ type: "text", text: "x".repeat(TRY_IT_MAX_BYTES) }] } }), now)).toBeNull();
  });
});
