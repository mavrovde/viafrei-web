/**
 * 2.5.17: the whole road's Ampel is the first thing after a motorway page's head, on every road the real digest
 * renders, in every site language. 2.5.16 wrote the junctions with something reported ("Betroffen: …", #1110 item 2)
 * in a note of their own under the road's course (7bbd2b7bd); the shell lifted the course and left the note, which
 * then stood between the fragment's root and the Ampel, so the anchored `liftAmpel` lifted nothing: no `#ampel-slot`
 * for the whole road, no `#ampel-whole` template for "Ganz Deutschland", the lamp a screen down below the note.
 * Unit fixtures of the head held no such note; this reads the digest's own answers (`e2e/real-digest.ts`).
 */
import { first } from "@viafrei/design/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "../e2e/real-digest.js";
import { liftAmpel } from "../src/lib/motorway-ampel.js";
import { motorwayHeadOf } from "../src/lib/motorway-head.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const ROADS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A34", "A57", "A61"];

let digest: Awaited<ReturnType<typeof startRealDigest>>;
beforeAll(async () => {
  digest = await startRealDigest();
}, 60_000);
afterAll(async () => {
  await digest.close();
});

describe("the whole road's Ampel is lifted on every recorded road (2.5.17)", () => {
  it("every page that holds the Ampel gives it to the slot, in every language, and a page naming junctions keeps them in the head", async () => {
    let pages = 0;
    let notes = 0;
    for (const lang of LIVE_LANGS) {
      for (const road of ROADS) {
        const res = await fetch(`${digest.url}/internal/motorway/${road}?lang=${lang}`);
        const body = await res.text();
        expect(res.status, `${road} ${lang}`).toBe(200);
        if (!body.includes('id="motorway-ampel"')) continue;
        pages += 1;
        const head = motorwayHeadOf(road, body, lang);
        const lifted = liftAmpel(head.html);
        expect(lifted.ampel, `${road} ${lang}: the Ampel is not first after the head`).not.toBeNull();
        expect(lifted.html, `${road} ${lang}`).not.toContain('id="motorway-ampel"');
        if (head.note !== null) {
          notes += 1;
          expect(first(head.note, "a[href]"), `${road} ${lang}: the note links its junctions`).not.toBeNull();
          // the FAQ repeats the list further down (its reviewed clause); the note itself left the place before the Ampel
          expect(head.html.replace(/^<section class="motorway" id="motorway"[^>]*>/, ""), `${road} ${lang}`).toMatch(/^<section class="pcard pcard--\w+ ampel /);
        }
      }
    }
    // the fixture holds roads with an Ampel, and some name the junctions where something is reported now
    expect(pages).toBeGreaterThanOrEqual(ROADS.length);
    expect(notes).toBeGreaterThan(0);
  }, 120_000);
});
