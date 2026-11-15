/**
 * #520 acceptance 1: the home's city jam tile and `check_road_status {place}`
 * agree on the jam count for the same city at the same minute, over the same
 * fixture — and #520 acceptance 2: a busy, an empty and a dead-feed state.
 *
 * A CONTRACT test, which is why it lives here: this package already holds the
 * tests that put `@viafrei/digest` and `@viafrei/mcp` side by side (the digest
 * may not import the MCP server, and the server has no reason to import the
 * digest). Both run their real code against one rolled-back transaction on the
 * throwaway test database: the tool through its in-memory MCP client, the tile
 * through `readCityJams` + `buildCityJams` (the digest's own read and block)
 * and `renderTile("jams")` for the figures a visitor reads.
 *
 * Fixtures: the two recorded NMS pulls the tool's own jam tests use
 * (`fixtures/mobilithek/recorded/situation-nms-jams-{koeln,berlin}.xml`), at
 * the same clocks, plus two Autobahn GmbH jam warnings near the A57 in Köln —
 * one 600 m from a police jam on the same road (a twin, counted once) and one
 * 8 km away (its own jam). Offline: committed bytes only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPool, findRepoRoot, JAM_RADIUS_M, LICENCE_CATALOGUE, loadSituations } from "@viafrei/ingest";
import { provisionTickDays } from "@viafrei/ingest/testing";
import { JAM_CITIES, buildCityJams, buildDigest, readCityJams, renderTile, type DigestSnapshot } from "@viafrei/digest";
import { connectInMemory } from "@viafrei/mcp";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all } from "@viafrei/design/testing";

const RECORDED = join(findRepoRoot(), "fixtures", "mobilithek", "recorded");
const KOELN_PULL = readFileSync(join(RECORDED, "situation-nms-jams-koeln.xml"), "utf8");
const BERLIN_PULL = readFileSync(join(RECORDED, "situation-nms-jams-berlin.xml"), "utf8");
/** Six minutes after the Köln pull's publication; ten after the Berlin pull's (the tool tests' clocks). */
const K = new Date("2026-10-06T16:41:00Z");
const B = new Date("2026-10-06T22:30:00Z");
const NOTE = "test: #520 tile/tool agreement";

let pool: pg.Pool;
let reachable = true;
beforeAll(async () => {
  pool = createPool(process.env["TEST_DATABASE_URL"] ?? "");
  try {
    await pool.query("select 1 from road_events limit 1");
    await pool.query("select 1 from feed_checks limit 1");
  } catch {
    reachable = false;
  }
  // Both pulls are loaded at the tool tests' clocks (K, B), so their tick day must exist in a database migrated after it aged out.
  if (reachable) await provisionTickDays(pool, [K, B]);
});
afterAll(async () => {
  await pool?.end();
});

async function inTx(body: (c: pg.PoolClient) => Promise<void>): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("delete from road_events where feed_key in ('nms_events', 'traffic_bw', 'traffic_sh')");
    await c.query("delete from autobahn_events where observed_at > $1::timestamptz - interval '1 hour' and observed_at <= $1::timestamptz", [K]);
    const nms = LICENCE_CATALOGUE["mobilithek_nms_events"]!;
    await c.query(
      `insert into feed_catalog (feed_key, provider, display_name, licence_id, licence_label, attribution, enabled, cadence_s)
       values ('nms_events', 'mobilithek', 'NMS police traffic events, Germany-wide', 'mobilithek_nms_events', $1, $2, true, 600)
       on conflict (feed_key) do update set licence_id = excluded.licence_id, licence_label = excluded.licence_label,
         attribution = excluded.attribution, enabled = true, cadence_s = excluded.cadence_s, closed_at = null`,
      [nms.label, nms.attribution],
    );
    await body(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}

/** Every catalogued feed checked at `at` (the tool reads feed_runs, the tile feed_checks over it), except those named. */
async function checkedAt(c: pg.PoolClient, at: Date, except: readonly string[] = []): Promise<void> {
  await c.query("update feed_catalog set cadence_s = coalesce(cadence_s, 600) where closed_at is null");
  await c.query(
    `insert into feed_runs (feed_key, started_at, finished_at, status, note)
     select f.feed_key, $1::timestamptz, $1::timestamptz, 'ok', $2::text from feed_catalog f
      where f.closed_at is null and f.feed_key <> all($3::text[])`,
    [at, NOTE, except],
  );
}

type ToolCounts = { counts?: Record<string, number> };
type ToolResult = { content: { type: string; text?: string }[]; structuredContent?: ToolCounts; isError?: boolean };

/** The tool's head-line jam count for one point, at `now`. */
async function toolJams(c: pg.PoolClient, at: { lat: number; lon: number }, now: Date): Promise<{ n: number; text: string }> {
  const client = await connectInMemory({ db: c, now: () => now });
  const r = (await client.callTool({ name: "check_road_status", arguments: { lat: at.lat, lon: at.lon } })) as ToolResult;
  expect(r.isError, JSON.stringify(r.content)).toBeFalsy();
  return { n: r.structuredContent?.counts?.["jams"] ?? 0, text: r.content.map((x) => x.text ?? "").join("\n") };
}

/** The tile's block and its rendered fragment, through the digest's own read. */
async function tile(c: pg.PoolClient, now: Date): Promise<{ block: ReturnType<typeof buildCityJams>; html: string }> {
  const read = await readCityJams(c, now, JAM_CITIES);
  const block = buildCityJams(read, now);
  const failed = { ok: false as const, error: "not part of this test" };
  const snapshot: DigestSnapshot = {
    takenAt: now,
    roads: failed,
    fuel: failed,
    places: failed,
    facilities: failed,
    punctuality: failed,
    fuelBoard: failed,
    cityJams: read,
    stations: failed,
    placesNear: { ok: true, value: { gazetteerLoaded: false, found: new Map(), asked: new Set() } },
  };
  return { block, html: renderTile("jams", buildDigest({ snapshot }), "de") ?? "" };
}

/** Two Autobahn GmbH jam warnings on the A57 in Köln, a minute before K (the tick window ends at the request's clock, 2.4.2). */
async function a57Warnings(c: pg.PoolClient): Promise<void> {
  const s1096 = (await c.query<{ lat: number; lon: number }>("select ST_Y(geom) as lat, ST_X(geom) as lon from road_events where publication_id like '%/S1096_%'")).rows[0]!;
  const wall = new Date(K.getTime() - 60_000);
  for (const [ext, dLat, delay] of [["test-520-twin", 0.005, 720], ["test-520-own", 0.072, 300]] as const) {
    await c.query(
      `insert into autobahn_events (observed_at, road, kind, ext_id, title, subtitle, abnormal_traffic_type, delay_s, geom, raw, source)
       values ($1, 'A57', 'warning', $2, 'A57 | Köln-Bickendorf - Kreuz Köln-Nord', 'Stau', 'QUEUING_TRAFFIC', $3,
               ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, '{"description":["Stau"]}'::jsonb, 'autobahn')`,
      [wall, ext, delay, s1096.lon, s1096.lat + dLat],
    );
  }
}

describe("the city jam tile and check_road_status count the same jams (#520)", () => {
  it("uses the tool's circle", () => {
    expect(JAM_RADIUS_M).toBe(25_000);
  });

  it("Köln at rush hour, with an Autobahn GmbH twin and a jam of its own: every one of the ten cities agrees", async ({ skip }) => {
    if (!reachable) skip();
    await inTx(async (c) => {
      await loadSituations(c, Buffer.from(KOELN_PULL, "utf8"), { feedKey: "nms_events", observedAt: K });
      await a57Warnings(c);
      await checkedAt(c, K);
      const t = await tile(c, K);
      expect(t.block.current).toBe(true);
      const byCity = new Map(t.block.cities.map((x) => [x.key, x.count]));
      let nonZero = 0;
      for (const city of JAM_CITIES) {
        const tool = await toolJams(c, city, K);
        expect(byCity.get(city.key), `${city.key}: tile ${String(byCity.get(city.key))}, tool ${String(tool.n)}`).toBe(tool.n);
        if (tool.n > 0) nonZero++;
      }
      // not vacuous: the pull's ten police jams plus the Autobahn GmbH's own one, the twin folded
      expect(byCity.get("koeln")).toBe(11);
      expect(nonZero).toBeGreaterThanOrEqual(2); // Düsseldorf's circle holds some of Köln's jams too
      // the rendered tile carries the same figure for Köln, the NMS line and the Autobahn GmbH line
      expect(t.html).toMatch(/<span class="jams__city-name" translate="no"><a href="\/de\/place\/koeln">Köln<\/a><\/span> <span class="jams__city-n num">11<\/span>/u);
      expect(t.html).toContain(LICENCE_CATALOGUE["mobilithek_nms_events"]!.attribution!);
      expect(t.html).toContain(LICENCE_CATALOGUE["autobahn"]!.attribution!);
      expect(all(t.html, '.tile.is-ok[id="tile-jams"]').length).toBe(1);
    });
  });

  it("an Autobahn GmbH jam cut into segments (#505's .deN ids, every printed field equal) is ONE jam to both", async ({ skip }) => {
    if (!reachable) skip();
    await inTx(async (c) => {
      const koeln = JAM_CITIES.find((x) => x.key === "koeln")!;
      const wall = new Date(K.getTime() - 60_000);
      for (const [n, dLat] of [[1, 0.01], [2, 0.012], [3, 0.014]] as const) {
        await c.query(
          `insert into autobahn_events (observed_at, road, kind, ext_id, title, subtitle, abnormal_traffic_type, delay_s, geom, raw, source)
           values ($1, 'A3', 'warning', $2, 'A3 | Köln-Dellbrück - Kreuz Köln-Ost', 'Stau', 'QUEUING_TRAFFIC', 600,
                   ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, '{"description":["Stau"]}'::jsonb, 'autobahn')`,
          [wall, `test-505-seg.de${String(n)}`, koeln.lon + 0.03, koeln.lat + dLat],
        );
      }
      await checkedAt(c, K);
      const t = await tile(c, K);
      const tool = await toolJams(c, koeln, K);
      expect(tool.n).toBe(1);
      expect(t.block.cities.find((x) => x.key === "koeln")?.count).toBe(1);
    });
  });

  it("Berlin at night: the same count from the tile and the tool", async ({ skip }) => {
    if (!reachable) skip();
    await inTx(async (c) => {
      await loadSituations(c, Buffer.from(BERLIN_PULL, "utf8"), { feedKey: "nms_events", observedAt: B });
      await checkedAt(c, B);
      const t = await tile(c, B);
      const berlin = JAM_CITIES.find((x) => x.key === "berlin")!;
      const tool = await toolJams(c, berlin, B);
      expect(tool.n).toBeGreaterThan(0);
      expect(t.block.cities.find((x) => x.key === "berlin")?.count).toBe(tool.n);
    });
  });

  it("nothing reported, feeds current: an honest empty — 'keine Staumeldungen' from both", async ({ skip }) => {
    if (!reachable) skip();
    await inTx(async (c) => {
      await checkedAt(c, K);
      const t = await tile(c, K);
      expect(t.block.current).toBe(true);
      expect(t.block.cities.every((x) => x.count === 0)).toBe(true);
      expect(all(t.html, '.tile.is-empty[id="tile-jams"]').length).toBe(1);
      expect(t.html).toContain("Keine Staumeldungen in den zehn größten Städten.");
      const koeln = await toolJams(c, JAM_CITIES.find((x) => x.key === "koeln")!, K);
      expect(koeln.n).toBe(0);
      expect(koeln.text).toContain("Keine Staumeldungen im Umkreis von 25 km");
    });
  });

  it("the police feed not current: never an all-clear — no count on the tile, 'keine Entwarnung' from both", async ({ skip }) => {
    if (!reachable) skip();
    await inTx(async (c) => {
      await loadSituations(c, Buffer.from(KOELN_PULL, "utf8"), { feedKey: "nms_events", observedAt: K });
      // NMS's newest run is a day old: outside 3 × its 600 s cadence.
      await c.query("insert into feed_runs (feed_key, started_at, finished_at, status, note) values ('nms_events', $1, $1, 'ok', $2)", [new Date(K.getTime() - 86_400_000), NOTE]);
      await checkedAt(c, K, ["nms_events"]);
      const t = await tile(c, K);
      expect(t.block.current).toBe(false);
      expect(t.block.cities).toEqual([]);
      expect(all(t.html, '.tile.is-error[id="tile-jams"]').length).toBe(1);
      expect(t.html).toContain("das ist keine Entwarnung");
      expect(t.html).not.toMatch(/jams__city-n/u);
      const koeln = await toolJams(c, JAM_CITIES.find((x) => x.key === "koeln")!, K);
      // the tool, with its one place source shut, says no source is open — and that this is no all-clear either
      expect(koeln.n).toBe(0);
      expect(koeln.text).toContain("nicht, dass die Straße frei ist");
    });
  });
});
