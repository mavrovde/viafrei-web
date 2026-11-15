/**
 * #1003: the endpoint chip, read as structure — the address as ONE URL in a
 * `<code translate="no">` whose only break opportunity is before the path, the
 * host emphasised in its own span, the copy button `hidden` until the shell's
 * script reveals it, its accessible name and its "copied" word, the polite
 * status region, the surface, and escaping once.
 */
import { describe, expect, it } from "vitest";
import { C, CONNECT_SOURCE_ATTR, endpointChip, esc, splitEndpoint, type EndpointChip } from "../src/index.js";
import { all, first, text, wellFormed } from "../src/testing/index.js";

const chip: EndpointChip = { endpoint: "https://mcp.viafrei.de/mcp", copy: esc("Adresse kopieren"), copied: esc("Kopiert"), source: "connect" };

describe("endpointChip (#1003)", () => {
  it("one URL: the code's text is exactly the address, scheme+host in one span, a <wbr>, then the path", () => {
    const html = endpointChip(chip);
    expect(wellFormed(html)).toEqual([]);
    const code = first(html, `span.${C.endpointChip} code.${C.endpointChipUrl}[translate="no"]`)!;
    expect(text(code)).toBe("https://mcp.viafrei.de/mcp");
    expect(text(first(code, `.${C.endpointChipHost}`)!)).toBe("https://mcp.viafrei.de");
    expect(text(first(code, `.${C.endpointChipHost} .${C.endpointChipScheme}`)!)).toBe("https://");
    expect(text(first(code, `.${C.endpointChipPath}`)!)).toBe("/mcp");
    // the ONLY break opportunity is the <wbr> between the host and the path
    expect(all(code, "wbr")).toHaveLength(1);
    expect(html).toMatch(/mcp\.viafrei\.de<\/span><wbr><span class="endpoint-chip__path">/u);
  });

  it("the copy button: hidden until a script reveals it, named in the page's words, carrying the 'copied' word", () => {
    const b = first(endpointChip(chip), `button.${C.endpointChipCopy}`)!;
    expect(b.attrs).toMatchObject({ type: "button", "aria-label": "Adresse kopieren", title: "Adresse kopieren", value: "Kopiert" });
    expect("hidden" in b.attrs).toBe(true);
    // its glyph is the stylesheet's: the button holds no text and no element, its name is the aria-label alone
    expect(b.children).toHaveLength(0);
  });

  it("an empty polite status region the script writes the 'copied' word into, and the surface on the chip", () => {
    const html = endpointChip(chip);
    const s = first(html, `span.${C.endpointChipStatus}[role="status"][aria-live="polite"]`)!;
    expect(text(s)).toBe("");
    expect(first(html, `span.${C.endpointChip}`)!.attrs[CONNECT_SOURCE_ATTR]).toBe("connect");
    // no script, no inline handler: a fragment that carries it stays script-free; and no data- attribute but the surface word
    expect(html).not.toMatch(/<script|\son[a-z]+=/iu);
    expect(html.replace(/ data-cta-source="connect"/u, "")).not.toMatch(/\sdata-/u);
  });

  it("escapes the address once; the words arrive as Html and are not escaped again", () => {
    const html = endpointChip({ ...chip, endpoint: "https://a<b>.de/x&y", copy: esc('Copy "it"') });
    expect(text(first(html, "code")!)).toBe("https://a<b>.de/x&y");
    expect(html).not.toContain("<b>");
    expect(first(html, "button")!.attrs["aria-label"]).toBe('Copy "it"');
    expect(html).not.toContain("&amp;amp;");
  });

  it("splitEndpoint cuts at the path, and an address without a scheme is all host", () => {
    expect(splitEndpoint("https://mcp.viafrei.de/mcp")).toEqual({ scheme: "https://", host: "mcp.viafrei.de", path: "/mcp" });
    expect(splitEndpoint("https://mcp.viafrei.de")).toEqual({ scheme: "https://", host: "mcp.viafrei.de", path: "" });
    expect(splitEndpoint("mcp")).toEqual({ scheme: "", host: "mcp", path: "" });
    expect(all(endpointChip({ ...chip, endpoint: "https://mcp.viafrei.de" }), "wbr")).toHaveLength(0);
  });
});
