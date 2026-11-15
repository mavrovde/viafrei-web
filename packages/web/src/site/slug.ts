/**
 * THE slug builder of viafrei.de (#892): one national rule for every public
 * URL — the place pages, the motorway stretches and junctions — and the
 * route words every page path is made of.
 *
 * The owner's rule (2026-10-21, amended the same day): every page word in a
 * URL is ENGLISH in every language, the language prefix being the only
 * language marker, and the motorway word is `autobahn` everywhere. Names
 * (Gemeinden, junctions) are slugged from their official German spelling:
 * ASCII, lower case, hyphen-joined, ä → ae, ö → oe, ü → ue, ß → ss, every
 * other Latin diacritic folded to its base letter, at most `SLUG_MAX`
 * characters, cut at a word boundary.
 *
 * Pure and dependency-free ON PURPOSE: `packages/web` may import no
 * database-holding workspace (`scripts/check_web_boundary.sh`), so it carries
 * a byte-identical copy at `packages/web/src/site/slug.ts`, and
 * `packages/web/test/slug.test.ts` fails when the two differ. Edit this file
 * and copy it; never edit the copy alone.
 */

/** The longest slug the builder returns (the issue's rule 1). */
export const SLUG_MAX = 80;

/** The words a route is made of, the same in every language (owner 2026-10-21). */
export const ROUTE_WORDS = {
  place: "place",
  autobahn: "autobahn",
  to: "to",
  towards: "towards",
  exit: "exit",
  station: "station",
  road: "road",
  // #1074: a Bundesland's page `/<lang>/state/<slug>` and the index of the sixteen `/<lang>/states`.
  state: "state",
  states: "states",
  // #1076: one fuel station's page `/<lang>/fuel/<slug>` and one charging site's `/<lang>/charging/<slug>`.
  fuel: "fuel",
  charging: "charging",
} as const;

/** Letters NFKD does not take apart, or takes apart wrongly for German. */
const LETTERS: Readonly<Record<string, string>> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss", ẞ: "ss",
  æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d", ð: "d", þ: "th", ı: "i", ŀ: "l", ħ: "h",
};

/**
 * A name as a slug: `München` → `muenchen`, `Frankfurt (Oder)` →
 * `frankfurt-oder`, `Neustadt an der Weinstraße` → `neustadt-an-der-weinstrasse`.
 * Empty when nothing of the name survives.
 */
export function slugify(text: string, max: number = SLUG_MAX): string {
  let s = "";
  for (const ch of text.toLowerCase()) s += LETTERS[ch] ?? ch;
  s = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf("-");
  return (at > 0 ? cut.slice(0, at) : s.slice(0, max)).replace(/-+$/g, "");
}

/** The shape every slug has: ASCII lower case and digits, single hyphens, no edge hyphen, at most `SLUG_MAX`. */
export function isSlug(s: string): boolean {
  return s.length > 0 && s.length <= SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

/**
 * Whether a path carries an internal id (#892): a run of five or more digits
 * — an AGS, a BASt location code, an EVA number. A junction number (at most
 * three digits) and a motorway number pass.
 */
export function hasInternalId(path: string): boolean {
  return /\d{5,}/.test(path);
}

/** One Gemeinde as the place-slug rule reads it. */
export type PlaceSlugInput = {
  /** The official name, with its official addition when it carries one ("Frankfurt (Oder)"). */
  readonly name: string;
  /** The Kreis's name; null when unknown. */
  readonly kreis: string | null;
  /** The Land's name; null when unknown. */
  readonly land: string | null;
};

/**
 * The candidate slugs of one Gemeinde, shortest qualifier first (#892 rule 3):
 * the official name with its addition, then the Kreis, then the Land, then
 * both. A qualifier the name already ends with adds nothing and is skipped.
 */
export function placeSlugCandidates(p: PlaceSlugInput): string[] {
  const base = slugify(p.name);
  if (base === "") return [];
  const q = (x: string | null): string | null => {
    if (x === null) return null;
    const s = slugify(x);
    return s === "" || base === s || base.endsWith(`-${s}`) ? null : s;
  };
  const kreis = q(p.kreis);
  const land = q(p.land);
  const out = [base];
  if (kreis !== null) out.push(slugify(`${base}-${kreis}`));
  if (land !== null) out.push(slugify(`${base}-${land}`));
  if (kreis !== null && land !== null) out.push(slugify(`${base}-${kreis}-${land}`));
  // review 2.3.4: a name carrying a run of five digits would pass `isSlug` and then fail the table's CHECK, rolling
  // back the whole gazetteer load — such a candidate is never offered.
  return [...new Set(out.filter((c) => isSlug(c) && !hasInternalId(c)))];
}

/**
 * The slug one new Gemeinde takes, given its candidates, whether ANOTHER
 * Gemeinde has a candidate at a rank no longer than `rank` (`sharedBy`), and
 * the slugs already assigned. A candidate is taken only when no other
 * Gemeinde shares it at that rank or shorter and it is not assigned yet — so
 * two namesakes both move to the next qualifier together instead of the first
 * one keeping the bare name. When every qualifier collides, a counter is
 * appended (`-2`, `-3`, …), which only a name repeated inside one Kreis of one
 * Land can reach; the last candidate is cut first so the counter always fits
 * in `SLUG_MAX`.
 */
export function chooseSlug(own: readonly string[], sharedBy: (candidate: string, rank: number) => boolean, taken: ReadonlySet<string>): string | null {
  for (let i = 0; i < own.length; i += 1) {
    const c = own[i]!;
    if (!taken.has(c) && !sharedBy(c, i)) return c;
  }
  const last = own[own.length - 1];
  if (last === undefined) return null;
  for (let n = 2; n < 1000; n += 1) {
    // review 2.3.4: the counter must fit — a last candidate of 79 or 80 characters is cut (at a dash, never mid-word
    // when one is near) before `-n` is added, or every counter fails `isSlug` and the place gets no slug at all.
    const suffix = `-${n}`;
    const room = SLUG_MAX - suffix.length;
    let head = last.length <= room ? last : last.slice(0, room);
    if (last.length > room) {
      const dash = head.lastIndexOf("-");
      head = dash > 0 ? head.slice(0, dash) : head.replace(/-+$/, "");
    }
    const c = `${head}${suffix}`;
    if (!taken.has(c) && isSlug(c) && !hasInternalId(c)) return c;
  }
  return null;
}

/**
 * Every Gemeinde's slug, the stored ones kept as they are (#892 rule 3,
 * "never recomputed"): `places` in a fixed order (by AGS), `stored` the slugs
 * already assigned. Returns the NEW assignments only, in the same order; a
 * place whose name slugs to nothing gets none.
 */
export function assignSlugs<P extends PlaceSlugInput & { readonly ags: string }>(places: readonly P[], stored: ReadonlyMap<string, string>): { readonly ags: string; readonly slug: string; readonly name: string }[] {
  const cands = places.map(placeSlugCandidates);
  // candidate → the shortest rank at which each place offers it
  const byCandidate = new Map<string, Map<number, number>>();
  cands.forEach((cs, p) =>
    cs.forEach((c, rank) => {
      const m = byCandidate.get(c) ?? new Map<number, number>();
      if (!m.has(p)) m.set(p, rank);
      byCandidate.set(c, m);
    }),
  );
  const taken = new Set(stored.values());
  const out: { ags: string; slug: string; name: string }[] = [];
  places.forEach((place, p) => {
    if (stored.has(place.ags)) return;
    const sharedBy = (c: string, rank: number): boolean => [...(byCandidate.get(c) ?? new Map<number, number>())].some(([q, r]) => q !== p && r <= rank);
    const slug = chooseSlug(cands[p]!, sharedBy, taken);
    if (slug === null) return;
    taken.add(slug);
    out.push({ ags: place.ags, slug, name: place.name });
  });
  return out;
}

/** One junction as the stretch rule reads it: its signed number and its name. */
export type JunctionSlugInput = { readonly no: string | null; readonly name: string };

/** The junction's number as a slug part, or null when it has none (only digits and a letter suffix survive: `138`, `12a`). */
const numberOf = (no: string | null): string | null => {
  if (no === null) return null;
  const s = slugify(no);
  return /^[0-9]{1,3}[a-z]?$/.test(s) ? s : null;
};

/**
 * The slug of each junction of ONE road, in the road's order (#892 rule 4):
 * the name; a name that repeats on the road takes the junction number as its
 * qualifier (`138-nesselwang`); a repeat with no number left to tell it apart
 * takes a counter. Unique per road.
 */
export function junctionSlugs(junctions: readonly JunctionSlugInput[]): string[] {
  const names = junctions.map((j) => slugify(j.name) || "junction");
  const count = new Map<string, number>();
  for (const n of names) count.set(n, (count.get(n) ?? 0) + 1);
  const first = names.map((n, i) => {
    if (count.get(n) === 1) return n;
    const no = numberOf(junctions[i]!.no);
    return no === null ? n : slugify(`${no}-${n}`);
  });
  const seen = new Map<string, number>();
  return first.map((s) => {
    const k = (seen.get(s) ?? 0) + 1;
    seen.set(s, k);
    return k === 1 ? s : `${s}-${k}`;
  });
}

/** One junction's own path segment: `exit-138-nesselwang` (no number: `exit-nesselwang`). */
export function exitSlug(j: JunctionSlugInput): string {
  const no = numberOf(j.no);
  return slugify(`${ROUTE_WORDS.exit}-${no === null ? "" : `${no}-`}${j.name}`) || ROUTE_WORDS.exit;
}

/** A stretch's path segment from its two junction slugs: `nesselwang-to-kempten`. */
export const stretchSlug = (a: string, b: string): string => `${a}-${ROUTE_WORDS.to}-${b}`;

/** A direction's path segment from the slug of the end it runs towards: `towards-wuerzburg`. */
export const towardsSlug = (end: string): string => `${ROUTE_WORDS.towards}-${end}`;

/**
 * A stretch segment read back against one road's junction slugs: the pair of
 * indexes it names, or null. `exit-…` names one junction (both indexes equal).
 * Every split at a `-to-` is tried, so a name that itself contains "to" still
 * reads back.
 */
export function readStretch(segment: string, slugs: readonly string[], exits: readonly string[]): { readonly a: number; readonly b: number } | null {
  const e = exits.indexOf(segment);
  if (e >= 0) return { a: e, b: e };
  const sep = `-${ROUTE_WORDS.to}-`;
  for (let at = segment.indexOf(sep); at > 0; at = segment.indexOf(sep, at + 1)) {
    const a = slugs.indexOf(segment.slice(0, at));
    const b = slugs.indexOf(segment.slice(at + sep.length));
    if (a >= 0 && b >= 0 && a !== b) return { a, b };
  }
  return null;
}
