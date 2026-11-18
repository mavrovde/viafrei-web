/**
 * #895 phase 3 (steward AM2, lesson §259): the motorway page's Ampel and
 * `check_autobahn_traffic`'s Ampel give the SAME lamp over the same rows —
 * "the tool must not say green where the page says yellow".
 *
 * A CONTRACT test, which is why it lives here (the digest may not import the
 * MCP server, and the server has no reason to import the digest — the
 * `city-jams-agreement.test.ts` pattern). One rolled-back transaction on the
 * throwaway test database plants a motorway (three BASt LCL junctions in a
 * Niedersachsen Gemeinde), one Autobahn GmbH item that gives no colour (works
 * on a ramp), the feeds' checks, and per case what changes the lamp. Then the
 * page is read AS `viafrei_digest` (`readMotorwayPage` → `pageAmpel`, whole
 * road) and the tool is called AS `viafrei_mcp` (its real handler through the
 * in-memory MCP client), and the two lamps — and the sight per group — are
 * compared:
 *
 *  - quiet, every group seen: green both;
 *  - a police message (NMS) on the motorway, a wrong-way driver: red both;
 *  - the relay's feed not checked: Niedersachsen's police sight is missing —
 *    yellow both (before phase 3 the tool said green here);
 *  - a slippery slot at a road-weather station on the line: yellow both, and
 *    the tool credits `dwd_road` with its altered line (T1, T2);
 *  - a police message about another road: green both.
 */
import { refreshMotorwaySummary } from "@viafrei/ingest";
import { testDb } from "@viafrei/ingest/testing";
import { boundedReasons, isReasonGroup } from "@viafrei/ingest";
import { ampelFamily, pageAmpel, readMotorwayPage } from "@viafrei/digest";
import { connectInMemory } from "@viafrei/mcp";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let admin: pg.Pool;
let reachable = true;
beforeAll(async () => {
  ({ pool: admin, reachable } = await testDb(`do $$ begin if to_regclass('motorway_summary_live') is null then raise exception 'migrate with the pinned viafrei-database image (database.pin)'; end if; end $$`));
});
afterAll(async () => {
  await admin?.end();
});

const ROAD = "A998";
const LAT = 51.5;

type Case = { readonly nmsChecked?: boolean; readonly police?: "wrongWay" | "otherRoad"; readonly slippery?: boolean; readonly many?: boolean };
/** One listed reason as both sides can say it: its lamp, its kind (a ramp closure is a closure) and, for a group, its count. */
type Shape = readonly [string, string, number | null];

async function checked(c: pg.PoolClient, feedKey: string, at: Date): Promise<void> {
  await c.query(
    `insert into feed_catalog (feed_key, provider, display_name, licence_id, cadence_s, enabled)
     values ($1, 'test', $1, 'test', 600, true)
     on conflict (feed_key) do update set cadence_s = excluded.cadence_s, closed_at = null`,
    [feedKey],
  );
  await c.query(`insert into feed_runs (feed_key, started_at, finished_at, status, items_seen) values ($1, $2::timestamptz - interval '10 seconds', $2::timestamptz, 'ok', 1)`, [feedKey, at]);
}

/** The two lamps (and sights) over one planted world. */
async function bothLamps(k: Case): Promise<{
  page: { lamp: string; sight: unknown[]; reasons: Shape[]; reasonCounts: unknown; reasonsTotal: number; listedRows: { closure: number; rampClosure: number; roadworks: number; rampMessages: number; worksMessages: number; more: number } };
  tool: { lamp: string; sight: unknown[]; sources: string[]; attribution: string; reasons: Shape[]; reasonCounts: unknown; reasonsTotal: number };
}> {
  const c = await admin.connect();
  try {
    await c.query("begin");
    const now = new Date();
    const tick = new Date(now.getTime() - 60_000);
    await c.query("delete from road_events where feed_key in ('nms_events', 'bridges_sh', 'traffic_sh')");
    await c.query("delete from feed_runs where feed_key in ('nms_events', 'dwd_warnings', 'dwd_road_forecast')");
    await c.query("insert into autobahn_roads (road, last_listed_at) values ($1, now()) on conflict (road) do nothing", [ROAD]);
    for (const [i, name] of [[1, "Nord"], [2, "Mitte"], [3, "Ende"]] as const) {
      await c.query(
        `insert into tmc_locations (cid, tabcd, lcd, lcl_version, class, tcd, stcd, junction_no, name, road_number, neg_off_lcd, pos_off_lcd, geom)
         values (58, 1, $1, '22.0', 'P', 1, 3, $2, $3, $4, $5, $6, st_setsrid(st_makepoint($7, $8), 4326)::geography)`,
        [998_000 + i, String(i), name, ROAD, i > 1 ? 998_000 + i - 1 : null, i < 3 ? 998_000 + i + 1 : null, 9.9 + i * 0.02, LAT],
      );
    }
    await c.query(
      `insert into gazetteer_places (kind, name, name_norm, admin_code, population, geom, source_id, external_id)
       values ('city', 'Testhausen', 'testhausen', '03159998', 20000, st_setsrid(st_makepoint(9.94, 51.51), 4326)::geography, 'bkg_gvisys', 'x895p')`,
    );
    // The one Autobahn GmbH item: works on a ramp, which narrow no carriageway and give no colour on either side.
    await c.query(
      `insert into autobahn_events (observed_at, road, kind, ext_id, title, subtitle, abnormal_traffic_type, delay_s, geom, extent, raw, source)
       values ($1, $2, 'roadworks', 'zz895-r1', $3, 'Nord -> Ende (aus Richtung Hamburg)', null, null, st_setsrid(st_makepoint(9.93, $4), 4326)::geography, null, $5::jsonb, 'autobahn')`,
      [tick, ROAD, `${ROAD} | AS Mitte`, LAT, JSON.stringify({ isBlocked: "false", description: ["Arbeiten an der Anschlussstelle"] })],
    );
    if (k.many === true) {
      // 2.3.10: a road with many works and ramp closures (the prod A7's shape, smaller): one closure, 14 works, 6 ramp closures, each its own site.
      const rows: [string, string, string, string, string][] = [["zz895-c", "closure", `${ROAD} | Vollsperrung Brueckenbau`, "Nord -> Ende", "Vollsperrung"]];
      for (let n = 0; n < 14; n++) rows.push([`zz895-w${String(n)}`, "roadworks", `${ROAD} | Werk k${String(n)}x`, "Nord -> Ende", "Fahrbahnerneuerung"]);
      for (let n = 0; n < 6; n++) rows.push([`zz895-a${String(n)}`, "closure", `${ROAD} | Rampe q${String(n)}x`, "Nord -> Ende (aus Richtung Hamburg)", "Auffahrt gesperrt"]);
      for (const [n, [id, kind, title, subtitle, what]] of rows.entries())
        await c.query(
          `insert into autobahn_events (observed_at, road, kind, ext_id, title, subtitle, abnormal_traffic_type, delay_s, geom, extent, raw, source)
           values ($1, $2, $3, $4, $5, $6, null, null, st_setsrid(st_makepoint($7, $8), 4326)::geography, null, $9::jsonb, 'autobahn')`,
          [tick, ROAD, kind, id, title, subtitle, 9.921 + n * 0.0025, LAT, JSON.stringify({ isBlocked: "false", description: [subtitle.includes("aus Richtung") ? `Auffahrt auf die ${ROAD}: ${what}` : `${ROAD}: Nord -> Ende, zwischen Nord und Mitte`, what] })],
        );
    }
    await checked(c, "dwd_warnings", new Date(now.getTime() - 60_000));
    if (k.nmsChecked !== false) await checked(c, "nms_events", new Date(now.getTime() - 60_000));
    if (k.police !== undefined) {
      const road = k.police === "wrongWay" ? ROAD : "B998";
      await c.query(
        `insert into road_events (feed_key, source_id, publication_id, version, event_type, road_number, overall_start, overall_end, payload, geom)
         values ('nms_events', 'DE-MIA', ' NI LMS-NI/zz895-1', 1, 'vehicleObstruction', $1, $2, $3, $4::jsonb, st_setsrid(st_makepoint(9.95, $5), 4326))`,
        [road, new Date(now.getTime() - 3_600_000), new Date(now.getTime() + 3_600_000), JSON.stringify({ situationRecord: [{ validity: [{ validityStatus: [{ "#text": "definedByValidityTimeSpec" }] }], generalPublicComment: [{ comment: { values: { value: { "#text": "A998 Nord Richtung Ende: Falschfahrer zwischen Nord und Mitte" } } } }] }] }), LAT],
      );
    }
    if (k.slippery === true) {
      await checked(c, "dwd_road_forecast", new Date(now.getTime() - 60_000));
      await c.query(
        `insert into road_weather_stations (station_id, source_id, name, segment_type, geom, position_source, raw, source_feed)
         values ('Z895', 'dwd_road', 'Testbrücke', 2, st_setsrid(st_makepoint(9.94, $1), 4326)::geography, 'swsKatalog', '{}'::jsonb, 'dwd_road_catalogue')`,
        [LAT],
      );
      const run = new Date(now.getTime() - 3_600_000);
      for (const h of [1, 2, 3]) {
        await c.query(`insert into road_weather_forecast (station_id, valid_at, run_at, source_id, source_run_id, rc, ts) values ('Z895', $1, $2, 'dwd_road', 0, 4, -2)`, [new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000 + (h - 1) * 3_600_000), run]);
      }
    }
    await refreshMotorwaySummary(c, (fn) => fn(c), now);

    await c.query("set local role viafrei_digest");
    const page = await readMotorwayPage(c, ROAD, now);
    const pa = pageAmpel(page);
    await c.query("reset role");

    await c.query("set local role viafrei_mcp");
    const client = await connectInMemory({ db: c, now: () => now });
    const r = (await client.callTool({ name: "check_autobahn_traffic", arguments: { roads: [ROAD], language: "de" } })) as {
      structuredContent?: { byRoad?: { ampel: { lamp: string; sight: unknown[]; reasons: { lamp: string; kind: string; count?: number }[]; reasonCounts: unknown; reasonsTotal: number } }[] };
      _meta?: { sources?: string[]; attribution?: string };
      content: { text: string }[];
    };
    await client.close();
    const ta = r.structuredContent?.byRoad?.[0]?.ampel;
    if (ta === undefined) throw new Error(`the tool gave no Ampel: ${r.content[0]?.text ?? ""}`);
    const pb = boundedReasons(pa.reasons, ampelFamily);
    const pageShapes: Shape[] = pb.listed.map((x): Shape =>
      isReasonGroup(x) ? ["yellow", x.group === "rampClosure" ? "closure" : "roadworks", x.count] : "sight" in x ? [x.lamp, "sight", null] : [x.lamp, x.signal.kind, null],
    );
    // #911: the page's Ampel counts the rows its lists show (a folded row once); these are those rows by reason key.
    const rows = page.live.state === "live" ? page.live : null;
    // The keys by `worksSignal`'s rule: a row of the closures list is a closure by its scope, blocked or not; a works
    // row (never blocked: `listsOf` lists those as closures) narrows the carriageway unless it is on a ramp.
    const carriageway = (i: { readonly scope?: string | null }): boolean => (i.scope ?? "carriageway") !== "ramp";
    const closures = rows?.closures ?? [];
    const works = (rows?.roadworks ?? []).filter(carriageway);
    const ramps = closures.filter((i) => !carriageway(i));
    const listedRows = {
      closure: closures.filter(carriageway).length,
      rampClosure: ramps.length,
      roadworks: works.length,
      // the messages those rows stand for (each row's `copies`), and what the listing held beyond the lists
      rampMessages: ramps.reduce((n, i) => n + i.copies, 0),
      worksMessages: works.reduce((n, i) => n + i.copies, 0),
      more: (rows?.moreClosures ?? 0) + (rows?.moreRoadworks ?? 0),
    };
    return {
      page: { lamp: pa.lamp, sight: [...pa.sight], reasons: pageShapes, reasonCounts: pb.reasonCounts, reasonsTotal: pb.reasonsTotal, listedRows },
      tool: {
        lamp: ta.lamp,
        sight: ta.sight,
        sources: r._meta?.sources ?? [],
        attribution: r._meta?.attribution ?? "",
        reasons: ta.reasons.map((x): Shape => [x.lamp, x.kind, x.count ?? null]),
        reasonCounts: ta.reasonCounts,
        reasonsTotal: ta.reasonsTotal,
      },
    };
  } finally {
    await c.query("rollback");
    c.release();
  }
}

describe("the page's Ampel and the tool's give the same lamp over the same rows (AM2)", () => {
  it("quiet, every group seen: green on both", async ({ skip }) => {
    if (!reachable) skip();
    const { page, tool } = await bothLamps({});
    expect(page.lamp).toBe("green");
    expect(tool.lamp).toBe(page.lamp);
    expect(tool.sight).toEqual(page.sight);
    expect(page.sight).toContainEqual({ group: "police", state: "fresh", land: "03" });
  });
  it("a police message on the motorway, a wrong-way driver: red on both, the NMS line credited by the tool", async ({ skip }) => {
    if (!reachable) skip();
    const { page, tool } = await bothLamps({ police: "wrongWay" });
    expect(page.lamp).toBe("red");
    expect(tool.lamp).toBe("red");
    expect(tool.sources).toContain("mobilithek_nms_events");
  });
  it("the relay's feed not checked: Niedersachsen's police sight is missing — yellow on both (the tool said green before phase 3)", async ({ skip }) => {
    if (!reachable) skip();
    const { page, tool } = await bothLamps({ nmsChecked: false });
    expect(page.lamp).toBe("yellow");
    expect(tool.lamp).toBe("yellow");
    expect(tool.sight).toEqual(page.sight);
    expect(tool.sight).toContainEqual({ group: "police", state: "missing", land: "03" });
  });
  it("a slippery slot at a road-weather station on the line: yellow on both; the tool credits dwd_road with its altered line", async ({ skip }) => {
    if (!reachable) skip();
    const { page, tool } = await bothLamps({ slippery: true });
    expect(page.lamp).toBe("yellow");
    expect(tool.lamp).toBe("yellow");
    expect(tool.sources).toContain("dwd_road");
    expect(tool.attribution).toContain("Datenbasis: Deutscher Wetterdienst, zusammengefasst. Datenquelle: BMVBS");
  });
  it("a police message about another road: green on both", async ({ skip }) => {
    if (!reachable) skip();
    const { page, tool } = await bothLamps({ police: "otherRoad" });
    expect(page.lamp).toBe("green");
    expect(tool.lamp).toBe("green");
  });
  it("2.3.10: many works and ramp closures — the same bounded reasons on both: every red reason alone, one entry per kind; the tool counts the messages, the page the rows it lists (#911)", async ({ skip }) => {
    if (!reachable) skip();
    const { page, tool } = await bothLamps({ many: true });
    expect(page.lamp).toBe("red");
    expect(tool.lamp).toBe("red");
    // The tool counts every message; the page (2.4.1 `foldSeen`, #911) counts the rows it lists, a row a reader sees as
    // one entry once — so its counts are its lists' and never more than the tool's, and the red reasons are the same.
    expect(tool.reasonCounts).toEqual({ closure: 1, rampClosure: 6, roadworks: 14 });
    expect(tool.reasons).toEqual([["red", "closure", null], ["yellow", "closure", 6], ["yellow", "roadworks", 14]]);
    const l = page.listedRows;
    expect(page.reasonCounts).toEqual({ closure: l.closure, rampClosure: l.rampClosure, roadworks: l.roadworks });
    expect(page.reasonsTotal).toBe(l.closure + l.rampClosure + l.roadworks);
    // the fold ran (the fixture's rows read alike on its one stretch) and dropped no message: the page's rows stand for
    // every message the tool counts
    expect(l.closure).toBe(1);
    expect(l.rampClosure).toBeLessThan(6);
    expect(l.roadworks).toBeLessThan(14);
    expect(l.more).toBe(0);
    expect(l.rampMessages).toBe(6);
    expect(l.worksMessages).toBe(14);
    expect(page.reasons.map(([lamp, kind]) => [lamp, kind])).toEqual(tool.reasons.map(([lamp, kind]) => [lamp, kind]));
  });
});
