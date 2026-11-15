/**
 * The legal pages and the 404 rendered by the BUILT server (#379 PR-07, GA
 * rule 6), with and without a tag:
 *   - /datenschutz carries section 5 "Google Analytics" exactly when a tag is
 *     set, and "Keine Cookies" exactly when none is — and section 4, the
 *     cookieless visitor count with its separate objection box, in BOTH (#535);
 *   - /impressum, /datenschutz and the 404 carry NO consent bar, even with a tag;
 *   - the withdraw control (the one other island) hydrates under the nonce
 *     CSP with no CSP error and deletes the stored decision;
 *   - a missing required identity name is a 500 with no HTML at all.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { all, parse, text as nodeText } from "@viafrei/design/testing";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { LIVE_LANGS, pathFor } from "../src/site/pages.js";

const ID = { IMPRESSUM_NAME: "Legal Probe", IMPRESSUM_STREET: "Probeweg 2", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "legal@example.invalid" };
const NO_TAG = 8797;
const TAG = 8798;
const NO_ID = 8799;
/** F-9: the host's street and city are still placeholders. */
const PENDING = 8809;
/** #901 D11 (steward G5.13 (vii)): the motorway pages' position paragraph, rendered only with the switch on. */
const AROUND = 8861;

const shells: ChildProcess[] = [];
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let browser: Browser;
const url = (port: number, path: string): string => `http://127.0.0.1:${port}${path}`;

beforeAll(async () => {
  stub = await startStubDigest({});
  shells.push(await startShell(NO_TAG, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "" }));
  shells.push(await startShell(TAG, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "G-0" }));
  shells.push(await startShell(NO_ID, { ...ID, IMPRESSUM_NAME: "", DIGEST_URL: stub.url, GOOGLE_TAG: "" }));
  shells.push(await startShell(AROUND, { ...ID, DIGEST_URL: stub.url, GOOGLE_TAG: "", VF_MOTORWAY_AROUND: "1" }));
  shells.push(await startShell(PENDING, { ...ID, IMPRESSUM_STREET: "[Straße folgt]", IMPRESSUM_CITY: "[PLZ Ort folgt]", DIGEST_URL: stub.url, GOOGLE_TAG: "" }));
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  for (const s of shells) s.kill();
  await stub?.close();
});

describe("Datenschutz follows the tag", () => {
  it("no tag: section 5 is 'Kein Tracking', no Google Analytics section, no island", async () => {
    const html = await (await fetch(url(NO_TAG, "/datenschutz"))).text();
    expect(html).toContain("5. Kein Tracking, keine Drittanbieter");
    expect(html).not.toContain("Google Analytics — nur mit Ihrer Einwilligung");
    expect(all(html, "astro-island")).toHaveLength(0);
    expect(html).toContain("Legal Probe");
  });
  it("#901 D11 (G5.13 (vii)): every language's Datenschutz says the motorway block may name and link the nearest junction, which the map service sees only on a click", async () => {
    const SENTENCE = "Die Seite kann die nächste Anschlussstelle mit Namen, Nummer und Entfernung in Luftlinie nennen und sie auf einem Kartendienst (OpenStreetMap) verlinken; dieser erfährt nur den Punkt dieser Anschlussstelle, nie Ihr Gebiet, und erst, wenn Sie den Link anklicken.";
    for (const p of LIVE_LANGS.map((l) => pathFor("datenschutz", l))) {
      const html = (await (await fetch(url(AROUND, p))).text()).replace(/\s+/g, " ");
      expect(html, p).toContain(SENTENCE);
    }
    // switch off: the paragraph, and with it the sentence, is not there
    expect((await (await fetch(url(NO_TAG, "/datenschutz"))).text()).replace(/\s+/g, " ")).not.toContain("nächste Anschlussstelle mit Namen, Nummer");
  });

  it("with a tag: the Google Analytics section in both languages, and no 'Kein Tracking'", async () => {
    for (const p of ["/datenschutz", "/en/datenschutz"]) {
      const html = await (await fetch(url(TAG, p))).text();
      expect(html, p).toContain("5. Google Analytics — nur mit Ihrer Einwilligung");
      expect(html, p).not.toContain("5. Kein Tracking, keine Drittanbieter");
    }
  });
  it("G6 (#716): with a tag, every language's Datenschutz carries the steward's motorway sentences verbatim; the count's line names the motorway bucket in both variants", async () => {
    const G6 = [
      "Auf den Inhaltsseiten dieses Angebots (Start, Verbinden, Entwickler, Unternehmen, die Übersicht der Autobahnen und die Seite jeder Autobahn) können wir die Nutzung mit Google Analytics 4 messen.",
      "Das Impressum, diese Erklärung, die Fehlerseite, die Ortsseiten, die Kraftstoffseite, die Übersicht der Bahnhöfe und die Seite jedes Bahnhofs enthalten keine Analyse.",
      // G5.10 (#890, 2026-10-21): the motorway item names the radius and the rung too; G5.7 interim: "beim Laden der Seite"
      "auf den Autobahnseiten die Autobahn als Teil der Seitenadresse — beim Laden der Seite ohne gewählten Abschnitt, Richtung, Filter oder Umkreis und nie Ihr Ort oder der Weg, auf dem die Seite ihn bestimmt hat,",
      // G5.7 (2026-10-21): five enhanced-measurement events ON, page changes and outbound clicks OFF
      "Für unsere Property ist die „erweiterte Messung“ von Google Analytics eingeschaltet.",
    ];
    for (const lang of ["", "/en", "/ru", "/bg", "/uk", "/ro", "/tr"]) {
      const p = `${lang}/datenschutz`;
      const tagged = (await (await fetch(url(TAG, p))).text()).replace(/\s+/g, " ");
      for (const g of G6) expect(tagged, p).toContain(g);
      const untagged = (await (await fetch(url(NO_TAG, p))).text()).replace(/\s+/g, " ");
      for (const g of G6) expect(untagged, p).not.toContain(g);
      for (const h of [tagged, untagged]) expect(h, p).toContain("Seitenaufrufe je Seite und Sprache (auf den Autobahnseiten je Autobahn); die Zahl der Besuche je"); // #1185 V3: the visits follow it
    }
  });
  it("#535: both variants render section 4, the cookieless visitor count, with its objection box as a separate section", async () => {
    for (const [port, p] of [[NO_TAG, "/datenschutz"], [NO_TAG, "/en/datenschutz"], [TAG, "/datenschutz"], [TAG, "/tr/datenschutz"]] as const) {
      const html = await (await fetch(url(port, p))).text();
      const s4 = html.indexOf(">4. Besucherzählung ohne Cookies</h2>");
      const box = html.indexOf('<section class="legal__box" id="widerspruch-besucherzaehlung"');
      expect(s4, `${p} on ${String(port)}`).toBeGreaterThan(html.indexOf("3. Server-Logfiles"));
      expect(box, `${p} on ${String(port)}`).toBeGreaterThan(s4);
      expect(html.slice(box), p).toMatch(/^<section[^>]*>\s*<h3[^>]*>Ihr Widerspruchsrecht \(Art\. 21 DSGVO\)<\/h3>/u);
      expect(html.indexOf(">5. "), p).toBeGreaterThan(box);
      // #591: the wording of the rotation (a new file each Berlin midnight, deleted on the seventh day)
      expect(html, p).toContain("Datei wird am siebten Tag danach automatisch gelöscht");
    }
  });
  it("#741 T12: every language's Datenschutz, in both variants, carries the error-message section and the amended MCP sentence, verbatim", async () => {
    const T12A = "Ausgenommen sind allein die darin enthaltenen Warn- und Fehlermeldungen: Sie übernehmen wir zuvor bereinigt in unsere Datenbank, wie unter";
    const T12B = [
      "Damit wir Störungen auch nach einem Neustart oder einer Aktualisierung unserer Dienste noch nachvollziehen können, übernimmt ein Programm auf unserem Server alle fünf Minuten und vor jeder Aktualisierung",
      "ein auf 300 Zeichen gekürzter Meldungstext und ein auf 2 KB gekürzter technischer Ablaufbericht",
      "nicht in die nächtliche Datensicherung aufgenommen und nach 30 Tagen automatisch gelöscht; bei jeder Bereitstellung prüfen wir, dass kein älterer Eintrag besteht.",
      "unser berechtigtes Interesse ist der sichere und störungsfreie Betrieb des Angebots.",
    ];
    for (const port of [NO_TAG, TAG]) {
      for (const lang of ["", "/en", "/ru", "/bg", "/uk", "/ro", "/tr"]) {
        const p = `${lang}/datenschutz (port ${String(port)})`;
        const html = await (await fetch(url(port, `${lang}/datenschutz`))).text();
        expect(all(html, "h3[id=\"fehlermeldungen\"]").map(nodeText), p).toContain("Fehlermeldungen unserer Dienste");
        expect(html, p).toContain(T12A);
        expect(nodeText(parse(html).root), p).toContain("„Fehlermeldungen unserer Dienste“ beschrieben.");
        expect(all(html, "a[href=\"#fehlermeldungen\"]").map(nodeText), p).toContain("Fehlermeldungen unserer Dienste");
        for (const t of T12B) expect(html, p).toContain(t);
        // At the end of section 3: after the live provider calls, before section 4.
        expect(html.indexOf('id="live-abfragen"'), p).toBeLessThan(html.indexOf('id="fehlermeldungen"'));
        expect(html.indexOf('id="fehlermeldungen"'), p).toBeLessThan(html.indexOf('id="besucherzaehlung"'));
      }
    }
  });
  it("F-22: every language's Datenschutz page names the live provider calls, in the binding German", async () => {
    for (const lang of ["", "/en", "/ru", "/bg", "/uk", "/ro", "/tr"]) {
      const p = `${lang}/datenschutz`;
      const html = await (await fetch(url(NO_TAG, p))).text();
      expect(html, p).toContain('id="live-abfragen"');
      expect(html, p).toContain("creativecommons.tankerkoenig.de");
      expect(html, p).toContain("apis.deutschebahn.com");
    }
  });
});

describe("no consent bar outside the four content pages (GA rule 6)", () => {
  for (const p of ["/impressum", "/en/impressum", "/datenschutz", "/de/404", "/en/404", "/nope"]) {
    it(`${p} with a tag carries no consent bar`, async () => {
      const html = await (await fetch(url(TAG, p))).text();
      // the bar renders nothing until hydrated, so the island's component is what to look for
      expect(html).not.toMatch(/component-url="\/_a\/Consent\./);
      expect(html).not.toContain("googletagmanager");
    });
  }
  it("/de/connect with a tag does carry it (the rule is not vacuous)", async () => {
    expect(await (await fetch(url(TAG, "/de/connect"))).text()).toMatch(/component-url="\/_a\/Consent\./);
  });
});

describe("the withdraw island", () => {
  it("hydrates under the nonce CSP with no CSP error and deletes the stored decision", async () => {
    const page = await (await browser.newContext()).newPage();
    const csp: string[] = [];
    page.on("console", (m) => {
      if (/Content.Security.Policy|Refused to/i.test(m.text())) csp.push(m.text());
    });
    await page.route(/googletagmanager|google-analytics/, (r) => void r.abort());
    await page.goto(url(TAG, "/datenschutz"), { waitUntil: "networkidle" });
    await page.evaluate(() => window.localStorage.setItem("viafrei.consent.analytics", `granted|${Date.now()}`));
    // F-10: the cookies an earlier consent let gtag.js write go with the decision.
    await page.context().addCookies([
      { name: "_ga", value: "GA1.1.1.1", url: url(TAG, "/") },
      { name: "_ga_ABC123", value: "GS1.1.1", url: url(TAG, "/") },
      { name: "theme", value: "keep", url: url(TAG, "/") },
    ]);
    await page.click("#vf-consent-reset");
    await expect.poll(() => page.textContent("#vf-consent-state")).toContain("gelöscht");
    expect(await page.evaluate(() => window.localStorage.getItem("viafrei.consent.analytics"))).toBeNull();
    expect((await page.context().cookies()).map((c) => c.name).sort()).toEqual(["theme"]);
    expect(csp).toEqual([]);
    await page.context().close();
  });
});

describe("identity", () => {
  for (const p of ["/impressum", "/datenschutz", "/en/impressum", "/en/datenschutz"]) {
    it(`${p}: a missing IMPRESSUM_NAME is a 500 with no HTML`, async () => {
      const r = await fetch(url(NO_ID, p));
      expect(r.status).toBe(500);
      const body = await r.text();
      expect(body).not.toMatch(/<html|Impressum|Datenschutz/i);
    });
  }
  for (const p of ["/impressum", "/datenschutz", "/en/impressum", "/en/datenschutz"]) {
    it(`${p}: a PLACEHOLDER address renders "Anschrift wird ergänzt", never the placeholder (F-9)`, async () => {
      const r = await fetch(url(PENDING, p));
      expect(r.status).toBe(200);
      const html = await r.text();
      expect(html).toContain("Anschrift wird ergänzt");
      expect(html).not.toMatch(/Straße folgt|PLZ Ort folgt|\[Stra/);
      expect(html).toContain("Legal Probe");
    });
  }
  it("the other pages still render without an identity", async () => {
    expect((await fetch(url(NO_ID, "/de/business"))).status).toBe(200);
  });
});
