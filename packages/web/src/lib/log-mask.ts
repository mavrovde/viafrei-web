/**
 * The log mask of #741 (data-steward ruling T3): what every warn and error
 * line of our services passes through BEFORE it is written, and what the
 * operator console passes the stored rows through again before it renders
 * them. The host collector (`the host error collector`) applies the same rules a
 * third time, in its own implementation, so a defect in one layer is caught by
 * the next — and `scripts/fixtures/log-collect/needles.tsv` is the one planted
 * corpus every layer is tested against.
 *
 * `redact()` (transport/http.ts) is the floor this replaces for log text: it
 * knows credential PARAMETERS by name, and a log line is not only a URL.
 *
 * THE ORDER IS THE RULING'S (T3), and every step runs before any truncation —
 * the IndexNow lesson: cut after masking, never before, or a value cut across
 * the bound survives as a fragment no mask recognises.
 *
 *   0. our own deploy paths are shortened (`/app/packages/x/dist/` → `x/`) so a
 *      stack frame stays shorter than the token rule below — information is
 *      only REMOVED here, never added, and every rule still runs after it;
 *   1. IPv6 in any form (full, `::`-compressed, IPv4-mapped, zoned, inside
 *      brackets) and then IPv4 → `<ip>`. A clock time (`16:36:00`) and a stack
 *      frame's `:123:45` are not addresses: a candidate is an address only when
 *      it carries `::` or seven colons;
 *   2. a UUID, any case → `<uuid>` (MCP session ids, Tankerkönig station ids);
 *   3. `Bearer …`, a `Cookie:`/`Set-Cookie:` value, URL userinfo, a run of 32
 *      or more token characters and a hex run of 24 or more → `<token>` — a
 *      run that is a PATH (`/internal/motorway/a1/exit-84-dortmund-unna`) is
 *      judged segment by segment instead (#1310 H, `maskTokenRun`), so the
 *      fragment behind a `fragment_timeout` is named while a token inside a
 *      segment is still masked;
 *   4. a query string → `?<q>`, a fragment → `#<f>`;
 *   5. a place key `pt:<n>,<n>` → `<place>`, a pair of decimals → `<coord>`, a
 *      decimal with two or more fractional digits → `<num>` (so no fuel price
 *      such as 1.799 survives);
 *   6. a DHID → `<stop>`, a run of five or more digits → `<n>`;
 *   7. every quoted substring — '…', "…", „…“, “…”, «…», »…«, ‘…’ and
 *      backticks — → `<q>`, no exceptions; an opening quote with no closing one
 *      masks to the end;
 *   8. an e-mail address → `<email>`.
 * Then: a message is cut to `MESSAGE_MAX_CHARS` characters and a stack to
 * `STACK_MAX_BYTES` bytes of UTF-8.
 */

/** T3: a stored message is at most this many characters. */
export const MESSAGE_MAX_CHARS = 300;
/** T3: a stored stack sample is at most this many bytes of UTF-8. */
export const STACK_MAX_BYTES = 2048;
/** T2: a key is at most this many characters. */
export const KEY_MAX_CHARS = 64;

const IPV6_CANDIDATE = /[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*(?:%[A-Za-z0-9_.-]+)?/g;
const IPV4 = /\d{1,3}(?:\.\d{1,3}){3}/g;
const UUID = /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/g;
const BEARER = /\b(Bearer)\s+\S+/gi;
const COOKIE = /\b(Set-Cookie|Cookie):[^\n]*/gi;
const USERINFO = /([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/\s@]+@/g;
const TOKEN_RUN = /[A-Za-z0-9_+/=.-]{32,}/g;
/** #1310 H: one segment of a path, as the token rule reads it. */
const PATH_SEGMENT = /[^/]+/g;
const HEX_RUN = /[0-9A-Fa-f]{24,}/g;
const QUERY = /([^\s?])\?[^\s"'`]+/g;
const FRAGMENT = /([^\s#])#[^\s"'`]+/g;
// A place key whole or cut: every `pt:` followed by a digit, exactly what the error table's CHECK refuses (2.1.18 review).
const PLACE_KEY = /pt:-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)?/g;
const COORD_PAIR = /-?\d+\.\d+(?:\s*,\s*|\s+)-?\d+\.\d+/g;
const DECIMAL = /-?\d+\.\d{2,}/g;
const DHID = /\bde:\d+:\d+(?::\d+)*/gi;
const DIGIT_RUN = /\d{5,}/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Opening quote → the closing quotes that end it. */
const QUOTES: ReadonlyMap<string, readonly string[]> = new Map([
  ["'", ["'"]],
  ['"', ['"']],
  ["`", ["`"]],
  ["„", ["“", "”"]],
  ["“", ["”", "“"]],
  ["‘", ["’"]],
  ["«", ["»"]],
  ["»", ["«"]],
]);

/**
 * Step 3's run rule (#1310 H): a run of 32 or more token characters is a `<token>` — unless it is a PATH. Before, a
 * whole fragment path (`/internal/station/<slug>/area`) was one run and went as one `<token>`, so 2 594 of ~2 850
 * `fragment_timeout` rows of 2026-11-14 named no fragment. A path is a run that STARTS with `/` (a pathname, never the
 * middle of a base64 value, which the maximal run would have joined) and carries no `+` or `=` (base64's marks). Each of
 * its segments is then judged alone: a segment of 32 or more characters, of 16 or more that mixes upper case, lower
 * case and digits, or of 16 or more that mixes letters and digits and carries no `-` (a random value split by a `/`,
 * lower case or not — `k3j9q2m8v7n4p1z6r5t0w8y2`; our slugs join their words with `-`, as `exit-84-dortmund-unna`, and
 * our routes and road numbers are letters only or short), is a `<token>`; every other segment is kept. Anything else is
 * masked whole, as before.
 */
function maskTokenRun(run: string): string {
  if (!run.startsWith("/") || /[+=]/.test(run)) return "<token>";
  return run.replace(PATH_SEGMENT, (seg) => (seg.length >= 32 || (seg.length >= 16 && /[A-Z]/.test(seg) && /[a-z]/.test(seg) && /\d/.test(seg)) || (seg.length >= 16 && /[A-Za-z]/.test(seg) && /\d/.test(seg) && !seg.includes("-")) ? "<token>" : seg));
}

/** Step 0: our own deploy paths, shortened; nothing else is touched. */
function shortenPaths(s: string): string {
  return s.replaceAll("file:///app/", "").replaceAll("/app/packages/", "").replaceAll("/app/node_modules/", "node_modules/").replaceAll("/dist/", "/");
}

/** Step 7: every quoted substring, scanned left to right; an unclosed quote masks to the end. */
function maskQuotes(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i] ?? "";
    const closers = QUOTES.get(ch);
    if (closers === undefined) {
      out += ch;
      i += 1;
      continue;
    }
    let end = -1;
    for (let j = i + 1; j < s.length; j += 1) {
      if (closers.includes(s[j] ?? "")) {
        end = j;
        break;
      }
    }
    out += "<q>";
    if (end === -1) return out;
    i = end + 1;
  }
  return out;
}

/** T3 steps 0–8, in order, with no truncation. */
export function maskLogText(input: string): string {
  let s = shortenPaths(input);
  // 1. addresses — IPv6 first, so an IPv4-mapped one goes whole.
  s = s.replace(IPV6_CANDIDATE, (m) => (m.includes("::") || (m.match(/:/g)?.length ?? 0) >= 7 ? "<ip>" : m));
  s = s.replace(IPV4, "<ip>");
  // 2.
  s = s.replace(UUID, "<uuid>");
  // 3.
  s = s.replace(BEARER, "$1 <token>").replace(COOKIE, "$1: <token>").replace(USERINFO, "$1<token>@").replace(TOKEN_RUN, maskTokenRun).replace(HEX_RUN, "<token>");
  // 4.
  s = s.replace(QUERY, "$1?<q>").replace(FRAGMENT, "$1#<f>");
  // 5.
  s = s.replace(PLACE_KEY, "<place>").replace(COORD_PAIR, "<coord>").replace(DECIMAL, "<num>");
  // 6.
  s = s.replace(DHID, "<stop>").replace(DIGIT_RUN, "<n>");
  // 7.
  s = maskQuotes(s);
  // 8.
  return s.replace(EMAIL, "<email>");
}

/** A message as it may be stored: masked, then cut to `MESSAGE_MAX_CHARS` characters. */
export function boundMessage(input: string): string {
  return [...maskLogText(input)].slice(0, MESSAGE_MAX_CHARS).join("");
}

/** A stack as it may be stored: masked, then cut to `STACK_MAX_BYTES` bytes without splitting a character. */
export function boundStack(input: string): string {
  const masked = maskLogText(input);
  if (Buffer.byteLength(masked, "utf8") <= STACK_MAX_BYTES) return masked;
  let out = "";
  let bytes = 0;
  for (const ch of masked) {
    const n = Buffer.byteLength(ch, "utf8");
    if (bytes + n > STACK_MAX_BYTES) break;
    out += ch;
    bytes += n;
  }
  return out;
}

/** The final shape of a stored key (T16, the migration's CHECK). */
export const KEY_SHAPE = /^[A-Za-z0-9/_.:<>-]{1,64}$/;

/**
 * A key as it may be stored (T2): our own route templates, tool names, RPC
 * methods, tile and cache ids, a motorway number. Masked FIRST (so an address,
 * an e-mail or a quoted value is recognised while it still has its shape —
 * dropping `@` or a quote first would leave its text unrecognisable), then
 * every character outside `[A-Za-z0-9/_.:<>-]` dropped, cut to 64, and masked
 * again — the ruling's order, with one more pass in front. A result that is
 * not of the stored shape is no key at all.
 */
export function boundKey(input: string): string | null {
  const kept = maskLogText(input).replace(/[^A-Za-z0-9/_.:<>-]/g, "").slice(0, KEY_MAX_CHARS);
  const masked = maskLogText(kept).slice(0, KEY_MAX_CHARS);
  return KEY_SHAPE.test(masked) ? masked : null;
}

/**
 * A name the CLIENT chose — an unknown JSON-RPC method or tool name (T2):
 * masked, then `[A-Za-z0-9/_.-]` only (so a mask's `<ip>` is left as the plain
 * word), at most 64 characters, then the masks again.
 */
export function clientKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const kept = maskLogText(input).replace(/[^A-Za-z0-9/_.-]/g, "").slice(0, KEY_MAX_CHARS);
  if (kept === "") return null;
  const masked = maskLogText(kept).slice(0, KEY_MAX_CHARS);
  return KEY_SHAPE.test(masked) ? masked : null;
}

/** A route template from a path with Astro or express parameters: `[slug]`/`:slug` → `:slug`, never a value. */
export function routeTemplate(pattern: string): string | null {
  return boundKey(pattern.replace(/\[\.{0,3}([A-Za-z0-9_]+)\]/g, ":$1"));
}

/** The SQLSTATE shape (PostgreSQL error classes): never an errno like `EPIPE`. */
const SQLSTATE = /^(?:[0-9][0-9A-Z]|P0|XX|F0|HV)[0-9A-Z]{3}$/;
/** An error's class or code as stored: `ECONNREFUSED`, `57014`, `TypeError` — a closed shape, never free text. */
const ERR_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

/** The `err` of a log line (T1): name, code, message and stack — masked and bounded, nothing else of the error. */
export type LoggedError = { readonly name?: string; readonly code?: string; readonly message: string; readonly stack?: string };

/** The T1 view of anything thrown or passed as `err`: an Error, a string, or an object with a message. */
export function serializeLogError(e: unknown): LoggedError {
  if (typeof e === "string") return { message: boundMessage(e) };
  if (typeof e !== "object" || e === null) return { message: boundMessage(String(e)) };
  const o = e as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown };
  const out: { name?: string; code?: string; message: string; stack?: string } = { message: boundMessage(typeof o.message === "string" ? o.message : "(no message)") };
  if (typeof o.name === "string" && ERR_CODE.test(o.name)) out.name = o.name;
  if ((typeof o.code === "string" || typeof o.code === "number") && ERR_CODE.test(String(o.code))) out.code = String(o.code);
  if (typeof o.stack === "string") out.stack = boundStack(o.stack);
  return out;
}

/** The five-character SQLSTATE of a database error, when `e` carries one. */
export function sqlstateOf(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" && SQLSTATE.test(code) ? code : undefined;
}
