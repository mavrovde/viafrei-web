/**
 * viafrei-web#36: a deploy must not drop the previous build's `/_a/` files, because search renderers replay stored
 * HTML that names them. The Dockerfile runs `scripts/carry-assets.ts` after the site's own build, with the previous
 * image's `packages/web/dist` (or the default stage's NO-PREVIOUS-RELEASE) as its input. Here three builds run in a
 * row on temporary directories exactly as the Dockerfile lays them out:
 *   1. the first build's names still resolve, byte for byte, after the second build, and a current file is never
 *      overwritten by a carried one;
 *   2. the manifest keeps each carried file's first-carried date across builds and drops a file after 14 days;
 *   3. a named previous image that did not arrive, an unnamed one that did, and an empty previous image each fail;
 *   4. the adapter's own static handler serves a carried file with the immutable cache header a current one gets.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CARRY_DAYS, FIRST_BUILD, MANIFEST_NAME, NO_PREVIOUS_MARKER, carryAssets, planCarry, readManifest, type CarryManifest } from "../scripts/carry-assets.js";

const REF_A = "ghcr.io/mavrovde/viafrei-app@sha256:" + "a".repeat(64);
const REF_B = "ghcr.io/mavrovde/viafrei-app@sha256:" + "b".repeat(64);
const DAY = 86_400_000;
const T0 = new Date("2026-11-17T10:00:00.000Z");
const at = (days: number): Date => new Date(T0.getTime() + days * DAY);

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "carry-web36-"));
  roots.push(d);
  return d;
};

/** A fresh Astro output: `dist/client/_a/<name>` per file, plus a server entry the carry must leave alone. */
function astroBuild(files: Record<string, string>): string {
  const dist = join(tmp(), "dist");
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, "client", "_a", name)), { recursive: true });
    writeFileSync(join(dist, "client", "_a", name), body);
  }
  mkdirSync(join(dist, "server"), { recursive: true });
  writeFileSync(join(dist, "server", "entry.mjs"), "export {};\n");
  return dist;
}
/** The Dockerfile's default `web-assets-previous` stage: one marker file. */
function defaultStage(): string {
  const d = join(tmp(), "dist");
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, NO_PREVIOUS_MARKER), "");
  return d;
}
/** What scripts/carry-previous.sh hands the build as web-assets-previous: one `<digest hex>/` per named image, its dist inside. */
function prevs(...images: readonly (readonly [string, string])[]): string {
  const d = join(tmp(), "dist");
  for (const [ref, dist] of images) cpSync(dist, join(d, ref.slice(-64)), { recursive: true });
  return d;
}
const read = (dist: string, name: string): string => readFileSync(join(dist, "client", "_a", name), "utf8");
const manifestOf = (dist: string): CarryManifest => JSON.parse(readFileSync(join(dist, MANIFEST_NAME), "utf8")) as CarryManifest;

const BUILD_A = { "site.AAAA.css": "a-css", "client.svelte.AAAA.js": "a-client", "Consent.AAAA.js": "a-consent", "shared.SAME.js": "a-shared" };
const BUILD_B = { "site.BBBB.css": "b-css", "client.svelte.BBBB.js": "b-client", "Consent.BBBB.js": "b-consent", "shared.SAME.js": "b-shared" };
const BUILD_C = { "site.CCCC.css": "c-css", "client.svelte.CCCC.js": "c-client" };

describe("viafrei-web#36: two builds in a row", () => {
  it("the first build's names resolve after the second, byte for byte; a current file is never overwritten", () => {
    const a = astroBuild(BUILD_A);
    const ma = carryAssets(defaultStage(), a, FIRST_BUILD, T0);
    expect(ma).toEqual({ version: 1, previous: FIRST_BUILD, builtAt: T0.toISOString(), carried: {} });

    const b = astroBuild(BUILD_B);
    const mb = carryAssets(prevs([REF_A, a]), b, REF_A, at(1));
    for (const name of ["site.AAAA.css", "client.svelte.AAAA.js", "Consent.AAAA.js"]) expect(read(b, name)).toBe(read(a, name));
    for (const [name, body] of Object.entries(BUILD_B)) expect(read(b, name)).toBe(body);
    expect(read(b, "shared.SAME.js")).toBe("b-shared");
    expect(mb.previous).toEqual([REF_A]);
    expect(Object.keys(mb.carried).sort()).toEqual(["Consent.AAAA.js", "client.svelte.AAAA.js", "site.AAAA.css"]);
    expect(manifestOf(b)).toEqual(mb);
    // The manifest sits beside client/, never inside it: it is not served.
    expect(() => readFileSync(join(b, "client", MANIFEST_NAME))).toThrow();
    expect(readFileSync(join(b, "server", "entry.mjs"), "utf8")).toBe("export {};\n");
  });

  it("a third build keeps the first build's files with their first-carried date, then drops them after 14 days", () => {
    const a = astroBuild(BUILD_A);
    carryAssets(defaultStage(), a, FIRST_BUILD, T0);
    const b = astroBuild(BUILD_B);
    carryAssets(prevs([REF_A, a]), b, REF_A, at(1));

    const early = astroBuild(BUILD_C);
    const me = carryAssets(prevs([REF_B, b]), early, REF_B, at(1 + CARRY_DAYS));
    expect(me.carried["client.svelte.AAAA.js"]).toEqual({ since: at(1).toISOString() });
    expect(me.carried["client.svelte.BBBB.js"]).toEqual({ since: at(1 + CARRY_DAYS).toISOString() });
    expect(read(early, "Consent.AAAA.js")).toBe("a-consent");
    expect(read(early, "shared.SAME.js")).toBe("b-shared");

    const late = astroBuild(BUILD_C);
    const ml = carryAssets(prevs([REF_B, b]), late, REF_B, new Date(at(1 + CARRY_DAYS).getTime() + 1));
    expect(Object.keys(ml.carried).filter((n) => n.includes("AAAA"))).toEqual([]);
    expect(() => read(late, "client.svelte.AAAA.js")).toThrow();
    expect(read(late, "client.svelte.BBBB.js")).toBe("b-client");
  });

  it("a build that names no previous image (compose, CI) carries nothing and says so", () => {
    const a = astroBuild(BUILD_A);
    expect(carryAssets(defaultStage(), a, "", T0).previous).toBeNull();
    expect(manifestOf(a).carried).toEqual({});
  });
});

describe("viafrei-web#36: the manifest's pruning", () => {
  const prev = (since: Date): CarryManifest => ({ version: 1, previous: [REF_A], builtAt: since.toISOString(), carried: { "old.js": { since: since.toISOString() } } });
  it("keeps a file exactly 14 days after it was first carried and drops it one millisecond later", () => {
    expect(planCarry([{ files: ["old.js", "cur.js"], manifest: prev(T0) }], ["new.js"], at(CARRY_DAYS)).carried).toEqual({ "cur.js": { since: at(CARRY_DAYS).toISOString() }, "old.js": { since: T0.toISOString() } });
    const p = planCarry([{ files: ["old.js", "cur.js"], manifest: prev(T0) }], ["new.js"], new Date(at(CARRY_DAYS).getTime() + 1));
    expect(p.dropped).toEqual(["old.js"]);
    expect(Object.keys(p.carried)).toEqual(["cur.js"]);
  });
  it("an image without a manifest (built before #36) had every file current: each starts its 14 days now", () => {
    expect(planCarry([{ files: ["a.js"], manifest: null }], [], T0).carried).toEqual({ "a.js": { since: T0.toISOString() } });
  });
  it("a name in two images keeps the earliest since, and is dropped by it", () => {
    const sources = [{ files: ["old.js"], manifest: null }, { files: ["old.js"], manifest: prev(T0) }];
    expect(planCarry(sources, [], at(3)).carried).toEqual({ "old.js": { since: T0.toISOString() } });
    expect(planCarry(sources, [], at(CARRY_DAYS + 1)).dropped).toEqual(["old.js"]);
  });
  it("a name current again is current, not carried", () => {
    expect(planCarry([{ files: ["old.js"], manifest: prev(T0) }], ["old.js"], at(1)).carried).toEqual({});
  });
  it("refuses a manifest that lists a file its image lacks, or one it cannot read", () => {
    expect(() => planCarry([{ files: [], manifest: prev(T0) }], [], at(1))).toThrow(/does not have/);
    const d = tmp();
    writeFileSync(join(d, MANIFEST_NAME), JSON.stringify({ version: 2, carried: {} }));
    expect(() => readManifest(d)).toThrow(/version-1/);
    writeFileSync(join(d, MANIFEST_NAME), JSON.stringify({ version: 1, carried: { "x.js": { since: "soon" } } }));
    expect(() => readManifest(d)).toThrow(/since/);
  });
});

describe("viafrei-web#36: several earlier images at once", () => {
  it("carries the union of two images, each name byte for byte, a shared identical name once", () => {
    const a = astroBuild(BUILD_A);
    const b = astroBuild({ ...BUILD_B, "shared.SAME.js": "a-shared" });
    const c = astroBuild(BUILD_C);
    const m = carryAssets(prevs([REF_A, a], [REF_B, b]), c, `${REF_A} ${REF_B}`, T0);
    expect(m.previous).toEqual([REF_A, REF_B]);
    for (const [name, body] of Object.entries(BUILD_A)) expect(read(c, name)).toBe(body);
    for (const name of ["site.BBBB.css", "client.svelte.BBBB.js", "Consent.BBBB.js"]) expect(read(c, name)).toBe(read(b, name));
    expect(Object.keys(m.carried)).toHaveLength(7);
  });
  it("refuses one name with different bytes in two images", () => {
    const a = astroBuild(BUILD_A);
    const b = astroBuild(BUILD_B); // shared.SAME.js: "b-shared" against "a-shared"
    expect(() => carryAssets(prevs([REF_A, a], [REF_B, b]), astroBuild(BUILD_C), `${REF_A} ${REF_B}`, T0)).toThrow(/shared\.SAME\.js differs/);
  });
  it("refuses when the images supplied are not the images named", () => {
    const a = astroBuild(BUILD_A);
    expect(() => carryAssets(prevs([REF_A, a]), astroBuild(BUILD_C), `${REF_A} ${REF_B}`, T0)).toThrow(/must be the same images/);
    expect(() => carryAssets(prevs([REF_A, a]), astroBuild(BUILD_C), `${REF_A} ${REF_A}`, T0)).toThrow(/each once/);
    expect(() => carryAssets(prevs([REF_A, a]), astroBuild(BUILD_C), "ghcr.io/x/y:2.6.22", T0)).toThrow(/not pinned by digest/);
  });
});

describe("viafrei-web#36: never a silent nothing-to-carry", () => {
  it("a named previous image that did not arrive as the build context fails the build", () => {
    expect(() => carryAssets(defaultStage(), astroBuild(BUILD_B), REF_A, T0)).toThrow(/scripts\/carry-previous.sh supplies them/);
  });
  it("a previous image supplied without naming it fails the build", () => {
    const a = astroBuild(BUILD_A);
    expect(() => carryAssets(prevs([REF_A, a]), astroBuild(BUILD_B), "", T0)).toThrow(/WEB_ASSETS_PREVIOUS/);
    expect(() => carryAssets(prevs([REF_A, a]), astroBuild(BUILD_B), FIRST_BUILD, T0)).toThrow(/WEB_ASSETS_PREVIOUS/);
  });
  it("a previous image with no _a/ files fails the build", () => {
    const empty = join(tmp(), "dist");
    mkdirSync(join(empty, "server"), { recursive: true });
    expect(() => carryAssets(prevs([REF_A, empty]), astroBuild(BUILD_B), REF_A, T0)).toThrow(/has no files/);
  });
});

describe("viafrei-web#36: the adapter serves a carried file like a current one", () => {
  it("200 and Cache-Control immutable for a carried and a current name, from @astrojs/node's own static handler", async () => {
    const a = astroBuild(BUILD_A);
    carryAssets(defaultStage(), a, FIRST_BUILD, T0);
    const b = astroBuild(BUILD_B);
    carryAssets(prevs([REF_A, a]), b, REF_A, at(1));

    // The adapter's handler finds the client directory relative to its own module's folder, named after the
    // server folder's basename: point `server` at that folder and `client` at this build's client/.
    const adapterDist = realpathSync(dirname(createRequire(import.meta.url).resolve("@astrojs/node")));
    const { createStaticHandler } = (await import(/* @vite-ignore */ pathToFileURL(join(adapterDist, "serve-static.js")).href)) as {
      createStaticHandler: (app: unknown, options: unknown) => (req: IncomingMessage, res: ServerResponse, ssr: () => void) => void;
    };
    const app = { removeBase: (p: string) => p, manifest: { assetsDir: "_a", trailingSlash: "ignore", buildFormat: "directory" } };
    const handler = createStaticHandler(app, { server: pathToFileURL(adapterDist + "/").href, client: pathToFileURL(join(b, "client") + "/").href });
    const server = createServer((req, res) => handler(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      for (const [name, body] of [["client.svelte.AAAA.js", "a-client"], ["Consent.AAAA.js", "a-consent"], ["client.svelte.BBBB.js", "b-client"]] as const) {
        const res = await fetch(`${base}/_a/${name}`);
        expect([name, res.status, res.headers.get("cache-control")]).toEqual([name, 200, "public, max-age=31536000, immutable"]);
        expect(await res.text()).toBe(body);
      }
      expect((await fetch(`${base}/_a/client.svelte.ZZZZ.js`)).status).toBe(404);
      expect((await fetch(`${base}/${MANIFEST_NAME}`)).status).toBe(404);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
