import type { APIRoute } from "astro";

/**
 * `/healthz` — internal (#375 A4: no nginx location), the one address a
 * deploy probes. The only machine-shaped response this process gives, and it
 * says nothing but that the process answers: no version, no sha, no figure.
 */
export const GET: APIRoute = () =>
  new Response('{"status":"ok"}', { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
