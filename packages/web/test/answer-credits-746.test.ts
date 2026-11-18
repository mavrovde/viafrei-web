/**
 * 2.6.19 (#746 with #1193, a card prints a credit line once): a home moment's second and third answers credit their
 * full Quelle line (#746), and most of it is the line the answer above them on the same card already prints in full.
 * `Answer.astro`'s `above` names those publishers in one short line instead of printing their lines again, so every
 * answer still names every source of its Quelle line and keeps a credit `li` (answers.e2e.ts). A line that must stay
 * whole (`staysWhole`: a condition, or an ALWAYS_SHOWN provider, Tankerkönig among them, FS5) is never replaced.
 *
 * On the examples page every card is one answer, so nothing stands above it; there `foldCredits` reads the list by
 * #1120's sources rule (`splitCredits`, `CreditList.astro`): the lines a person must see stay whole, the rest sit in one
 * `<details class="sources">` whose summary names every publisher inside it (FS3).
 */
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { FOLD_UNRULED_CREDITS, alwaysShownText, shortSource } from "@viafrei/design";
import { all, first, text } from "@viafrei/design/testing";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { t, type MessageKey } from "../src/i18n/index.js";
import { splitCredits, staysWhole } from "../src/lib/fold-credits.js";
import { MOMENTS, answerKey, type MomentAnswer } from "../src/site/examples.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILE = "/src/components/Answer.astro";
let vite: ViteDevServer | undefined;
let container: AstroContainer;

beforeAll(async () => {
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  vite = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  container = await AstroContainer.create();
}, 30_000);

afterAll(async () => {
  await vite?.close();
});

const render = async (answer: MomentAnswer, msg: MessageKey, above?: readonly string[], foldCredits = false): Promise<string> => {
  const mod = (await vite!.ssrLoadModule(FILE)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
  return container.renderToString(mod.default, { props: { lang: "de", msg, answer, source: "home", foldCredits, ...(above === undefined ? {} : { above }) } });
};
type Credit = (typeof catalogue.credits)[number];
const byId = (ids: readonly string[]): Credit[] => ids.map((id) => catalogue.credits.find((c) => c.id === id)!);
const line = (id: string): string => byId([id])[0]!.text;
const lis = (html: string) => all(html, "ul.qa-answer__credits li");
const listed = (html: string): string => text(first(html, "ul.qa-answer__credits")!);
const head = (id: string): string => line(id).slice(0, 25);
const jam = MOMENTS.find((m) => m.key === "jam")!;
const a3 = jam.answers[2]!;

describe("#746: an answer names the publishers whose lines stand above it on the card", () => {
  const shared = a3.credits.filter((id) => jam.answers[1]!.credits.includes(id));
  // the shared lines that may be only named; the rest of `shared` must stay whole (`staysWhole`)
  const nameable = shared.filter((id) => !staysWhole(byId([id])[0]!));

  it("the jam moment's third answer shares lines with its second (the case this exists for)", () => {
    expect(nameable.length).toBeGreaterThan(0);
    expect(nameable.length).toBeLessThan(shared.length);
  });

  it("without `above`, every credit is its full register line", async () => {
    const html = await render(a3, answerKey(jam, 3));
    expect(html).not.toContain("qa-answer__again");
    for (const id of a3.credits) expect(listed(html), id).toContain(head(id));
    expect(lis(html)).toHaveLength(a3.credits.length);
  });

  it("with `above`, a shared line is named once by its publisher, the rest stays whole, and the list keeps a line", async () => {
    const html = await render(a3, answerKey(jam, 3), jam.answers[1]!.credits);
    const again = first(html, "li.qa-answer__again");
    expect(again, "the short line").not.toBeNull();
    const said = text(again!);
    expect(said.startsWith(t("de", "day.answer.again"))).toBe(true);
    for (const id of nameable) expect(said, id).toContain(shortSource(line(id)));
    const own = a3.credits.filter((id) => !nameable.includes(id));
    for (const id of own) expect(listed(html), id).toContain(head(id));
    expect(lis(html).length).toBe(own.length + 1);
  });

  it("every nameable credit above leaves exactly one short line, never an empty list", async () => {
    const ans: MomentAnswer = { ...a3, credits: nameable };
    const html = await render(ans, answerKey(jam, 3), nameable);
    expect(lis(html)).toHaveLength(1);
  });

  // data-steward on 2.6.19: a line that must stay whole is printed in full beside every answer it credits, even when it
  // stands above. One line per class the ruling names; each id below matches its class (pinned in the next test).
  const WHOLE: readonly (readonly [string, string])[] = [
    ["OpenStreetMap", "osm"],
    ["ODbL (no OSM)", "flix_transit"],
    ["Tankerkönig/MTS-K (FS5)", "tankerkoenig"],
    ["Toll Collect", "toll_collect_sid"],
    ["GeoNutzV", "mobilithek_bab_messages"],
    ["DWD", "dwd"],
    ["CC BY 3.0", "duisburg_umweltzone"],
    ["a condition of use, no ALWAYS_SHOWN provider", "mobilithek_traffic_bw"],
  ];

  it("each class's example line is what its row says (the cases below test what they name)", () => {
    const [osm, odbl, tk, toll, geo, dwd, ccby, cond] = WHOLE.map(([, id]) => byId([id])[0]!);
    expect(osm!.text).toMatch(/OpenStreetMap/u);
    expect(odbl!.text).toMatch(/ODbL|Open Database License/u);
    expect(odbl!.text).not.toMatch(/OpenStreetMap/u);
    expect(tk!.text).toMatch(/Tankerkönig|MTS-K/u);
    expect(toll!.text).toMatch(/Toll Collect/u);
    expect(geo!.text).toMatch(/GeoNutzV/u);
    expect(dwd!.text).toMatch(/Deutscher Wetterdienst/u);
    expect(ccby!.text).toMatch(/CC BY 3\.0/u);
    expect(cond!.condition).not.toBeNull();
    expect(alwaysShownText(cond!.text)).toBe(false);
  });

  for (const [what, id] of WHOLE) {
    it(`a ${what} line in \`above\` keeps its full CreditItem in the later answer`, async () => {
      const ans: MomentAnswer = { ...a3, credits: [id, ...nameable] };
      const html = await render(ans, answerKey(jam, 3), ans.credits);
      const whole = all(html, 'ul.qa-answer__credits li[lang="de"]').map((li) => text(li));
      expect(whole.some((t) => t.includes(head(id))), id).toBe(true);
      const again = first(html, "li.qa-answer__again");
      expect(again, "the plain shared lines are still only named").not.toBeNull();
      expect(text(again!), id).not.toContain(shortSource(line(id)));
      // the plain shared lines are still only named (the rule is not "never name anything")
      expect(lis(html)).toHaveLength(2);
    });
  }

  it("staysWhole on fixed register ids: OSM and the DWD stay whole, a plain CC BY 4.0 line does not", () => {
    expect(staysWhole(byId(["osm"])[0]!)).toBe(true);
    expect(staysWhole(byId(["dwd"])[0]!)).toBe(true);
    expect(staysWhole(byId(["mobilithek_bab_messages"])[0]!)).toBe(true);
    const vbb = byId(["vbb_rt"])[0]!;
    expect(vbb.text).toContain("CC BY 4.0");
    expect(staysWhole(vbb)).toBe(false);
    expect(splitCredits(byId(["osm", "dwd", "vbb_rt", "vrn_rt"]))).toEqual({ shown: byId(["osm", "dwd"]), folded: byId(["vbb_rt", "vrn_rt"]) });
  });

  it("staysWhole keeps a line of an unruled licence class whole (FS8), so it never folds and is never only named", async () => {
    // plant in both module graphs: this file's, and the one vite renders Answer.astro from
    const ssr = ((await vite!.ssrLoadModule("@viafrei/design")) as { FOLD_UNRULED_CREDITS: RegExp[] }).FOLD_UNRULED_CREDITS;
    const planted = [...new Set([FOLD_UNRULED_CREDITS as RegExp[], ssr])];
    const vbb = byId(["vbb_rt"])[0]!;
    expect(staysWhole(vbb)).toBe(false);
    for (const p of planted) p.push(/Verkehrsverbund Berlin-Brandenburg/u);
    try {
      expect(staysWhole(vbb)).toBe(true);
      expect(splitCredits(byId(["vbb_rt", "vrn_rt", "autobahn"])).shown.map((c) => c.id)).toContain("vbb_rt");
      const ans: MomentAnswer = { ...a3, credits: ["vbb_rt", ...nameable] };
      const html = await render(ans, answerKey(jam, 3), ans.credits);
      expect(all(html, 'ul.qa-answer__credits li[lang="de"]').map((li) => text(li)).some((t) => t.includes(head("vbb_rt")))).toBe(true);
    } finally {
      for (const p of planted) p.pop();
    }
    expect(staysWhole(vbb)).toBe(false);
  });

  it("staysWhole: each ALWAYS_SHOWN provider alone, and a condition alone, keep a line whole; a plain line does not", () => {
    // Mutant pins: each case holds exactly one reason, so dropping any ALWAYS_SHOWN pattern or the condition check fails one.
    const plain = { condition: null, text: "Verkehrsdaten: Beispiel GmbH, dl-de/by-2-0" };
    expect(staysWhole(plain)).toBe(false);
    for (const t of ["OpenStreetMap-Mitwirkende", "Open Database License", "ODbL 1.0", "Tankerkönig", "MTS-K", "Toll Collect GmbH", "GeoNutzV", "Deutscher Wetterdienst", "CC BY 3.0"]) {
      expect(staysWhole({ condition: null, text: `Daten: ${t}` }), t).toBe(true);
    }
    expect(staysWhole({ condition: "Nur zur Information", text: plain.text })).toBe(true);
    expect(staysWhole({ condition: "", text: plain.text })).toBe(true);
  });
});

describe("#746 on the examples page: an answer's credit lines by #1120's sources rule", () => {
  it("the lines a person must see stay, the rest fold, and one foldable line is never folded alone", () => {
    const lines = byId(a3.credits);
    const { shown, folded } = splitCredits(lines);
    expect(folded.length).toBeGreaterThanOrEqual(2);
    expect(shown.every(staysWhole)).toBe(true);
    expect(folded.some(staysWhole)).toBe(false);
    expect([...shown, ...folded].map((c) => c.id).sort()).toEqual([...a3.credits].sort());
    const one = lines.filter((c) => !staysWhole(c)).slice(0, 1);
    expect(splitCredits(one)).toEqual({ shown: one, folded: [] });
    expect(splitCredits(byId(["osm", "tankerkoenig"])).folded).toEqual([]);
  });

  it("folded, every line is still in the list's HTML, the summary names every publisher inside, and the list keeps a line", async () => {
    const html = await render(a3, answerKey(jam, 3), undefined, true);
    const { shown, folded } = splitCredits(byId(a3.credits));
    const fold = first(html, "ul.qa-answer__credits li.credits__more details.sources");
    expect(fold, "one disclosure inside the list").not.toBeNull();
    const summary = text(first(fold!, "summary")!);
    for (const c of folded) expect(summary, c.id).toContain(shortSource(c.text));
    const inside = text(first(fold!, "ul.credits")!);
    for (const c of folded) expect(inside, c.id).toContain(c.text.slice(0, 25));
    for (const c of shown) expect(listed(html), c.id).toContain(c.text.slice(0, 25));
    expect(lis(html).length).toBe(a3.credits.length + 1);
  });

  it("without `foldCredits` nothing folds", async () => {
    expect(await render(a3, answerKey(jam, 3))).not.toContain("credits__more");
  });
});
