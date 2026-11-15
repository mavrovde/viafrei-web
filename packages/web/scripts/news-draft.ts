/**
 * The News page's "New" drafts (#588): when an integration ships, its credits
 * id appears in `catalogue.credits` with no entry in `src/news/entries.ts`.
 * `test/news.test.ts` then fails and names the id; this script prints the
 * draft a person turns into approved wording — one skeleton per top-level
 * bullet of the release's `### Added` section, with its issue, its bold lead
 * as the title, its first sentence as the body and the flagged ids beside it.
 *
 *   npx tsx packages/web/scripts/news-draft.ts            (the newest released block)
 *   npx tsx packages/web/scripts/news-draft.ts 1.9.16     (a named one)
 *
 * It writes nothing: the draft is printed, and only a person puts an entry in
 * `entries.ts` (the issue's "a human approves the wording").
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { uncoveredCredits } from "../src/news/entries.js";

export type ReleaseBlock = { readonly version: string; readonly date: string; readonly body: string };
export type NewsDraft = { readonly issue: number; readonly title: string; readonly body: string; readonly release: string; readonly date: string };

/** A released `## [X.Y.Z] — YYYY-MM-DD` block of the CHANGELOG: the named one, or the newest. Null when none matches. */
export function releaseBlock(md: string, version?: string): ReleaseBlock | null {
  const re = /^## \[(\d+\.\d+\.\d+)\] — (\d{4}-\d{2}-\d{2})\s*$/gm;
  const heads = [...md.matchAll(re)];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]!;
    if (version !== undefined && h[1] !== version) continue;
    const end = i + 1 < heads.length ? heads[i + 1]!.index : md.length;
    return { version: h[1]!, date: h[2]!, body: md.slice(h.index + h[0].length, end) };
  }
  return null;
}

/** One draft per top-level `- **Lead (#N).** …` bullet under `### Added`. */
export function draftsFrom(block: ReleaseBlock): NewsDraft[] {
  const added = /^### Added\s*$([\s\S]*?)(?=^### |(?![\s\S]))/m.exec(block.body)?.[1] ?? "";
  const out: NewsDraft[] = [];
  for (const m of added.matchAll(/^- \*\*(.+?)\s*\(#(\d+)\)\.?\*\*\s*(.*)$/gm)) {
    const rest = (m[3] ?? "").trim();
    const first = /^(.*?[.!?])(\s|$)/.exec(rest)?.[1] ?? rest;
    out.push({ issue: Number(m[2]), title: (m[1] ?? "").replace(/\.$/, ""), body: first, release: block.version, date: block.date });
  }
  return out;
}

export function renderDrafts(drafts: readonly NewsDraft[], flagged: readonly string[]): string {
  const lines = [`// ${flagged.length} credits id(s) with no news entry: ${flagged.join(", ") || "none"}`, "// Drafts from the CHANGELOG — a person writes the wording (all seven languages) before it goes in entries.ts.", ""];
  for (const d of drafts) {
    lines.push(
      "{",
      `  id: "TODO-${d.issue}", kind: "new", date: "${d.date}", release: "${d.release}", issue: ${d.issue},`,
      `  credits: [/* from: ${flagged.join(", ")} */], tool: "TODO",`,
      `  text: { de: { title: ${JSON.stringify(d.title)}, body: ${JSON.stringify(d.body)}, ask: "TODO" } },`,
      "},",
    );
  }
  return lines.join("\n") + "\n";
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const md = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "CHANGELOG.md"), "utf8");
  const block = releaseBlock(md, process.argv[2]);
  if (block === null) {
    process.stderr.write(`news-draft: no released block${process.argv[2] === undefined ? "" : ` for ${process.argv[2]}`} in CHANGELOG.md\n`);
    process.exit(2);
  }
  process.stdout.write(renderDrafts(draftsFrom(block), uncoveredCredits(catalogue.credits.map((c) => c.id))));
}
