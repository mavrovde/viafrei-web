/**
 * The motorway pages of #715 (2.1.13): `/<lang>/autobahn/<road>` in every
 * language since #892 (the motorway word is `autobahn` everywhere, owner
 * 2026-10-21), the road the canonical number in lower case (`a3`), and the
 * index `/<lang>/autobahn` (`pages.ts` "motorways"). A stretch of a motorway
 * is a path below its page (#892): `/de/autobahn/a7/nesselwang-to-kempten`,
 * `/…/exit-138-nesselwang`, with `/towards-wuerzburg` after it — the segments
 * the digest builds (`analysis/motorway-view.ts` filterPath). The digest builds the same paths for its links
 * (`packages/digest/src/presentation/place-tiles.ts` motorwayPath), and what a
 * motorway number IS is `@viafrei/ingest` platform/motorway.ts; the site may
 * import neither at runtime (`scripts/check_web_boundary.sh`), so
 * `test/motorway-routes.test.ts` pins both copies to theirs.
 *
 * There is no 404 on a motorway address (owner 2026-10-14): a spelling that
 * names a motorway (`A 3`, `a03`, `BAB3`) is a 301 to its page, a motorway
 * the register does not hold and anything else a 301 to the index.
 */
import { pathFor, type Lang } from "./pages.js";
import { ROUTE_WORDS } from "./slug.js";

/** The canonical shape: `A`, then 1–3 digits, no leading zero. */
export const MOTORWAY_NUMBER = /^A[1-9][0-9]{0,2}$/;

export function canonicalMotorway(raw: string): string | null {
  const m = /^\s*(?:a|bab|autobahn)\s*[-.\s]?\s*0*([1-9][0-9]{0,2})\s*$/iu.exec(raw);
  if (m === null) return null;
  const road = `A${m[1] ?? ""}`;
  return MOTORWAY_NUMBER.test(road) ? road : null;
}

export function compareMotorways(a: string, b: string): number {
  const n = (r: string): number => (MOTORWAY_NUMBER.test(r) ? Number(r.slice(1)) : Number.MAX_SAFE_INTEGER);
  return n(a) - n(b) || a.localeCompare(b, "en");
}

export const motorwaySlug = (road: string): string => road.toLowerCase();

/** The path segment of a motorway page: `autobahn` in every language (#892). */
export const MOTORWAY_SEGMENT = ROUTE_WORDS.autobahn;

export function motorwayPath(lang: Lang, road: string): `/${string}` {
  return `${pathFor("motorways", lang)}/${motorwaySlug(road)}`;
}

/**
 * The static motorway register (#716 G3/G7): the site's copy of
 * `MOTORWAY_REGISTER` in `@viafrei/ingest` domain/roads/motorway-register.ts (the
 * site may not import it), held equal by `test/motorway-716.test.ts`. A
 * page view on a motorway page is sent with the CANONICAL path of a road on
 * this list and nothing else (`analytics/listener.ts`).
 */
export const MOTORWAY_REGISTER: readonly string[] = Object.freeze([
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12", "A13", "A14", "A15", "A17", "A19", "A20", "A21", "A23",
  "A24", "A25", "A26", "A27", "A28", "A29", "A30", "A31", "A33", "A34", "A36", "A37", "A38", "A39", "A40", "A42", "A43", "A44", "A45", "A46",
  "A48", "A49", "A52", "A57", "A59", "A60", "A61", "A62", "A63", "A64", "A65", "A66", "A67", "A70", "A71", "A72", "A73", "A81", "A92", "A93",
  "A94", "A95", "A96", "A98", "A99", "A100", "A103", "A111", "A113", "A114", "A115", "A117", "A143", "A210", "A215", "A226", "A255", "A261", "A270", "A280",
  "A281", "A293", "A320", "A352", "A369", "A391", "A392", "A445", "A448", "A480", "A485", "A516", "A524", "A535", "A542", "A544", "A553", "A555", "A559", "A560",
  "A562", "A565", "A571", "A573", "A602", "A620", "A623", "A640", "A643", "A648", "A650", "A656", "A659", "A661", "A671", "A672", "A831", "A861", "A864", "A952",
  "A980", "A995",
]);

/** #1025: an exit page of a motorway — `/<lang>/autobahn/a24/exit-1-hamburg-horn`, the digest's `exitSlug` segment below the road's page. */
export function motorwayExitPath(lang: Lang, road: string, segment: string): `/${string}` {
  return `${motorwayPath(lang, road)}/${segment}`;
}

/** The canonical motorway page a path IS (a road of the register, its language's segment, lower case), or null. */
export function motorwayPageAt(path: string): { readonly road: string; readonly lang: Lang } | null {
  const m = /^\/([a-z]{2})\/autobahn\/(a[1-9][0-9]{0,2})$/.exec(path);
  if (m === null) return null;
  const lang = m[1] as Lang;
  const road = (m[2] ?? "").toUpperCase();
  if (!MOTORWAY_REGISTER.includes(road)) return null;
  return motorwayPath(lang, road) === path ? { road, lang } : null;
}

/** The motorway page a path is ON (#892): its own canonical page, or a stretch below it (`/de/autobahn/a7/x-to-y`) — the road's page either way. */
export function motorwayPageOf(path: string): { readonly road: string; readonly lang: Lang } | null {
  const m = /^(\/[a-z]{2}\/autobahn\/a[1-9][0-9]{0,2})(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$/.exec(path);
  return m === null ? null : motorwayPageAt(m[1]!);
}

/** The motorways the home and the place pages link to: the nine one-digit motorways, every one a page. */
export const LINKED_MOTORWAYS: readonly string[] = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"];
