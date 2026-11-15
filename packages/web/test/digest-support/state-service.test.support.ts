/**
 * #1074: a planted database for the Land pages' service — the three statements it reads, answered from fixtures, every
 * question recorded. Shared by the route test and the app's licence sweep. Test support: never imported at runtime.
 */
import type pg from "pg";
import {
  JAM_HISTORY_SQL,
  JAM_USUAL_SQL,
  LAND_TRAFFIC_SQL,
  LAND_TRAFFIC_TICK_SQL,
  LIVE_FEEDS_CHECKED_SQL,
  MOTORWAY_PLAN_CHECKS_SQL,
  MOTORWAY_PLANS_SQL,
  type JamUsualRow,
  type LandTrafficRow,
  type MotorwayPlanCheck,
  type MotorwayPlanRow,
  type Queryable,
} from "@viafrei/ingest";
import { WARNINGS_CHECKED_SQL } from "../../../../.pinned/app/packages/digest/dist/src/cards/warnings/sql.js";
import {
  STATE_ALERTS_SQL,
  STATE_CITIES_SQL,
  STATE_EXTENTS_SQL,
  STATE_JAM_HOURS_SQL,
  STATE_JAM_PLACES_SQL,
  STATE_POINTS_LAND_SQL,
  STATE_ROADS_SQL,
  STATE_WARNINGS_SQL,
  type StateAlertRow,
  type StateCityRow,
  type StateExtentRow,
  type StateJamHourRow,
  type StateJamPlaceRow,
  type StatePointLandRow,
  type StateWarningRow,
} from "../../../../.pinned/app/packages/digest/dist/src/queries/state-pages.sql.js";
import { PUNCTUALITY_DIGEST_SQL, type PunctualityRow } from "../../../../.pinned/app/packages/digest/dist/src/queries/transit.sql.js";

export const STATE_AT = new Date("2026-11-03T10:00:00Z");

export type StateAsked = { readonly text: string; readonly params: readonly unknown[] };
export type StateFakeDb = Queryable & { readonly asked: StateAsked[] };

export const stateRow = (o: Partial<LandTrafficRow> = {}): LandTrafficRow => ({
  source: "autobahn",
  road: "A9",
  kind: "closure",
  ext_id: "x1",
  title: "A9 | AS München-Nord",
  subtitle: "Nürnberg -> München",
  abnormal_traffic_type: null,
  delay_s: null,
  site_extents: null,
  starts_at: null,
  lat: 48.2,
  lon: 11.6,
  land: "09",
  ...o,
});

const result = (rows: readonly unknown[]): pg.QueryResult => ({ rows: [...rows], rowCount: rows.length, command: "SELECT", oid: 0, fields: [] });

/** #1182: Bayern's box, for its map. */
export const STATE_EXTENT_BY: StateExtentRow = { land: "09", lat0: 47.3, lat1: 50.5, lon0: 9.0, lon1: 13.8 };

export function stateDb(
  o: {
    readonly tick?: Date | null;
    readonly rows?: readonly LandTrafficRow[];
    readonly cities?: readonly StateCityRow[];
    readonly fail?: () => boolean;
    /** #1182: the later sections' answers; a statement named in `failExtra` is rejected. */
    readonly extents?: readonly StateExtentRow[];
    readonly warnings?: readonly StateWarningRow[];
    readonly checkedAt?: Date | null;
    readonly punctuality?: readonly PunctualityRow[];
    readonly failExtra?: readonly StateExtraKey[];
    /** #1182: the return features' answers (each empty by default: no jam hour, no road ticked, no alert feed current). */
    readonly jamHours?: readonly StateJamHourRow[];
    readonly jamPlaces?: (params: readonly unknown[]) => readonly StateJamPlaceRow[];
    readonly jamOldest?: Date | null;
    readonly usual?: readonly JamUsualRow[];
    readonly roads?: readonly string[];
    readonly planChecks?: readonly MotorwayPlanCheck[];
    readonly plans?: readonly MotorwayPlanRow[];
    readonly pointLands?: readonly StatePointLandRow[];
    readonly alertChecks?: readonly { feed_key: string; checked_at: Date | null; cadence_s: number | null; paused: boolean }[];
    readonly alerts?: readonly StateAlertRow[];
  } = {},
): StateFakeDb {
  // the jam-history gate is process-wide (`JAM_HISTORY_GATE`): its own statement is answered, never asserted on here
  const asked: StateAsked[] = [];
  const query = (text: string, params: readonly unknown[] = []): Promise<pg.QueryResult> => {
    asked.push({ text, params });
    if (o.fail?.() === true) return Promise.reject(new Error("boom"));
    if (text === LAND_TRAFFIC_TICK_SQL) return Promise.resolve(result([{ tick: o.tick === undefined ? new Date(STATE_AT.getTime() - 120_000) : o.tick, roads: 3 }]));
    if (text === LAND_TRAFFIC_SQL) return Promise.resolve(result(o.rows ?? [stateRow()]));
    if (text === STATE_CITIES_SQL) return Promise.resolve(result(o.cities ?? [{ ags: "09162000", name: "München" }]));
    const x = (k: StateExtraKey, rows: readonly unknown[]): Promise<pg.QueryResult> =>
      o.failExtra?.includes(k) === true ? Promise.reject(new Error(`${k} down`)) : Promise.resolve(result(rows));
    if (text === STATE_EXTENTS_SQL) return x("extents", o.extents ?? [STATE_EXTENT_BY]);
    if (text === STATE_WARNINGS_SQL) return x("warnings", o.warnings ?? []);
    if (text === WARNINGS_CHECKED_SQL) return x("checked", [{ checked_at: o.checkedAt === undefined ? new Date(STATE_AT.getTime() - 60_000) : o.checkedAt, cadence_s: 300 }]);
    if (text === PUNCTUALITY_DIGEST_SQL) return x("punctuality", o.punctuality ?? []);
    if (text === STATE_JAM_HOURS_SQL) return x("jamHours", o.jamHours ?? []);
    if (text === STATE_JAM_PLACES_SQL) return x("jamPlaces", o.jamPlaces?.(params) ?? []);
    if (text === JAM_HISTORY_SQL) return x("usual", [{ oldest: o.jamOldest === undefined ? new Date(STATE_AT.getTime() - 60 * 86_400_000) : o.jamOldest }]);
    if (text === JAM_USUAL_SQL) return x("usual", o.usual ?? []);
    if (text === STATE_ROADS_SQL) return x("plans", (o.roads ?? []).map((road) => ({ road })));
    if (text === MOTORWAY_PLAN_CHECKS_SQL) return x("plans", o.planChecks ?? []);
    if (text === MOTORWAY_PLANS_SQL) return x("plans", o.plans ?? []);
    if (text === STATE_POINTS_LAND_SQL) return x("plans", o.pointLands ?? []);
    if (text === LIVE_FEEDS_CHECKED_SQL) return x("alerts", o.alertChecks ?? []);
    if (text === STATE_ALERTS_SQL) return x("alerts", o.alerts ?? []);
    return Promise.reject(new Error(`unexpected statement: ${text.slice(0, 40)}`));
  };
  return { asked, query: query as Queryable["query"] };
}

/** The later sections' statements a test may fail one by one. */
export type StateExtraKey = "extents" | "warnings" | "checked" | "punctuality" | "jamHours" | "jamPlaces" | "usual" | "plans" | "alerts";
