/**
 * A place's cards with ViaFrei's live answers under their questions (#745,
 * owner 2026-10-15: "Can you call mcp based on location?").
 *
 * Every place card already asks its question ("Fragen Sie Ihren
 * KI-Assistenten: …", the digest's `pcard__ask` line). For the cards whose
 * question one of the MCP process's per-Gemeinde asks answers, the shell puts
 * that answer directly under the question: warnings, roads, the pharmacy (#1117: the health card), charging and
 * the city parking card (a car park, `kind: car_park`, since #799 split off the
 * lorry card, which keeps its question alone). Fuel is never asked (only a person's own request may ask
 * Tankerkönig), and the stations, lifts and motorway cards keep their question
 * alone: no local ask answers what they ask.
 *
 * Only for a person (the fuel refresh's rule: no crawler, no prefetch, no HEAD)
 * and only for a Gemeinde key: the MCP side asks at the Gemeinde's centroid,
 * never at a visitor's own position. Under a short deadline, because a place
 * nobody asked about in the last 15 minutes takes the MCP process a few
 * seconds; it keeps asking after the shell stops waiting, so the next view of
 * that place has its answers. A missing answer is no answer: the card is
 * exactly the digest's.
 */
import type { Lang } from "../site/pages.js";
import { answerHtml } from "./answer-html.js";
import { parseAsk, type AskEntry, type AskKey } from "./ask.js";
import type { FetchLike } from "./tiles.js";

/** Which local answer answers which card's question. */
export const PLACE_CARD_ASK: Readonly<Record<string, AskKey>> = { warnings: "weather", roads: "roadsNear", health: "poi", charging: "chargingNear", parking: "parking" };

/** How long a first render waits for a place's answers, ms; the background fill waits longer. */
export const PLACE_ASKS_SSR_MS = 400;
export const PLACE_ASKS_FILL_MS = 2_500;

export const LOCAL_ASKS_PATH = "/internal/examples/local";

/** The answers for one Gemeinde (`ags:` + 8 digits), keyed; anything else, an error or a slow answer is the empty map. */
export async function fetchLocalAsks(at: string, o: { readonly baseUrl: string | undefined; readonly timeoutMs: number; readonly fetchImpl?: FetchLike }): Promise<ReadonlyMap<AskKey, AskEntry>> {
  const empty = new Map<AskKey, AskEntry>();
  if (o.baseUrl === undefined || !/^ags:\d{8}$/u.test(at)) return empty;
  const f: FetchLike = o.fetchImpl ?? ((url, init) => fetch(url, init));
  try {
    const r = await f(`${o.baseUrl}${LOCAL_ASKS_PATH}?at=${at}`, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "application/json" } });
    if (r.status !== 200) return empty;
    const body = JSON.parse(await r.text()) as unknown;
    const list = typeof body === "object" && body !== null ? (body as { answers?: unknown }).answers : undefined;
    if (!Array.isArray(list)) return empty;
    for (const x of list) {
      const e = parseAsk(x);
      if (e !== null && !empty.has(e.key)) empty.set(e.key, e);
    }
    return empty;
  } catch {
    return empty;
  }
}

/**
 * The cards' HTML with each answer placed right after its card's question line. A card without a question line (an
 * error card asks nothing), without an answer, or whose answer cannot be said in this language is left as it was.
 */
export function spliceAnswers(html: string, lang: Lang, asks: ReadonlyMap<AskKey, AskEntry>, now: Date = new Date()): string {
  if (asks.size === 0) return html;
  let out = html;
  for (const [card, key] of Object.entries(PLACE_CARD_ASK)) {
    const e = asks.get(key);
    if (e === undefined) continue;
    const block = answerHtml(lang, e, now, "place");
    if (block === null) continue;
    const start = out.indexOf(`id="pcard-${card}"`);
    if (start < 0) continue;
    const end = out.indexOf("</article>", start);
    const ask = out.indexOf('<p class="pcard__ask">', start);
    if (ask < 0 || end < 0 || ask > end) continue;
    const close = out.indexOf("</p>", ask);
    if (close < 0 || close > end) continue;
    const at = close + "</p>".length;
    out = out.slice(0, at) + block + out.slice(at);
  }
  return out;
}
