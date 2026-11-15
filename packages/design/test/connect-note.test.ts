/**
 * #1001: the "works only with ViaFrei connected" note, both shapes, read as
 * structure — the plug, the sentence, the in-place expansion (the endpoint
 * chip, the one line of assistant names, the guide link) or the plain link with
 * the chip beside it (#1003), the surface on every link, and escaping once.
 */
import { describe, expect, it } from "vitest";
import { C, CONNECT_SOURCES, CONNECT_SOURCE_ATTR, connectNote, esc, isConnectSource, type ConnectNote } from "../src/index.js";
import { all, first, text, wellFormed } from "../src/testing/index.js";

const base: ConnectNote = { text: esc("Diese Antwort gibt Ihr KI-Assistent nur, wenn ViaFrei verbunden ist."), link: esc("So verbinden Sie ViaFrei"), href: "/de/connect#clients", source: "home" };
const how = {
  endpointLabel: esc("MCP-Endpunkt"),
  clientsLabel: esc("Schritt für Schritt für"),
  clients: [
    { name: esc("Claude"), href: "/de/connect#client-claude-ai" },
    { name: esc("ChatGPT"), href: "/de/connect#client-chatgpt" },
    { name: esc("Le Chat"), href: "/de/connect#client-le-chat" },
  ],
  guide: esc("Vollständige Anleitung"),
};
const chip = { endpoint: "https://mcp.viafrei.de/mcp", copy: esc("Adresse kopieren"), copied: esc("Kopiert") };

describe("connectNote (#1001)", () => {
  it("with `how`: a <details> whose summary is the plug, the sentence and the link words; the body holds the endpoint, the steps and the guide link", () => {
    const html = connectNote({ ...base, chip, how });
    expect(wellFormed(html)).toEqual([]);
    const d = first(html, `details.${C.connectNote}`);
    expect(d).not.toBeNull();
    const summary = first(html, `details.${C.connectNote} summary.${C.connectNoteSummary}`)!;
    expect(all(summary, `svg.${C.connectNoteIcon}[aria-hidden="true"]`)).toHaveLength(1);
    expect(text(first(summary, `.${C.connectNoteText}`)!)).toBe("Diese Antwort gibt Ihr KI-Assistent nur, wenn ViaFrei verbunden ist.");
    expect(text(first(summary, `.${C.connectNoteLink}`)!)).toBe("So verbinden Sie ViaFrei →");
    // the arrow is hidden from a screen reader: the accessible name is the words
    expect(all(summary, `.${C.connectNoteLink} span[aria-hidden="true"]`).map(text)).toEqual([" →"]);
    expect(all(summary, "a")).toHaveLength(0);
    // #1003: the endpoint chip in the body, naming the note's surface
    const chips = all(html, `.${C.connectNoteBody} span.${C.endpointChip}`);
    expect(chips).toHaveLength(1);
    expect(chips[0]!.attrs[CONNECT_SOURCE_ATTR]).toBe("home");
    expect(text(first(chips[0]!, "code")!)).toBe("https://mcp.viafrei.de/mcp");
    // #1003: one line of names, each a link to its own block, each naming the surface
    const names = all(html, `p.${C.connectNoteClients} span[translate="no"] a`);
    expect(names.map(text)).toEqual(["Claude", "ChatGPT", "Le Chat"]);
    expect(names.map((a) => a.attrs["href"])).toEqual(["/de/connect#client-claude-ai", "/de/connect#client-chatgpt", "/de/connect#client-le-chat"]);
    for (const a of names) expect(a.attrs[CONNECT_SOURCE_ATTR]).toBe("home");
    expect(text(first(html, `p.${C.connectNoteClients}`)!)).toBe("Schritt für Schritt für: Claude, ChatGPT, Le Chat");
    const links = all(html, `a.${C.connectNoteGuide}`);
    expect(links).toHaveLength(1);
    expect(links[0]!.attrs).toMatchObject({ class: C.connectNoteGuide, href: "/de/connect#clients", [CONNECT_SOURCE_ATTR]: "home" });
    expect(text(links[0]!)).toBe("Vollständige Anleitung →");
  });

  it("without `how`: the same plug and sentence in a paragraph, the chip beside them (#1003), and a plain link straight to the guide", () => {
    const html = connectNote({ ...base, chip, source: "motorway" });
    expect(wellFormed(html)).toEqual([]);
    expect(all(html, "details")).toHaveLength(0);
    const p = first(html, `p.${C.connectNote}`)!;
    expect(all(p, `svg.${C.connectNoteIcon}`)).toHaveLength(1);
    expect(text(first(p, `.${C.connectNoteText}`)!)).toBe("Diese Antwort gibt Ihr KI-Assistent nur, wenn ViaFrei verbunden ist.");
    const a = all(html, "a");
    expect(a).toHaveLength(1);
    expect(a[0]!.attrs).toMatchObject({ class: C.connectNoteLink, href: "/de/connect#clients", [CONNECT_SOURCE_ATTR]: "motorway" });
    const c = all(p, `span.${C.endpointChip}`);
    expect(c).toHaveLength(1);
    expect(c[0]!.attrs[CONNECT_SOURCE_ATTR]).toBe("motorway");
    expect(all(p, `button[hidden]`)).toHaveLength(1);
    // and without a chip, none
    expect(all(connectNote({ ...base, source: "motorway" }), `.${C.endpointChip}`)).toHaveLength(0);
  });

  it("escapes the href, the endpoint and the source once; the words arrive as Html and are not escaped again", () => {
    const html = connectNote({ ...base, text: esc('A<b> & "c"'), href: '/de/connect"x#clients', chip: { ...chip, endpoint: "https://x/<y>" }, how: { ...how, clients: [{ name: esc("A&B"), href: '/x"y' }] } });
    expect(text(first(html, `.${C.connectNoteText}`)!)).toBe('A<b> & "c"');
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("&amp;amp;");
    expect(first(html, `a.${C.connectNoteGuide}`)!.attrs["href"]).toBe('/de/connect"x#clients');
    expect(text(first(html, `code.${C.endpointChipUrl}`)!)).toBe("https://x/<y>");
    expect(text(first(html, `p.${C.connectNoteClients} a`)!)).toBe("A&B");
    expect(first(html, `p.${C.connectNoteClients} a`)!.attrs["href"]).toBe('/x"y');
  });

  it("the surfaces are a closed list", () => {
    expect([...CONNECT_SOURCES]).toEqual(["home", "place", "motorway", "examples", "connect", "business", "developers"]);
    for (const s of CONNECT_SOURCES) expect(isConnectSource(s)).toBe(true);
    for (const x of ["", "Home", "kassel", null, undefined, 1]) expect(isConnectSource(x)).toBe(false);
  });
});
