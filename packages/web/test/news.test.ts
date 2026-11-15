/**
 * The News page (#588): the entries, the credits flag, the CHANGELOG drafts,
 * the Atom feed, the page map and the digest fragment check.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { draftsFrom, releaseBlock, renderDrafts } from "../scripts/news-draft.js";
import { planReport, renderPlanReport, type GhIssue } from "../scripts/news-plans.js";
import { atomFeed, berlinDay, feedPath, feedResponse } from "../src/news/atom.js";
import { CREDITS_BEFORE_NEWS, entriesFor, NEWS_DRAFTS, HOME_NEWS, HOME_NEWS_COUNT, homeNewsFor, NEWS_ENTRIES, NEWS_KINDS, newestNewsDate, uncoveredCredits, type NewsEntry } from "../src/news/entries.js";
import { t } from "../src/i18n/index.js";
import { fetchNewsTraffic } from "../src/lib/news.js";
import { NEWS_TEXTS } from "../src/news/i18n/index.js";
import { LIVE_LANGS, pageAt, pathFor } from "../src/site/pages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CREDIT_IDS = catalogue.credits.map((c) => c.id);

describe("the entries (#588)", () => {
  it("every credits id is named by an entry or was live before the page — a new integration is FLAGGED; draft it with `npx tsx packages/web/scripts/news-draft.ts`", () => {
    expect(uncoveredCredits(CREDIT_IDS)).toEqual([]);
  });

  it("flags a credits id that ships without an entry, and only that one", () => {
    expect(uncoveredCredits([...CREDIT_IDS, "planted_new_feed"])).toEqual(["planted_new_feed"]);
    // and an entry naming it clears the flag
    expect(uncoveredCredits([...CREDIT_IDS, "planted_new_feed"], [...NEWS_ENTRIES, ...NEWS_DRAFTS, { ...NEWS_ENTRIES[0]!, id: "x", credits: ["planted_new_feed"] }])).toEqual([]);
  });

  it("a held draft is never rendered, yet it counts for the credit gate; its id is no live entry's", () => {
    const live = new Set(NEWS_ENTRIES.map((e) => e.id));
    for (const d of NEWS_DRAFTS) {
      expect(live.has(d.id), d.id).toBe(false);
      for (const c of d.credits) expect(CREDIT_IDS, `${d.id}: ${c}`).toContain(c);
    }
    for (const lang of ["de", "en", "ru", "bg", "uk", "ro", "tr"] as const) {
      const shown = new Set([...entriesFor(lang).map((e) => e.id), ...homeNewsFor(lang).map((e) => e.id)]);
      for (const d of NEWS_DRAFTS) expect(shown.has(d.id), `${lang}: ${d.id}`).toBe(false);
    }
    // the gate still flags a draft-only credit once the draft is gone
    for (const d of NEWS_DRAFTS) expect(uncoveredCredits(d.credits, NEWS_ENTRIES)).toEqual(d.credits.filter((c) => !CREDITS_BEFORE_NEWS.includes(c) && !NEWS_ENTRIES.some((e) => e.credits.includes(c))));
  });

  it("every entry's credits exist in the register, and the baseline lists no id an entry also claims", () => {
    for (const e of NEWS_ENTRIES) for (const c of e.credits) expect(CREDIT_IDS, `${e.id}: ${c}`).toContain(c);
    const claimed = new Set(NEWS_ENTRIES.flatMap((e) => e.credits));
    for (const id of CREDITS_BEFORE_NEWS) expect(claimed.has(id), id).toBe(false);
    for (const id of CREDITS_BEFORE_NEWS) expect(CREDIT_IDS, `${id} in the baseline is no longer a credits id`).toContain(id);
  });

  // cross-repo(viafrei): reads viafrei's CHANGELOG.md, the MCP server's release history; the catalogue it checks is generated in viafrei (scripts/generate-catalogue.ts) and arrives here as src/generated/*.json (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("ids are unique permalinks, dates are YYYY-MM-DD, kinds known, tools registered; a NEW entry's issue and release are named in the CHANGELOG", () => {
    const md = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    const tools = new Set(catalogue.tools.map((x) => x.name));
    expect(new Set(NEWS_ENTRIES.map((e) => e.id)).size).toBe(NEWS_ENTRIES.length);
    for (const e of NEWS_ENTRIES) {
      expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(NEWS_KINDS).toContain(e.kind);
      expect(tools.has(e.tool), `${e.id}: ${e.tool} is a registered tool`).toBe(true);
      if (e.kind === "plan") continue; // a plan has no release yet: its own rules are the next test
      expect(e.release, `${e.id}: a new entry names its release`).not.toBeNull();
      expect(e.credits.length, `${e.id}: a new entry credits its sources`).toBeGreaterThan(0);
      const block = releaseBlock(md, e.release!);
      // A patch cut writes no CHANGELOG block: the line's blocks are written once, at the milestone
      // close (owner 2026-10-26), where check_changelog.sh rule 7 refuses a tag without one. Until
      // then a patch of the OPEN line — the newest, its X.Y.0 block written, its own not yet — is accepted, and
      // this test checks the date and the issue once the block exists.
      const line = /^(\d+\.\d+)\.[1-9]\d*$/.exec(e.release!);
      const newest = /^## \[(\d+\.\d+)\.\d+\]/m.exec(md)?.[1];
      if (block === null && line !== null && line[1] === newest && releaseBlock(md, `${line[1]}.0`) !== null) continue;
      expect(block, `${e.id}: release ${e.release} is in the CHANGELOG`).not.toBeNull();
      expect(block!.date, `${e.id}: dated as its release`).toBe(e.date);
      // The house form is `(refs #N)` (changelog.d/README.md), and a hand-written block may say `(#N)`:
      // both name the issue; a bare `#N12` or `#N` inside prose does not.
      expect(block!.body, `${e.id}: the release names #${e.issue}`).toMatch(new RegExp(`\\((?:refs )?(?:#\\d+,\\s+)*#${e.issue}(?:,\\s+#\\d+)*\\)`));
    }
  });

  it("a plan promises no release and credits nothing — and the credits check accepts it with none", () => {
    const plans = NEWS_ENTRIES.filter((e) => e.kind === "plan");
    // the three the owner labelled `planned` on 2026-10-12 (#637, #623, #690); #637 shipped in 2.2.4
    // ("umweltzone-am-punkt" credits the Umweltbundesamt's register), so its plan is gone
    expect(plans.map((e) => e.issue).sort()).toEqual([623, 690]);
    expect(NEWS_ENTRIES.find((e) => e.credits.includes("uba_umweltzonen"))?.kind).toBe("new");
    for (const e of plans) {
      expect(e.release, e.id).toBeNull();
      expect(e.credits, e.id).toEqual([]);
      expect(Number.isInteger(e.issue) && e.issue > 0, e.id).toBe(true);
      // Greek closes a question with its own mark, written ";" (or U+037E) — #767
      for (const l of LIVE_LANGS) expect(e.text[l]?.ask, `${e.id} ${l}: a real question`).toMatch(l === "el" ? /[;\u037e]$/ : /\?$/);
    }
    // a plan with no credits neither trips the credits sweep nor needs a baseline row
    expect(uncoveredCredits(CREDIT_IDS, plans, CREDITS_BEFORE_NEWS).length).toBe(uncoveredCredits(CREDIT_IDS, [], CREDITS_BEFORE_NEWS).length);
    expect(uncoveredCredits(CREDIT_IDS)).toEqual([]);
  });

  it("a plan's feed entry says planned, no date, and carries no source line", () => {
    for (const l of LIVE_LANGS) {
      const xml = atomFeed(l);
      for (const e of entriesFor(l).filter((x) => x.kind === "plan")) {
        const entry = new RegExp(`<entry><id>[^<]*#${e.id}</id>[\\s\\S]*?</entry>`).exec(xml)?.[0] ?? "";
        expect(entry, `${l} ${e.id}`).toContain('<category term="plan"/>');
        expect(entry, `${l} ${e.id}`).not.toContain(`${t(l, "newsPage.sources")}:`);
        expect(entry, `${l} ${e.id}`).toContain(t(l, "newsPage.plannedNote"));
      }
    }
  });

  it("the home strip shows new entries only; plans stay on the News page", () => {
    const teaser = readFileSync(join(ROOT, "packages", "web", "src", "components", "NewsTeaser.astro"), "utf8");
    expect(teaser).toContain('.filter((e) => e.kind === "new")');
  });

  // Owner 2026-10-15: "there must be usually 7 news items, choose the most valuable integrations and features".
  it("the home strip's ranking names seven shipped entries, each once, and every language shows those seven in that order", () => {
    expect(HOME_NEWS_COUNT).toBe(7);
    expect(HOME_NEWS).toHaveLength(HOME_NEWS_COUNT);
    expect(new Set(HOME_NEWS).size).toBe(HOME_NEWS.length);
    for (const id of HOME_NEWS) expect(NEWS_ENTRIES.find((e) => e.id === id)?.kind, id).toBe("new");
    for (const l of LIVE_LANGS) expect(homeNewsFor(l).map((e) => e.id), l).toEqual([...HOME_NEWS]);
  });

  it("the home strip fills to seven with the newest others, never with a plan, and keeps its order", () => {
    const at = (id: string, date: string, kind: NewsEntry["kind"] = "new"): NewsEntry => ({ ...NEWS_ENTRIES[0]!, id, date, kind });
    const pool = [at("old", "2026-01-01"), at("ranked", "2026-02-01"), at("plan", "2026-12-01", "plan"), ...Array.from({ length: 8 }, (_, i) => at(`n${i}`, `2026-03-0${i + 1}`))];
    const ids = homeNewsFor("de", pool, ["ranked", "missing"]).map((e) => e.id);
    expect(ids).toEqual(["ranked", "n7", "n6", "n5", "n4", "n3", "n2"]);
    expect(homeNewsFor("de", [at("a", "2026-01-01"), at("plan", "2026-12-01", "plan")], [])).toHaveLength(1);
  });

  it("an entry is shown only in the languages it has text for — no fallback (#449)", () => {
    const one = { ...NEWS_ENTRIES[0]!, id: "only-de", date: "2099-01-01", text: { de: NEWS_ENTRIES[0]!.text.de! } };
    expect(entriesFor("de", [one]).map((e) => e.id)).toEqual(["only-de"]);
    expect(entriesFor("en", [one])).toEqual([]);
    // every shipped entry has every live language (the fifteen of #753 from news/i18n/<lang>.json)
    for (const e of NEWS_ENTRIES) for (const l of LIVE_LANGS) expect(e.text[l], `${e.id} ${l}`).toBeDefined();
  });

  it("a per-language News file names only entries that exist, each with a title, a body and an ask (#753)", () => {
    const ids = new Set(NEWS_ENTRIES.map((e) => e.id));
    for (const [lang, texts] of Object.entries(NEWS_TEXTS)) {
      for (const [id, x] of Object.entries(texts ?? {})) {
        expect(ids.has(id), `${lang}: ${id} is no entry`).toBe(true);
        for (const f of [x.title, x.body, x.ask]) expect(f.trim().length, `${lang} ${id}`).toBeGreaterThan(0);
      }
    }
    for (const lang of Object.keys(NEWS_TEXTS)) expect((LIVE_LANGS as readonly string[]).includes(lang), lang).toBe(true);
  });

  it("are newest first, and the newest date is the News page's lastmod", () => {
    const dates = entriesFor("de").map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(newestNewsDate()).toBe(dates[0]);
  });
});

describe("the CHANGELOG drafts (#588)", () => {
  const md = `# Changelog\n\n## [Unreleased]\n\n## [9.9.9] — 2031-02-03\n\nIntro.\n\n### Added\n- **Live widgets in Kassel (#901).** \`find_widget\` now answers in Kassel. It is read hourly.\n  - A sub-bullet is not an entry.\n- **Second thing (#902).** Body two.\n\n### Fixed\n- **Not new (#903).** A fix.\n\n## [9.9.8] — 2031-01-01\n\n### Added\n- **Older (#800).** Old.\n`;

  it("one draft per top-level Added bullet of the newest released block, with issue, title, first sentence and date", () => {
    const block = releaseBlock(md)!;
    expect(block.version).toBe("9.9.9");
    expect(draftsFrom(block)).toEqual([
      { issue: 901, title: "Live widgets in Kassel", body: "`find_widget` now answers in Kassel.", release: "9.9.9", date: "2031-02-03" },
      { issue: 902, title: "Second thing", body: "Body two.", release: "9.9.9", date: "2031-02-03" },
    ]);
    expect(draftsFrom(releaseBlock(md, "9.9.8")!).map((d) => d.issue)).toEqual([800]);
    expect(releaseBlock(md, "1.0.0")).toBeNull();
  });

  it("the printed draft names the flagged ids and is marked as needing a person", () => {
    const out = renderDrafts(draftsFrom(releaseBlock(md)!), ["planted_new_feed"]);
    expect(out).toContain("1 credits id(s) with no news entry: planted_new_feed");
    expect(out).toContain("issue: 901");
    expect(out).toContain('ask: "TODO"');
  });

  // cross-repo(viafrei): reads viafrei's CHANGELOG.md, the MCP server's release history; the catalogue it checks is generated in viafrei (scripts/generate-catalogue.ts) and arrives here as src/generated/*.json (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("reads the real CHANGELOG", () => {
    const real = releaseBlock(readFileSync(join(ROOT, "CHANGELOG.md"), "utf8"), "1.9.15");
    expect(draftsFrom(real!).map((d) => d.issue)).toEqual(expect.arrayContaining([492, 491, 490, 488, 456]));
  });
});

describe("the plans against GitHub's `planned` label (scripts/news-plans.ts, fixtures only — no gh, no network)", () => {
  const issue = (number: number, state = "OPEN", labels: string[] = ["planned"]): GhIssue => ({ number, title: `issue ${number}`, state, labels });
  const plans = NEWS_ENTRIES.filter((e) => e.kind === "plan");
  const open = new Map(plans.map((e) => [e.issue, issue(e.issue)]));

  it("is clean when every planned issue has a plan and every plan an open, labelled issue", () => {
    const r = planReport([...open.values()], (n) => open.get(n) ?? null);
    expect(r).toEqual({ unlisted: [], stale: [] });
    expect(renderPlanReport(r)).toContain("✓ news-plans");
  });

  it("names a planned issue with no entry, and ignores a closed one or one without the label", () => {
    const r = planReport([...open.values(), issue(999), issue(998, "CLOSED"), issue(997, "OPEN", ["type:feature"])], (n) => open.get(n) ?? null);
    expect(r.unlisted.map((i) => i.number)).toEqual([999]);
    expect(renderPlanReport(r)).toContain("✗ #999 is labelled planned and has no plan entry");
  });

  it("names a plan whose issue is closed, unlabelled or unreadable", () => {
    // three plans, whatever the live list holds: the real ones plus planted ones (#637 shipped in 2.2.4)
    const three = [...plans, ...[996, 995, 994].map((n) => ({ ...plans[0]!, id: `planted-plan-${n}`, issue: n }))].slice(0, 3);
    const [a, b, c] = three;
    const now = new Map([...open, ...three.map((e) => [e.issue, issue(e.issue)] as const)]);
    now.set(a!.issue, issue(a!.issue, "CLOSED"));
    now.set(b!.issue, issue(b!.issue, "OPEN", ["release:v2.1"]));
    now.delete(c!.issue);
    const r = planReport([], (n) => now.get(n) ?? null, three);
    expect(r.stale).toEqual([
      { id: a!.id, issue: a!.issue, why: "closed" },
      { id: b!.id, issue: b!.issue, why: "unlabelled" },
      { id: c!.id, issue: c!.issue, why: "unreadable" },
    ]);
    const out = renderPlanReport(r);
    expect(out).toContain(`plan ${a!.id}: #${a!.issue} is closed`);
    expect(out).toContain(`plan ${b!.id}: #${b!.issue} no longer carries planned`);
  });

  it("asks GitHub only through gh, with no shell and no network in this file", () => {
    const src = readFileSync(join(ROOT, "packages", "web", "scripts", "news-plans.ts"), "utf8");
    expect(src).toContain('execFileSync("gh", args');
    expect(src).not.toMatch(/\bexecSync\(|\bfetch\(|shell: true/);
  });
});

describe("the page and its feed (#588)", () => {
  it("is in the page map: /<lang>/news in every language (#892)", () => {
    for (const l of LIVE_LANGS) expect(pathFor("news", l)).toBe(`/${l}/news`);
    expect(pageAt("/de/news")).toEqual({ id: "news", lang: "de" });
    expect(pageAt("/de/neuigkeiten")).toBeNull();
  });

  it("the site-pages projection lists the News page in every language", () => {
    const rows = readFileSync(join(ROOT, "scripts", "site-pages.txt"), "utf8");
    for (const l of LIVE_LANGS) expect(rows).toMatch(new RegExp(`^${pathFor("news", l).replace(/\//g, "\\/")}\\s`, "m"));
  });

  it("serves one Atom feed per language, valid in shape, with an entry per shown item", () => {
    for (const l of LIVE_LANGS) {
      const xml = atomFeed(l);
      expect(feedPath(l)).toBe(`${pathFor("news", l)}.xml`);
      expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"')).toBe(true);
      for (const el of ["id", "title", "updated", "author"]) expect(xml, `${l} feed ${el}`).toMatch(new RegExp(`<feed[^>]*>[\\s\\S]*<${el}>`));
      expect(xml).toContain(`<link rel="self" type="application/atom+xml" href="https://viafrei.de${feedPath(l)}"/>`);
      // the newest entry SHOWN in this language, as its Berlin release day (review N4)
      expect(xml.match(/<feed[^>]*>[\s\S]*?<updated>([^<]+)<\/updated>/)?.[1]).toBe(berlinDay(newestNewsDate(entriesFor(l))));
      expect(xml).not.toContain("T00:00:00Z");
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
      expect(entries).toHaveLength(entriesFor(l).length);
      for (const e of entries) for (const el of ["id", "title", "updated", "summary"]) expect(e, `${l} entry ${el}`).toContain(`<${el}>`);
      wellFormed(xml);
      // no tracking parameter, no script
      expect(xml).not.toMatch(/utm_|<script/i);
    }
  });

  it("stamps each day as Berlin's midnight with the offset in force then — both DST switch days included (review N4)", () => {
    expect(berlinDay("2026-10-11")).toBe("2026-10-11T00:00:00+02:00");
    expect(berlinDay("2026-12-01")).toBe("2026-12-01T00:00:00+01:00");
    // 2026-03-29 and 2026-10-25 are the switch days: midnight still carries the offset of the night before
    expect(berlinDay("2026-03-29")).toBe("2026-03-29T00:00:00+01:00");
    expect(berlinDay("2026-03-30")).toBe("2026-03-30T00:00:00+02:00");
    expect(berlinDay("2026-10-25")).toBe("2026-10-25T00:00:00+02:00");
    expect(berlinDay("2026-10-26")).toBe("2026-10-26T00:00:00+01:00");
    for (const d of ["2026-03-29", "2026-10-25", "2026-07-01"]) {
      const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date(berlinDay(d)));
      expect(local).toBe(`${d} 00:00`);
    }
    expect(() => berlinDay("11.10.2026")).toThrow();
  });

  it("a feed's updated is the newest entry SHOWN in its language: a German-only later entry moves the German feed alone", () => {
    const base = NEWS_ENTRIES[0]!;
    const deOnly = { ...base, id: "de-only", date: "2099-01-01", text: { de: base.text.de! } };
    const both = [base, deOnly];
    const head = (xml: string): string | undefined => xml.match(/<feed[^>]*>[\s\S]*?<updated>([^<]+)<\/updated>/)?.[1];
    expect(head(atomFeed("de", both))).toBe("2099-01-01T00:00:00+01:00");
    expect(head(atomFeed("en", both))).toBe(berlinDay(base.date));
  });

  it("escapes text, and the feed of a language carries none of another's words", () => {
    const planted = { ...NEWS_ENTRIES[0]!, id: "esc", date: "2099-01-01", text: { en: { title: "A & B <c>", body: "x", ask: "y" } } };
    const xml = atomFeed("en", [planted]);
    expect(all(xml, "title").map(nodeText)).toContain("A & B <c>");
    wellFormed(xml);
    expect(atomFeed("en")).not.toContain(NEWS_ENTRIES[0]!.text.de!.title);
  });

  it("each feed route answers its own language only", async () => {
    expect(feedResponse("de", "news").status).toBe(200);
    expect(feedResponse("de", "neuigkeiten").status).toBe(404);
    expect(feedResponse("en", "news").status).toBe(200);
    expect(feedResponse("en", "neuigkeiten").status).toBe(404);
    expect(feedResponse("xx", "news").status).toBe(404);
    expect(feedResponse("en", "news").headers.get("content-type")).toBe("application/atom+xml; charset=utf-8");
    expect(await feedResponse("tr", "news").text()).toContain('xml:lang="tr"');
  });
});

describe("the traffic fragment fetch (#588)", () => {
  const respond = (body: string, status = 200, type = "text/html; charset=utf-8") => ({
    baseUrl: "http://digest",
    timeoutMs: 200,
    fetchImpl: () => Promise.resolve(new Response(body, { status, headers: { "content-type": type } })),
  });
  it("accepts the list, the none and the error shapes", async () => {
    expect(await fetchNewsTraffic("de", respond('<ul class="news-list news-traffic"><li class="news-entry">x</li></ul>'))).toContain("news-entry");
    expect(await fetchNewsTraffic("de", respond('<p class="news-traffic news-traffic--none">Keine.</p>'))).toContain("--none");
  });
  it("refuses anything else: a 500, another fragment, a script", async () => {
    expect(await fetchNewsTraffic("de", respond("<p>news unavailable</p>", 500))).toBeNull();
    expect(await fetchNewsTraffic("de", respond('<section class="tile">x</section>'))).toBeNull();
    expect(await fetchNewsTraffic("de", respond('<ul class="news-list news-traffic"><script>x</script></ul>'))).toBeNull();
    expect(await fetchNewsTraffic("de", respond("{}", 200, "application/json"))).toBeNull();
  });
});

/** A minimal well-formedness check: every element closes in order, no stray `&`. */
function wellFormed(xml: string): void {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, "");
  expect(body).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/);
  const stack: string[] = [];
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:-]*)[^>]*?(\/?)>/g)) {
    if (m[3] === "/") continue;
    if (m[1] === "/") expect(stack.pop(), `</${m[2]}>`).toBe(m[2]);
    else stack.push(m[2]!);
  }
  expect(stack).toEqual([]);
}
