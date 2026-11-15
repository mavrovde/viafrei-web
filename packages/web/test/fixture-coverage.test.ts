/**
 * The page-weight fixture covers every source production can count (review
 * S2, v1.8.18). `e2e/real-digest.ts` renders the charging and lorry-parking
 * tiles with one line per source, and each line costs ~500 B in Russian; a
 * feed added to the registry and not to the fixture is a page the budget
 * under-weighs — the shape that let the homes reach 151 KB while the gate was
 * green. So the list is DERIVED from the registries, never typed here:
 *
 * - charging: every `charging_static` feed of `CHARGING_FEEDS` (the profile that
 *   writes `charging_sites`), except the Ladesäulenregister, which the tile's
 *   statement leaves out (`PLACES_DIGEST_SQL`);
 * - parking: every feed of the Mobilithek, Hamburg and direct registries whose
 *   loader writes facilities into the SHARED `parking_facilities` table — an
 *   ODbL or share-alike row goes to its own table, which the tile never reads,
 *   and so does a GATED feed's site (the SID static offer, #1274 C7: its own
 *   `parking_facilities_sid`, read only after acceptance, never by the tile);
 * - plus the Autobahn GmbH, the one provider worker that writes both tables
 *   (`parking_lorry`, `electric_charging_station`) and has no feed-registry row;
 * - and only sources whose register row carries an attribution line, because a
 *   source with none contributes nothing to the tile (`buildPlaces`).
 */
import { buildDigest } from "@viafrei/digest";
import {
  BNETZA_LSR_FEED,
  CHARGING_FEEDS,
  DIRECT_FEEDS,
  gatedOccupancyOf,
  HAMBURG_PARKING_FEEDS,
  LICENCE_CATALOGUE,
  MOBILITHEK_FEEDS,
  parkingFacilityTable,
  writesParkingFacilities,
} from "@viafrei/ingest";
import { describe, expect, it } from "vitest";
import { fixtureSnapshot } from "../e2e/real-digest.js";

const PROVIDER_WRITING_BOTH = "autobahn";
const attributable = (licence: string): boolean => (LICENCE_CATALOGUE[licence]?.attribution ?? null) !== null;

function chargingLicences(): readonly string[] {
  const feeds = CHARGING_FEEDS.filter((f) => f.profile === "charging_static" && f.key !== BNETZA_LSR_FEED).map((f) => f.licence);
  return [...new Set([...feeds, PROVIDER_WRITING_BOTH])].filter(attributable).sort();
}

function parkingLicences(): readonly string[] {
  const mobilithek = MOBILITHEK_FEEDS.filter((f) => writesParkingFacilities("profile" in f ? f.profile : undefined)).map((f) => f.licence);
  // A direct feed declaring `facilitiesFrom` writes occupancy ONTO another feed's
  // facility rows and none of its own (Dortmund's portal, #548), so it is no line here.
  const direct = DIRECT_FEEDS.filter((f) => !("facilitiesFrom" in f) || f.facilitiesFrom === undefined).map((f) => f.licence);
  const all = [...mobilithek, ...HAMBURG_PARKING_FEEDS.map((f) => f.licence), ...direct];
  return [...new Set([...all.filter((l) => gatedOccupancyOf(l)?.facilityTable === undefined && parkingFacilityTable(l) === "parking_facilities"), PROVIDER_WRITING_BOTH])].filter(attributable).sort();
}

describe("the page-weight fixture counts every source production can (review S2)", () => {
  const report = buildDigest({ snapshot: fixtureSnapshot() });
  const shown = (xs: readonly { attribution: { licenceId: string } }[]): string[] => [...new Set(xs.map((x) => x.attribution.licenceId))].sort();

  it("charging: one line per charging_static feed with a register line, and the Autobahn GmbH", () => {
    expect(chargingLicences().length, "the derivation read the registry").toBeGreaterThanOrEqual(5);
    expect(shown(report.places.charging), "extend `place(\"charging\", …)` in e2e/real-digest.ts for each missing source").toEqual(chargingLicences());
  });

  it("parking: one line per feed writing the shared parking_facilities table with a register line, and the Autobahn GmbH", () => {
    expect(parkingLicences().length, "the derivation read the registry").toBeGreaterThanOrEqual(5);
    // #799: the shared table feeds two tiles — lorry parks (`parking`) and city car parks (`carparks`) — so the
    // fixture covers the register across both, and each tile holds some of it.
    expect(shown([...report.places.parking, ...report.places.carparks]), "extend `place(\"parking\" | \"carparks\", …)` in e2e/real-digest.ts for each missing source").toEqual(parkingLicences());
    expect(report.places.parking.length, "the lorry tile has lorry sources").toBeGreaterThan(0);
    expect(report.places.carparks.length, "the car-park tile has city sources").toBeGreaterThan(0);
  });

  it("the derivation can say NO: an ODbL or share-alike parking feed is not expected, and a feed without a line is not either", () => {
    expect(parkingFacilityTable("mobilithek_park_trucklounge")).not.toBe("parking_facilities");
    expect(parkingLicences()).not.toContain("mobilithek_park_trucklounge");
    expect(parkingLicences()).not.toContain("mobilithek_park_nrw_pr");
    expect(chargingLicences()).not.toContain(BNETZA_LSR_FEED);
    // #1274 (C7): the SID's static sites go to the gate's own table, never the shared one the tile reads.
    expect(gatedOccupancyOf("toll_collect_sid")?.facilityTable).toBe("parking_facilities_sid");
    expect(parkingLicences()).not.toContain("toll_collect_sid");
  });
});
