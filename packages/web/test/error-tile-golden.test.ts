/**
 * #922 A2: the digest is down and the home shows the shell's own error tile —
 * byte for byte the markup it showed before the tile frame moved into
 * `@viafrei/design`, for every embedded tile id in every live language. The
 * loading placeholder (#564) is pinned beside it, because it is the same frame
 * with the fill hooks on. The golden was recorded before the move.
 */
import { describe, expect, it } from "vitest";
import { errorTile, EMBEDDED_TILES } from "../src/lib/tiles.js";
import { tilePlaceholder } from "../src/lib/fill.js";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";

describe("#922 A2: the shell's error and loading tiles are unchanged", () => {
  it("for every embedded tile id in every live language", async () => {
    const lines: string[] = [];
    for (const lang of LIVE_LANGS)
      for (const id of EMBEDDED_TILES) {
        lines.push(`error\t${lang}\t${id}\t${errorTile(id, lang)}`);
        lines.push(`loading\t${lang}\t${id}\t${tilePlaceholder(id, t(lang, `tiles.${id}`), lang, `/fragment/tile/${id}?lang=${lang}`)}`);
      }
    expect(lines.length).toBe(LIVE_LANGS.length * EMBEDDED_TILES.length * 2);
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("./__golden__/error-tiles.tsv");
  });
});
