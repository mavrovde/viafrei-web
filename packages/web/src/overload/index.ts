/**
 * #1184 phase 2: the overload challenge's one set of process-wide parts — the pressure reading, the pass book (since
 * #1205 keyed by `WEB_PASS_KEY`, the same in every replica), the crawler verdicts and the per-client trip (#1205) — made on the first request that
 * needs them.
 */
import { readEnv } from "../lib/env.js";
import { clientIp } from "../location/client-ip.js";
import type { OverloadDeps } from "./challenge.js";
import { createCrawlerVerifier } from "./crawler-verify.js";
import { createPassBook, passKeyFrom } from "./pass.js";
import { createPressure } from "./pressure.js";
import { createClientTrip } from "./trip.js";

let deps: OverloadDeps | undefined;

/** The pass book's key: the replicas' shared one when the host set it (#1205). */
function passBookDeps(): { key?: Buffer } {
  const key = passKeyFrom(process.env);
  return key === undefined ? {} : { key };
}

export function overloadDeps(): OverloadDeps {
  deps ??= { pressure: createPressure({ baseUrl: readEnv().digestUrl }), passes: createPassBook(passBookDeps()), crawlers: createCrawlerVerifier(), clientIp, trip: createClientTrip() };
  return deps;
}
