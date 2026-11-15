/**
 * The place cards are a flex column whose spacing and pinned footer come from
 * the card itself. The fuel card's body is wrapped in a `<div data-nosnippet>`
 * (data steward 2026-10-12, so an indexed place page cannot show an old fuel
 * price in a search snippet); that div must take no box, or the card's children
 * lose their gap and the credits leave the bottom of the card (review
 * 2026-10-12). The e2e stub renders no cards, so this rule is pinned here.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/styles/site.css", import.meta.url), "utf8");

describe("the place card's nosnippet wrapper", () => {
  it("takes no box, so the card's flex layout reaches its children", () => {
    expect(css).toMatch(/\.pcard > \[data-nosnippet\] \{ display: contents; \}/);
  });
  it("the card is still the flex column the rule relies on, with the footer pinned to the bottom", () => {
    expect(css).toMatch(/\.pcard \{[^}]*display: flex; flex-direction: column;[^}]*\}/);
    expect(css).toMatch(/\.pcard__foot \{ margin-top: auto;/);
  });
});
