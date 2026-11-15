/**
 * #1106: ViaFrei on a phone — the connect page's `#phone` section (`site/connect-phone.ts`).
 *
 * - AC 1/2: a block whose vendor documents the phone path carries numbered steps from opening to a first answer, the
 *   address in its step, a test question and what a right answer is; each step shows the owner's capture of it
 *   (claude.ai in a phone's browser, 2026-11-01), captioned as taken in the phone's BROWSER — never the Claude app —
 *   and no "screenshot to follow" mark is left.
 * - AC 3: a vendor that documents the web only, or rules the phone out for a visitor in Germany, gets ONE honest line
 *   and no steps.
 * - AC 4: every block links its vendor's own guide (https, the vendor's domain) and was checked within 90 days.
 * - AC 5: no block claims a device run it did not have — the check line is the draft "not yet tried on a phone".
 * - Every live language renders every block; the jump link and the section are on the page (the anchor itself is
 *   judged by `in-page-anchors.test.ts` over the rendered connect page).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { all, text } from "@viafrei/design/testing";
import { t } from "../src/i18n/index.js";
import { dayOf, shotCaption, type ShotFile } from "../src/lib/connect-blocks.js";
import { SHOT_IDS, SHOT_META, type ShotId } from "../src/site/connect-clients.js";
import { MCP_ENDPOINT } from "../src/site/endpoints.js";
import { PENDING_CAPTURES, captureTargets } from "../src/site/connect-captures.js";
import { PHONE_CHECKED, PHONE_CLIENTS, PHONE_CLIENT_IDS, PHONE_GUIDE_DOMAINS, PHONE_RECHECK_DAYS, phoneAnchor, phoneBlockHtml as blockHtml, phoneClients } from "../src/site/connect-phone.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SHOTS = Object.fromEntries(SHOT_IDS.map((id, i) => [id, { src: `/_a/s${String(i)}.webp`, width: 393, height: 300 + i }])) as Record<ShotId, ShotFile>;
const phoneBlockHtml = (lang: Parameters<typeof blockHtml>[0], c: Parameters<typeof blockHtml>[1]): string => blockHtml(lang, c, SHOTS);

/** The fixed clock of this release's check; a block older than the recheck window at the next cut fails here. */
const CUT = Date.parse("2026-11-01T12:00:00Z");
const hrefs = (html: string): string[] => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
const unesc = (s: string): string => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

describe("#1106 the phone blocks, in every live language", () => {
  for (const lang of LIVE_LANGS)
    it(lang, () => {
      for (const c of phoneClients()) {
        const html = phoneBlockHtml(lang, c);
        // AC 4: the vendor's own guide, https, on its own domain (the figures' own in-page anchors aside)
        const links = hrefs(html).filter((h) => !h.startsWith("#shot-"));
        expect(links.length, `${lang} ${c.id}`).toBe(c.guides.length);
        for (const h of links) {
          const u = new URL(h);
          expect(u.protocol).toBe("https:");
          expect(PHONE_GUIDE_DOMAINS[c.id].some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`)), `${c.id} ${h}`).toBe(true);
        }
        // AC 5: never "connected on a phone" without a device run
        expect(c.device).toBeNull();
        expect(unesc(html)).toContain(t(lang, "connectPage.phone.checked", { date: dayOf(lang, c.checked) }));
        expect(html).toMatch(/<p class="ccheck"><span class="draft">/);
        if (c.status === "steps") {
          // AC 1/2: numbered steps, each with its own capture, captioned as claude.ai in a phone's browser; the address in a
          // step; the test question last; no "screenshot to follow" mark left
          const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]!);
          expect(all(html, "ol.csteps")).toHaveLength(1);
          expect(items.length).toBe(c.steps.length);
          expect(items.length).toBeGreaterThanOrEqual(3);
          expect(c.shots.length).toBe(c.steps.length);
          for (const [i, li] of items.entries()) {
            const figs = [...li.matchAll(/<figure class="cshot" id="shot-([a-z0-9]+)"/giu)].map((m) => m[1]!);
            expect(figs, `${lang} step ${String(i + 1)}`).toEqual(c.shots[i]);
            for (const id of figs) {
              expect(all(li, `figure#shot-${id} figcaption`).map(text)).toEqual([shotCaption(lang, id as ShotId)]);
              expect(unesc(li)).toContain(`alt="${t(lang, `connectPage.shot.${id as ShotId}`)}"`);
            }
          }
          expect(html).not.toContain("cshot-pending");
          expect(items.some((li) => li.includes(MCP_ENDPOINT))).toBe(true);
          expect(unesc(items.at(-1)!)).toContain(t(lang, c.steps.at(-1)!));
        } else {
          // AC 3: one honest line, no steps, naming the date of the check
          expect(all(html, "ol")).toEqual([]);
          expect(all(html, "figure")).toEqual([]);
          expect(unesc(html)).toContain(dayOf(lang, c.checked));
        }
      }
    });
});

describe("#1106 what each block may claim", () => {
  it("only Claude documents the phone path; Gemini and Copilot each say their own reason; the rest say 'unclear'", () => {
    expect(PHONE_CLIENT_IDS.filter((id) => PHONE_CLIENTS[id].status === "steps")).toEqual(["claude"]);
    expect(PHONE_CLIENT_IDS.filter((id) => PHONE_CLIENTS[id].status === "no").sort()).toEqual(["copilot", "gemini"]);
    const g = unesc(phoneBlockHtml("en", PHONE_CLIENTS.gemini));
    expect(g).toContain("only with a personal account in the US");
    expect(g).not.toContain("Microsoft");
    expect(unesc(phoneBlockHtml("en", PHONE_CLIENTS.copilot))).toContain("Microsoft 365 Copilot");
    expect(unesc(phoneBlockHtml("en", PHONE_CLIENTS.chatgpt))).toContain("ChatGPT: the official guide adds a custom MCP server on the web only");
    for (const id of PHONE_CLIENT_IDS) if (PHONE_CLIENTS[id].status !== "steps") expect(PHONE_CLIENTS[id].steps).toEqual([]);
    // AC 1: the whole path, in order — set up on the web, the address, switched on in the app, the first question
    const steps = [...unesc(phoneBlockHtml("en", PHONE_CLIENTS.claude)).matchAll(/<li><p>(.*?)<\/p>/g)].map((m) => m[1]!);
    expect(steps.map((x, i) => [/claude\.ai/.test(x) && i === 0, x.includes(MCP_ENDPOINT), /Claude app/.test(x), /A7 near Kassel/.test(x)])).toEqual([
      [true, false, false, false],
      [false, true, false, false],
      [false, false, true, false],
      [false, false, false, true],
    ]);
  });
  it("the documented block comes first, then the unclear, then the ruled-out", () => {
    const order = phoneClients().map((c) => c.status);
    expect(order).toEqual([...order].sort((a, b) => ["steps", "unclear", "no"].indexOf(a) - ["steps", "unclear", "no"].indexOf(b)));
    expect(order[0]).toBe("steps");
  });
  it(`every block was checked within ${String(PHONE_RECHECK_DAYS)} days of this release's clock (AC 4)`, () => {
    for (const id of PHONE_CLIENT_IDS) {
      const age = (CUT - Date.parse(`${PHONE_CLIENTS[id].checked}T00:00:00Z`)) / 86_400_000;
      expect(age, id).toBeGreaterThanOrEqual(0);
      expect(age, id).toBeLessThanOrEqual(PHONE_RECHECK_DAYS);
    }
    expect(PHONE_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("every phone step has its capture, none is pending any more, and none claims the Claude app (#1106)", () => {
    const phone = captureTargets().filter((x) => x.startsWith("phone:"));
    expect(phone).toEqual(PHONE_CLIENTS.claude.steps.map((_, i) => `phone:claude:${String(i + 1)}`));
    for (const x of phone) expect(PENDING_CAPTURES[x], x).toBeUndefined();
    expect(PHONE_CLIENTS.claude.shots).toEqual([["phone1"], ["phone2"], ["phone3"], ["phone4", "phone4b"]]);
    // taken in the phone's BROWSER on 2026-11-01: the caption says so in every language, and never the computer one
    for (const id of PHONE_CLIENTS.claude.shots.flat()) {
      expect(SHOT_META[id]).toMatchObject({ kind: "phone", taken: "2026-11-01", what: "claude.ai" });
      for (const lang of LIVE_LANGS) {
        const date = dayOf(lang, "2026-11-01");
        expect(shotCaption(lang, id), `${lang} ${id}`).toBe(t(lang, "connectPage.shot.phoneCaption", { date }));
        expect(shotCaption(lang, id), `${lang} ${id}`).not.toBe(t(lang, "connectPage.shot.caption", { date }));
      }
    }
    expect(shotCaption("en", "phone3")).toBe(`Screenshot: claude.ai in a phone’s browser, ${dayOf("en", "2026-11-01")}`);
  });
  it("step 2 names the dialog's real button, Continue, and no No-sign-in choice the dialog does not have (#1106)", () => {
    for (const lang of LIVE_LANGS) {
      const s2 = t(lang, "connectPage.phone.claude.s2", { url: MCP_ENDPOINT });
      expect(s2, lang).toContain("Continue");
      expect(s2, lang).toContain(MCP_ENDPOINT);
      expect(s2, lang).not.toContain("No sign in");
      expect(s2, lang).not.toMatch(/[“„«‘"]Add[”“»’"]/u);
    }
  });
  it("anchors are unique and phone-prefixed", () => {
    const ids = PHONE_CLIENT_IDS.map(phoneAnchor);
    expect(new Set(ids).size).toBe(ids.length);
    expect(phoneAnchor("leChat")).toBe("phone-le-chat");
  });
});

describe("#1106 the page wires the section and its jump link", () => {
  it("ConnectPage.astro has the jump link in its head and the #phone section before the client list", () => {
    const src = readFileSync(new URL("../src/layouts/ConnectPage.astro", import.meta.url), "utf8");
    const jump = src.indexOf('href="#phone"');
    const section = src.indexOf('id="phone"');
    expect(jump).toBeGreaterThan(-1);
    expect(jump).toBeLessThan(src.indexOf('id="endpoint"'));
    expect(section).toBeGreaterThan(src.indexOf('id="endpoint"'));
    expect(section).toBeLessThan(src.indexOf('id="clients"'));
    expect(src).toContain("phoneBlockHtml(lang, c, SHOTS)");
  });
});
