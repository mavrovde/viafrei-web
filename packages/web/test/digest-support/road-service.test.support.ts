/**
 * Fixtures for the road pages (#1027): one row of `ROAD_PAGE_SQL`, one of `ROAD_PAGE_LIST_SQL`, and a fake database
 * that answers each statement with its own rows and records what it was asked.
 */
import type pg from "pg";
import type { Queryable } from "@viafrei/ingest";
import { ROAD_PAGE_LIST_SQL, ROAD_PAGE_SQL, type RoadPageListRow, type RoadPageRow } from "../../../../.pinned/app/packages/digest/dist/src/queries/road-pages.sql.js";

export const ROAD_AT = new Date("2026-11-03T10:00:00.000Z");

export function roadRow(over: Partial<RoadPageRow> = {}): RoadPageRow {
  return {
    feed_key: "roadworks_nrw_lvz",
    source_id: "nrw_lvz",
    publication_id: "pub-1",
    event_type: "roadworks",
    road_number: "B 51",
    overall_start: new Date("2026-11-01T06:00:00.000Z"),
    overall_end: new Date("2026-11-20T16:00:00.000Z"),
    closed_at: null,
    first_seen_at: new Date("2026-11-01T06:05:00.000Z"),
    last_seen_at: new Date("2026-11-03T09:55:00.000Z"),
    lat: 51.96,
    lon: 7.63,
    in_force: true,
    fresh: true,
    ended_at: null,
    closes: false,
    place_text: "zwischen Telgte und Münster-Handorf",
    detail_text: "Fahrbahnerneuerung",
    detour_via: null,
    gem_ags: "05515000",
    gem_name: "Münster",
    ...over,
  };
}

export function roadListRow(over: Partial<RoadPageListRow> = {}): RoadPageListRow {
  return { road_key: "B51", feed_key: "roadworks_nrw_lvz", active: true, ended_at: null, first_seen_at: new Date("2026-11-01T06:05:00.000Z"), ...over };
}

export type RoadDb = Queryable & { readonly asked: { text: string; params: readonly unknown[] }[] };

/** A database that answers the page read with `rows` and the list read with `list`; `fail` makes every read throw. */
export function roadDb(o: { rows?: readonly RoadPageRow[]; list?: readonly RoadPageListRow[]; fail?: boolean } = {}): RoadDb {
  const asked: { text: string; params: readonly unknown[] }[] = [];
  return {
    asked,
    query: ((text: string, params?: readonly unknown[]) => {
      asked.push({ text, params: params ?? [] });
      if (o.fail === true) return Promise.reject(new Error("down"));
      const rows = text === ROAD_PAGE_SQL ? (o.rows ?? []) : text === ROAD_PAGE_LIST_SQL ? (o.list ?? []) : [];
      return Promise.resolve({ rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] } as unknown as pg.QueryResult);
    }) as Queryable["query"],
  };
}
