/**
 * Withdrawing or declining consent expires Google Analytics' cookies (launch
 * audit F-10). A cookie jar that behaves like `document.cookie` — reads list
 * the live cookies, a write with `max-age=0` and a MATCHING domain deletes one —
 * so the test proves the domain matching as well as the names.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cookieDomains, expireGaCookies, GA_COOKIE } from "../src/analytics/ga-cookies.js";

const WEB = new URL("../", import.meta.url).pathname;

/** name → the domain it was set with (null = host-only). */
function jar(cookies: Record<string, string | null>): { cookie: string; live: () => string[]; writes: string[] } {
  const store = new Map(Object.entries(cookies));
  const writes: string[] = [];
  return {
    get cookie(): string {
      return [...store.keys()].map((k) => `${k}=v`).join("; ");
    },
    set cookie(w: string) {
      writes.push(w);
      const name = w.split("=")[0] ?? "";
      const domain = /;\s*domain=([^;]+)/i.exec(w)?.[1] ?? null;
      if (/max-age=0/.test(w) && store.has(name) && store.get(name) === domain) store.delete(name);
    },
    live: () => [...store.keys()].sort(),
    writes,
  };
}

describe("expireGaCookies (F-10)", () => {
  it("removes _ga, _ga_<id>, _gid and _gat_* set on the parent domain, and nothing else", () => {
    const j = jar({ _ga: ".viafrei.de", _ga_ABC123: ".viafrei.de", _gid: ".viafrei.de", _gat_UA1: null, theme: null, _gaz: ".viafrei.de" });
    const expired = expireGaCookies(j, "www.viafrei.de");
    expect(expired.sort()).toEqual(["_ga", "_ga_ABC123", "_gat_UA1", "_gid"]);
    expect(j.live()).toEqual(["_gaz", "theme"]);
  });

  it("removes a host-only cookie and one on every parent domain", () => {
    const j = jar({ _ga: null, _ga_X: ".viafrei.de", _gid: ".www.viafrei.de" });
    expireGaCookies(j, "www.viafrei.de");
    expect(j.live()).toEqual([]);
    // never the bare TLD
    expect(j.writes.some((w) => /domain=\.de(;|$)/.test(w))).toBe(false);
  });

  it("on an address (the e2e host) writes host-only and nothing else", () => {
    expect(cookieDomains("127.0.0.1")).toEqual([null]);
    expect(cookieDomains("localhost")).toEqual([null]);
    expect(cookieDomains("viafrei.de")).toEqual([null, ".viafrei.de"]);
    const j = jar({ _ga: null });
    expireGaCookies(j, "127.0.0.1");
    expect(j.live()).toEqual([]);
  });

  it("does nothing when there is nothing to expire", () => {
    const j = jar({ theme: null });
    expect(expireGaCookies(j, "viafrei.de")).toEqual([]);
    expect(j.writes).toEqual([]);
  });

  it("matches exactly the GA names", () => {
    for (const n of ["_ga", "_ga_ABCDEF", "_gid", "_gat", "_gat_UA-1"]) expect(GA_COOKIE.test(n), n).toBe(true);
    for (const n of ["_gaz", "ga", "_gads", "__ga", "_gidx"]) expect(GA_COOKIE.test(n), n).toBe(false);
  });

  it("is called on decline and on withdrawal", () => {
    const consent = readFileSync(join(WEB, "src/components/Consent.svelte"), "utf8");
    const decide = /function decide\(v: Decision\): void \{([\s\S]*?)\n  \}/.exec(consent)?.[1] ?? "";
    expect(decide).toContain("expireGaCookies(document, window.location.hostname)");
    const withdraw = readFileSync(join(WEB, "src/components/ConsentWithdraw.svelte"), "utf8");
    expect(withdraw).toContain("expireGaCookies(document, window.location.hostname)");
  });
});
