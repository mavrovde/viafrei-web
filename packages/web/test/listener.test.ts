import { describe, expect, it } from "vitest";
import { EVENTS } from "../src/analytics/events.js";
import { clickEvent, copyEvent, factsOf, pageView, type ClickFacts } from "../src/analytics/listener.js";

/** GA rules 4 and 7: one listener, no board value, no hit from a tile. */
const facts = (over: Partial<ClickFacts> = {}): ClickFacts => ({ href: "/de/connect", insideTile: false, insideLangs: false, where: "hero", ...over });

describe("the shell's one listener (src/analytics/listener.ts)", () => {
  it("counts a page view by route and language only — never a query string or a hash", () => {
    expect(pageView("/de", "de")).toEqual({ name: "page_view", params: { route: "/de", lang: "de" } });
    expect(pageView("/en/connect?place=Nürnberg&line=U2", "en")).toEqual({ name: "page_view", params: { route: "/en/connect", lang: "en" } });
    expect(pageView("/de#roads", "de").params.route).toBe("/de");
    // a path that is not a page of the map carries nothing a visitor typed
    expect(pageView("/de/my-board/Hauptbahnhof", "de").params.route).toBe("/");
    expect(JSON.stringify(pageView("/de?q=A8", "de"))).not.toContain("A8");
  });

  it("names the three click events and nothing else", () => {
    expect(clickEvent(facts(), "de")?.name).toBe("cta_connect_click");
    expect(clickEvent(facts({ where: "header" }), "de")?.params).toEqual({ lang: "de", where: "header" });
    expect(clickEvent(facts({ href: "/de/developers", where: "audience" }), "de")?.name).toBe("cta_developers_click");
    expect(clickEvent(facts({ href: "/en", insideLangs: true, where: null }), "de")).toEqual({ name: "language_switch", params: { from: "de", to: "en" } });
    expect(clickEvent(facts({ href: "/de", insideLangs: true, where: null }), "de")).toBeNull(); // same language: no switch
    expect(clickEvent(facts({ href: "/de/business" }), "de")).toBeNull();
    expect(clickEvent(facts({ href: "#prompts" }), "de")).toBeNull();
  });

  it("sends nothing from inside a tile — a credit link is never a hit (rule 7)", () => {
    expect(clickEvent(facts({ href: "https://verkehr.autobahn.de", insideTile: true, where: null }), "de")).toBeNull();
    expect(clickEvent(facts({ href: "/de/connect", insideTile: true }), "de")).toBeNull();
    expect(clickEvent(facts({ href: null }), "de")).toBeNull();
  });

  it("carries no free text in any parameter: every value is a map path, a language or a slot name", () => {
    const seen = [
      pageView("/de", "de"),
      clickEvent(facts(), "de"),
      clickEvent(facts({ href: "/en", insideLangs: true, where: null }), "de"),
      clickEvent(facts({ href: "/de/developers", where: "audience" }), "de"),
    ];
    for (const e of seen) {
      expect(e).not.toBeNull();
      expect(EVENTS).toContain(e?.name);
      for (const v of Object.values(e?.params ?? {})) expect(["/de", "/en", "de", "en", "hero", "header", "audience", "/de/connect"]).toContain(v);
    }
  });

  it("reads the facts off an element through closest() and getAttribute() only", () => {
    const el = {
      getAttribute: (n: string) => (n === "href" ? "/de/connect" : null),
      closest: (sel: string) => (sel === ".hero" ? {} : null),
    };
    expect(factsOf(el)).toEqual({ href: "/de/connect", insideTile: false, insideLangs: false, where: "hero", source: null, cta: null });
    expect(factsOf(null)).toEqual({ href: null, insideTile: false, insideLangs: false, where: null, source: null, cta: null });
  });

  it("#1001: the note's guide link is cta_connect_click with where 'note' and its surface — inside a live block too; an unknown surface is no source", () => {
    const at = (attrs: Readonly<Record<string, string>>, inside: readonly string[] = []) => ({
      getAttribute: (n: string) => attrs[n] ?? null,
      closest: (sel: string) => (inside.some((i) => sel.split(", ").includes(i)) ? {} : null),
    });
    for (const source of ["home", "place", "motorway", "examples", "connect", "business", "developers"] as const) {
      const f = factsOf(at({ href: "/de/connect#clients", "data-cta-source": source }, [".motorway-page"]));
      expect(f.source).toBe(source);
      expect(f.insideTile).toBe(true);
      expect(clickEvent(f, "de")).toEqual({ name: "cta_connect_click", params: { lang: "de", where: "note", surface: source } });
    }
    expect(clickEvent(factsOf(at({ href: "/en/connect#clients", "data-cta-source": "home" }, [".moment"])), "en")?.params).toEqual({ lang: "en", where: "note", surface: "home" });
    // a value off the closed list is no source: the click is what it was before (a moment link → "moment")
    expect(factsOf(at({ href: "/de/connect#clients", "data-cta-source": "Kassel" })).source).toBeNull();
    expect(clickEvent(factsOf(at({ href: "/de/connect#clients", "data-cta-source": "Kassel" }, [".moment"])), "de")?.params).toEqual({ lang: "de", where: "moment" });
    // a note link inside a tile that names no surface stays silent (rule 7), and a source on another page's link is no note click
    expect(clickEvent(factsOf(at({ href: "/de/connect#clients" }, [".tile"])), "de")).toBeNull();
    expect(clickEvent(factsOf(at({ href: "/de/business", "data-cta-source": "home" }, [".tile"])), "de")).toBeNull();
    expect(clickEvent(factsOf(at({ href: "https://example.org/de/connect", "data-cta-source": "home" })), "de")).toBeNull();
  });

  it("#1003: a copy of the endpoint chip is cta_connect_click with where 'copy' and the chip's surface; a word off the closed list sends nothing", () => {
    for (const surface of ["home", "place", "motorway", "examples", "connect", "business", "developers"] as const)
      expect(copyEvent(surface, "en")).toEqual({ name: "cta_connect_click", params: { lang: "en", where: "copy", surface } });
    for (const x of [null, undefined, "", "Kassel", "https://mcp.viafrei.de/mcp", 1, {}]) expect(copyEvent(x, "de")).toBeNull();
  });
});
