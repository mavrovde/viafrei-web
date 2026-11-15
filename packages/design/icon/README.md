# ViaFrei icon

The ViaFrei mark: a dashed lane line on a blue (`#0a4a93`) rounded square with a white inner border.
`viafrei-icon.svg` is byte-identical to `packages/web/public/favicon.svg`, served at <https://viafrei.de/favicon.svg>.

| file | size | use |
|---|---|---|
| `viafrei-icon.svg` | vector | the source; any directory that takes an SVG or an icon URL |
| `viafrei-icon-4096.png` … `-512.png` | 4096 / 2048 / 1024 / 512 px | the owner's export (2026-10-16), for stores that ask for large artwork |
| `viafrei-icon-400.png` | 400 × 400 | the Cline MCP Marketplace (asks for exactly 400×400 PNG) and other directory forms |
| `viafrei-icon-256.png` | 256 × 256 | directory forms with a small-icon slot |
| `viafrei-icon-64.png` | 64 × 64 | catalogue entries that take a favicon-size image |

The 400, 256 and 64 px files are resized from the 1024 px export with `sips -z`.
The MCP-directory issues (#718–#735) refer to these files.

## The motorway pages' panel icons (#987)

The sixteen kind icons and the four freshness shapes of the motorway pages live as SVG `<symbol>` drawings in
`packages/digest/src/presentation/motorway-icons.ts` (`ICON_SYMBOLS`), one inline sprite per page. **Licence: our own
work**, drawn for ViaFrei on a 16-unit grid in plain strokes; no third-party icon set and no official StVO sign
artwork is copied. Where a shape recalls a road sign (the no-entry disc of Zeichen 267, the worker of Zeichen 123, the
"P"), it is the sign's plain geometric idea, which carries no copyright, redrawn in outline. Nothing to attribute.
They use `currentColor`, are `aria-hidden` beside a visible title, and their colours are gated as `icon` pairs (3:1)
by `scripts/web-contrast.mjs`.
