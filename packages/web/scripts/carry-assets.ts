/**
 * Carry earlier releases' `/_a/` files into this build (viafrei-web#36).
 *
 * Every build names its browser files by content hash (`/_a/client.svelte.<hash>.js`). A deploy used to drop the
 * previous build's names, and a search renderer that replays stored HTML then asked for files that were gone: 210
 * Googlebot 404s a day, mostly the Svelte client chunk and the consent chunk. So each image now keeps the files of the
 * images before it, for 14 days after they stopped being current.
 *
 * The Dockerfile's build stage runs this file with plain node (type stripping, no tsx):
 *
 *   node packages/web/scripts/carry-assets.ts <previous dir> <this build's dist dir> <"ref ref …" | first-build | "">
 *
 * `<previous dir>` is `/app/packages/web/dist` of the stage `web-assets-previous`. A release build
 * (release.yml, through `scripts/carry-previous.sh` and the `carry` pins of images.pin) replaces that stage with a local directory
 * that holds one subdirectory per named image, `<64-hex digest>/`, each a copy of that image's `packages/web/dist`. A
 * build that does not, e.g. compose or CI, gets the Dockerfile's own stage, which holds only the file
 * `NO-PREVIOUS-RELEASE`. The third argument must agree with what arrived, image for image, or the build fails: a named
 * image that was not supplied is never a silent "nothing to carry".
 *
 * What it writes:
 * - the union of the named images' `_a/` files that are not one of this build's own names, copied byte for byte into
 *   `<dist>/client/_a/`. A current file is never overwritten, and a name two images hold with different bytes is
 *   refused. The adapter serves everything under `client/_a/` with `Cache-Control: public, max-age=31536000,
 *   immutable`, so a carried file gets the same cache header as a current file;
 * - `<dist>/carried-assets.json`, outside `client/` so it is never served: the images carried from, and per carried
 *   file the moment it stopped being current (`since`, the earliest any image records). A file is dropped once its
 *   `since` is more than 14 days old.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** How long a file that stopped being current is still served. */
export const CARRY_DAYS = 14;
/** The file the Dockerfile's own `web-assets-previous` stage holds: "no previous image was supplied". */
export const NO_PREVIOUS_MARKER = "NO-PREVIOUS-RELEASE";
/** Written beside `client/`, never inside it. */
export const MANIFEST_NAME = "carried-assets.json";
/** The third argument of a release's very first carrying build, when no earlier image exists. */
export const FIRST_BUILD = "first-build";

export interface CarriedEntry {
  /** ISO time the file stopped being current: the earliest build that carried it. */
  readonly since: string;
}
export interface CarryManifest {
  readonly version: 1;
  /** The images carried from (`<repo>@sha256:…`), "first-build", or null for a build that carries nothing (compose, CI). */
  readonly previous: readonly string[] | typeof FIRST_BUILD | null;
  readonly builtAt: string;
  /** Carried file name (relative to `_a/`) → entry. This build's own files are not listed. */
  readonly carried: Readonly<Record<string, CarriedEntry>>;
}

/** Code-point order, the order `Array#sort` gives strings by default, spelled out. */
export function byCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Every regular file under `dir`, as `/`-separated paths relative to it, sorted. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(relative(dir, p).replaceAll("\\", "/"));
      else throw new Error(`carry-assets: ${p} is neither a file nor a directory`);
    }
  };
  walk(dir);
  return out.sort(byCodePoint);
}

/** Reads an earlier image's manifest; null when it has none (an image built before #36 — all its files were current). */
export function readManifest(distDir: string): CarryManifest | null {
  const p = join(distDir, MANIFEST_NAME);
  if (!existsSync(p)) return null;
  const m = JSON.parse(readFileSync(p, "utf8")) as Partial<CarryManifest>;
  if (m.version !== 1 || typeof m.carried !== "object" || m.carried === null) {
    throw new Error(`carry-assets: ${p} is not a version-1 manifest`);
  }
  for (const [name, e] of Object.entries(m.carried)) {
    if (typeof e?.since !== "string" || Number.isNaN(Date.parse(e.since))) {
      throw new TypeError(`carry-assets: ${p} entry ${name} has no valid "since"`);
    }
  }
  return m as CarryManifest;
}

export interface CarryPlan {
  /** name → entry, for the new manifest; also the files to copy. */
  readonly carried: Record<string, CarriedEntry>;
  /** Names older than CARRY_DAYS, left behind. */
  readonly dropped: string[];
}

/** One earlier image: its `_a/` names and its manifest (null: none, every file was current there). */
export interface CarrySource {
  readonly files: readonly string[];
  readonly manifest: CarryManifest | null;
}

/**
 * The pure decision over one or more earlier images. A name current in this build is current, never carried. A name
 * in several images keeps the earliest `since`; an image without an entry for a name had it current, so its clock
 * starts now. Different bytes under one name are refused by the caller, which reads the files.
 */
export function planCarry(sources: readonly CarrySource[], currentFiles: readonly string[], now: Date): CarryPlan {
  const current = new Set(currentFiles);
  const since = new Map<string, number>();
  for (const { files, manifest } of sources) {
    const present = new Set(files);
    const prior = manifest?.carried ?? {};
    for (const name of Object.keys(prior)) {
      // A manifest that lists a file its own image lacks was not written by this script: refuse, never guess.
      if (!present.has(name)) throw new Error(`carry-assets: a previous manifest lists _a/${name}, which its image does not have`);
    }
    for (const name of files) {
      if (current.has(name)) continue;
      const t = Date.parse(prior[name]?.since ?? now.toISOString());
      since.set(name, Math.min(t, since.get(name) ?? t));
    }
  }
  const carried: Record<string, CarriedEntry> = {};
  const dropped: string[] = [];
  const limitMs = CARRY_DAYS * 86_400_000;
  for (const [name, t] of [...since.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (now.getTime() - t > limitMs) dropped.push(name);
    else carried[name] = { since: new Date(t).toISOString() };
  }
  return { carried, dropped };
}

const DIGEST_REF = /^[^\s@]+@sha256:([0-9a-f]{64})$/;

/** Which earlier images the build names: none, the first build, or digest references. */
type Named = { readonly refs: readonly string[]; readonly firstBuild: boolean; readonly namesImages: boolean };

/** The supplied stage and the named images must agree: both "none" or both "these images". */
function checkStage(previousDir: string, n: Named): void {
  const isDefaultStage = existsSync(join(previousDir, NO_PREVIOUS_MARKER));
  if (isDefaultStage && n.namesImages) {
    throw new Error(
      `carry-assets: the build names the previous image(s) ${n.refs.join(" ")}, but the stage web-assets-previous is the ` +
        "Dockerfile's own (no files) — build through release.yml, whose scripts/carry-previous.sh supplies them",
    );
  }
  if (!isDefaultStage && !n.namesImages) {
    throw new Error(
      'carry-assets: earlier images were supplied as web-assets-previous without naming them — pass --build-arg WEB_ASSETS_PREVIOUS="<image@sha256:…> …"',
    );
  }
}

/** The 64-hex digest of each reference, refused unless every one is pinned by digest and the supplied directories are exactly those. */
function suppliedHexes(previousDir: string, refs: readonly string[]): string[] {
  const hexes = refs.map((r) => {
    const m = DIGEST_REF.exec(r);
    if (m === null) throw new Error(`carry-assets: ${r} is not pinned by digest (<image>@sha256:<64 hex>)`);
    return m[1] as string;
  });
  const supplied = readdirSync(previousDir).sort(byCodePoint);
  if (hexes.length !== new Set(hexes).size || JSON.stringify(supplied) !== JSON.stringify([...hexes].sort(byCodePoint))) {
    throw new Error(
      `carry-assets: web-assets-previous holds [${supplied.join(", ")}], the build names [${hexes.join(", ")}] — they must be the same images, each once`,
    );
  }
  return hexes;
}

/** Each earlier image's `_a/` files and manifest, and name → the first file seen under it (for the byte comparison and the copy). */
function readSources(previousDir: string, refs: readonly string[], hexes: readonly string[]): { sources: CarrySource[]; origin: Map<string, string> } {
  const sources: CarrySource[] = [];
  const origin = new Map<string, string>();
  for (const [i, hex] of hexes.entries()) {
    const prevAssets = join(previousDir, hex, "client", "_a");
    const files = existsSync(prevAssets) ? listFiles(prevAssets) : [];
    // A site image always has its stylesheet; an empty or absent _a/ is not "nothing to carry", it is a wrong image.
    if (files.length === 0) throw new Error(`carry-assets: the previous image ${refs[i]} has no files under packages/web/dist/client/_a/`);
    for (const name of files) {
      const path = join(prevAssets, name);
      const seen = origin.get(name);
      if (seen === undefined) origin.set(name, path);
      else if (!readFileSync(seen).equals(readFileSync(path))) {
        throw new Error(`carry-assets: _a/${name} differs between ${refs[i]} and an earlier named image — a hashed name must name one content`);
      }
    }
    sources.push({ files, manifest: readManifest(join(previousDir, hex)) });
  }
  return { sources, origin };
}

/** The manifest's `previous`: the named references, the first-build word, or null. */
function previousOf(n: Named): CarryManifest["previous"] {
  if (n.namesImages) return [...n.refs];
  return n.firstBuild ? FIRST_BUILD : null;
}

/** How the log line names `previous`. */
function shownPrevious(previous: CarryManifest["previous"]): string {
  if (previous === null) return "none (a build that carries nothing)";
  return typeof previous === "string" ? previous : previous.join(" ");
}

/** Runs the carry for one build; returns the manifest written. Throws, and the image build fails, on any doubt. */
export function carryAssets(previousDir: string, dist: string, previousRefs: string, now: Date): CarryManifest {
  const refs = previousRefs.split(/\s+/).filter((r) => r !== "");
  const firstBuild = refs.length === 1 && refs[0] === FIRST_BUILD;
  const named: Named = { refs, firstBuild, namesImages: refs.length > 0 && !firstBuild };
  checkStage(previousDir, named);
  const assetsDir = join(dist, "client", "_a");
  if (!existsSync(assetsDir)) throw new Error(`carry-assets: this build has no ${assetsDir}`);
  const currentFiles = listFiles(assetsDir);
  let plan: CarryPlan = { carried: {}, dropped: [] };
  if (named.namesImages) {
    const { sources, origin } = readSources(previousDir, refs, suppliedHexes(previousDir, refs));
    plan = planCarry(sources, currentFiles, now);
    for (const name of Object.keys(plan.carried)) {
      const to = join(assetsDir, name);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(origin.get(name) as string, to);
    }
  }
  const manifest: CarryManifest = { version: 1, previous: previousOf(named), builtAt: now.toISOString(), carried: plan.carried };
  writeFileSync(join(dist, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `carry-assets: previous ${shownPrevious(manifest.previous)}; ` +
      `${currentFiles.length} current, ${Object.keys(plan.carried).length} carried, ${plan.dropped.length} dropped (older than ${CARRY_DAYS} days)`,
  );
  return manifest;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [previousDir, dist, previousRefs] = process.argv.slice(2);
  if (previousDir === undefined || dist === undefined || previousRefs === undefined) {
    console.error('usage: node carry-assets.ts <previous dir> <dist dir> <"<image@sha256:…> …" | first-build | "">');
    process.exit(64);
  }
  carryAssets(previousDir, dist, previousRefs, new Date());
}
