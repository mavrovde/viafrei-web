import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EVENTS, LOCATION_SOURCES, assertEventName, event, isEventName, isLocationSource } from "../src/analytics/events.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|astro|svelte|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

/** GA rules (#375 comment), rule 5: a closed list in one file (six names, seven since #564's location_source, eight since #938's card_more, nine since #939's card_refresh, eleven since #992's cta_business_click and dev_copy), a twelfth name fails. */
describe("the analytics event list (src/analytics/events.ts)", () => {
  it("is exactly the names rule 5 fixes, in snake_case", () => {
    expect([...EVENTS]).toEqual(["page_view", "cta_connect_click", "cta_developers_click", "language_switch", "consent_accept", "consent_decline", "location_source", "card_more", "card_refresh", "cta_business_click", "dev_copy"]);
    for (const n of EVENTS) expect(n).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });

  it("refuses any other name at runtime", () => {
    for (const bad of ["scroll", "page_view ", "PAGE_VIEW", "search", "board_saved", ""]) {
      expect(isEventName(bad), bad).toBe(false);
      expect(() => assertEventName(bad), bad).toThrow(/is not one of the 11 events/);
    }
    expect(assertEventName("consent_decline")).toBe("consent_decline");
  });

  it("builds a typed event whose parameters are enums and site paths only", () => {
    const e = event("page_view", { route: "/de", lang: "de" });
    expect(e).toEqual({ name: "page_view", params: { route: "/de", lang: "de" } });
    expect(event("consent_accept", {})).toEqual({ name: "consent_accept", params: {} });
    // #564: how the place was found, never which place
    expect(event("location_source", { lang: "de", method: "ip" })).toEqual({ name: "location_source", params: { lang: "de", method: "ip" } });
    expect([...LOCATION_SOURCES]).toEqual(["browser", "ip", "manual", "saved", "none"]);
    for (const bad of ["Köln", "ags:05315000", "pt:50.94,6.96", "", null]) expect(isLocationSource(bad), JSON.stringify(bad)).toBe(false);
  });

  it("is the only place in src/ that spells an event name as a string literal (rule 5: one file)", () => {
    // Every occurrence of a gtag("event", "<name>") or an event-name literal
    // outside events.ts is a second list. The sweep reads every source file.
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(5);
    const literal = /gtag\(\s*["']event["']\s*,\s*["']([a-z_]+)["']/g;
    for (const f of files) {
      if (f.endsWith("analytics/events.ts")) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(literal)) {
        expect.fail(`${f.replace(SRC, "src")} sends '${m[1]}' by literal — go through src/analytics/events.ts`);
      }
    }
  });

  it("names no measurement id anywhere in src/ (rule 3)", () => {
    for (const f of walk(SRC)) expect(readFileSync(f, "utf8"), f).not.toMatch(/G-[A-Z0-9]{8,12}/);
  });

  // GA4 reads an event parameter named source, medium, campaign or term as traffic attribution and overwrites the
  // session's source: `location_source {source: "ip"}` showed as the session source "ip / (not set)" (2026-10-24).
  // 2.3.22 (review nit 3 of 2.3.21): the whole attribution family GA4 reserves — campaign_id, content and the two
  // click ids as well, so a parameter named for any of them is refused before it can overwrite a session's source.
  const NAMES = "source|medium|campaign|campaign_id|term|content|gclid|dclid";
  const RESERVED = new RegExp(`(?:^|,)\\s*(${NAMES})\\s*(?:[:,]|$)`);
  it("declares no parameter GA4 reads as attribution", () => {
    const decl = readFileSync(join(SRC, "analytics", "events.ts"), "utf8").split("export type EventParams")[1]?.split("\n};")[0] ?? "";
    expect(decl).toContain("location_source");
    expect(decl).not.toMatch(new RegExp(`readonly (${NAMES}):`));
  });
  it("the reserved list catches each name, and only as a parameter name", () => {
    for (const n of NAMES.split("|")) {
      expect(` ${n}: "x"`, n).toMatch(RESERVED);
      expect(`lang: "de", ${n}: "x"`, n).toMatch(RESERVED);
      expect(`readonly ${n}: string`, n).toMatch(new RegExp(`readonly (${NAMES}):`));
    }
    for (const ok of [` surface: "home"`, ` method: "ip"`, ` where: "copy"`, ` sources: 1`, ` contents: 1`]) expect(ok).not.toMatch(RESERVED);
  });
  it("sends no parameter GA4 reads as attribution, from any file of src/", () => {
    const calls = walk(SRC).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\bevent\("[a-z_]+",\s*\{([^}]*)\}/g)].map((m) => [f, m[1] ?? ""] as const));
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const [f, params] of calls) expect(params, f).not.toMatch(RESERVED);
  });
  it("the location event carries its rung as `method` and the note click its surface as `surface`", () => {
    expect(event("location_source", { lang: "en", method: "browser" }).params).toEqual({ lang: "en", method: "browser" });
    expect(event("cta_connect_click", { lang: "de", where: "note", surface: "home" }).params).toEqual({ lang: "de", where: "note", surface: "home" });
    // #1003: a copy of the endpoint chip, its surface the same way
    expect(event("cta_connect_click", { lang: "de", where: "copy", surface: "connect" }).params).toEqual({ lang: "de", where: "copy", surface: "connect" });
  });
});
