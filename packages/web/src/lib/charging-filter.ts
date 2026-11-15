/**
 * #1081: the charging filter's address keys (`ev_op`, `ev_kw`, `ev_plug`, `ev_free`, and since phase 2 `ev_term`) as the
 * shell passes them on. The
 * digest owns the rule — which values mean anything, and what a filter keeps (`chargingFilterOf` in @viafrei/ingest,
 * which this package may not import, `check_web_boundary.sh`) — so the shell only forwards what LOOKS like a choice,
 * each value by its shape, and drops everything else. A value the digest does not know is then dropped there (D3): a
 * bad address is the unfiltered card with a 200.
 *
 * Any `ev_*` key makes the page a person's view: `noindex` (with `noarchive`), its canonical the unfiltered page (D2).
 */
import { INLINE_SCRIPTS } from "./inline-scripts.js";

/** The five keys, in the order they are forwarded (`ev_term`: the terms of use, #1081 phase 2). */
export const CHARGING_FILTER_KEYS = ["ev_op", "ev_kw", "ev_plug", "ev_free", "ev_term"] as const;

/**
 * One `key=value` pair of the address the browser scripts carry on (card-refresh's every refresh, the place island's
 * every ask), as a regular-expression source built from THE key list — so a key added above is carried by both. The
 * island is shipped as a function's text and cannot import it; `test/charging-filter-1081.test.ts` holds its literal
 * equal to this one.
 */
export const CHARGING_FILTER_PAIR_SOURCE = `^ev_(?:${CHARGING_FILTER_KEYS.map((k) => k.slice(3)).join("|")})=[A-Za-z0-9%,._-]{1,200}$`;

/** One forwarded value: an operator key, a band, a plug, a term, `1` — or a comma list of them (the script's form). */
const VALUE = /^[a-z0-9äöüß,-]{1,200}$/u;
/** At most this many values per key (the digest reads 16 at most). */
const MAX_VALUES = 16;

/** The filter keys of an address, as a query without `?` or a leading `&`; "" when there is none. */
export function chargingFilterForward(params: URLSearchParams): string {
  const out: string[] = [];
  for (const k of CHARGING_FILTER_KEYS) {
    const vals = params
      .getAll(k)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => VALUE.test(v))
      .slice(0, MAX_VALUES);
    for (const v of vals) out.push(`${k}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}

/** Whether the address carries any `ev_*` key — a filtered view, `noindex` like a topic choice (#1081 D2). */
export function hasChargingFilter(params: URLSearchParams): boolean {
  return CHARGING_FILTER_KEYS.some((k) => params.has(k));
}

/** `&` + the forwarded keys, or "" — for appending to a digest address that already has a query. */
export function chargingFilterTail(params: URLSearchParams): string {
  const q = chargingFilterForward(params);
  return q === "" ? "" : `&${q}`;
}

/**
 * The filter to forward for a page with a topic choice (#1050, #1081 D8): `?topics=charging&ev_kw=hpc` filters the
 * charging card; a choice without the charging card (`?topics=fuel&ev_kw=hpc`) forwards nothing — the keys are ignored.
 */
export function chargingFilterForTopics(params: URLSearchParams, topics: readonly string[] | null): string {
  if (topics !== null && !topics.includes("charging")) return "";
  return chargingFilterForward(params);
}

/** How the digest's charging filter form begins (`chargingFilterBarHtml` in `cards/charging/filter-html.ts`). */
export const CHARGING_FILTER_FORM_MARK = '<form class="tpf evf"';

/** Whether a fragment carries the charging filter form: the page's CSP then says `form-action 'self'` (#716's rule). */
export function carriesChargingFilterForm(html: string): boolean {
  return html.includes(CHARGING_FILTER_FORM_MARK);
}

/**
 * The page's OTHER choices a no-script submit of the charging filter must keep (#1081 review 5): a GET form replaces
 * the whole query, so the topic choice (#1050), a station board's platform/destination/mode/step-free view, and a
 * motorway page's radius, layers, type filter and search ride along as hidden inputs. Every `ev_*` key is the form's
 * own and is never carried; any key not named here is dropped.
 */
export const CHARGING_FORM_KEEPS = ["topics", "f", "layer", "show", "find", "r", "from", "to", "dir", "platform", "mode", "access"] as const;

const escapeAttr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Every charging filter form of `html` with the page's other choices (`CHARGING_FORM_KEEPS`) as hidden inputs, escaped. */
export function keepChoicesInChargingForm(html: string, params: URLSearchParams): string {
  if (!carriesChargingFilterForm(html)) return html;
  const keep: string[] = [];
  for (const k of CHARGING_FORM_KEEPS) {
    for (const v of params.getAll(k).slice(0, 8)) {
      if (v.length <= 200) keep.push(`<input type="hidden" name="${k}" value="${escapeAttr(v)}">`);
    }
  }
  if (keep.length === 0) return html;
  return html.replace(/<form class="tpf evf"[^>]*>/g, (open) => `${open}${keep.join("")}`);
}

/**
 * 2.4.4 review B2: the charging filter has no Apply button with scripts on (the digest puts it in `<noscript>`), so a
 * change must send the form — on EVERY page the form can render, not only inside a card that refreshes in place. ONE
 * rule, carried by two scripts and never by both on one page: the refresh script (`REFRESH_JS`) applies it to a form
 * it does not re-fetch in place, and on a page without the refresh script the stand-alone `evf` script
 * ({@link chargingSubmitScript}, decided by {@link needsChargingSubmit}) applies it to every form. A box the page has
 * disabled sends nothing; `requestSubmit` keeps the form's own submit event (and its hidden inputs), `submit` is the
 * fallback of an older browser.
 */
export const EVF_SUBMIT_JS = `// 2.4.4 review B2: the charging filter (form.evf) sends itself on change — its Apply is in <noscript>.
function evSubmit(e) {
  var t = e.target, f = t && t.closest ? t.closest("form.evf") : null;
  if (!f || t.disabled) return;
  if (typeof f.requestSubmit === "function") f.requestSubmit(); else f.submit();
}`;

/** The stand-alone script's source: the rule on every `form.evf` of the page (one delegated listener, so a swapped-in card is covered). */
export const EVF_JS = `${EVF_SUBMIT_JS}
document.addEventListener("change", evSubmit);`;

/** The stand-alone script, under the page's nonce. */
export function chargingSubmitScript(): string {
  return `(${INLINE_SCRIPTS.evf})();`;
}

/**
 * Whether a page carries the stand-alone `evf` script (2.4.4 review B2): never beside the refresh script (which
 * carries the same rule), and otherwise when the fragment it renders holds the charging filter or when cards may be
 * swapped in after the first render (the location island on the home, a place page and a motorway page's around block).
 */
export function needsChargingSubmit(o: { readonly refresh: boolean; readonly html: string; readonly swaps: boolean }): boolean {
  return !o.refresh && (o.swaps || carriesChargingFilterForm(o.html));
}
