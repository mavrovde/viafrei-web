/**
 * #1087 parts 2 and 3, the shell's half: the home's station block arrives as the digest's fragment; a block that did
 * not arrive is the home's own last good one while it is young enough (`STATION_TOP_KEPT_SECONDS`, the digest's
 * `STATION_TOP_STALE_S`), and with nothing kept it is the block's ERROR state in the page's language — its heading,
 * the error note, the station search (GET `q` to the catalogue) and the link to every station, never a missing block
 * and never a figure or a credit the shell did not read.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { all, first, text } from "@viafrei/design/testing";
import { fetchStationTop, STATION_TOP_KEPT_SECONDS, stationTopError } from "../src/lib/station-top.js";
import { clearHomeKept } from "../src/lib/home-kept.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { t } from "../src/i18n/index.js";
import { STATION_TOP_STALE_S } from "../../digest/src/server/station-service.js";
import { STATION_COPY } from "../../digest/src/presentation/i18n-station.js";
import { renderStationTop } from "../../digest/src/presentation/station-top-html.js";

const BLOCK = renderStationTop("de", { newest: new Date("2026-10-27T19:38:00Z"), rows: [{ slug: "koeln-hbf", name: "Köln Hbf", cancelled: 2, late: 0, alerts: 0, lifts_out: 0 }], alertSources: [] }, new Date("2026-10-27T19:40:00Z"), 6482);
const answer = (status: number, body: string): FetchLike => () => Promise.resolve(new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } }));
const O = (fetchImpl: FetchLike) => ({ baseUrl: "http://digest.test", timeoutMs: 500, fetchImpl, fragmentUrl: undefined });

afterEach(() => {
  clearHomeKept();
  vi.useRealTimers();
});

describe("#1087: the home's station block in the shell", () => {
  it("the digest's block is taken as it arrived", async () => {
    const r = await fetchStationTop("de", O(answer(200, BLOCK)));
    expect(r).toEqual({ kind: "ok", html: BLOCK });
  });

  it("a block that did not arrive is the kept one while young enough, then its error state", async () => {
    vi.useFakeTimers();
    const t0 = Date.parse("2026-10-27T19:40:00Z");
    vi.setSystemTime(t0);
    await fetchStationTop("de", O(answer(200, BLOCK)));
    vi.setSystemTime(t0 + STATION_TOP_KEPT_SECONDS * 1000 - 1);
    expect(await fetchStationTop("de", O(answer(500, "<p>station unavailable</p>")))).toEqual({ kind: "kept", html: BLOCK });
    vi.setSystemTime(t0 + STATION_TOP_KEPT_SECONDS * 1000);
    const r = await fetchStationTop("de", O(answer(500, "<p>station unavailable</p>")));
    expect(r.kind).toBe("error");
    expect(r.html).toBe(stationTopError("de"));
  });

  it("a body that is not the block (a script, another fragment) is never taken", async () => {
    expect((await fetchStationTop("de", O(answer(200, `${BLOCK.replace("</section>", "")}<script>x</script></section>`)))).kind).toBe("error");
    expect((await fetchStationTop("de", O(answer(200, '<section class="motorway-top" id="motorway-top"></section>')))).kind).toBe("error");
    expect((await fetchStationTop("de", O(() => Promise.reject(new Error("ECONNREFUSED"))))).kind).toBe("error");
  });

  it("the error state, every live language: heading, note, the search to the catalogue, every station — no figure, no credit", () => {
    for (const lang of LIVE_LANGS) {
      const html = stationTopError(lang);
      const root = first(html, "section#station-top")!;
      expect(root.attrs.class, lang).toBe("station-top is-error");
      expect(text(first(html, "h2.station-top__h")!), lang).toBe(t(lang, "now.stationTop.head"));
      expect(text(first(html, "p.station-top__none")!), lang).toBe(t(lang, "tile.errorNote"));
      const form = first(html, "form.station-top__search")!;
      expect(form.attrs.action, lang).toBe(pathFor("stations", lang));
      expect(all(form, "input").map((i) => i.attrs.name), lang).toEqual(["q"]);
      expect(first(html, "p.station-top__cta a")!.attrs.href, lang).toBe(pathFor("stations", lang));
      expect(all(html, ".credit, .sttop, ol"), lang).toHaveLength(0);
    }
  });

  it("the shell says what the digest says: the same heading, search words and catalogue name in every live language", () => {
    for (const lang of LIVE_LANGS) {
      const c = STATION_COPY[lang];
      expect(t(lang, "now.stationTop.head"), lang).toBe(c.top.head);
      expect(t(lang, "now.stationTop.search"), lang).toBe(c.index.search);
      expect(t(lang, "now.stationTop.go"), lang).toBe(c.index.go);
      expect(t(lang, "now.stationTop.all"), lang).toBe(c.index.head);
    }
  });

  it("the kept age is the digest's own stale bound", () => {
    expect(STATION_TOP_KEPT_SECONDS).toBe(STATION_TOP_STALE_S);
  });
});
