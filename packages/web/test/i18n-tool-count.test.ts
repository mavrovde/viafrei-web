/**
 * 2.5.8: the connect page said the MCP Inspector "gets 22 names" while the catalogue held 24. A count of tools is
 * never typed into a catalogue string: a string that needs one takes `{n}` from the generated catalogue
 * (`devPage.toolsLead`), and a caption of a dated picture names none. Every locale is swept for a number in a string
 * that says `tools/list`; the "number before tools" shape is read in English and German only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const I18N = join(import.meta.dirname, "..", "src", "i18n");
const LOCALES = readdirSync(I18N).filter((f) => f.endsWith(".json"));

function strings(v: unknown, path: string, out: [string, string][]): [string, string][] {
  if (typeof v === "string") out.push([path, v]);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) strings(x, path ? `${path}.${k}` : k, out);
  return out;
}

const COUNT_BEFORE_TOOLS = /\b\d+\s+(MCP[- ])?(tools|Werkzeuge|Tools)\b/;
function typesACount(file: string, s: string): boolean {
  return (s.includes("tools/list") && /\d/.test(s)) || ((file === "en.json" || file === "de.json") && COUNT_BEFORE_TOOLS.test(s));
}

describe("no catalogue string types a tool count", () => {
  it("reads every locale", () => {
    expect(LOCALES.length).toBeGreaterThanOrEqual(22);
  });

  it("a string about tools/list carries no number, and no English or German string puts a number before tools", () => {
    const bad: string[] = [];
    for (const f of LOCALES) {
      const all = strings(JSON.parse(readFileSync(join(I18N, f), "utf8")), "", []);
      for (const [k, s] of all) if (typesACount(f, s)) bad.push(`${f}: ${k}`);
    }
    expect(bad).toEqual([]);
  });

  it("can say no: the captions that shipped before 2.5.8 are refused", () => {
    expect(typesACount("en.json", "Terminal: the MCP Inspector asks ViaFrei's address for its tools (tools/list) and gets 22 names.")).toBe(true);
    expect(typesACount("ru.json", "Терминал: MCP Inspector запрашивает у адреса ViaFrei его инструменты (tools/list) и получает 22 названия.")).toBe(true);
    expect(typesACount("de.json", "Alle 24 Werkzeuge im Überblick")).toBe(true);
    expect(typesACount("en.json", "the MCP Inspector asks for its tools (tools/list) and gets their names.")).toBe(false);
  });
});
