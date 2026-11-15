/**
 * "What ViaFrei does not answer" on the connect page (#142, #449).
 *
 * The server says it in `viafrei://coverage` (`notCovered`, English, read at
 * build into `generated/catalogue.json`). The page says it in the page's own
 * language, from the copy deck (`connectPage.notCovered.<key>`), and this
 * table binds each of the server's lines to the deck key that translates it.
 * `test/pages-content.test.ts` asserts the table's server lines ARE the
 * catalogue's, in order and in number — so a limit the server adds or rewords
 * fails the build until it has a translation, and the page can never list
 * fewer limits than the server states.
 */
import type { MessageKey } from "../i18n/index.js";

export const NOT_COVERED: readonly { readonly server: string; readonly key: MessageKey }[] = [
  {
    server: "No door-to-door routing or journey planning — ViaFrei answers about places, roads and feeds, never 'how do I get there'.",
    key: "connectPage.notCovered.routing",
  },
  {
    server:
      "No city-street traffic beyond the city and Land feeds we carry: street works, closures and traffic messages for Berlin, Cologne (closures for events), Hannover (once its feed publishes), Schleswig-Holstein including Kiel, and Baden-Württemberg including Stuttgart. Other cities are not covered; elsewhere the live traffic we hold is the federal motorway network (Autobahn GmbH) and, where a feed carries them, federal roads, plus roadworks on Land roads in Lower Saxony, Saxony and Thuringia.",
    key: "connectPage.notCovered.cityStreets",
  },
  { server: "No fares, tickets or booking of any kind.", key: "connectPage.notCovered.fares" },
  {
    server: "No punctuality figure for one named line — 'is the S1 on time?' is answered train by train at a railway station (the live delay of each departing train, S-Bahn included) and per region with the line's service alerts; a bus, tram or U-Bahn stop gets the timetable only.",
    key: "connectPage.notCovered.lineRealtime",
  },
  { server: "No weather forecast — official DWD warnings only, and only while they are in force.", key: "connectPage.notCovered.forecast" },
  {
    server: "No parking tariffs, and no promise that a space is free unless the operator publishes occupancy (see the parking section).",
    key: "connectPage.notCovered.parkingTariffs",
  },
];
