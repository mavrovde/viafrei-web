/**
 * #1235: the staging switch of dev.viafrei.de (`VF_STAGING`, `src/lib/staging.ts`), in both directions — off by
 * default (robots.txt as before, the GA tag and Clarity as configured, the IndexNow key served, no X-Robots-Tag
 * added) and on (robots.txt `Disallow: /`, noindex on every answer, no GA tag, no Clarity, no IndexNow key).
 * The middleware imports `astro:middleware` and cannot run here, so its wiring is pinned as text, like
 * clarity-717.test.ts pins its own.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGING_ROBOTS_TAG, STAGING_ROBOTS_TXT, stagingOf, stagingRobotsTag, withStagingRobots } from "../src/lib/staging.js";
import { robotsBody } from "../src/pages/robots.txt.js";
import { robotsTxt } from "../src/site/discovery.js";
import { indexNowKey, keyFileResponse } from "../src/site/indexnow.js";
import { readEnv } from "../src/lib/env.js";

const read = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const KEY = "abcdef0123456789";
const TAG = "G-TEST123";
const CLARITY = "abcd1234";

describe("the switch's values", () => {
  it("is off by default and for every off spelling", () => {
    expect(stagingOf({})).toBe(false);
    for (const v of ["", " ", "0", "false", "no", "FALSE", "No"]) expect(stagingOf({ VF_STAGING: v }), v).toBe(false);
  });
  it("is on for every on spelling", () => {
    for (const v of ["1", "true", "yes", "TRUE", " Yes "]) expect(stagingOf({ VF_STAGING: v }), v).toBe(true);
  });
  it("refuses anything else, naming the variable and never the value", () => {
    for (const v of ["2", "on", "staging", "ture"]) {
      expect(() => stagingOf({ VF_STAGING: v }), v).toThrow(/VF_STAGING/);
      try {
        stagingOf({ VF_STAGING: v });
      } catch (err) {
        expect((err as Error).message).not.toContain(`'${v}'`);
      }
    }
  });
});

describe("robots.txt", () => {
  it("off: the production file, unchanged", () => {
    expect(robotsBody({})).toBe(robotsTxt());
    expect(robotsBody({ VF_STAGING: "0" })).toContain("Sitemap:");
  });
  it("on: every crawler, every path disallowed, nothing else", () => {
    expect(robotsBody({ VF_STAGING: "1" })).toBe("User-agent: *\nDisallow: /\n");
    expect(STAGING_ROBOTS_TXT).not.toMatch(/Allow: \/\n|Sitemap|llms/u);
  });
});

describe("X-Robots-Tag", () => {
  it("adds noindex, nofollow to an answer without one", () => {
    const r = withStagingRobots(new Response("x", { status: 301, headers: { location: "/de" } }));
    expect(r.headers.get("x-robots-tag")).toBe(STAGING_ROBOTS_TAG);
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("/de");
  });
  it("keeps a page's own noindex value whole (the fuel answers' noarchive, which the service worker reads)", () => {
    expect(stagingRobotsTag("noindex, nofollow, noarchive, nosnippet")).toBe("noindex, nofollow, noarchive, nosnippet");
    expect(stagingRobotsTag("noarchive")).toBe("noarchive, noindex, nofollow");
    expect(stagingRobotsTag(null)).toBe("noindex, nofollow");
  });
  it("copies an answer whose headers are immutable, body and status intact", async () => {
    const frozen = Response.redirect("https://viafrei.de/de", 302);
    const r = withStagingRobots(frozen);
    expect(r.headers.get("x-robots-tag")).toBe(STAGING_ROBOTS_TAG);
    expect(r.status).toBe(302);
    const body = withStagingRobots(new Response("hello", { status: 404 }));
    expect(await body.text()).toBe("hello");
    expect(body.status).toBe(404);
  });
  it("the middleware applies it to EVERY answer it passes, only when the switch is on, read once at load", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toMatch(/const STAGING = \(\(\): boolean => \{\s*try \{\s*return stagingOf\(process\.env\);/u);
    expect(mw).toMatch(/catch \(err\) \{\s*logLine\(60, \{ kind: "config_refused", key: "staging" \}[^;]*;\s*process\.exit\(78\);/u);
    expect(mw).toContain("const response = await handle(context, next);");
    expect(mw).toContain("return STAGING ? withStagingRobots(response) : response;");
  });
});

describe("analytics", () => {
  it("off: the GA tag and Clarity as configured", () => {
    const env = readEnv({ GOOGLE_TAG: TAG, CLARITY_PROJECT_ID: CLARITY });
    expect(env.googleTag).toBe(TAG);
    expect(env.clarityProjectId).toBe(CLARITY);
  });
  it("on: no GA tag and no Clarity, whatever the .env holds", () => {
    const env = readEnv({ GOOGLE_TAG: TAG, CLARITY_PROJECT_ID: CLARITY, VF_STAGING: "1" });
    expect(env.googleTag).toBeUndefined();
    expect(env.clarityProjectId).toBeUndefined();
  });
  it("the middleware gives no render a tag or a Clarity id on staging", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toContain('const googleTag = STAGING || process.env["GOOGLE_TAG"] === "" ? undefined : process.env["GOOGLE_TAG"];');
    expect(mw).toContain("const CLARITY = STAGING ? undefined : CLARITY_ID;");
    expect(mw).not.toMatch(/locals\.clarityId = CLARITY_ID/u);
  });
});

describe("IndexNow", () => {
  it("off: the key file is served", async () => {
    expect(indexNowKey({ INDEXNOW_KEY: KEY })).toBe(KEY);
    expect(await keyFileResponse(KEY, { INDEXNOW_KEY: KEY })?.text()).toBe(KEY);
  });
  it("on: no key, the key file is the 404", () => {
    expect(indexNowKey({ INDEXNOW_KEY: KEY, VF_STAGING: "true" })).toBeUndefined();
    expect(keyFileResponse(KEY, { INDEXNOW_KEY: KEY, VF_STAGING: "true" })).toBeNull();
  });
});
