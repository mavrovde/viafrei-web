/**
 * #1267: the Datenschutzerklärung names Cloudflare as processor before
 * viafrei.de is proxied — purpose, legal basis, data, retention, transfer
 * basis, the two cookies and the objection. Since the #1233 cutover all five
 * names are proxied (#1235 S4 bullet 4): the scope and the objection are pinned
 * in both directions, so the pre-cutover "not through Cloudflare" wording
 * cannot come back. Each element is pinned so a later
 * edit cannot drop one silently. Read as text (no render): the section is
 * unconditional, so every language route carries it (the page is German and
 * binding in all of them, `Legal.astro`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../src/components/LegalPrivacy.astro", import.meta.url), "utf8");
const flat = (s: string): string => s.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");
const start = src.indexOf('<h3 id="cloudflare">');
const end = src.indexOf("<h2>3. Server-Logfiles</h2>");
const section = flat(src.slice(start, end));

describe("#1267 the Cloudflare section", () => {
  it("stands in section 2, before the server logs, outside any conditional branch", () => {
    expect(start).toBeGreaterThan(src.indexOf("<h2>2. Hosting</h2>"));
    expect(end).toBeGreaterThan(start);
    expect(src.slice(src.indexOf("<h2>2. Hosting</h2>"), start)).not.toMatch(/[{}]/u);
  });

  it("names the processor, its address and the DPA under Art. 28", () => {
    expect(section).toContain("Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA");
    expect(section).toContain("(Art. 28 DSGVO)");
    expect(section).toContain("Data Processing Addendum von Cloudflare (Version 6.4 vom 3. April 2026)");
  });

  it("routes all five names through Cloudflare after the #1233 cutover, mail excepted", () => {
    expect(section).toContain(
      "Alle Adressen dieses Angebots – die Website viafrei.de und www.viafrei.de, den MCP-Endpunkt mcp.viafrei.de, die Statusseite status.viafrei.de und die Betriebskonsole admin.viafrei.de – leiten wir über das Netz",
    );
    expect(section).toContain("Unser Server nimmt Anfragen an diese Adressen nur von Cloudflare an;");
    expect(section).toContain("Unser E-Mail-Verkehr läuft nicht über Cloudflare.");
    expect(section).toContain("Antworten des MCP-Endpunkts, der Statusseite und der Betriebskonsole speichert Cloudflare nicht zwischen.");
    expect(section).toContain("also auch die, die unser Server danach ohne Inhalt abweist");
  });

  it("no longer claims that mcp, status or the console bypass Cloudflare (the pre-cutover wording)", () => {
    expect(section).not.toContain("laufen nicht über Cloudflare");
    expect(section).not.toContain("der nicht über Cloudflare läuft");
    expect(section).not.toContain("Die Website viafrei.de und www.viafrei.de leiten wir");
    expect(section).not.toMatch(/mcp\.viafrei\.de[^.]*nicht über Cloudflare/u);
  });

  it("names what the MCP endpoint hands Cloudflare: the caller's address, the session id, the tool arguments", () => {
    expect(section).toContain("beim MCP-Endpunkt die des Programms, das die Anfrage stellt");
    expect(section).toContain("beim MCP-Endpunkt auch die Sitzungskennung");
    expect(section).toContain("beim MCP-Endpunkt die Werkzeugaufrufe mit ihren Argumenten");
    expect(section).toContain("Programmierschnittstellen wie unseren MCP-Endpunkt");
  });

  it("the objection offers no bypass, and says so", () => {
    expect(section).toContain("gibt es keinen Weg zu unserer Website oder zu unseren Werkzeugen, der Cloudflare umgeht");
    expect(section).toContain("vermeiden können Sie sie nur, indem Sie unsere Adressen nicht aufrufen");
    expect(section).toContain("jede Antwort nennt ihre Quelle, bei der Sie diese Daten ohne uns abrufen können");
  });

  it("lists the data, including headers and request contents", () => {
    for (const d of ["die IP-Adresse des anfragenden Geräts", "bei der Website die Ihres Geräts", "Browserkennung (User-Agent)", "(Referrer)", "den Inhalt der Anfrage"]) expect(section).toContain(d);
  });

  it("names both cookies, their lifetimes and § 25 Abs. 2 Nr. 2 TDDDG", () => {
    expect(section).toContain("__cf_bm");
    expect(section).toContain("Es läuft nach 30 Minuten ohne Aktivität ab.");
    expect(section).toContain("cf_clearance");
    expect(section).toContain("wir verwenden die Voreinstellung von 30 Minuten");
    expect(section).toContain("(§ 25 Abs. 2 Nr. 2 TDDDG), und erfordern daher keine Einwilligung.");
  });

  it("gives purpose, Art. 6(1)(f), retention, the DPF with SCCs as fallback, and the objection", () => {
    expect(section).toContain("Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO");
    expect(section).toContain("standardmäßig nicht aufbewahrt");
    expect(section).toContain("mindestens 31 Tage lang");
    expect(section).toContain("EU-U.S. Data Privacy Framework vom 10. Juli 2023 (Art. 45 DSGVO)");
    expect(section).toContain("Standarddatenschutzklauseln der Kommission (Art. 46 Abs. 2 lit. c DSGVO)");
    expect(section).toContain("nach Art. 21 DSGVO");
  });

  it("the MCP access log says its connection and TLS parameters are Cloudflare's, not the visitor's", () => {
    const logs = flat(src.slice(end, src.indexOf("Alle übrigen Kopfzeilen der Anfrage", end)));
    expect(logs).toContain("das ist die Adresse des Cloudflare-Servers, über den die Anfrage kam");
    expect(logs).toContain("der verschlüsselten Verbindung zwischen Cloudflare und unserem Server");
    expect(logs).toContain("die verschlüsselte Verbindung Ihres Geräts endet bei Cloudflare");
    expect(logs).not.toMatch(/Parameter der verschlüsselten Verbindung \(TLS/u);
  });

  it("the no-tag sentence no longer claims no connection to any other provider", () => {
    const text = flat(src);
    expect(text).not.toContain("keine Verbindung zu einem anderen Anbieter.");
    expect(text).toContain("keine Verbindung zu einem anderen Anbieter als Cloudflare.");
  });
});
