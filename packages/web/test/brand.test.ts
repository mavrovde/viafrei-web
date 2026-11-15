/**
 * The brand line (#935, owner 2026-10-22): one tagline and one pitch,
 * `TAGLINE_EN` and `PITCH_EN` in `packages/mcp/src/content/brand.ts`, and every
 * copy that cannot import them held equal here — the site's `en.json`, the MCP
 * server's `instructions` and `serverInfo`, the README headline, the package
 * descriptions and the two project briefs — so an edit to one of them alone is
 * red. Then the site's side: every language carries both lines in its own words,
 * the home's head is "ViaFrei – <tagline>" with the pitch within 160 characters,
 * and the other pages keep their search titles.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PITCH_CLOSE_EN, PITCH_EN, PITCH_LEAD_EN, TAGLINE_EN, brandWithin, connectInMemory } from "@viafrei/mcp";
import type { Queryable } from "@viafrei/ingest";
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { catalogue, t } from "../src/i18n/index.js";
import { BRAND, DESCRIPTION_MAX, homeMeta, pageMeta, pitchWithin } from "../src/site/meta.js";
import { LIVE_LANGS, PAGE_IDS } from "../src/site/pages.js";

const ROOT = new URL("../../../", import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
const noDb: Queryable = { query: () => Promise.reject(new Error("no database in this test")) };

describe("one brand line, held equal everywhere (#935 AC 4, AC 9)", () => {
  it("the constants are the owner's final copy", () => {
    expect(TAGLINE_EN).toBe("The German Real-Time Mobility Context Platform for AI");
    expect(PITCH_EN).toBe("ViaFrei gives AI assistants real-time awareness of Germany. Trains and buses, traffic and roadworks, fuel, charging, parking and weather. One MCP. No API key. No sign-up.");
    expect(PITCH_EN.startsWith(`${PITCH_LEAD_EN}. `) && PITCH_EN.endsWith(` ${PITCH_CLOSE_EN}`)).toBe(true);
  });

  it("the site's en.json carries them verbatim", () => {
    expect(t("en", "meta.tagline")).toBe(TAGLINE_EN);
    expect(t("en", "meta.pitch")).toBe(PITCH_EN);
  });

  it("the MCP server says them: the instructions' first sentence is the pitch's, serverInfo carries the tagline then the pitch", async () => {
    const client = await connectInMemory({ db: noDb });
    const instructions = client.getInstructions() ?? "";
    expect(instructions.startsWith(`${PITCH_LEAD_EN}: live motorway traffic`)).toBe(true);
    // "real-time" never claims the reference data: places, addresses and the rules are named as reference
    expect(instructions.split(". ")[0]).toMatch(/; and, as reference data, places and addresses and the curated German driving rules$/);
    expect(client.getServerVersion()).toMatchObject({ name: "viafrei", title: "ViaFrei", description: `${TAGLINE_EN}. ${PITCH_EN}` });
    await client.close();
  });

  it("the README: H1 ViaFrei, the tagline as the subtitle, the pitch as the first paragraph, then the connect snippet", () => {
    const lines = read("README.md").split("\n");
    expect(lines[0]).toBe("# ViaFrei");
    expect(lines[2]).toBe(`**${TAGLINE_EN}**`);
    expect(lines[4]).toBe(PITCH_EN);
    expect(lines.slice(6, 9)).toEqual(["```bash", "claude mcp add --transport http viafrei https://mcp.viafrei.de/mcp", "```"]);
  });

  it("the package descriptions carry the tagline — the root's with the pitch", () => {
    const desc = (rel: string): string => (JSON.parse(read(rel)) as { description?: string }).description ?? "";
    expect(desc("package.json")).toBe(`${TAGLINE_EN}. ${PITCH_EN}`);
    const tail = TAGLINE_EN.replace(/^The /, "the ");
    for (const p of ["digest", "ingest", "mcp", "status", "web"]) expect(desc(`packages/${p}/package.json`), p).toMatch(new RegExp(`^ViaFrei, ${tail}: \\S`));
  });

  it("the project briefs open with it", () => {
    expect(read("CLAUDE.md").split("\n")[2]).toContain(TAGLINE_EN);
    // The PLAYBOOK's §0 opens with it — found by its heading, not by a line
    // number, so a paragraph added above §0 (#1059) does not move the check.
    const pb = read(".claude/PLAYBOOK.md").split("\n");
    const s0 = pb.findIndex((l) => l.startsWith("## 0."));
    expect(s0).toBeGreaterThan(0);
    expect(pb[s0 + 2]).toContain(TAGLINE_EN);
  });

  it("a short field gets the owner's order of forms: the pitch, then its first sentence and close, then the tagline", () => {
    expect(brandWithin(500)).toBe(PITCH_EN);
    expect(brandWithin(100)).toBe(`${PITCH_LEAD_EN}. ${PITCH_CLOSE_EN}`);
    expect(brandWithin(60)).toBe(TAGLINE_EN);
    expect(() => brandWithin(10)).toThrow(/no brand form fits/);
    // the site's rule for a translated pitch is the same rule: on the English pitch the two agree
    for (const max of [500, DESCRIPTION_MAX, 100]) expect(pitchWithin(PITCH_EN, max), String(max)).toBe(brandWithin(max));
  });
});

describe("every language says both lines in its own words (#935 AC 1, AC 9)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: a tagline and a five-sentence pitch, ending in the same three promises`, () => {
      const tagline = t(lang, "meta.tagline");
      const pitch = t(lang, "meta.pitch");
      expect(tagline).not.toMatch(/[.!]$/);
      const sentences = pitch.split(/(?<=\.)\s+/u);
      expect(sentences, pitch).toHaveLength(5);
      expect(pitch).toContain("ViaFrei");
      expect(pitch).toMatch(/\bMCP\b/);
      expect(pitch).toMatch(/\bAPI\b/);
      if (lang !== "en") {
        // one language per page: no English line on a translated page
        expect(tagline).not.toBe(TAGLINE_EN);
        expect(pitch).not.toBe(PITCH_EN);
        for (const v of Object.values(catalogue(lang))) {
          expect(v).not.toContain(TAGLINE_EN);
          expect(v).not.toContain(PITCH_LEAD_EN);
        }
      }
    });
  }
  it("the German is the owner's copy", () => {
    expect(t("de", "meta.tagline")).toBe("Die Echtzeit-Mobilitätsplattform für KI in Deutschland");
    expect(t("de", "meta.pitch")).toBe("ViaFrei gibt KI-Assistenten Echtzeit-Wissen über Deutschland. Bahn und Bus, Verkehr und Baustellen, Sprit, Laden, Parken und Wetter. Ein MCP. Kein API-Schlüssel. Keine Anmeldung.");
  });
});

describe("the home's head and the other pages' titles (#935 marketing rules 1 and 3)", () => {
  for (const lang of LIVE_LANGS) {
    it(`${lang}: the home is "ViaFrei – <tagline>", its description the pitch within 160, its card the tagline and the pitch`, () => {
      const home = pageMeta("start", lang);
      expect(home.title).toBe(`${BRAND} – ${t(lang, "meta.tagline")}`);
      expect(home.description.length, home.description).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(home.description).toBe(pitchWithin(t(lang, "meta.pitch"), DESCRIPTION_MAX));
      expect(home.description.startsWith(t(lang, "meta.pitch").split(/(?<=\.)\s+/u)[0]!)).toBe(true);
      expect(home.og).toEqual({ title: t(lang, "meta.tagline"), description: t(lang, "meta.pitch") });
      expect(home).toEqual(homeMeta(t(lang, "meta.tagline"), t(lang, "meta.pitch")));
      expect(t(lang, "meta.siteName")).toBe(BRAND);
      for (const p of PAGE_IDS.filter((x) => x !== "start")) {
        const m = pageMeta(p, lang);
        expect(m.title.includes(t(lang, "meta.tagline")), `${p}: ${m.title}`).toBe(false);
        expect(m.og, p).toBeUndefined();
      }
    });
  }
  it("a pitch with no form inside the field is an error, not a cut word", () => {
    expect(() => pitchWithin("A sentence far too long for the field.", 10)).toThrow(/fits no form/);
  });
});

describe("the hero renders the two lines, then the connect button (#935 rule 2)", () => {
  it("Hero.astro: the h1 is the tagline, the pitch under it, the actions before the conversation", () => {
    const hero = readFileSync(new URL("../src/components/Hero.astro", import.meta.url), "utf8");
    const markup = hero.slice(hero.indexOf("<section"));
    const at = (s: string): number => markup.indexOf(s);
    expect(all(markup, "h1").map(nodeText)).toContain("{t(lang, \"meta.tagline\")}");
    expect(all(markup, "p.hero__pitch").map(nodeText)).toContain("{t(lang, \"meta.pitch\")}");
    expect(at("<h1>")).toBeLessThan(at('class="hero__pitch"'));
    expect(at('class="hero__pitch"')).toBeLessThan(at('class="btn btn--primary"'));
    expect(at('class="btn btn--primary"')).toBeLessThan(at('class="hero__talk"'));
  });
});
