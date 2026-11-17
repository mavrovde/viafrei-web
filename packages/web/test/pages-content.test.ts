/**
 * The wave-2 pages' content rules (#379, #142, #143, #144), checked against
 * their sources rather than against copies: the connect questions against the
 * eval corpus, the developer catalogue against the booted server, the identity
 * rule against the reader, and the claims rule against the copy deck and the
 * page templates.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { buildCatalogue } from "../scripts/generate-catalogue.js";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { catalogue as catalogueOf, t } from "../src/i18n/index.js";
import { CONNECT_PROMPTS, GRADED_PROMPT_LANGS } from "../src/site/connect-prompts.js";
import { PUBLIC_REPOS } from "../src/site/structured-data.js";
import { NOT_COVERED } from "../src/site/not-covered.js";
import { MissingIdentity, REQUIRED_IDENTITY, identityOrError, readIdentity } from "../src/lib/identity.js";
import { sitemapXml } from "../src/pages/sitemap.xml.js";
import { LIVE_LANGS, PAGES } from "../src/site/pages.js";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(WEB, "..", "..");

describe("connect page questions (#142, #449)", () => {
  // cross-repo(viafrei): reads viafrei's evals/prompts/, the MCP server's golden-prompt corpus (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("are five, each a golden prompt in its OWN tool's file with that expect_tool and lang, for every graded language", () => {
    expect(CONNECT_PROMPTS).toHaveLength(5);
    for (const lang of GRADED_PROMPT_LANGS) {
      for (const { tool, key } of CONNECT_PROMPTS) {
        const prompt = t(lang, key);
        const entries = parse(readFileSync(join(ROOT, "evals", "prompts", `${tool}.yaml`), "utf8")) as { prompt: string; lang?: string; expect_tool: string | null }[];
        const hit = entries.find((e) => e.prompt === prompt);
        expect(hit, `${lang}: ${prompt} not in ${tool}.yaml`).toBeDefined();
        expect(hit?.expect_tool).toBe(tool);
        expect(hit?.lang, `${lang}: ${prompt} is graded as another language`).toBe(lang);
      }
    }
  });

  // #449: the five were literals, three German and two English, printed unchanged on every language's page.
  it("are asked in the page's own language: no language repeats another's question", () => {
    expect(LIVE_LANGS.length).toBeGreaterThanOrEqual(7);
    for (const { key } of CONNECT_PROMPTS) {
      const seen = new Map<string, string>();
      for (const lang of LIVE_LANGS) {
        const q = t(lang, key);
        expect(q.trim(), `${lang}: ${key} is empty`).not.toBe("");
        expect(seen.get(q), `${lang}: ${key} is ${seen.get(q)}'s text "${q}"`).toBeUndefined();
        seen.set(q, lang);
      }
    }
  });
});

describe("what ViaFrei does not answer, in the page's language (#449)", () => {
  it("binds every line the server states, in its order, to a deck key — none left untranslated", () => {
    expect(catalogue.notCovered.length).toBeGreaterThanOrEqual(5);
    expect(NOT_COVERED.map((x) => x.server)).toEqual(catalogue.notCovered);
  });
  it("says each limit in every live language, and no language repeats another's line", () => {
    for (const { key } of NOT_COVERED) {
      const seen = new Map<string, string>();
      for (const lang of LIVE_LANGS) {
        const line = t(lang, key);
        expect(line.trim(), `${lang}: ${key}`).not.toBe("");
        expect(seen.get(line), `${lang}: ${key} is ${seen.get(line)}'s line`).toBeUndefined();
        seen.set(line, lang);
      }
    }
  });
});

describe("the developer catalogue in the page's language (#449)", () => {
  it("translates every tool and prompt the server lists, in every live language, and nothing it does not list", () => {
    for (const lang of LIVE_LANGS) {
      const flat = Object.keys(catalogueOf(lang));
      const tools = flat.filter((k) => k.startsWith("devPage.tools.")).map((k) => k.slice("devPage.tools.".length));
      const prompts = flat.filter((k) => k.startsWith("devPage.prompts.")).map((k) => k.slice("devPage.prompts.".length));
      expect(tools.sort(), lang).toEqual(catalogue.tools.map((x) => x.name).sort());
      expect(prompts.sort(), lang).toEqual(catalogue.prompts.map((x) => x.name).sort());
    }
  });
});

describe("quotation marks are the page language's own (#449)", () => {
  const EXPECTED: Readonly<Record<string, readonly [string, string]>> = {
    de: ["\u201e", "\u201c"], // „…“
    en: ["\u201c", "\u201d"], // “…”
    ru: ["\u00ab", "\u00bb"], // «…»
    uk: ["\u00ab", "\u00bb"], // «…»
    bg: ["\u201e", "\u201c"], // „…“
    ro: ["\u201e", "\u201d"], // „…”
    tr: ["\u201c", "\u201d"], // “…”
    // the fifteen of #753
    fr: ["\u00ab", "\u00bb"], es: ["\u00ab", "\u00bb"], it: ["\u00ab", "\u00bb"], pt: ["\u00ab", "\u00bb"], el: ["\u00ab", "\u00bb"], // «…»
    lt: ["\u201e", "\u201c"], cs: ["\u201e", "\u201c"], sk: ["\u201e", "\u201c"], hr: ["\u201e", "\u201c"], sr: ["\u201e", "\u201c"], lv: ["\u201e", "\u201c"], da: ["\u201e", "\u201c"], // „…“
    pl: ["\u201e", "\u201d"], hu: ["\u201e", "\u201d"], // „…”
    nl: ["\u201c", "\u201d"], // “…”
  };
  it("pins the pair for every live language", () => {
    expect(Object.keys(EXPECTED)).toHaveLength(22);
    for (const lang of LIVE_LANGS) expect([t(lang, "quote.open"), t(lang, "quote.close")], lang).toEqual(EXPECTED[lang]);
  });
  it("no stylesheet types a quotation mark for the questions", () => {
    const css = readFileSync(join(WEB, "src", "styles", "site.css"), "utf8");
    expect(css).not.toMatch(/ask__q::(before|after)/);
  });
});

describe("developer page catalogue (#143)", () => {
  // cross-repo(viafrei): reads viafrei's CHANGELOG.md, the MCP server's release history; the catalogue it checks is generated in viafrei (scripts/generate-catalogue.ts) and arrives here as src/generated/*.json (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("equals what the booted server lists, so a tool added or renamed is not missed", async () => {
    const live = await buildCatalogue();
    // whole objects — a changed title or description makes the committed page stale too
    expect(catalogue).toEqual(live);
    const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
    expect(catalogue.release.version).toBe(root.version);
    expect(catalogue.tools.length).toBeGreaterThanOrEqual(20);
  });

  it("no template links the private platform repository", () => {
    // The repositories a template may name are the PUBLIC ones, read from the list the JSON-LD's `sameAs` is
    // built from (PUBLIC_REPOS), never typed a second time here; plus `viafrei-bridge`, the bridge's name before
    // it became viafrei-mcp, which Glama's listing still carries (GLAMA_LISTING). viafrei, viafrei-infra and
    // viafrei-ingestor are private and in neither.
    const GITHUB = "https://github.com/mavrovde/";
    for (const u of PUBLIC_REPOS) expect(u.startsWith(GITHUB), u).toBe(true);
    const allowed = new Set([...PUBLIC_REPOS.map((u) => u.slice(GITHUB.length)), "viafrei-bridge"]);
    expect(allowed.has("viafrei")).toBe(false);
    const files = execFileSync("git", ["ls-files", "--others", "--cached", "--exclude-standard", "src"], { cwd: WEB, encoding: "utf8" }).split("\n").filter(Boolean);
    let named = 0;
    for (const f of files) {
      for (const m of readFileSync(join(WEB, f), "utf8").matchAll(/mavrovde\/(viafrei[A-Za-z0-9_.-]*)/g)) {
        named += 1;
        expect(allowed.has(m[1]!), `${f}: mavrovde/${m[1]}`).toBe(true);
      }
    }
    // PRECONDITION: the sweep read the templates that do name a repository (structured-data.ts, connect-prompts.ts).
    expect(named).toBeGreaterThanOrEqual(PUBLIC_REPOS.length);
  });
});

describe("§ 5 DDG identity (#379 PR-07)", () => {
  const full = { IMPRESSUM_NAME: "N", IMPRESSUM_STREET: "S", IMPRESSUM_CITY: "C", IMPRESSUM_EMAIL: "e@example.invalid" };

  it("reads the four required names and the optional ones", () => {
    const id = readIdentity({ ...full, IMPRESSUM_PHONE: " " });
    expect(id.phone).toBeUndefined();
    expect(id.authority).toBe("die Landesdatenschutzbehörde am Sitz des Verantwortlichen");
    expect(id.contactEmail).toBe("e@example.invalid");
  });

  for (const k of REQUIRED_IDENTITY) {
    it(`a missing ${k} is a 500, never a half page`, () => {
      const env = { ...full, [k]: "" };
      expect(() => readIdentity(env)).toThrow(MissingIdentity);
      const r = identityOrError(env);
      expect(r).toBeInstanceOf(Response);
      expect((r as Response).status).toBe(500);
    });
  }

  it("no e-mail address or phone number is committed in the web package", () => {
    const files = execFileSync("git", ["ls-files", "--others", "--cached", "--exclude-standard", "src", "e2e", "scripts"], { cwd: WEB, encoding: "utf8" })
      .split("\n")
      .filter((f) => f !== "" && !f.endsWith(".png"));
    for (const f of files) {
      const text = readFileSync(join(WEB, f), "utf8");
      expect(text.match(/[\w.+-]+@(?!example\.invalid)[\w-]+\.[a-z]{2,}/gi) ?? [], f).toEqual([]);
      expect(text, f).not.toMatch(/\+49[\s\d]{6,}/);
    }
  });
});

describe("claims (#144), in every live language", () => {
  const catalogues = LIVE_LANGS.map((l) => `src/i18n/${l}.json`);
  const sources = [...catalogues, "src/layouts/BusinessPage.astro", "src/layouts/ConnectPage.astro", "src/layouts/DevelopersPage.astro"];
  it("no page names a restricted feed", () => {
    for (const f of sources) expect(readFileSync(join(WEB, f), "utf8"), f).not.toMatch(/bab_messages|ald_14d|bahnpark/i);
  });
  // The fuel and price words of each of the seven languages: the business page
  // offers no fuel data and names no price (MTS-K is consumer information only).
  const FUEL = /MTS-K|Kraftstoff|Sprit\b|Benzin|Diesel|\bfuel|petrol|топлив|бензин|дизел|горив|пальн|carburan|motorin|benzin|yakıt|akaryakıt|€|\bEUR\b/i;
  for (const l of LIVE_LANGS) {
    it(`${l}: the business page names no fuel price, no MTS-K and no price figure`, () => {
      const cat = JSON.parse(readFileSync(join(WEB, `src/i18n/${l}.json`), "utf8")) as { bizPage: Record<string, unknown> };
      // #992: the licence table's words are nested (`bizPage.lic.<class>.name`), so every string under bizPage is read
      const strings = (o: unknown, at: string): [string, string][] =>
        typeof o === "string" ? [[at, o]] : o !== null && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => strings(v, `${at}.${k}`)) : [];
      const read = strings(cat.bizPage, "bizPage");
      expect(read.length).toBeGreaterThan(30);
      for (const [k, v] of read) expect(v, `${l} ${k}`).not.toMatch(FUEL);
    });
  }
});

describe("sitemap (#380)", () => {
  it("lists every page but the 404 in every reviewed language, with alternates", () => {
    const xml = sitemapXml();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toHaveLength((PAGES.length - 1) * LIVE_LANGS.length);
    expect(xml).not.toMatch(/\/404/);
    expect(xml).toContain('hreflang="x-default"');
    // one catalogue per live language, and no stray one
    expect(readdirSync(join(WEB, "src", "i18n")).filter((f) => f.endsWith(".json")).sort()).toEqual([...LIVE_LANGS].map((l) => `${l}.json`).sort());
  });
});
