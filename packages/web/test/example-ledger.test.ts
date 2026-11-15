/**
 * The examples page holds every example ever added (#747): the ledger
 * (`src/site/example-ledger.ts`) is append-only, and each of its keys must be
 * an entry the page renders, under the anchor it is linked by. The rendered
 * pages are held to the same list by `e2e/site.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { ARCHIVE_DOMAINS, MOMENT_DOMAIN, allEntries, anchorFor, archiveEntries, isTankerkoenig, ledgerKey } from "../src/site/example-archive.js";
import { EXAMPLE_LEDGER, RETIRED_FUEL, isRetired } from "../src/site/example-ledger.js";
import { BUSINESS_ASKS } from "../src/site/business-asks.js";
import { FUEL_ASKS, HOME_FUEL_ASKS, MOMENTS } from "../src/site/examples.js";
import { CONNECT_EXAMPLES, LIVE_EXAMPLES } from "../src/site/live-examples.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (f: string): string => readFileSync(join(SRC, f), "utf8");

describe("the examples ledger (#747)", () => {
  const keys = archiveEntries().map(ledgerKey);
  const all = allEntries().map(ledgerKey);
  const tankerkoenig = allEntries().filter(isTankerkoenig).map(ledgerKey);
  /** Where each key is rendered: the home's fuel requests and the connect page's cards, by the lists the pages map over. */
  const onHome = HOME_FUEL_ASKS.map((f) => `fuel:${f.key}`);
  const onConnect = CONNECT_EXAMPLES.map((e) => `card:${e.key}`);

  it("every ledger key is an example on the examples page — or a Tankerkönig example, which the page never shows (Verdict 2)", () => {
    const missing = EXAMPLE_LEDGER.filter((k) => !keys.includes(k) && !tankerkoenig.includes(k));
    expect(missing, `in the ledger but not on the examples page — an example may leave the home or the connect page, never this page: ${missing.join(", ")}`).toEqual([]);
    expect(EXAMPLE_LEDGER.filter((k) => !all.includes(k)), "a ledger key with no example in source").toEqual([]);
  });

  it("every example in source is in the ledger — a new example is added to it in the same change", () => {
    const unlisted = all.filter((k) => !EXAMPLE_LEDGER.includes(k));
    expect(unlisted, `add to src/site/example-ledger.ts: ${unlisted.join(", ")}`).toEqual([]);
  });

  it("lists each key once, and the page renders each once", () => {
    expect(new Set(EXAMPLE_LEDGER).size).toBe(EXAMPLE_LEDGER.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers every moment question, every fuel request, every connect card and the business page's six former questions", () => {
    expect(all.filter((k) => k.startsWith("moment:"))).toHaveLength(MOMENTS.reduce((n, m) => n + m.answers.length, 0));
    expect(all.filter((k) => k.startsWith("fuel:"))).toHaveLength(FUEL_ASKS.length);
    expect(all.filter((k) => k.startsWith("card:"))).toHaveLength(LIVE_EXAMPLES.length);
    expect(all.filter((k) => k.startsWith("business:")).sort()).toEqual(BUSINESS_ASKS.map((a) => `business:u${a.n}`));
    expect(BUSINESS_ASKS).toHaveLength(6);
    expect(all.length).toBe(69);
    expect(tankerkoenig).toHaveLength(7);
    expect(keys.length, "the examples page: every example but the seven Tankerkönig ones").toBe(62);
  });

  it("retires a fuel example only with a dated reason, and a retired key is rendered nowhere (Verdict 2, condition 7)", () => {
    expect(Object.keys(RETIRED_FUEL).sort()).toEqual(["card:fuelland", "fuel:leipzig", "fuel:muenchen", "fuel:nuernberg"]);
    for (const [k, why] of Object.entries(RETIRED_FUEL)) {
      expect(EXAMPLE_LEDGER, k).toContain(k);
      expect(tankerkoenig, `${k}: only a Tankerkönig example is retired here`).toContain(k);
      expect(why, k).toMatch(/^\d{4}-\d{2}-\d{2}: \S/);
      expect(keys, `${k}: on the examples page`).not.toContain(k);
      expect(onHome, `${k}: on the home`).not.toContain(k);
      expect(onConnect, `${k}: on the connect page`).not.toContain(k);
    }
    // every Tankerkönig example is rendered on the home or /connect, or retired — never left in between
    for (const k of tankerkoenig) expect(onHome.includes(k) || onConnect.includes(k) || isRetired(k), k).toBe(true);
  });

  it("renders at most three Tankerkönig examples on the whole site, at three places, one station each — none on the examples page", () => {
    const rendered = [...onHome, ...onConnect].filter((k) => tankerkoenig.includes(k));
    expect(rendered).toEqual(["fuel:goerlitz", "card:fuelcity", "card:fuelroad"]);
    expect(rendered.length).toBeLessThanOrEqual(3);
    expect(keys.filter((k) => tankerkoenig.includes(k)), "a Tankerkönig example on the examples page").toEqual([]);
    const names = [
      ...HOME_FUEL_ASKS.map((f) => f.answer.names ?? {}),
      ...CONNECT_EXAMPLES.filter((e) => e.credits.includes("tankerkoenig")).map((e) => e.names ?? {}),
    ];
    // condition 4: one answer each — exactly one station named, at three different places (the address's town)
    for (const n of names) expect(Object.keys(n).sort(), JSON.stringify(n)).toEqual(["address", "station"]);
    const towns = names.map((n) => /\d{5} (.+)$/.exec(n["address"] ?? "")?.[1]);
    expect(new Set(towns).size, towns.join(", ")).toBe(3);
  });

  it("the business page's six former questions stay said, in every language", () => {
    for (const a of BUSINESS_ASKS) {
      for (const l of LIVE_LANGS) {
        expect(t(l, `bizPage.u${a.n}q` as never).length, `${l} u${a.n}q`).toBeGreaterThan(3);
        const said = t(l, a.answerKey, { ...a.answer.values, ...a.answer.names });
        expect(said, `${l} u${a.n}a`).not.toMatch(/\{[a-zA-Z0-9]+\}/u);
      }
    }
  });

  it("the ledger refuses a removed example (mutant, run inline)", () => {
    const without = archiveEntries().filter((e) => !(e.kind === "card" && e.card.key === "lorry")).map(ledgerKey);
    expect(EXAMPLE_LEDGER.filter((k) => !without.includes(k) && !tankerkoenig.includes(k))).toEqual(["card:lorry"]);
  });

  it("the cap refuses a fourth Tankerkönig example and an un-retired one (mutants, run inline)", () => {
    const unretired = [...onHome, ...onConnect, "card:fuelland"].filter((k) => tankerkoenig.includes(k));
    expect(unretired.length).toBeGreaterThan(3);
    // a retired key that is not a fuel example would fail the retirement test's own assertion
    expect(tankerkoenig).not.toContain("card:lorry");
  });

  it("each entry is rendered under the anchor its key names, grouped in the page's domain order", () => {
    for (const e of archiveEntries()) expect(anchorFor(ledgerKey(e)), ledgerKey(e)).toBe(e.id);
    const order = archiveEntries().map((e) => ARCHIVE_DOMAINS.indexOf(e.domain));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const m of MOMENTS) expect(ARCHIVE_DOMAINS).toContain(MOMENT_DOMAIN[m.key]);
    const page = read("layouts/ExamplesPage.astro");
    // the moments, the cards and the former business questions carry their entry's id; a fuel entry is never rendered here
    expect(page.match(/id=\{e\.id\}/g)?.length).toBe(3);
    expect(page).toContain('if (e.kind === "fuel") return null;');
    expect(page).toContain("ARCHIVE_DOMAINS.map((d) =>");
  });

  it("is reached from the home's moments and from the connect page", () => {
    expect(read("components/Day.astro")).toContain('<a href={pathFor("examples", lang)}>{t(lang, "day.allExamples")}</a>');
    expect(read("layouts/ConnectPage.astro")).toContain('<a href={pathFor("examples", lang)}>{t(lang, "connectPage.allExamples")}</a>');
    // #892: the English word in every language
    for (const l of LIVE_LANGS) expect(pathFor("examples", l)).toBe(`/${l}/examples`);
  });

  it("the fuel section is one sentence linking to the home and the connect page, and the page has no robots directive", () => {
    const page = read("layouts/ExamplesPage.astro");
    expect(page).toMatch(/d === "fuel" \? \(\s*<p class="examples__fuelnote">/);
    expect(page).not.toContain("fuelasks");
    expect(page).toContain('href={`${pathFor("start", lang)}#fuel-asks`}');
    expect(page).toContain('href={`${connect}#answers`}');
    const day = read("components/Day.astro");
    const at = day.indexOf('id="fuel-asks"');
    expect(at).toBeGreaterThan(0);
    // FS5: the element carrying the anchor is a section, never a fold
    expect(day.lastIndexOf("<section", at)).toBeGreaterThan(day.lastIndexOf("<details", at));
    // FS5: every fuel request is a recorded Tankerkönig price, which stands open on every width and never in a fold
    for (const f of HOME_FUEL_ASKS) expect(f.answer.credits, f.key).toContain("tankerkoenig");
    for (const l of LIVE_LANGS) {
      const note = t(l, "examplesPage.fuelNote", { home: "<H>", connect: "<C>" });
      expect(note.split("<H>").length, l).toBe(2);
      expect(note.split("<C>").length, l).toBe(2);
      expect(note, l).not.toMatch(/\d/);
    }
    expect(page).toContain('<Base lang={lang} page="examples">');
    expect(page).not.toMatch(/robots=/);
    for (const l of LIVE_LANGS) for (const d of ARCHIVE_DOMAINS) expect(t(l, `examplesPage.domain.${d}` as never).length, `${l} ${d}`).toBeGreaterThan(3);
  });
});
