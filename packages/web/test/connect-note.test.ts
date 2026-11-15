/**
 * #1001: the shell's "works only with ViaFrei connected" note, in every site
 * language — the sentence, the link words, the expansion with the endpoint
 * chip and the one line of assistant names (#1003) read from the connect
 * page's own list, each linking to its own block there, the guide at
 * `/<lang>/connect#clients` — the digest's words held equal to
 * the shell's, and every renderer of an example answer held to carry it.
 * The rendered pages are held to "exactly one per answer" by
 * `e2e/connect-note.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { C, CONNECT_SOURCES } from "@viafrei/design";
import { all, first, text, wellFormed } from "@viafrei/design/testing";
import { MOTORWAY_EXTRAS_COPY } from "../../digest/src/presentation/i18n-motorway-extras.js";
import { t } from "../src/i18n/index.js";
import { connectGuideHref, connectNoteHtml } from "../src/lib/connect-note.js";
import { CONNECT_CLIENT_IDS, NOTE_CLIENTS, clientAnchor, connectClients } from "../src/site/connect-clients.js";
import { MCP_ENDPOINT } from "../src/site/endpoints.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (p: string): string => readFileSync(join(SRC, p), "utf8");

describe("the note in every site language (#1001)", () => {
  it("the issue's German words, verbatim", () => {
    expect(t("de", "connectNote.text")).toBe("Diese Antwort gibt Ihr KI-Assistent nur, wenn ViaFrei verbunden ist.");
    expect(text(first(connectNoteHtml("de", "home"), `.${C.connectNoteLink}`)!)).toBe("So verbinden Sie ViaFrei →");
  });

  for (const lang of LIVE_LANGS) {
    it(`${lang}: the sentence, the link, the endpoint chip, the line of assistant names from /connect's list and the guide`, () => {
      const html = connectNoteHtml(lang, "examples");
      expect(wellFormed(html)).toEqual([]);
      expect(text(first(html, `summary .${C.connectNoteText}`)!)).toBe(t(lang, "connectNote.text"));
      expect(text(first(html, `summary .${C.connectNoteLink}`)!)).toBe(`${t(lang, "connectNote.link")} →`);
      expect(text(first(html, `.${C.connectNoteBody} code.${C.endpointChipUrl}`)!)).toBe(MCP_ENDPOINT);
      expect(first(html, `button.${C.endpointChipCopy}`)!.attrs["aria-label"]).toBe(t(lang, "connectNote.copy"));
      const names = all(html, `p.${C.connectNoteClients} a`);
      expect(names.map(text)).toEqual(NOTE_CLIENTS.map((c) => c.name));
      const anchors = new Set(connectClients(lang).map((c) => c.anchor));
      for (const a of names) {
        const [path, hash] = (a.attrs["href"] ?? "").split("#");
        expect(path).toBe(`/${lang}/connect`);
        expect(anchors.has(hash ?? ""), hash).toBe(true);
        expect(a.attrs["data-cta-source"]).toBe("examples");
      }
      const guide = all(html, `a.${C.connectNoteGuide}`);
      expect(guide).toHaveLength(1);
      expect(guide[0]!.attrs).toMatchObject({ href: `/${lang}/connect#clients`, "data-cta-source": "examples" });
      expect(connectGuideHref(lang)).toBe(`/${lang}/connect#clients`);
      expect(text(guide[0]!)).toBe(`${t(lang, "connectNote.guide")} →`);
      // a language's own words: no catalogue may fall back to the German sentence
      if (lang !== "de") expect(t(lang, "connectNote.text")).not.toBe(t("de", "connectNote.text"));
    });
  }

  it("bounded: one note is at most 2 400 B of UTF-8 in every language (measured 2.3.21: de 1 434, el 1 787; 2.3.22 with #1003's chip and eight named links: de 2 018, el 2 215, the longest), so a page grows by a known amount per answer", () => {
    for (const lang of LIVE_LANGS) expect(Buffer.byteLength(connectNoteHtml(lang, "business")), lang).toBeLessThanOrEqual(2400);
  });

  it("every surface names itself on the guide link", () => {
    for (const s of CONNECT_SOURCES) {
      const html = connectNoteHtml("de", s);
      for (const a of all(html, "a")) expect(a.attrs["data-cta-source"]).toBe(s);
      expect(first(html, `span.${C.endpointChip}`)!.attrs["data-cta-source"]).toBe(s);
    }
  });

  it("the client list is the connect page's: one list, the note's names a part of it, each with its own anchor (#1003)", () => {
    expect(NOTE_CLIENTS.map((c) => c.name)).toEqual(["Claude", "ChatGPT", "GitHub Copilot", "Cursor", "Gemini CLI", "Windsurf", "Codex", "Le Chat"]);
    for (const c of NOTE_CLIENTS) expect(CONNECT_CLIENT_IDS).toContain(c.id);
    expect(connectClients("de").map((c) => c.id)).toEqual([...CONNECT_CLIENT_IDS]);
    expect([...CONNECT_CLIENT_IDS]).toEqual(["claudeAi", "claudeDesktop", "claudeCode", "chatgpt", "copilot", "cursor", "geminiCli", "windsurf", "codex", "leChat", "generic", "stdio"]);
    // anchors: one per client, unique, in the page's id shape
    const anchors = CONNECT_CLIENT_IDS.map(clientAnchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const a of anchors) expect(a).toMatch(/^client-[a-z]+(-[a-z]+)*$/u);
    expect(clientAnchor("leChat")).toBe("client-le-chat");
    const en = connectClients("en");
    const code = (id: string): string | undefined => en.find((c) => c.id === id)?.code;
    expect(code("claudeCode")).toBe(`claude mcp add --transport http viafrei ${MCP_ENDPOINT}`);
    expect(code("geminiCli")).toBe(`gemini mcp add --scope user --transport http viafrei ${MCP_ENDPOINT}`);
    expect(code("codex")).toBe(`codex mcp add viafrei --url ${MCP_ENDPOINT}`);
    expect(JSON.parse(code("copilot")!)).toEqual({ mcpServers: { viafrei: { type: "http", url: MCP_ENDPOINT } } });
    expect(JSON.parse(code("cursor")!)).toEqual({ mcpServers: { viafrei: { url: MCP_ENDPOINT } } });
    expect(JSON.parse(code("windsurf")!)).toEqual({ mcpServers: { viafrei: { serverUrl: MCP_ENDPOINT } } });
    expect(code("stdio")).toBe("npx -y viafrei");
    expect(code("chatgpt")).toBeUndefined();
    expect(code("leChat")).toBeUndefined();
    // Copilot's block names the sandbox's 403 and the host to allow, in every language
    for (const lang of LIVE_LANGS) {
      const after = connectClients(lang).find((c) => c.id === "copilot")?.after ?? "";
      expect(after, lang).toContain("x-ms-block-by: sandbox-broker");
      expect(after, lang).toContain("403");
      expect(after, lang).toContain("mcp.viafrei.de");
      expect(connectClients(lang).filter((c) => c.after !== undefined).map((c) => c.id)).toEqual(["copilot", "geminiCli"]);
      // #1090: Copilot's guided flow — Global → Copilot Global, and the file it writes (the snippet is that file's format)
      const copilot = connectClients(lang).find((c) => c.id === "copilot")!.steps;
      for (const w of ["MCP: Add Server", "HTTP", "Global", "Copilot Global", "~/.copilot/mcp-config.json", "viafrei"]) expect(copilot, `${lang} ${w}`).toContain(w);
      expect(copilot, lang).not.toMatch(/(^|[^-])mcp\.json/u);
      // names only: every name is plain text, never an image
      for (const c of connectClients(lang)) expect(c.name.length, `${lang} ${c.id}`).toBeGreaterThan(0);
    }
    const page = read("layouts/ConnectPage.astro");
    expect(page).toContain("const clients = connectClients(lang);");
    expect(page).toContain("id={c.anchor}");
    // never a second copy of the steps: the page names no step key itself
    expect(page).not.toMatch(/connectPage\.\w+Steps/u);
  });

  it("the digest's motorway block says the shell's words, in every language", () => {
    for (const lang of LIVE_LANGS) {
      expect(MOTORWAY_EXTRAS_COPY[lang].ask.requires, lang).toBe(t(lang, "connectNote.text"));
      expect(MOTORWAY_EXTRAS_COPY[lang].ask.requiresLink, lang).toBe(t(lang, "connectNote.link"));
    }
  });
});

describe("no renderer of an example answer can leave the note out (#1001)", () => {
  it("each answer renderer calls the one block, with a surface its callers must pass", () => {
    for (const f of ["components/Answer.astro", "components/LiveCard.astro"]) {
      const src = read(f);
      expect(src, f).toContain("<Fragment set:html={connectNoteHtml(lang, source)} />");
      expect(src, f).toMatch(/^\s+source: ConnectSource;$/mu);
    }
    expect(read("lib/answer-html.ts")).toMatch(/`<\/div>` \+\n\s+connectNoteHtml\(lang, source\)/u);
    expect(read("components/LiveAsk.astro")).toContain("answerHtml(lang, entry, now, source)");
    expect(read("lib/place-asks.ts")).toContain('answerHtml(lang, e, now, "place")');
    expect(read("components/Sign.astro").match(/connectNoteHtml\(lang, "home"\)/gu)).toHaveLength(2);
  });
});
