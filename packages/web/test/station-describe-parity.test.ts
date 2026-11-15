/**
 * #1044: `describe_station` answers what the station's page shows — the same station, the same departures, the same
 * lifts in the same order, the same service alerts — because both read by one copy of each statement and rule
 * (`@viafrei/ingest`'s station record, board, lifts and alerts).
 *
 * A CONTRACT test, which is why it lives here (the digest may not import the MCP server, and the server has no reason
 * to import the digest — the `motorway-ampel-parity.test.ts` pattern). One rolled-back transaction on the throwaway
 * test database plants Köln Hbf: DB StaDa's record (the recorded StaDa fixture through the real loader), the
 * gazetteer's station and the zHV stop it pairs with, a timetable of four trains from platform 4 (and one that left
 * already), three FaSta lifts of which one is out of service, the two feeds' checks, and three DELFI service alerts
 * (one at the station, one about one of its lines in its Kreis, one about the same line in another city). Then the page
 * is read AS `viafrei_digest` (the station service's page and live part) and the tool is called AS `viafrei_mcp` (its
 * real handler through the in-memory MCP client), and the two are compared section by section.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createStationService, stationLiveKeyOf, stationRailAmpel } from "@viafrei/digest";
import type { RailAmpel } from "@viafrei/ingest";
import { findRepoRoot, loadStationIndex, parseStationIndex } from "@viafrei/ingest";
import { testDb } from "@viafrei/ingest/testing";
import { connectInMemory } from "@viafrei/mcp";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const STADA = JSON.parse(readFileSync(join(findRepoRoot(), "fixtures/stada/station-pages.json"), "utf8")) as { total: number; result: Record<string, unknown>[] };

let admin: pg.Pool;
let reachable = true;
beforeAll(async () => {
  ({ pool: admin, reachable } = await testDb(`do $$ begin if to_regclass('station_index_live') is null or not has_table_privilege('viafrei_mcp', 'station_index_live', 'select') then raise exception 'apply db/migrations/0247_mcp_station_grants.sql'; end if; end $$`));
});
afterAll(async () => {
  await admin?.end();
});

const STATION_NO = "3320";
const EVA = "8000207";
const HBF = "de:05315:11201";
const AT = { lon: 6.9589, lat: 50.943 };
const point = (p: { lon: number; lat: number }): string => `st_setsrid(st_makepoint(${String(p.lon)}, ${String(p.lat)}), 4326)::geography`;
const far = (km: number): { lon: number; lat: number } => ({ lon: AT.lon, lat: AT.lat + km / 111 });

async function checked(c: pg.PoolClient, feedKey: string, licence: string): Promise<void> {
  await c.query("delete from feed_runs where feed_key = $1", [feedKey]);
  await c.query(
    `insert into feed_catalog (feed_key, provider, display_name, licence_id, cadence_s, enabled) values ($1, 'test', $1, $2, 300, true)
     on conflict (feed_key) do update set cadence_s = excluded.cadence_s, enabled = true, closed_at = null`,
    [feedKey, licence],
  );
  await c.query("insert into feed_runs (feed_key, started_at, finished_at, status, items_seen) values ($1, now() - interval '70 seconds', now() - interval '60 seconds', 'ok', 1)", [feedKey]);
}

/** One trip over `calls` ([stop, minutes from now]), in order, on today's service. */
async function trip(c: pg.PoolClient, now: Date, day: string, id: string, route: string, headsign: string, calls: readonly (readonly [string, number])[]): Promise<void> {
  await c.query("insert into trips (gtfs_feed_key, id, route_id, service_id, headsign) values (1, $1, $2, 'par-svc', $3)", [id, route, headsign]);
  let seq = 0;
  for (const [stop, m] of calls) {
    seq += 1;
    const at = new Date(Math.floor((now.getTime() + m * 60_000) / 1000) * 1000);
    await c.query(
      `insert into stop_times (gtfs_feed_key, trip_id, stop_id, stop_sequence, arrival, departure, pickup_type, drop_off_type)
       values (1, $1, $2, $3, ($4::timestamptz at time zone 'Europe/Berlin') - $5::date::timestamp, ($4::timestamptz at time zone 'Europe/Berlin') - $5::date::timestamp, 0, 0)`,
      [id, stop, seq, at, day],
    );
  }
}

async function plant(c: pg.PoolClient, now: Date): Promise<void> {
  await loadStationIndex(c, parseStationIndex(STADA), now);
  await c.query(`insert into gazetteer_places (kind, name, name_norm, geom, source_id, external_id) values ('station', 'Köln Hbf', 'koeln hbf', ${point(AT)}, 'db_stada', $1)`, [EVA]);
  await c.query(`insert into gazetteer_places (kind, name, name_norm, geom, source_id, external_id) values ('stop', $1, lower($1), ${point(AT)}, 'delfi_zhv', $1)`, [HBF]);
  await c.query(
    `insert into stops (gtfs_feed_key, id, name, location_type, parent_id, platform_code, geom) values
       (1, $1, 'Köln Hbf', 1, null, null, ${point(AT)}),
       (1, $1 || ':4', 'Köln Hbf', 0, $1, '4', ${point(AT)}),
       (1, 'x:aachen', 'Aachen Hbf', 0, null, null, ${point(far(60))}),
       (1, 'x:dortmund', 'Dortmund Hbf', 0, null, null, ${point(far(80))}),
       (1, 'x:bonn', 'Bonn Hbf', 0, null, null, ${point(far(-25))})`,
    [HBF],
  );
  await c.query(`insert into routes (gtfs_feed_key, id, route_type, short_name) values (1, 'p-re1', 2, 'RE 1'), (1, 'p-ice', 101, 'ICE 10'), (1, 'p-re5', 2, 'RE 5'), (1, 'p-s11', 109, 'S 11')`);
  const day = (await c.query<{ d: string }>("select ((now() - interval '30 minutes') at time zone 'Europe/Berlin')::date::text as d")).rows[0]!.d;
  await c.query("insert into gtfs_service_dates (gtfs_feed_key, service_id, service_date) values (1, 'par-svc', $1::date)", [day]);
  const P = `${HBF}:4`;
  await trip(c, now, day, "p-left", "p-re1", "Aachen Hbf", [[P, -20], ["x:aachen", 30]]);
  await trip(c, now, day, "p-1", "p-re5", "Bonn Hbf", [[P, 4], ["x:bonn", 30]]);
  await trip(c, now, day, "p-2", "p-ice", "Dortmund Hbf", [[P, 9], ["x:dortmund", 60]]);
  await trip(c, now, day, "p-3", "p-s11", "Bonn Hbf", [[P, 14], ["x:bonn", 40]]);
  await trip(c, now, day, "p-4", "p-re1", "Aachen Hbf", [[P, 25], ["x:aachen", 75]]);
  await c.query("refresh materialized view transit_stop_modes");
  // FaSta: three lifts, the one to platform 4/5 out of service (listed first on both sides), its reason kept.
  for (const [no, kind, state, why, description] of [
    ["10500001", "elevator", "active", null, "zu Gleis 1"],
    ["10500002", "elevator", "inactive", "Reparatur", "zu Gleis 4/5"],
    ["10500003", "escalator", "active", null, "zur Domplatte"],
  ] as const) {
    await c.query(
      `insert into db_facilities (equipment_no, station_no, kind, state, state_explanation, description, resume_at, lon, lat, state_since, first_seen_at, last_seen_at, source_feed, source_publisher)
       values ($1, $2, $3, $4, $5, $6, null, $7, $8, now() - interval '1 hour', now() - interval '9 days', now(), 'db_fasta', 'DB InfraGO')`,
      [no, STATION_NO, kind, state, why, description, AT.lon, AT.lat],
    );
  }
  await checked(c, "db_fasta", "db_fasta");
  // DELFI service alerts: at the station; about its S 11 in its Kreis; about an S 11 in Düsseldorf (not the station's).
  await c.query("delete from delfi_service_alerts");
  await c.query(
    `insert into delfi_service_alerts (source_id, source_feed, alert_id, header, dedupe_key, content_hash, stop_ids, line_names, kreise, confidentiality, closed_at, active_periods, last_seen_at, message_ref) values
       ('delfi_rt_sa', 'service_alerts_gtfsrt', 'P1', 'Aufzug zu Gleis 4/5 außer Betrieb', 'pk1', 'h-p1', $1::text[], '{}', '{05315}', null, null, '[]', now() - interval '1 minute', null),
       ('delfi_rt_sa', 'service_alerts_gtfsrt', 'P2', 'S 11: Bauarbeiten', 'pk2', 'h-p2', '{}', '{S 11}', '{05315}', null, null, '[]', now() - interval '1 minute', null),
       ('delfi_rt_sa', 'service_alerts_gtfsrt', 'P3', 'S 11 in Düsseldorf', 'pk3', 'h-p3', '{}', '{S 11}', '{05111}', null, null, '[]', now() - interval '1 minute', null)`,
    [[HBF]],
  );
  await checked(c, "service_alerts_gtfsrt", "delfi_rt_sa");
}

type Section = { id: string; [k: string]: unknown };
type ToolAnswer = { structuredContent?: { station: { name: string; slug: string; stationNo: string }; pageUrl: string; sections: Section[] }; _meta?: Record<string, unknown>; content: { text: string }[]; isError?: boolean };

async function both(): Promise<{ page: { name: string; slug: string; board: string[][]; lifts: string[][]; alerts: unknown[][]; ampel: RailAmpel }; tool: ToolAnswer }> {
  const c = await admin.connect();
  try {
    await c.query("begin");
    const db = await c.query<{ name: string }>("select current_database() as name");
    if (!db.rows[0]!.name.startsWith("test_")) throw new Error(`refusing to run on ${db.rows[0]!.name}`);
    const now = (await c.query<{ now: Date }>("select now() as now")).rows[0]!.now;
    await plant(c, now);

    await c.query("set local role viafrei_digest");
    const service = createStationService({ db: c, now: () => now });
    const pr = await service.page(STATION_NO);
    if (!pr.ok || pr.value === null) throw new Error(`the page read failed: ${pr.ok ? "no page" : pr.error}`);
    const live = await service.live(stationLiveKeyOf(pr.value));
    await c.query("reset role");
    if (live.board.state !== "ok" || live.lifts.state !== "ok" || live.alerts.state !== "ok") throw new Error(`page: board ${live.board.state}, lifts ${live.lifts.state}, alerts ${live.alerts.state}`);
    const page = {
      name: pr.value.name,
      slug: pr.value.slug,
      board: live.board.rows.map((r) => [r.planned.toISOString(), r.line ?? "", r.destination ?? "", r.platform ?? ""]),
      lifts: live.lifts.units.map((u) => [u.kind, u.state, u.reason ?? ""]),
      alerts: live.alerts.items.map((a) => [a.header, a.atStation, [...a.lines]]),
      // #988: the page's rail Ampel, judged from the same live value the cards are drawn from
      ampel: stationRailAmpel(live),
    };

    await c.query("set local role viafrei_mcp");
    const client = await connectInMemory({ db: c, now: () => now });
    const tool = (await client.callTool({ name: "describe_station", arguments: { eva_no: EVA, language: "de" } })) as unknown as ToolAnswer;
    await client.close();
    return { page, tool };
  } finally {
    await c.query("rollback");
    c.release();
  }
}

describe("describe_station answers what the station page shows (#1044)", () => {
  it("the same station, departures, lifts and alerts, section by section; the alerts' share-alike named", async (ctx) => {
    if (!reachable) return ctx.skip();
    const { page, tool } = await both();
    const s = tool.structuredContent;
    if (tool.isError === true || s === undefined) throw new Error(`the tool failed: ${tool.content[0]?.text ?? ""}`);
    const section = (id: string): Section => {
      const x = s.sections.find((y) => y.id === id);
      if (x === undefined) throw new Error(`no ${id} section: ${s.sections.map((y) => y.id).join(", ")}`);
      return x;
    };
    // The world the comparison stands on: something on every side, so agreement is not two empty lists.
    expect(page.board.length).toBe(4);
    expect(page.lifts.length).toBe(3);
    expect(page.alerts.length).toBe(2);

    expect([s.station.name, s.station.slug, s.station.stationNo]).toEqual([page.name, page.slug, STATION_NO]);
    expect(s.pageUrl).toBe(`https://viafrei.de/de/station/${page.slug}`);
    const rows = section("departures").rows as { planned: string; line: string | null; destination: string | null; platform: string | null }[];
    expect(rows.map((r) => [r.planned, r.line ?? "", r.destination ?? "", r.platform ?? ""])).toEqual(page.board.slice(0, rows.length));
    expect(rows.length).toBe(page.board.length);
    const units = section("lifts").units as { kind: string; state: string; reason: string | null }[];
    expect(units.map((u) => [u.kind, u.state, u.reason ?? ""])).toEqual(page.lifts);
    expect(units[0]?.state).toBe("inactive");
    const alerts = section("service_alerts").alerts as { header: string; atStation: boolean; lines: string[] }[];
    expect(alerts.map((a) => [a.header, a.atStation, a.lines])).toEqual(page.alerts);

    // #988: the rail Ampel — the tool's lamp, reasons and line lamps are the page's for the same station and minute
    const ampel = section("rail_ampel") as unknown as { lamp: string; trips: number; reasons: unknown[]; lines: { line: string; long: boolean; lamp: string; trips: number }[] };
    expect(page.ampel.trips).toBe(4);
    expect(page.ampel.lamp).toBe("yellow");
    expect([ampel.lamp, ampel.trips, ampel.reasons]).toEqual([page.ampel.lamp, page.ampel.trips, JSON.parse(JSON.stringify(page.ampel.reasons))]);
    expect(ampel.lines).toEqual(page.ampel.lines.map((l) => ({ line: l.line, long: l.long, lamp: l.lamp, trips: l.trips })));
    expect(page.ampel.lines.find((l) => l.line === "S 11")?.lamp).toBe("yellow");
    expect(tool.content.map((x) => x.text).join("\n")).toContain("Bahn-Ampel: Gelb — Störungsmeldungen: 2");

    expect(s.sections.map((x) => x.id)).toEqual(["header", "rail_ampel", "step_free_now", "lifts", "departures", "service_alerts", "parking_charging", "attribution"]);
    // The alerts are DELFI's CC BY-SA: the share-alike sentence names them, and nothing else is share-alike here.
    expect(JSON.stringify(tool._meta)).toContain("DELFI-Störungsmeldungen");
    expect(tool.content.map((x) => x.text).join("\n")).toContain("DELFI");
  });
});
