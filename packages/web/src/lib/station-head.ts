/**
 * #1041: the station's name, read off the digest's page fragment, for the
 * page's `<h1>`, title and description — and the fragment without the line
 * that carried it, so the name is not said twice at the top of the page.
 * The fragment escaped the name; it is unescaped here and Astro escapes it
 * again where it is printed.
 */
import { jumpItem, raw } from "@viafrei/design";

const NAME = /<p class="stpage__name" translate="no">([^<]{1,200})<\/p>/;

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

export function stationHeadOf(fragment: string): { readonly name: string | null; readonly html: string } {
  const m = NAME.exec(fragment);
  if (m === null) return { name: null, html: fragment };
  const name = m[1]!.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e] ?? e).trim();
  return { name: name === "" ? null : name, html: fragment.replace(m[0], "") };
}

/**
 * #1175: the block's link to the parking card, which stands in the place cards' fragment and not in the block's: only
 * when that fragment holds one, under its own title.
 */
export function withParkingJump(first: string | null, area: string | null): string | null {
  if (first === null || area === null) return first;
  const title = /id="pcard-parking-t"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?\s*([^<]+)</u.exec(area)?.[1]?.trim();
  if (title === undefined || title === "") return first;
  return first.replace("</ul></nav>", `${jumpItem({ target: "pcard-parking", label: raw(title), count: null })}</ul></nav>`);
}
