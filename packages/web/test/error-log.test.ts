/**
 * The site shell's error lines (#741) against the ONE planted corpus
 * (`scripts/fixtures/log-collect/`, data-steward ruling T14), and the mask
 * copy held byte-identical to the ingest original it was copied from — the
 * shell may import no workspace that holds a database
 * (`scripts/check_web_boundary.sh`), so it carries its own copy, and a copy
 * that drifted would be a second, weaker rule nobody reviewed.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatLogLine, logFragmentFailure, setLogSink } from "../src/lib/log.js";
import { routeTemplate } from "../src/lib/log-mask.js";
import { getFragment } from "../src/lib/place.js";
import { getMotorwayFragment } from "../src/lib/motorway.js";
import { fetchTile, type FetchLike } from "../src/lib/tiles.js";

const FIXTURES = new URL("../../../scripts/fixtures/log-collect/", import.meta.url);
type Needle = { readonly name: string; readonly plant: string; readonly forbidden: readonly string[] };
const needles: readonly Needle[] = readFileSync(new URL("needles.tsv", FIXTURES), "utf8")
  .split("\n")
  .filter((l) => l !== "" && !l.startsWith("#"))
  .map((l) => {
    const [name = "", plant = "", forbidden = ""] = l.split("\t");
    return { name, plant, forbidden: forbidden === "" ? [plant] : forbidden.split("|") };
  });
const ALL = needles.map((n) => n.plant).join(" | ");
const leaks = (lines: readonly string[]): string[] => needles.flatMap((n) => n.forbidden.filter((f) => lines.some((l) => l.includes(f))).map((f) => `${n.name}: ${f}`));

let lines: string[] = [];
let restore: () => void = () => undefined;
beforeEach(() => {
  lines = [];
  restore = setLogSink((l) => { lines.push(l); });
});
afterEach(() => {
  restore();
  vi.useRealTimers();
});

const answer = (status: number, body = "<p>x</p>"): ReturnType<FetchLike> =>
  Promise.resolve({ status, headers: { get: (n: string) => (n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve(body) });
const opts = (f: FetchLike) => ({ baseUrl: "http://digest:8791", timeoutMs: 2000, fetchImpl: f });

describe("the mask copy (#741)", () => {
  // cross-repo(viafrei): a byte-for-byte copy of an ingest SOURCE file; the released image ships it compiled, so the one-source check belongs to viafrei, which holds both until the copy is retired (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("is byte-identical to packages/ingest/src/platform/log-mask.ts", () => {
    const original = readFileSync(new URL("../../../.pinned/app/packages/ingest/dist/platform/log-mask.js", import.meta.url), "utf8");
    const copy = readFileSync(new URL("../src/lib/log-mask.ts", import.meta.url), "utf8");
    expect(copy === original, "packages/web/src/lib/log-mask.ts drifted from the ingest original — copy it again").toBe(true);
  });
});

describe("formatLogLine (#741)", () => {
  it.each(needles.map((n) => [n.name, n] as const))("a %s in the message, the key or the error never reaches the line", (_name, n) => {
    const line = formatLogLine(50, { kind: "ssr_exception", key: `/de/${n.plant}`, status: 500, ms: 3, err: new Error(`render failed ${n.plant}`) }, `page ${n.plant}`);
    expect(leaks([line]).filter((l) => l.startsWith(`${n.name}:`))).toEqual([]);
    expect(JSON.parse(line)).toMatchObject({ level: 50, kind: "ssr_exception", status: 500, ms: 3, err: { name: "Error" } });
  });
  it("is one JSON line carrying only the closed list of fields", () => {
    const line = formatLogLine(40, { kind: "fragment_upstream", key: "/internal/place/suggest", status: 502, ms: 12 }, "a digest fragment could not be used", () => 1);
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toEqual({ level: 40, time: 1, kind: "fragment_upstream", key: "/internal/place/suggest", status: 502, ms: 12, msg: "a digest fragment could not be used" });
  });
  it("keys a page by its route template, never by a value", () => {
    expect(routeTemplate("/de/ort/[slug]")).toBe("/de/ort/:slug");
    expect(routeTemplate("/[lang]/motorway/[...road]")).toBe("/:lang/motorway/:road");
  });
});

describe("a digest fragment that did not arrive (#741)", () => {
  it("is a warn line keyed by the internal PATH — the visitor's query is never in it", async () => {
    const q = encodeURIComponent(`Zollstockgürtel 12 50969 Köln ${ALL}`);
    const r = await getFragment(`http://digest:8791/internal/place/suggest?lang=de&q=${q}`, opts(() => answer(502)), /^<ul/, "</ul>");
    expect(r.ok).toBe(false);
    expect(lines).toHaveLength(1);
    const first = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
    expect(first).toMatchObject({ level: 40, kind: "fragment_upstream", key: "/internal/place/suggest", status: 502 });
    expect(typeof first["ms"]).toBe("number");
    expect(leaks(lines)).toEqual([]);
    for (const word of ["Zollstockgürtel", "50969", "Köln", "lang=de"]) expect(lines[0]).not.toContain(word);
  });
  it("a deadline missed is fragment_timeout; a thrown connection error is fragment_upstream with no status", async () => {
    const hang: FetchLike = (_u, init) => new Promise((_r, reject) => { init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; reject(e); }); });
    await getMotorwayFragment("http://digest:8791/internal/motorway/A3?lang=de&from=1", { baseUrl: "http://digest:8791", timeoutMs: 20, fetchImpl: hang }, /^<section/, "</section>", false);
    await fetchTile("reports", "de", opts(() => Promise.reject(new Error(`connect ECONNREFUSED ${ALL}`))));
    expect(lines.map((l) => JSON.parse(l) as Record<string, unknown>)).toEqual([
      expect.objectContaining({ kind: "fragment_timeout", key: "/internal/motorway/A3" }),
      expect.objectContaining({ kind: "fragment_upstream", key: "/internal/tiles/reports" }),
    ]);
    expect(JSON.parse(lines[1] ?? "")).not.toHaveProperty("status");
    expect(leaks(lines)).toEqual([]);
  });
  it("a #1184 refusal (503 marked x-vf-busy) writes nothing; an unmarked 503 is still a line (2.5.14 review)", async () => {
    const busy: FetchLike = () => Promise.resolve({ status: 503, headers: { get: (n: string) => (n === "x-vf-busy" ? "1" : n === "content-type" ? "text/html; charset=utf-8" : null) }, text: () => Promise.resolve("<p>place cards are busy</p>") });
    const r = await getFragment("http://digest:8791/internal/place/cards?at=ags:05315000", opts(busy), /^<section/, "</section>");
    expect(r).toMatchObject({ ok: false, status: 503, busy: true });
    expect(lines).toEqual([]);
    await getFragment("http://digest:8791/internal/place/cards?at=ags:05315000", opts(() => answer(503)), /^<section/, "</section>");
    expect(lines.map((l) => JSON.parse(l) as Record<string, unknown>)).toEqual([expect.objectContaining({ kind: "fragment_upstream", status: 503 })]);
  });
  it("a 404 is an answer and writes nothing; a 200 writes nothing", async () => {
    await fetchTile("reports", "de", opts(() => answer(404)));
    await getFragment("http://digest:8791/internal/place/cards?at=ags:05315000", opts(() => answer(404)), /^<section/, "</section>");
    await getMotorwayFragment("http://digest:8791/internal/motorway/A999", opts(() => answer(404)), /^<section/, "</section>", false);
    await getFragment("http://digest:8791/internal/place/index", opts(() => answer(200, "<ul></ul>")), /^<ul/, "</ul>");
    expect(lines).toEqual([]);
  });
  it("an address that does not parse is keyed by nothing rather than by itself", () => {
    logFragmentFailure(`not a url ${ALL}`, null, "boom", 1);
    expect(JSON.parse(lines[0] ?? "")).not.toHaveProperty("key");
    expect(leaks(lines)).toEqual([]);
  });
});
