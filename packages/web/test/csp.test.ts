import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { CSP_NO_SCRIPT, GTAG_ORIGIN, contentSecurityPolicy, newNonce, noScriptPolicy, withNonce } from "../src/security/csp.js";

/**
 * The two CSP cases of #375 A6 as pure functions — the browser half (zero
 * console errors, zero <script> without a tag) is `e2e/csp.e2e.ts` against the
 * built server; this is the policy string itself.
 */
describe("contentSecurityPolicy (src/security/csp.ts)", () => {
  const nonce = newNonce((n) => randomBytes(n));

  it("makes a base64url nonce of 16 bytes", () => {
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newNonce((n) => randomBytes(n))).not.toBe(nonce);
  });

  it("without a tag: script-src 'none', the stylesheet plus this request's style nonce (#1103), images from self, and nothing else", () => {
    for (const tag of [undefined, ""]) {
      const csp = contentSecurityPolicy(nonce, tag);
      expect(csp).toBe(noScriptPolicy(nonce));
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain(`style-src 'self' 'nonce-${nonce}';`);
      expect(csp).toContain("img-src 'self'");
      expect(csp).toContain("script-src 'none'");
      expect(csp).not.toMatch(/script-src[^;]*nonce/);
      expect(csp).not.toContain("google");
      expect(csp).not.toContain("unsafe-inline");
    }
  });

  it("#1103: a page with no script styles its own <style> — the policy and the element carry the same nonce; a redirect keeps the body-less policy", () => {
    const csp = contentSecurityPolicy(nonce, undefined, false);
    const page = withNonce('<head><link rel="stylesheet" href="/_a/site.x.css"><style>.stpage{margin:0}</style></head>', nonce);
    expect(all(page, "style").map((s) => s.attrs["nonce"])).toEqual([nonce]);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(CSP_NO_SCRIPT).not.toContain("nonce");
    expect(() => contentSecurityPolicy("short", undefined, false)).toThrow(/at least 16/);
  });

  it("without a tag but with an island (#404): the nonce and strict-dynamic, no Google origin, no 'self' for scripts", () => {
    for (const tag of [undefined, ""]) {
      const csp = contentSecurityPolicy(nonce, tag, true);
      expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic';`);
      expect(csp).toContain(`style-src 'self' 'nonce-${nonce}'`);
      expect(csp).toContain("connect-src 'self';");
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("form-action 'none'");
      expect(csp).not.toContain("google");
      expect(csp).not.toMatch(/script-src[^;]*'self'/);
      expect(csp).not.toContain("unsafe-inline");
    }
    // and a page without one keeps the no-script policy (its scripts refused, its styles under the nonce)
    expect(contentSecurityPolicy(nonce, undefined, false)).toBe(noScriptPolicy(nonce));
  });

  it("with a tag: the nonce, strict-dynamic and the googletagmanager origin — never 'self' for scripts", () => {
    const csp = contentSecurityPolicy(nonce, "G-0");
    expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic' ${GTAG_ORIGIN}`);
    expect(csp).toContain(`style-src 'self' 'nonce-${nonce}'`);
    expect(csp).toContain("connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com");
    expect(csp).toContain("img-src 'self' https://www.google-analytics.com");
    expect(csp).not.toMatch(/script-src[^;]*'self'/);
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("mirrors the digest's policy: same Google origins, same hardening directives", () => {
    // packages/digest/src/presentation/render.ts contentSecurityPolicy(): the
    // four origins and the four hardening directives, compared by value rather
    // than imported, because this package may not import the digest.
    const csp = contentSecurityPolicy(nonce, "G-0");
    for (const d of ["default-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"]) expect(csp).toContain(d);
    for (const o of ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", GTAG_ORIGIN]) expect(csp).toContain(o);
  });

  it("refuses a short nonce rather than emitting a weak policy", () => {
    expect(() => contentSecurityPolicy("abc", "G-0")).toThrow(/at least 16/);
  });

  it("writes the nonce onto every script and style element and touches nothing else", () => {
    const html = '<html><head><style>a{}</style></head><body><p>no &lt;script here</p><script>1</script><script type="module" src="/x.js"></script></body></html>';
    const out = withNonce(html, nonce);
    expect(out.match(new RegExp(`<script nonce="${nonce}"`, "g"))?.length).toBe(2);
    expect(out.match(new RegExp(`<style nonce="${nonce}"`, "g"))?.length).toBe(1);
    expect(all(out, "p").map(nodeText)).toContain("no <script here");
    expect(withNonce("<p>plain</p>", nonce)).toBe("<p>plain</p>");
  });

  it("leaves an element that already carries the nonce as it is — the JSON-LD block of #531 — so no element gets two", () => {
    const html = `<head><script type="application/ld+json" nonce="${nonce}">{}</script></head><body><script>1</script></body>`;
    const out = withNonce(html, nonce);
    expect(out.match(/nonce=/g)?.length).toBe(2);
    expect(out).toContain(`<script type="application/ld+json" nonce="${nonce}">{}</script>`);
    expect(out).toContain(`<script nonce="${nonce}">1</script>`);
    expect(withNonce(out, nonce)).toBe(out);
  });
});
