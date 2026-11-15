/**
 * The country flags of the language menu (#989): our own simplified drawings of
 * the national flags (public-domain specifications), each on one 24 × 18 grid —
 * 4:3, shown about 15 px tall — and kept to what reads at that size: bands,
 * crosses and the one emblem that tells two otherwise equal tricolours apart
 * (Croatia's chequered shield from the Netherlands, Slovakia's double cross
 * from Russia). The Spanish and Portuguese arms are reduced to a disc or left
 * out, the US stars to the blue canton.
 *
 * WHICH language shows which flag is the locale registry's (`locales.ts`
 * `flag`), and only the registry's: this file knows countries, never
 * languages. The flags are one sprite — a `<symbol>` per country, drawn once
 * per page by the language list, every flag a `<use>` of it — inline SVG, so
 * there is no request, no image source in the CSP and no emoji (Windows renders
 * a flag emoji as the two letters "DE"). The colours are the flags' own and do
 * not follow the theme: a flag looks the same on a light and a dark page.
 */

/** ISO 3166-1 alpha-2 codes, lower-case, of every flag the sprite draws. */
export const FLAG_CODES = ["de", "gb", "us", "ru", "bg", "ua", "ro", "tr", "fr", "es", "nl", "pl", "it", "lt", "cz", "hu", "sk", "dk", "pt", "hr", "rs", "gr", "lv"] as const;
export type FlagCode = (typeof FLAG_CODES)[number];

/** The flags' grid: every symbol has this viewBox, every `<svg>` that uses one the matching 4:3 size. */
export const FLAG_VIEWBOX = "0 0 24 18";
export const FLAG_WIDTH = 20;
export const FLAG_HEIGHT = 15;

/** Three horizontal bands, top to bottom, each a third of the height unless `mid` says otherwise. */
const h3 = (a: string, b: string, c: string, top = 6, mid = 6): string =>
  `<path fill="${a}" d="M0 0h24v${String(top)}H0z"/><path fill="${b}" d="M0 ${String(top)}h24v${String(mid)}H0z"/><path fill="${c}" d="M0 ${String(top + mid)}h24v${String(18 - top - mid)}H0z"/>`;
/** Three vertical bands, hoist to fly. */
const v3 = (a: string, b: string, c: string): string => `<path fill="${a}" d="M0 0h8v18H0z"/><path fill="${b}" d="M8 0h8v18H8z"/><path fill="${c}" d="M16 0h8v18h-8z"/>`;

/** The drawing of each flag: the inside of its `<symbol>`. */
export const FLAG_ART: Readonly<Record<FlagCode, string>> = {
  de: h3("#000", "#d00", "#ffce00"),
  gb:
    `<path fill="#012169" d="M0 0h24v18H0z"/>` +
    `<path stroke="#fff" stroke-width="3.6" d="M0 0l24 18M24 0L0 18"/>` +
    `<path stroke="#c8102e" stroke-width="1.2" d="M0 0l24 18M24 0L0 18"/>` +
    `<path stroke="#fff" stroke-width="6" d="M12 0v18M0 9h24"/>` +
    `<path stroke="#c8102e" stroke-width="3.6" d="M12 0v18M0 9h24"/>`,
  us:
    `<path fill="#fff" d="M0 0h24v18H0z"/>` +
    `<path stroke="#b22234" stroke-width="1.385" d="M0 .69h24M0 3.46h24M0 6.23h24M0 9h24M0 11.77h24M0 14.54h24M0 17.31h24"/>` +
    `<path fill="#3c3b6e" d="M0 0h9.6v9.69H0z"/>`,
  ru: h3("#fff", "#0039a6", "#d52b1e"),
  bg: h3("#fff", "#00966e", "#d62612"),
  ua: `<path fill="#0057b7" d="M0 0h24v9H0z"/><path fill="#ffd700" d="M0 9h24v9H0z"/>`,
  ro: v3("#002b7f", "#fcd116", "#ce1126"),
  tr:
    `<path fill="#e30a17" d="M0 0h24v18H0z"/>` +
    `<circle fill="#fff" cx="8.6" cy="9" r="4.5"/><circle fill="#e30a17" cx="9.75" cy="9" r="3.6"/>` +
    `<path fill="#fff" d="M11.5 9l1.41-.5.04-1.5.91 1.19 1.44-.42-.85 1.23.85 1.23-1.44-.42-.91 1.19-.04-1.5z"/>`,
  fr: v3("#002654", "#fff", "#ce1126"),
  es: h3("#aa151b", "#f1bf00", "#aa151b", 4.5, 9),
  nl: h3("#ae1c28", "#fff", "#21468b"),
  pl: `<path fill="#fff" d="M0 0h24v9H0z"/><path fill="#dc143c" d="M0 9h24v9H0z"/>`,
  it: v3("#009246", "#fff", "#ce2b37"),
  lt: h3("#fdb913", "#006a44", "#c1272d"),
  cz: `<path fill="#fff" d="M0 0h24v9H0z"/><path fill="#d7141a" d="M0 9h24v9H0z"/><path fill="#11457e" d="M0 0l12 9-12 9z"/>`,
  hu: h3("#cd2a3e", "#fff", "#436f4d"),
  sk:
    h3("#fff", "#0b4ea2", "#ee1c25") +
    `<path fill="#ee1c25" stroke="#fff" stroke-width=".6" d="M5 4h7v6.5c0 2.5-1.8 3.6-3.5 4.3C6.8 14.1 5 13 5 10.5z"/>` +
    `<path stroke="#fff" stroke-width=".9" d="M8.5 5.5v6.5M6.8 7.4h3.4M6.3 9.4h4.4"/>` +
    `<path fill="#0b4ea2" d="M5.5 11.6c.8-.9 1.9-.9 3-.2 1.1-.7 2.2-.7 3 .2-.5 1.4-1.7 2.1-3 2.7-1.3-.6-2.5-1.3-3-2.7z"/>`,
  dk: `<path fill="#c8102e" d="M0 0h24v18H0z"/><path stroke="#fff" stroke-width="2.6" d="M0 9h24M9.1 0v18"/>`,
  pt:
    `<path fill="#046a38" d="M0 0h9.6v18H0z"/><path fill="#da291c" d="M9.6 0H24v18H9.6z"/>` +
    `<circle fill="#ffe900" cx="9.6" cy="9" r="3.6"/>` +
    `<path fill="#fff" stroke="#da291c" stroke-width=".7" d="M8.1 7h3v2.6c0 1.2-.7 1.8-1.5 2.1-.8-.3-1.5-.9-1.5-2.1z"/>`,
  hr:
    h3("#f00", "#fff", "#171796") +
    `<path fill="#fff" stroke="#f00" stroke-width=".4" d="M9.6 4.8h4.8v6.4c0 1.4-1.2 2.1-2.4 2.5-1.2-.4-2.4-1.1-2.4-2.5z"/>` +
    `<path fill="#f00" d="M9.6 4.8h1.6v1.6H9.6zm3.2 0h1.6v1.6h-1.6zm-1.6 1.6h1.6V8h-1.6zM9.6 8h1.6v1.6H9.6zm3.2 0h1.6v1.6h-1.6zm-1.6 1.6h1.6v1.6h-1.6z"/>`,
  rs:
    h3("#c6363c", "#0c4076", "#fff") +
    `<path fill="#c6363c" stroke="#fff" stroke-width=".5" d="M5.5 5h4.4v4.6c0 1.6-1.1 2.5-2.2 3-1.1-.5-2.2-1.4-2.2-3z"/>` +
    `<path stroke="#fff" stroke-width=".8" d="M7.7 5.6v6.4M5.9 8.4h3.6"/>`,
  gr:
    `<path fill="#0d5eaf" d="M0 0h24v18H0z"/>` +
    `<path stroke="#fff" stroke-width="2" d="M10 3h14M10 7h14M0 11h24M0 15h24"/>` +
    `<path stroke="#fff" stroke-width="2" d="M5 0v10M0 5h10"/>`,
  lv: h3("#9e3039", "#fff", "#9e3039", 7.2, 3.6),
};

/** The id of a flag's `<symbol>`; every `<use>` points at `#` + this. */
export const flagSymbolId = (code: FlagCode): string => `flag-${code}`;

/**
 * The sprite: one hidden `<svg>` holding a `<symbol>` per flag, in `FLAG_CODES`
 * order. It is out of the layout (`.flag-sprite`, absolutely positioned at
 * zero size — never `display: none`, under which some engines will not paint
 * a `<use>` of it) and hidden from assistive technology.
 */
export function flagSprite(codes: readonly FlagCode[] = FLAG_CODES): string {
  const symbols = codes.map((c) => `<symbol id="${flagSymbolId(c)}" viewBox="${FLAG_VIEWBOX}">${FLAG_ART[c]}</symbol>`).join("");
  return `<svg class="flag-sprite" aria-hidden="true" focusable="false">${symbols}</svg>`;
}
