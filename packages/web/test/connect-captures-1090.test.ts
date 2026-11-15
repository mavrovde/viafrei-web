/**
 * #1090 (2.4.8): the connect page's images and each client row's own check record.
 *
 * - Coverage: every client step and every example answer has a real image or a named PENDING capture, never both,
 *   never neither (`site/connect-captures.ts`), so a new client, step or example without one fails here.
 * - The files: every committed image is a WebP of at most 60 KB whose header size is the size the page reserves,
 *   carries NO metadata chunk (EXIF, XMP, ICC profile — the RIFF chunk list is read, not the file name), and is
 *   used; no orphan file ships.
 * - Each row's check line: "checked in the client on <date> with <version>" for a client really connected, else a
 *   draft line naming the guide check and the reason — in every live language, with the reason's own words.
 * - Full size without a script: each thumbnail links to its figure's `#…-full` anchor, which links back.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all, first, text } from "@viafrei/design/testing";
import { t } from "../src/i18n/index.js";
import { clientExtrasHtml, dayOf, shotAnchor, shotCaption, shotFullAnchor, type ShotFile } from "../src/lib/connect-blocks.js";
import { CLIENT_CHECKS, CONNECT_CLIENT_IDS, DOCS_CHECKED, PENDING_REASONS, SHOT_IDS, SHOT_META, connectClients, isVerified, type ShotId } from "../src/site/connect-clients.js";
import { PENDING_CAPTURES, captureTargets, capturedTargets, type CaptureTarget } from "../src/site/connect-captures.js";
import { phoneBlockHtml, phoneClients } from "../src/site/connect-phone.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "src", "assets", "connect");
const SHOTS = Object.fromEntries(SHOT_IDS.map((id, i) => [id, { src: `/_a/s${String(i)}.webp`, width: 880, height: 200 + i }])) as Record<ShotId, ShotFile>;
const block = (lang: (typeof LIVE_LANGS)[number], id: (typeof CONNECT_CLIENT_IDS)[number]): string => clientExtrasHtml(lang, connectClients(lang).find((c) => c.id === id)!, SHOTS);

/** The RIFF chunks of a WebP file, in order, with the canvas size its header declares. */
function webpChunks(buf: Buffer): { chunks: string[]; width: number; height: number } {
  expect(buf.subarray(0, 4).toString("latin1")).toBe("RIFF");
  expect(buf.subarray(8, 12).toString("latin1")).toBe("WEBP");
  expect(buf.readUInt32LE(4) + 8).toBe(buf.length);
  const chunks: string[] = [];
  let width = 0;
  let height = 0;
  for (let i = 12; i < buf.length; ) {
    const tag = buf.subarray(i, i + 4).toString("latin1");
    const n = buf.readUInt32LE(i + 4);
    chunks.push(tag);
    const d = i + 8;
    if (tag === "VP8X") [width, height] = [1 + buf.readUIntLE(d + 4, 3), 1 + buf.readUIntLE(d + 7, 3)];
    if (tag === "VP8 " && width === 0) [width, height] = [buf.readUInt16LE(d + 6) & 0x3fff, buf.readUInt16LE(d + 8) & 0x3fff];
    if (tag === "VP8L" && width === 0) {
      const v = buf.readUInt32LE(d + 1);
      [width, height] = [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1];
    }
    i = d + n + (n & 1);
  }
  return { chunks, width, height };
}

describe("#1090: every client step and every example has a real image or a named pending capture", () => {
  const targets = captureTargets();
  const captured = capturedTargets();
  const pending = PENDING_CAPTURES;

  it("the targets are the page's: twelve clients' steps (claude.ai and ChatGPT three each), the five questions, every example card", () => {
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets.filter((x) => x.startsWith("client:"))).toHaveLength(16);
    expect(targets.filter((x) => x.startsWith("ask:"))).toEqual(["ask:train", "ask:parking", "ask:charging", "ask:road", "ask:weather"]);
    expect(targets.filter((x) => x.startsWith("live:")).length).toBeGreaterThan(20);
    for (const id of CONNECT_CLIENT_IDS) expect(targets, id).toContain(`client:${id}:1`);
  });

  it("images and pending entries cover the targets exactly — none without either, none with both, no stale entry", () => {
    const has = new Set(Object.keys(captured));
    const owed = new Set(Object.keys(pending));
    const missing = targets.filter((x) => !has.has(x) && !owed.has(x));
    expect(missing, "a target with neither an image nor a pending capture").toEqual([]);
    expect(targets.filter((x) => has.has(x) && owed.has(x)), "a pending entry for a target that has its image").toEqual([]);
    expect([...owed].filter((x) => !targets.includes(x as CaptureTarget)), "a pending entry for no target").toEqual([]);
    expect([...has].filter((x) => !targets.includes(x as CaptureTarget))).toEqual([]);
    for (const [k, v] of Object.entries(pending)) expect(v!.what.length, k).toBeGreaterThan(20);
  });

  it("the captured ones today: claude.ai's three steps, the four terminal clients and the four phone steps (#1106); every example is still owed", () => {
    expect(Object.keys(captured).sort()).toEqual(
      ["client:claudeAi:1", "client:claudeAi:2", "client:claudeAi:3", "client:claudeCode:1", "client:generic:1", "client:geminiCli:1", "client:stdio:1", "phone:claude:1", "phone:claude:2", "phone:claude:3", "phone:claude:4"].sort(),
    );
    expect(captured["phone:claude:4"]).toEqual(["phone4", "phone4b"]);
    for (const x of targets) if (!x.startsWith("client:") && !x.startsWith("phone:")) expect(pending[x], x).toBeDefined();
    for (const x of targets) if (x.startsWith("phone:")) expect(pending[x], x).toBeUndefined();
  });

  it("every image is used by exactly one target, and a client verified in the client shows at least one", () => {
    const used = Object.values(captured).flat();
    expect([...used].sort()).toEqual([...SHOT_IDS].sort());
    for (const c of connectClients("de")) {
      const shots = c.flow?.steps.flatMap((s) => s.shots) ?? c.shots;
      if (isVerified(c.check)) expect(shots.length, c.id).toBeGreaterThan(0);
    }
  });
});

describe("#1090: the committed image files", () => {
  const files = readdirSync(ASSETS).filter((f) => !f.startsWith("."));

  it("every file is an image the page uses, and every image the page uses is a file", () => {
    expect([...files].sort()).toEqual(SHOT_IDS.map((id) => SHOT_META[id].file).sort());
  });

  it("each is a WebP of at most 60 KB, carrying image data only — no EXIF, XMP or ICC chunk", () => {
    let total = 0;
    for (const id of SHOT_IDS) {
      const p = join(ASSETS, SHOT_META[id].file);
      const size = statSync(p).size;
      total += size;
      expect(size, id).toBeLessThanOrEqual(60 * 1024);
      const { chunks, width, height } = webpChunks(readFileSync(p));
      expect(chunks.filter((c) => !["VP8 ", "VP8L", "VP8X", "ALPH"].includes(c)), `${id}: metadata chunks`).toEqual([]);
      expect(width * height, id).toBeGreaterThan(0);
      expect(width, id).toBeLessThanOrEqual(1400);
    }
    // the set, measured (outside the page budget, which is HTML + CSS): 8 files, 208 120 B at 2.4.8; 13 files, 375 718 B
    // at 2.5.2 with the five phone captures of #1106
    expect(total).toBeLessThanOrEqual(13 * 60 * 1024);
  });

  it("the metadata scan can say no: a file with an EXIF chunk is found", () => {
    const vp8 = readFileSync(join(ASSETS, SHOT_META.claude1.file));
    const exif = Buffer.concat([Buffer.from("EXIF", "latin1"), Buffer.from([4, 0, 0, 0]), Buffer.from("MM\0*", "latin1")]);
    const body = Buffer.concat([vp8.subarray(12), exif]);
    const head = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.alloc(4), Buffer.from("WEBP", "latin1")]);
    head.writeUInt32LE(body.length + 4, 4);
    expect(webpChunks(Buffer.concat([head, body])).chunks).toContain("EXIF");
  });
});

describe("#1090: each row says how it was checked", () => {
  it("every client has a record; a verified one names a day and a version, a pending one a reason and the guide check's day", () => {
    expect(Object.keys(CLIENT_CHECKS).sort()).toEqual([...CONNECT_CLIENT_IDS].sort());
    for (const id of CONNECT_CLIENT_IDS) {
      const c = CLIENT_CHECKS[id];
      if (isVerified(c)) {
        expect(c.verified.date, id).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
        // a terminal client names its release; claude.ai is a web app with no version of its own, so it is named as the web app
        if (id === "claudeAi") expect(c.verified.version).toBe("claude.ai");
        else expect(c.verified.version, id).toMatch(/\d+\.\d+\.\d+/u);
      } else {
        expect(PENDING_REASONS, id).toContain(c.pending);
        expect(c.docs, id).toBe(DOCS_CHECKED);
      }
    }
    expect(CONNECT_CLIENT_IDS.filter((id) => isVerified(CLIENT_CHECKS[id]))).toEqual(["claudeAi", "claudeCode", "geminiCli", "generic", "stdio"]);
  });

  it("in every language: the verified line with its date and version and no draft; the pending line as a draft with its reason", () => {
    for (const lang of LIVE_LANGS)
      for (const id of CONNECT_CLIENT_IDS) {
        const html = block(lang, id);
        const line = first(html, "p.ccheck");
        expect(line, `${lang} ${id}`).not.toBeNull();
        expect(all(html, "p.ccheck"), `${lang} ${id}`).toHaveLength(1);
        const c = CLIENT_CHECKS[id];
        if (isVerified(c)) {
          expect(text(line!), `${lang} ${id}`).toBe(t(lang, "connectPage.check.verified", { date: dayOf(lang, c.verified.date), version: c.verified.version }));
          expect(first(html, ".draft"), `${lang} ${id}`).toBeNull();
        } else {
          const draft = first(html, "p.ccheck span.draft");
          expect(text(draft!), `${lang} ${id}`).toBe(t(lang, "connectPage.check.docs", { date: dayOf(lang, c.docs), reason: t(lang, `connectPage.check.pending.${c.pending}`) }));
        }
      }
  });

  it("no page-wide draft is left in any catalogue, and the check words are distinct per reason", () => {
    for (const lang of LIVE_LANGS) {
      const reasons = PENDING_REASONS.map((r) => t(lang, `connectPage.check.pending.${r}`));
      expect(new Set(reasons).size, lang).toBe(reasons.length);
      const deck = JSON.parse(readFileSync(join(HERE, "..", "src", "i18n", `${lang}.json`), "utf8")) as { connectPage: Record<string, unknown> };
      expect(deck.connectPage["draft"], lang).toBeUndefined();
      expect(deck.connectPage["draftClient"], lang).toBeUndefined();
    }
    expect(dayOf("de", "2026-10-28")).toBe("28.10.2026");
  });
});

describe("#1090: the terminal transcripts and the full-size view", () => {
  it("each terminal client shows its transcript after its snippet, captioned as a transcript with the client's version, described in the page's language", () => {
    for (const lang of LIVE_LANGS)
      for (const [id, shot] of [["claudeCode", "claudeCode1"], ["geminiCli", "geminiCli1"], ["generic", "generic1"], ["stdio", "stdio1"]] as const) {
        const html = block(lang, id);
        const img = all(html, "figure.cshot a.cshot__open img");
        expect(img, `${lang} ${id}`).toHaveLength(1);
        expect(img[0]!.attrs.alt, `${lang} ${id}`).toBe(t(lang, `connectPage.shot.${shot}`));
        expect(img[0]!.attrs.loading).toBe("lazy");
        expect(text(first(html, "figure.cshot figcaption")!), `${lang} ${id}`).toBe(shotCaption(lang, shot));
        expect(shotCaption(lang, shot), `${lang} ${id}`).toContain(SHOT_META[shot].what);
      }
  });

  it("every thumbnail opens its own full-size view on the same page and the view links back — no script, ids unique", () => {
    const ids: string[] = [];
    // the client blocks and the phone blocks (#1106) are on one page, so their figure ids share one namespace
    const blocks = [...CONNECT_CLIENT_IDS.map((id) => [id, block("de", id)] as const), ...phoneClients().map((c) => [`phone:${c.id}`, phoneBlockHtml("de", c, SHOTS)] as const)];
    for (const [id, html] of blocks) {
      for (const fig of all(html, "figure.cshot")) {
        const shot = fig.attrs.id!.replace(/^shot-/u, "") as ShotId;
        ids.push(fig.attrs.id!, shotFullAnchor(shot));
        expect(fig.attrs.id).toBe(shotAnchor(shot));
        const open = first(html, `#${shotAnchor(shot)} a.cshot__open`)!;
        expect(open.attrs.href).toBe(`#${shotFullAnchor(shot)}`);
        expect(open.attrs["aria-label"]).toContain(t("de", "connectPage.shot.open"));
        const full = first(html, `#${shotAnchor(shot)} a.cshot__full`)!;
        expect(full.attrs.id).toBe(shotFullAnchor(shot));
        expect(full.attrs.href).toBe(`#${shotAnchor(shot)}`);
        expect(full.attrs["aria-label"]).toBe(t("de", "connectPage.shot.close"));
        const big = first(html, `#${shotFullAnchor(shot)} img`)!;
        expect(big.attrs.src).toBe(SHOTS[shot].src);
        expect(big.attrs.alt).toBe("");
        expect(big.attrs.loading).toBe("lazy");
      }
      expect(all(html, "script"), id).toEqual([]);
    }
    expect(ids.length).toBe(SHOT_IDS.length * 2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the stylesheet shows the full view only while it is the target", () => {
    const css = readFileSync(join(HERE, "..", "src", "styles", "site.css"), "utf8");
    expect(css).toMatch(/\.cshot__full \{ display: none; \}/u);
    expect(css).toMatch(/\.cshot__full:target \{[^}]*position: fixed;[^}]*display: flex;/u);
  });
});
