/**
 * #707 — the terms of use as the BUILT server renders them, in every live
 * language: section 2 is `#sid`, item c's source line is German and not
 * translated, every non-German page links the binding German page, and every
 * footer links the terms. The unit test (`test/terms.test.ts`) pins the words;
 * this pins the markup by structure (#922 B2). Offline: the shell is on
 * loopback and no tile is requested.
 */
import type { ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, text } from "@viafrei/design/testing";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";
import { SID_SOURCE_LINE } from "../src/site/terms.js";
import { startShell } from "./server.js";

const PORT = 8863;
let shell: ChildProcess | undefined;
const get = async (path: string): Promise<{ status: number; body: string }> => {
  const r = await fetch(`http://127.0.0.1:${String(PORT)}${path}`, { redirect: "manual" });
  return { status: r.status, body: await r.text() };
};

beforeAll(async () => {
  // The legal pages are a 500 without the § 5 DDG identity (identity.ts); the suite brings its own probe
  // identity like legal.e2e, so its verdict never depends on what the calling shell happens to export.
  shell = await startShell(PORT, { IMPRESSUM_NAME: "Terms Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "terms@example.invalid" });
});

afterAll(() => {
  shell?.kill();
});

describe("#707: /terms on the built server", () => {
  for (const lang of LIVE_LANGS) {
    it(`${pathFor("terms", lang)}: #sid, the German source line, the binding link, the footer link`, async () => {
      const r = await get(pathFor("terms", lang));
      expect(r.status).toBe(200);
      expect(all(r.body, "h2#sid")).toHaveLength(1);
      expect(all(r.body, 'span[lang="de"][translate="no"]').map(text)).toContain(SID_SOURCE_LINE);
      // The binding sentence is in the page's body; the language list's own link to the German page is not it.
      const binding = all(r.body, `main a[href="${pathFor("terms", "de")}"][hreflang="de"]`);
      if (lang === "de") expect(binding).toEqual([]);
      else expect(binding.length).toBeGreaterThan(0);
      expect(all(r.body, `footer a[href="${pathFor("terms", lang)}"]`).map(text)).toContain(t(lang, "footer.terms"));
    });
  }
});
