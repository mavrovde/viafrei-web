/**
 * #1153: what the header's place row says on first render — "Live für <Ort>", the two scope radios ("the place" and
 * "Ganz Deutschland") with their no-script links, the line saying how the place was found, and the configuration of
 * the headline's script (`PLACEHEAD_JS`). The header is the site's one search and location dispatcher (owner
 * 2026-11-03): every page renders it, and the page tells it only what the server already knows.
 *
 *  - The home and a place page: the place block's answer (`blockHeaderPlace`) — the IP rung's place, an address's
 *    `?at=`, `?scope=de`, or the place page's own place. Their location island runs in the body (it swaps the cards).
 *  - A motorway page with "around you" on: the around block's answer (`motorwayHeaderPlace`); its island runs in the
 *    body too.
 *  - Every other page: nothing is known on the server (`headerPlaceFor`) — no IP lookup is made for a page that shows
 *    no place's figures. The pill reads "Ort wählen" and links to the home, which runs the ladder; with script, the
 *    header's own island (`island: false`) names the place this device remembers.
 */
import { t } from "../i18n/index.js";
import { pathFor, type Lang } from "../site/pages.js";
import { placePath } from "../site/places.js";
import { scopeHrefs } from "./place-scope.js";
import type { PlaceFragment } from "./place.js";

export type HeaderPlace = {
  /** The place's name as shown, or null: no place ("Ganz Deutschland" is the radio that is on). */
  readonly label: string | null;
  /** The source line: how the place was found. */
  readonly how: string;
  /** The server's place is an IP guess: the confirm row is offered. */
  readonly ip: boolean;
  /** The place radio's and "Ganz Deutschland"'s no-script targets. */
  readonly hrefs: { readonly place: string; readonly germany: string };
  /** The line why a place is asked for. */
  readonly why: string;
  /** Which radio is on. */
  readonly scopeOn: "place" | "germany";
  /** Where the nationwide figures are (the home's band; a motorway page's main block). */
  readonly noteHref: string;
  /** The headline script's state (`placeHeadScript`). */
  readonly head: { readonly ip: boolean; readonly at: boolean; readonly label: string | null };
  /** True: the page prints the location island itself, in its body (it has cards to swap); false: the header prints it. */
  readonly island: boolean;
  /** The chip current on first render (a popular place's name), or null. */
  readonly chip: string | null;
  /** #1182: false — the header's island asks no exact position on this page (the station index, steward ruling 2026-11-08). */
  readonly spot?: false;
};

/** A page that shows no place's figures: nothing known, the home is where the pill and "Ganz Deutschland" go. */
export function headerPlaceFor(lang: Lang): HeaderPlace {
  const home = pathFor("start", lang);
  return {
    label: null,
    how: t(lang, "place.choose"),
    ip: false,
    hrefs: scopeHrefs(home, null),
    why: t(lang, "place.why"),
    scopeOn: "germany",
    noteHref: `${home}#now`,
    head: { ip: false, at: false, label: null },
    island: false,
    chip: null,
  };
}

/** The home's and a place page's place block (`PlaceBlock.astro`): its source, its place, its deferred IP place. */
export function blockHeaderPlace(
  lang: Lang,
  b: { readonly source: "ip" | "page" | "none" | "outside" | "chosen" | "germany"; readonly place: PlaceFragment | null; readonly deferred?: { readonly at: string } | null; readonly path: string },
): HeaderPlace {
  const { source, place, deferred = null, path } = b;
  const how =
    source === "ip" ? t(lang, "place.how.approx") : source === "page" || source === "chosen" ? t(lang, "place.how.chosen") : source === "germany" ? t(lang, "place.head.germanyHow") : source === "outside" ? t(lang, "place.head.outside") : t(lang, "place.choose");
  // #1088: null is "Ganz Deutschland" — the place radio then reads "Ort wählen" and the Germany radio is on.
  const label = place?.label ?? (deferred !== null ? t(lang, "tile.loading") : null);
  return {
    label,
    how,
    ip: source === "ip",
    // The no-script targets: the place's own page when it has one, else this page; "Ganz Deutschland" is `?scope=de`.
    hrefs: scopeHrefs(path, place?.slug !== undefined ? placePath(lang, place.slug) : null),
    why: t(lang, "place.why"),
    scopeOn: label === null ? "germany" : "place",
    // 2.4.5 review: the nationwide figures ("Ganz Deutschland") are the home's band (`#now`); a place page has none, so its note goes there
    noteHref: source === "page" ? `${pathFor("start", lang)}#now` : "#now",
    head: { ip: source === "ip" && label !== null, at: label !== null, label },
    island: true,
    chip: label,
  };
}

/** A motorway page's "around you" (`MotorwayPlace.astro`): the road, and the place the around block was asked for. */
export function motorwayHeaderPlace(
  lang: Lang,
  m: { readonly road: string; readonly server: { readonly source: "ip" | "none" | "outside" | "germany" | "chosen"; readonly at: string | null; readonly label: string | null }; readonly html: string | null; readonly path: string },
): HeaderPlace {
  const { road, server, html, path } = m;
  const shown = html !== null && server.at !== null;
  const how = shown ? t(lang, server.source === "chosen" ? "place.how.chosen" : "place.how.approx") : server.source === "germany" ? t(lang, "place.head.germanyHow") : t(lang, "place.choose");
  // The digest's Place-Label is the place alone (it is what may be remembered); the road is added only here, for the eye.
  const label = shown && server.label !== null && server.label !== "" ? `${road} · ${server.label}` : road;
  return {
    label,
    how,
    ip: shown && server.source === "ip",
    hrefs: scopeHrefs(path, shown && server.source === "chosen" ? `${path}?at=${server.at ?? ""}` : null),
    why: t(lang, "place.motorway.why"),
    // #1088: with no position the page is the whole road — "Ganz Deutschland" is the radio that is on.
    scopeOn: shown ? "place" : "germany",
    noteHref: "#motorway-main",
    head: { ip: shown && server.source === "ip", at: shown, label: shown ? label : null },
    island: true,
    chip: shown ? server.label : null,
  };
}
