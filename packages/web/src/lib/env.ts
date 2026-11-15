import { clarityConfigOf } from "../analytics/clarity.js";
import { stagingOf } from "./staging.js";

/**
 * What this process is told, and nothing else (#375 A2): where the digest is,
 * how long a tile may take, and the one analytics tag. No database URL, no
 * provider key — `scripts/check_web_boundary.sh` asserts the compose service
 * carries none, and this file has no key for one, so a value the process is
 * never handed is a value no template can print.
 */
export type WebEnv = {
  /** The digest's base URL on the compose network (`http://digest:8791`); loopback for a laptop. */
  readonly digestUrl: string;
  /**
   * #936 D: the fragment cache in front of the digest (`DIGEST_FRAGMENT_URL`,
   * `http://fragcache:8793`), for the place cards and the motorway pages
   * (`lib/fragment-cache.ts`). Undefined — the default, and when it names the
   * digest itself — means every fragment is asked of `digestUrl`, as before.
   */
  readonly fragmentUrl?: string | undefined;
  /** The per-tile fetch deadline. 2 000 ms (#378), and at most that (#1166): a slow tile is an error tile, never a slow page. */
  readonly tileTimeoutMs: number;
  /**
   * The longest a page-sized digest read may take (#709, #1166): a place
   * page's slug key and name index, the energy and motorway pages, the
   * motorway fragments, the island's place fragment and the legacy redirects.
   * 2 000 ms by default and at most (owner 2026-10-26: no visitor waits above
   * two seconds). It was 8 000 ms, and a saturated digest made a place page a
   * 503 after eight seconds; a place page now renders its cards as loading
   * when they are late (`lib/place-page.ts`), and the pages that cannot
   * (a fuel, charging or motorway page IS its fragment) answer a 503 with
   * Retry-After inside this deadline.
   */
  readonly placeTimeoutMs: number;
  readonly googleTag: string | undefined;
  /**
   * #717: the Microsoft Clarity project id the consent island starts after
   * accept — `CLARITY_PROJECT_ID`, unless `CLARITY_ENABLED` switches it off.
   * Absent: off. A malformed value is refused (`clarityConfigOf`).
   */
  readonly clarityProjectId?: string | undefined;
  /**
   * The IP rung's local file (#564 § 8): the VFGEO1 extract of DB-IP Lite on a
   * read-only mount, or undefined — the rung is then skipped and the home is
   * Germany-wide, never broken.
   */
  readonly geoipFile: string | undefined;
  /**
   * The MCP process's INTERNAL listener (`http://mcp:8788`, #564): where the
   * fuel card's on-demand refresh is asked. Not a provider and not a key — the
   * key and the guards live in that process. Undefined: no refresh, the card
   * answers from held prices (a laptop).
   */
  readonly fuelRefreshUrl?: string | undefined;
  /**
   * The MCP process's INTERNAL listener again (#743/#744), for a different
   * job: the site's live assistant answers (`/internal/examples`). Its own
   * variable, because it has nothing to do with fuel — the two only share the
   * port. Undefined: every card shows its question without a live answer.
   */
  readonly mcpInternalUrl?: string | undefined;
};

export const DEFAULT_TILE_TIMEOUT_MS = 2_000;
/** #1166: the two-second ceiling for a tile too — the most `WEB_TILE_TIMEOUT_MS` may say, refused at startup above it. */
export const MAX_TILE_TIMEOUT_MS = 2_000;
/** #1166: the two-second ceiling — the default and the most `WEB_PLACE_TIMEOUT_MS` may say. */
export const DEFAULT_PLACE_TIMEOUT_MS = 2_000;
export const MAX_PLACE_TIMEOUT_MS = 2_000;

export function readEnv(env: Readonly<Record<string, string | undefined>> = process.env): WebEnv {
  const digestUrl = (env["DIGEST_URL"] ?? "").trim() || "http://127.0.0.1:8791";
  if (!/^https?:\/\/[^/\s]+$/.test(digestUrl)) throw new Error(`DIGEST_URL must be an origin like http://digest:8791, got '${digestUrl}'`);
  const frag = (env["DIGEST_FRAGMENT_URL"] ?? "").trim();
  if (frag !== "" && !/^https?:\/\/[^/\s]+$/.test(frag)) throw new Error(`DIGEST_FRAGMENT_URL must be an origin like http://fragcache:8793, got '${frag}'`);
  const raw = (env["WEB_TILE_TIMEOUT_MS"] ?? "").trim();
  const tileTimeoutMs = raw === "" ? DEFAULT_TILE_TIMEOUT_MS : Number(raw);
  if (!Number.isInteger(tileTimeoutMs) || tileTimeoutMs < 100 || tileTimeoutMs > MAX_TILE_TIMEOUT_MS) {
    throw new Error(`WEB_TILE_TIMEOUT_MS must be an integer between 100 and ${String(MAX_TILE_TIMEOUT_MS)}, got '${raw}'`);
  }
  const rawPlace = (env["WEB_PLACE_TIMEOUT_MS"] ?? "").trim();
  const placeTimeoutMs = rawPlace === "" ? DEFAULT_PLACE_TIMEOUT_MS : Number(rawPlace);
  if (!Number.isInteger(placeTimeoutMs) || placeTimeoutMs < 100 || placeTimeoutMs > MAX_PLACE_TIMEOUT_MS) {
    // #1166: the two-second ceiling; nginx's proxy_read_timeout (the edge shell proxy rules) outlasts it by far.
    throw new Error(`WEB_PLACE_TIMEOUT_MS must be an integer between 100 and ${String(MAX_PLACE_TIMEOUT_MS)}, got '${rawPlace}'`);
  }
  // #1235: the staging site configures no analytics, whatever the host's .env holds (`lib/staging.ts`).
  const staging = stagingOf(env);
  const tag = staging ? "" : (env["GOOGLE_TAG"] ?? "").trim();
  const clarity = staging ? undefined : clarityConfigOf(env);
  const geo = (env["GEOIP_FILE"] ?? "").trim();
  if (geo !== "" && !geo.startsWith("/")) throw new Error(`GEOIP_FILE must be an absolute path, got '${geo}'`);
  const refresh = (env["FUEL_REFRESH_URL"] ?? "").trim();
  if (refresh !== "" && !/^https?:\/\/[^/\s]+$/.test(refresh)) throw new Error(`FUEL_REFRESH_URL must be an origin like http://mcp:8788, got '${refresh}'`);
  const mcp = (env["MCP_INTERNAL_URL"] ?? "").trim();
  if (mcp !== "" && !/^https?:\/\/[^/\s]+$/.test(mcp)) throw new Error(`MCP_INTERNAL_URL must be an origin like http://mcp:8788, got '${mcp}'`);
  return {
    digestUrl, tileTimeoutMs, placeTimeoutMs, googleTag: tag === "" ? undefined : tag, geoipFile: geo === "" ? undefined : geo,
    ...(frag === "" || frag === digestUrl ? {} : { fragmentUrl: frag }),
    ...(refresh === "" ? {} : { fuelRefreshUrl: refresh }),
    ...(mcp === "" ? {} : { mcpInternalUrl: mcp }),
    ...(clarity === undefined ? {} : { clarityProjectId: clarity }),
  };
}
