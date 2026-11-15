/**
 * #938 C5: a card's fold that loaded its next entries is counted as `card_more` (card, step) — only through the
 * consent island (sent after consent), only with a card KIND from the closed list and a clamped step count, never a
 * place, a line or a road. The list is held equal to the digest's card ids and motorway kinds, which the shell may not
 * import at runtime.
 */
import { describe, expect, it } from "vitest";
import { MOTORWAY_KINDS } from "@viafrei/digest";
import { PLACE_CARD_IDS } from "../../../.pinned/app/packages/digest/dist/src/analysis/place.js";
import { CARD_EVENT_IDS, CARD_STEP_MAX } from "../src/analytics/events.js";
import { cardMoreEvent } from "../src/analytics/listener.js";
import { PAGER_JS } from "../src/lib/card-more.js";

describe("#938 C5: the card_more event", () => {
  it("names exactly the place cards and the motorway card kinds — both directions", () => {
    const expected = new Set<string>([...PLACE_CARD_IDS, ...MOTORWAY_KINDS]);
    expect(new Set<string>(CARD_EVENT_IDS)).toEqual(expected);
    expect(CARD_EVENT_IDS.length).toBe(expected.size);
  });

  it("builds the event from the pager's detail, clamps the step, and refuses anything else", () => {
    expect(cardMoreEvent({ card: "stations", step: 2 }, "de")).toEqual({ name: "card_more", params: { lang: "de", card: "stations", step: 2 } });
    expect(cardMoreEvent({ card: "jams", step: 999 }, "en")?.params.step).toBe(CARD_STEP_MAX);
    for (const bad of [{ card: "Köln", step: 1 }, { card: "stations", step: 0 }, { card: "stations", step: 1.5 }, { card: "stations" }, null, "stations", { card: "ags:05315000", step: 1 }]) {
      expect(cardMoreEvent(bad, "de"), JSON.stringify(bad)).toBeNull();
    }
  });

  it("the pager script announces each loaded step as vf:card-more with the card and the step count, nothing else", () => {
    expect(PAGER_JS).toContain('"vf:card-more"');
    expect(PAGER_JS).toMatch(/detail: \{ card: [^}]*, step: [^}]*\}/);
  });
});

describe("#938 B4: a step that could not be loaded", () => {
  it("keeps the entries shown, says so beside the fold from its data-failed text, closes it so the next press retries", () => {
    const failed = PAGER_JS.slice(PAGER_JS.indexOf(".catch(function () {"));
    expect(failed).toContain('d.getAttribute("data-failed")');
    expect(failed).toContain("pager__failed");
    expect(failed).toContain("d.open = false");
    expect(failed).toContain('d.removeAttribute("data-state")');
    // the body (the entries loaded so far and the no-script link) is never emptied on a failure
    expect(failed).not.toContain("innerHTML");
  });
});
