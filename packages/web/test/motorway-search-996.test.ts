/**
 * #996 (2.3.23): the search-as-you-type script's static contract. Its behaviour (results without a reload, the row
 * scrolled into view, the no-JS form) is driven in a real browser by `e2e/motorway-search-996.e2e.ts`.
 */
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { hasSearchBox, motorwaySearchScript, SEARCH_INPUT_ID, SEARCH_SECTION_ID } from "../src/lib/motorway-search.js";

describe("#996: the search script", () => {
  const js = motorwaySearchScript();

  it("is one valid script, bound once, delegated, and asks only this origin's own page", () => {
    expect(() => new Script(js)).not.toThrow();
    expect(js).toContain("w.vfSearch");
    expect(js.match(/addEventListener\(/g)).toHaveLength(1);
    // the same address the form asks: this page with `find` — never another host, never a second matcher
    expect(js).toContain("new URL(location.href)");
    expect(js).toContain('searchParams.set("find"');
    expect(js).not.toMatch(/https?:\/\//);
    expect(js).not.toMatch(/fold|normalize\(/);
  });

  it("never writes markup from a string, keeps the box, and announces through the one region it keeps", () => {
    expect(js).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(js).toContain("if(k!==f)k.remove()");
    expect(js).not.toContain("replaceChildren");
    expect(js).toContain('removeAttribute("aria-live")');
    expect(js).toContain('"role","status"');
  });

  it("is included exactly when the fragment carries the box", () => {
    expect(hasSearchBox(`<section id="${SEARCH_SECTION_ID}"><input id="${SEARCH_INPUT_ID}"></section>`)).toBe(true);
    expect(hasSearchBox("<section></section>")).toBe(false);
  });
});
