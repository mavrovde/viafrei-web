/**
 * #1090 (owner 2026-10-28): every client block of the connect page links its OFFICIAL guide (https, the vendor's
 * own domain, a new tab, no referrer); Claude's steps carry the REAL screenshots (lazy, sized, described in the
 * page's language, dated); ChatGPT carries a labelled DIAGRAM in our own style and no image pretending to be a
 * screenshot; each block carries its own check line (2.4.8): verified in the client with date and version, or a draft
 * line naming the guide check and the reason. No guide is fetched: OpenAI's help centre answers scripts with 403.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { all, first, parse, text } from "@viafrei/design/testing";
import { t } from "../src/i18n/index.js";
import { clientExtrasHtml, shotDate, type ShotFile } from "../src/lib/connect-blocks.js";
import { CONNECT_CLIENT_IDS, GUIDE_DOMAINS, SHOT_META, connectClients, type ShotId } from "../src/site/connect-clients.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "src", "assets", "connect");
const CLAUDE_IDS = ["claude1", "claude2", "claude3", "claude4"] as const satisfies readonly ShotId[];
const SHOTS = Object.fromEntries(Object.keys(SHOT_META).map((id, i) => [id, { src: `/_a/shot-${String(i)}.webp`, width: 1100, height: 200 + i }])) as Record<ShotId, ShotFile>;
/** The thumbnails a block shows (each figure also holds its hidden full-size copy). */
const THUMBS = "figure.cshot a.cshot__open img";
const block = (lang: (typeof LIVE_LANGS)[number], id: (typeof CONNECT_CLIENT_IDS)[number]): string => clientExtrasHtml(lang, connectClients(lang).find((c) => c.id === id)!, SHOTS);

describe("#1090: every client links its official guide", () => {
  it("in every language, every block names at least one guide — https, on that vendor's own domain, a new tab without referrer", () => {
    for (const lang of LIVE_LANGS)
      for (const id of CONNECT_CLIENT_IDS) {
        const links = all(block(lang, id), "p.cguide a");
        expect(links.length, `${lang} ${id}`).toBeGreaterThan(0);
        for (const a of links) {
          const u = new URL(a.attrs.href!);
          expect(u.protocol, `${lang} ${id}`).toBe("https:");
          expect(GUIDE_DOMAINS[id].some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`)), `${id}: ${u.hostname}`).toBe(true);
          expect(a.attrs.target).toBe("_blank");
          expect(a.attrs.rel).toBe("noopener noreferrer");
        }
      }
  });
  it("the other-clients block names Mistral, VS Code, GitHub Copilot and Cursor by their own guides", () => {
    expect(all(block("de", "generic"), "p.cguide a").map((a) => text(a))).toEqual(["Mistral Le Chat", "VS Code", "GitHub Copilot", "Cursor"]);
  });
});

describe("#1090: Claude's steps with the real screenshots", () => {
  it("three steps, four images: lazy, sized, described in the page's language, captioned with the day they were taken; no draft line", () => {
    for (const lang of LIVE_LANGS) {
      const html = block(lang, "claudeAi");
      expect(all(html, "ol.csteps li"), lang).toHaveLength(3);
      const imgs = all(html, THUMBS);
      expect(imgs.map((i) => i.attrs.src), lang).toEqual(CLAUDE_IDS.map((id) => SHOTS[id].src));
      for (const [k, img] of imgs.entries()) {
        expect(img.attrs.loading).toBe("lazy");
        expect(Number(img.attrs.width)).toBeGreaterThan(0);
        expect(Number(img.attrs.height)).toBeGreaterThan(0);
        expect(img.attrs.alt, `${lang} alt ${String(k)}`).toBe(t(lang, `connectPage.shot.${CLAUDE_IDS[k]!}`));
        expect((img.attrs.alt ?? "").length, lang).toBeGreaterThan(20);
      }
      for (const c of all(html, "figure.cshot figcaption")) expect(text(c), lang).toBe(t(lang, "connectPage.shot.caption", { date: shotDate(lang) }));
      expect(first(html, ".draft"), lang).toBeNull();
    }
    expect(shotDate("de")).toBe("28.10.2026");
  });
  it("the steps are the live UI's: Customize → Connectors → + Add, the name ViaFrei and the MCP server URL, then ask and allow", () => {
    const steps = all(block("en", "claudeAi"), "ol.csteps li p").map((p) => text(p));
    expect(steps[0]).toContain("Customize → Connectors → “+ Add” → “Add custom connector”");
    expect(steps[1]).toContain("ViaFrei");
    expect(steps[1]).toContain("MCP server URL");
    expect(steps[2]).toContain("Is the A8 towards Munich clear?");
  });
  it("every screenshot file is a WebP of at most 60 KB", () => {
    for (const id of CLAUDE_IDS) {
      const p = join(ASSETS, SHOT_META[id].file);
      expect(statSync(p).size, id).toBeLessThanOrEqual(60 * 1024);
      const head = readFileSync(p).subarray(0, 12);
      expect(head.subarray(0, 4).toString("ascii") + head.subarray(8, 12).toString("ascii"), id).toBe("RIFFWEBP");
    }
  });
});

describe("#1090: ChatGPT — a diagram, not a screenshot", () => {
  it("in every language: three steps, the diagram of exactly those three with its caption, the availability line, the draft line with its reason, and no image", () => {
    for (const lang of LIVE_LANGS) {
      const html = block(lang, "chatgpt");
      expect(all(html, "ol.csteps li"), lang).toHaveLength(3);
      expect(all(html, "img"), lang).toEqual([]);
      expect(all(html, "figure.cdiag li.cdiag__box"), lang).toHaveLength(3);
      expect(text(first(html, "figure.cdiag figcaption")!), lang).toBe(t(lang, "connectPage.shot.diagram"));
      expect(first(html, "figure.cdiag")!.attrs["aria-label"], lang).toBe(t(lang, "connectPage.chatgptFlow.dtitle"));
      expect(html, lang).toContain(t(lang, "connectPage.chatgptFlow.avail").slice(0, 20));
      expect(text(first(html, ".ccheck .draft")!), lang).toContain(t(lang, "connectPage.check.pending.account"));
    }
    const steps = all(block("en", "chatgpt"), "ol.csteps li p").map((p) => text(p));
    expect(steps[0]).toBe("Plugins → “+” → “Add custom MCP server”.");
    expect(steps[1]).toContain("Create as a plugin");
    expect(steps[2]).toContain("@");
  });
  it("a draft line only where the client itself was not checked: every client really connected drops it", () => {
    const verified = ["claudeAi", "claudeCode", "geminiCli", "generic", "stdio"];
    for (const id of CONNECT_CLIENT_IDS) expect(first(block("en", id), ".draft") === null, id).toBe(verified.includes(id));
  });
  it("only the blocks with a real capture carry an image: claude.ai's screenshots and the four terminal transcripts", () => {
    const withImages = ["claudeAi", "claudeCode", "geminiCli", "generic", "stdio"];
    for (const lang of LIVE_LANGS) for (const id of CONNECT_CLIENT_IDS) if (!withImages.includes(id)) expect(all(block(lang, id), "img"), `${lang} ${id}`).toEqual([]);
  });
});

it("the page parses the block as rendered (sanity: no stray markup)", () => {
  expect(parse(block("de", "claudeAi")).root).toBeDefined();
});
