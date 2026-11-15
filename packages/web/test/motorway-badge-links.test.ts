/**
 * #945 in the shell:
 *
 *  - AC 3: a sweep over every fragment the shell embeds, from the real digest,
 *    in every site language: each motorway-badge link (`a.shield`) leads to a
 *    motorway page of the site's route map in the fragment's language — zero
 *    404s — carries its accessible name with the number, and a motorway page
 *    never links its own badge;
 *  - the shell's own badge (the hero's Wegweiser) is drawn by the same
 *    renderer, linked only for a registered motorway, and its name is in the
 *    site catalogue of every language (AC 4);
 *  - the badge link's look: the class vocabulary carries it, the stylesheet
 *    styles hover only and adds no colour (AC 5's contrast gate is unchanged).
 */
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MOTORWAY_REGISTER as INGEST_REGISTER } from "@viafrei/ingest";
import { all, first, text as nodeText, type El } from "@viafrei/design/testing";
import { startRealDigest } from "../e2e/real-digest.js";
import { t } from "../src/i18n/index.js";
import { resolveMotorwayPage } from "../src/lib/motorway-page.js";
import { MOTORWAY_REGISTER, motorwayPageAt } from "../src/site/motorways.js";
import { exitSlug } from "../src/site/slug.js";
import { POPULAR_PLACES } from "../src/site/places.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

const ROOT = new URL("../../../", import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, ROOT), "utf8");

const TILES = ["reports", "roads", "charging", "lorry", "carparks", "lifts", "fuel", "transit", "punctuality", "jams", "station"];
const ROADS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A34", "A57", "A61"];

/** Every fragment the shell embeds in one language; a motorway page names its road. */
function fragments(l: string): { readonly url: string; readonly self: string | null }[] {
  const plain = (url: string) => ({ url, self: null });
  return [
    ...TILES.map((x) => plain(`/internal/tiles/${x}?lang=${l}`)),
    plain(`/internal/tiles/fuel?lang=${l}&view=board`),
    plain(`/internal/news/traffic?lang=${l}`),
    plain(`/internal/motorway/index?lang=${l}`),
    ...ROADS.map((r) => ({ url: `/internal/motorway/${r}?lang=${l}`, self: r })),
    ...ROADS.map((r) => ({ url: `/internal/motorway/${r}/around?lang=${l}&at=ags%3A05315000&r=25`, self: r })),
    ...[...POPULAR_PLACES.slice(0, 6).map((p) => `ags%3A${p.ags}`), "ags%3A09564000", "pt%3A50.94%2C6.96"].map((at) => plain(`/internal/place/cards?at=${at}&lang=${l}`)),
  ];
}

let digest: Awaited<ReturnType<typeof startRealDigest>>;
/** The digest's register — the motorway pages the site serves (`/internal/motorway/list`, what the sitemap reads). */
let register: readonly string[] = [];
beforeAll(async () => {
  digest = await startRealDigest();
  register = all(await (await fetch(`${digest.url}/internal/motorway/list`)).text(), "a").map(nodeText);
}, 60_000);
afterAll(async () => {
  await digest.close();
});

/**
 * #1048 (#998, the lead's decision on the issue): a crossing on the crossings card links the OTHER motorway's page
 * centred on the interchange (`/<lang>/autobahn/<road>/exit-…`). Such a link is accepted only (a) inside the crossings
 * card, (b) as a page of the site in the fragment's language that the shell serves as a page — no 301, no 404 — and
 * (c) at the SHARED junction: the other road's page centred there lists the host road on its own crossings card (both
 * roads list the interchange). #1032: a related motorway's badge (a spur, a bridged interruption) is accepted at
 * that road's junction when its page lists the host among ITS related motorways — the relation holds on both roads. Everywhere else a badge links the road's own page.
 */
const EXIT_LINK = /^\/([a-z]{2})\/autobahn\/(a[1-9][0-9]{0,2})\/(exit-[a-z0-9]+(?:-[a-z0-9]+)*)$/;
/** #1032: the badge is a related motorway's (a spur, a bridged interruption), not a crossing's. */
const inRelatedRow = (a: El): boolean => {
  for (let p = a.parent; p !== null; p = p.parent) if ((p.attrs["class"] ?? "").split(/\s+/u).includes("mwrel__row")) return true;
  return false;
};
const onCrossingsCard = (a: El): boolean => {
  for (let p = a.parent; p !== null; p = p.parent) if (p.attrs["id"] === "mwk-crossings") return true;
  return false;
};
const served = new Map<string, Promise<boolean>>();
/** Whether the shell serves the other road's centred page as a PAGE in that language (no 301 to another spelling, no 404). */
function servedAsPage(lang: string, road: string, segment: string): Promise<boolean> {
  const key = `${lang}/${road}/${segment}`;
  let p = served.get(key);
  if (p === undefined) {
    p = resolveMotorwayPage(lang as Lang, road.toLowerCase(), segment, { baseUrl: digest.url, timeoutMs: 20_000 }).then((r) => r.kind === "page" && r.path === `/${lang}/autobahn/${road.toLowerCase()}/${segment}`);
    served.set(key, p);
  }
  return p;
}
const pages = new Map<string, Promise<string>>();
const roadPage = (road: string): Promise<string> => {
  let p = pages.get(road);
  if (p === undefined) {
    p = fetch(`${digest.url}/internal/motorway/${road}?lang=de`).then((r) => r.text());
    pages.set(road, p);
  }
  return p;
};
/**
 * The shared-junction rule: on `road`'s own page, the junction list row whose exit slug IS `segment` (its number and
 * name, the German type word stripped: the slug the shell reads back), and that junction's row on the crossings card
 * names `host`. Both roads list the interchange.
 */
async function sharedJunction(road: string, segment: string, host: string, related = false): Promise<boolean> {
  const html = await roadPage(road);
  const row = all(html, "li").find((li) => {
    if (!/^mw-j-\d+$/.test(li.attrs["id"] ?? "")) return false;
    const no = first(li, "span.motorway__no");
    // #1026: a junction with a name is the link to its own page, `<a translate="no">`; the rest stay a span
    const name = first(li, 'span[translate="no"]') ?? first(li, 'a[translate="no"]');
    return name !== null && exitSlug({ no: no === null ? null : nodeText(no), name: nodeText(name).replace(/^(?:AS|AK|AD) /u, "") }) === segment;
  });
  if (row === undefined) return false;
  // #1032: a related motorway's link — the other road's page lists the host among ITS related motorways (the relation
  // is one rule, derived on both roads), at a junction that page lists
  if (related) return all(html, "li.mwrel__row").some((li) => all(li, "a.shield").some((b) => nodeText(b) === host));
  const crossing = first(html, `#mwc-${(row.attrs["id"] ?? "").slice("mw-j-".length)}`);
  return crossing !== null && all(crossing, "a.shield").some((b) => nodeText(b) === host);
}
/** Why a junction-centred badge link is refused (null: accepted). `host`: the road whose page carries the badge. */
async function junctionLinkProblem(a: El, lang: string, host: string | null): Promise<string | null> {
  const href = a.attrs["href"] ?? "";
  const m = EXIT_LINK.exec(href);
  if (m === null) return "not a junction link";
  if (!onCrossingsCard(a)) return "a junction link outside the crossings card";
  const road = nodeText(a);
  if (m[1] !== lang || m[2] !== road.toLowerCase() || !register.includes(road)) return "not the badge's road in this language";
  if (host === null) return "a crossings card with no host road";
  if (!(await servedAsPage(lang, road, m[3]!))) return "the centred page is not served as a page (301/404)";
  if (!(await sharedJunction(road, m[3]!, host, inRelatedRow(a)))) return `not the shared junction: ${road} at ${m[3]!} does not list ${host}`;
  return null;
}

describe("AC 3: every motorway-badge link of every fragment leads to a page of the site", () => {
  it("in every language: a registered motorway's page in that language, named, never the page's own road", async () => {
    let links = 0;
    let plain = 0;
    let junction = 0;
    const bad: string[] = [];
    for (const l of LIVE_LANGS)
      for (const f of fragments(l)) {
        const res = await fetch(digest.url + f.url);
        if (res.status !== 200) throw new Error(`${f.url} answered ${String(res.status)}`);
        const html = await res.text();
        for (const a of all(html, "a.shield")) {
          links += 1;
          const href = a.attrs["href"] ?? "";
          const road = nodeText(a);
          const page = motorwayPageAt(href);
          if (page === null || page.lang !== l || page.road !== road || !register.includes(road)) {
            const why = await junctionLinkProblem(a, l, f.self);
            if (why === null) junction += 1;
            else bad.push(`${f.url}: ${road} -> ${href} (${why})`);
          }
          if (!(a.attrs["aria-label"] ?? "").startsWith(road)) bad.push(`${f.url}: ${road} unnamed`);
          if (road === f.self) bad.push(`${f.url}: links its own badge`);
        }
        // and the other way round (AC 1): a registered motorway's badge is a link everywhere but on its own page
        for (const s of all(html, "span.shield")) {
          plain += 1;
          if (register.includes(nodeText(s)) && nodeText(s) !== f.self) bad.push(`${f.url}: ${nodeText(s)} is not linked`);
        }
      }
    expect(register.length).toBeGreaterThan(5);
    expect(bad).toEqual([]);
    // the sweep read badges at all: a sweep over no link reports clean
    expect(links).toBeGreaterThan(LIVE_LANGS.length * 10);
    expect(plain).toBeGreaterThan(0);
    // #1048: the crossings card's junction-centred links were judged at all
    expect(junction).toBeGreaterThan(LIVE_LANGS.length);
  }, 600_000);

  it("#1048: over the WHOLE register, every crossings-card link is a page served as such at the shared junction", async () => {
    let judged = 0;
    const bad: string[] = [];
    for (const road of register) {
      const html = await (await fetch(`${digest.url}/internal/motorway/${road}?lang=de`)).text();
      const card = first(html, "#mwk-crossings");
      if (card === null) continue;
      for (const a of all(card, "a.shield")) {
        if (motorwayPageAt(a.attrs["href"] ?? "") !== null) continue;
        judged += 1;
        const why = await junctionLinkProblem(a, "de", road);
        if (why !== null) bad.push(`${road}: ${nodeText(a)} -> ${a.attrs["href"] ?? ""} (${why})`);
      }
    }
    expect(judged, "no junction-centred link was judged: the sweep proves nothing").toBeGreaterThan(0);
    expect(bad).toEqual([]);
  }, 600_000);

  it("#1048: the judge can say no — an unrelated exit, a junction link off the crossings card, an unknown exit", async () => {
    const a1 = await (await fetch(`${digest.url}/internal/motorway/A1?lang=de`)).text();
    const real = all(first(a1, "#mwk-crossings")!, "a.shield").find((a) => EXIT_LINK.test(a.attrs["href"] ?? ""))!;
    expect(await junctionLinkProblem(real, "de", "A1")).toBeNull();
    const road = nodeText(real).toLowerCase();
    const plant = (href: string, onCard: boolean): El => {
      const html = `<section id="${onCard ? "mwk-crossings" : "mwk-roadworks"}"><ul><li><a class="shield" href="${href}">${nodeText(real)}</a></li></ul></section>`;
      return first(html, "a.shield")!;
    };
    // an exit of the same road that is no interchange with the A1 (the plain Anschlussstelle the place card links)
    expect(await junctionLinkProblem(plant(`/de/autobahn/${road}/exit-7-beispielort-sued-7`, true), "de", "A1")).toBe(`not the shared junction: ${nodeText(real)} at exit-7-beispielort-sued-7 does not list A1`);
    expect(await junctionLinkProblem(plant(real.attrs["href"]!, false), "de", "A1")).toBe("a junction link outside the crossings card");
    expect(await junctionLinkProblem(plant(`/de/autobahn/${road}/exit-999-nowhere`, true), "de", "A1")).toBe("the centred page is not served as a page (301/404)");
    expect(await junctionLinkProblem(plant(real.attrs["href"]!.replace("/de/", "/en/"), true), "de", "A1")).toBe("not the badge's road in this language");
  }, 120_000);

  it("the digest's register and the site's route map are one list", () => {
    expect([...INGEST_REGISTER].sort()).toEqual([...MOTORWAY_REGISTER].sort());
  });
});

describe("the shell's own badge and its words (AC 4)", () => {
  it("the hero's Wegweiser draws its route badge with the shared renderer, linked only for a registered motorway", () => {
    const src = read("packages/web/src/components/Sign.astro");
    expect(src).toContain("motorwayBadge(esc(road), {");
    expect(src).toContain("href: MOTORWAY_REGISTER.includes(road) ? motorwayPath(lang, road) : null,");
    expect(src).not.toMatch(/<span class="shield/);
  });

  it("every site language names the link, with the number as shown", () => {
    for (const l of LIVE_LANGS) {
      const name = t(l, "sign.badge", { road: "A8" });
      expect(name.startsWith("A8"), `${l}: ${name}`).toBe(true);
      expect(name.length, l).toBeGreaterThan("A8 – ".length);
    }
  });
});

describe("the look (AC 5): hover and focus only, no new colour", () => {
  it("a.shield's rules set no colour, background or border", () => {
    const css = read("packages/web/src/styles/site.css");
    const rules = [...css.matchAll(/^a\.shield[^{]*\{([^}]*)\}/gm)].map((m) => m[1] ?? "");
    expect(rules.length).toBeGreaterThanOrEqual(2);
    for (const r of rules) expect(r).not.toMatch(/(?:^|;)\s*(?:color|background|border|box-shadow|outline)\s*:/);
  });
});
