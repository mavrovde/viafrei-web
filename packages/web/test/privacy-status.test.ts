/**
 * The Datenschutz paragraph on status.viafrei.de and admin.viafrei.de (2.0.2)
 * pinned to the code that makes it true: both are the operator's only since
 * 2026-10-13 (owner), refused without content and without storing the address,
 * and the console's two cookies (session, and the passkey sign-in's two-minute
 * one) and audit address.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pinnedPath } from "./pinned-source.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(pinnedPath(rel), REPO), "utf8");
const flat = (s: string): string => s.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");
const src = read("packages/web/src/components/LegalPrivacy.astro");
const sec = flat(src.slice(src.indexOf('<h3 id="statusseite">'), src.indexOf('<h3 id="live-abfragen">')));

describe("the privacy notice on the status page and the console (2.0.2)", () => {
  it("is there, inside section 3, and names both hosts", () => {
    expect(src.indexOf('<h3 id="statusseite">')).toBeGreaterThan(src.indexOf("<h2>3. Server-Logfiles</h2>"));
    expect(sec).toContain("status.viafrei.de");
    expect(sec).toContain("admin.viafrei.de");
  });

  it("says the status page is the operator's only (owner 2026-10-13) — and the public smoke asserts exactly that", () => {
    expect(sec).toContain("Sie ist wie die Betriebskonsole nur dem Betreiber zugänglich");
    expect(sec).toContain("ohne Inhalt abgewiesen; ihre Adresse wird dabei nicht gespeichert");
    expect(sec).not.toContain("öffentliche Statusseite");
    // nothing on the page still describes a visitor's view key or consent bar there
    expect(src).not.toContain("viafrei.status.mode");
    expect(src).not.toContain("Für die Statusseite status.viafrei.de");
    // the smoke that runs after every release refuses a status page served to the outside vantage
    const smoke = read("the public smoke");
    expect(smoke).toContain('refused status.viafrei.de "${r%%|*}" "$OUT/status-public.$OUTSIDE"');
    expect(smoke).toContain("the status page is for the allow-listed addresses only");
  });

  it("the console carries NO analytics — the status process never hands it the tag (steward 2026-10-12, § 25 Abs. 1)", () => {
    expect(sec).toContain("Weitere Cookies oder Analysedienste verwendet sie nicht");
    const http = read("packages/status/src/server/http.ts");
    expect(http).toMatch(/const app = createApp\(\{ service, access:/);
    expect(http).not.toMatch(/createApp\(\{[^}]*googleTag/);
    // and the type the console is built from has no field to carry one
    expect(read("packages/status/src/server/app.ts")).not.toMatch(/readonly googleTag/);
  });

  // cross-repo(viafrei): reads db/migrations/0111 and the retention job: the status console stays in viafrei, and viafrei-database ships a squashed baseline (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("the audit log's addresses are deleted after twelve months (#692) — and the migration and the job say so", () => {
    expect(sec).not.toContain("ohne Löschfrist");
    // the data steward's wording of 2026-10-12 (#692 C1), verbatim
    expect(sec).toContain(
      "Dieses Protokoll kann nachträglich nicht geändert werden, mit einer Ausnahme: Zwölf Monate nach einem Eintrag wird dessen IP-Adresse automatisch gelöscht. Der Eintrag bleibt danach ohne IP-Adresse erhalten (Zeitpunkt, Aktion, betroffene Funktion oder Einstellung und Ergebnis) und lässt sich keiner Person außer dem Betreiber mehr zuordnen. In unseren nächtlichen Datensicherungen ist die Adresse noch enthalten, bis die jeweilige Sicherung im regelmäßigen Wechsel gelöscht wird; wir bewahren nur die sieben jüngsten Sicherungen auf.",
    );
    // "the seven newest backups" is the backup job's own retention
    expect(read("the backup job")).toContain(`KEEP="$(cfg BACKUP_KEEP 7)"`);
    const mig = read("db/migrations/0111_ops_audit_ip_retention.sql");
    // the exception admits client_ip := NULL on rows older than twelve months, and nothing else
    expect(mig).toContain("old.at < now() - interval '12 months'");
    expect(mig).toContain("new.client_ip is null");
    expect(mig).toMatch(/set client_ip = null\s+where client_ip is not null\s+and at < now\(\) - interval '12 months'/);
    // and something runs it: the five-minute rollup job on the host
    expect(read("the rollup job")).toContain("ops_audit_forget_ips()");
  });

  // cross-repo(viafrei): reads db/migrations/0104: the status console stays in viafrei, and viafrei-database ships a squashed baseline (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("the cookie lasts eight hours and the audit log cannot be changed — and the code says so", () => {
    expect(sec).toContain("acht Stunden");
    expect(read("packages/status/src/server/console-auth.ts")).toContain("SESSION_TTL_MS = 8 * 3_600_000");
    expect(sec).toContain("kann nachträglich nicht geändert werden");
    expect(read("db/migrations/0104_ops_console.sql")).toMatch(/before update or delete on ops_audit/);
  });

  it("names the passkey sign-in cookie, two minutes, set only during a passkey sign-in — and the code sets exactly that", () => {
    expect(sec).toContain("nur während einer Anmeldung mit Passkey");
    expect(sec).toContain("__Host-vf_passkey, gültig zwei Minuten");
    const passkeys = read("packages/status/src/server/console-passkeys.ts");
    expect(passkeys).toContain('PASSKEY_LOGIN_COOKIE = "__Host-vf_passkey"');
    expect(passkeys).toContain("PASSKEY_CHALLENGE_TTL_MS = 120_000");
    expect(passkeys).toContain("Max-Age=${String(PASSKEY_CHALLENGE_TTL_MS / 1000)}");
    // set by the passkey sign-in's options route and nowhere else
    const app = read("packages/status/src/server/console-app.ts");
    expect((app.match(/passkeyLoginCookie\(/g) ?? []).length).toBe(1);
    expect(app.slice(app.indexOf('r.post("/login/passkey/options"'), app.indexOf('r.post("/login/passkey/verify"'))).toContain("passkeyLoginCookie(");
    // and the console sets no third cookie: the only names it writes are these two
    const cookieNames = new Set([...(read("packages/status/src/server/console-auth.ts") + passkeys).matchAll(/"(__Host-[a-z_]+)"/g)].map((m) => m[1]));
    expect([...cookieNames].sort()).toEqual(["__Host-vf_console", "__Host-vf_passkey"]);
  });

  it("counts EVERY refused sign-in, token or passkey, in the audit log", () => {
    expect(sec).toContain("jeden abgelehnten Anmeldeversuch");
    expect(sec).not.toContain("falschem Zugangsschlüssel");
  });

  // cross-repo(viafrei): reads db/migrations/0104: the status console stays in viafrei, and viafrei-database ships a squashed baseline (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("says the console sets a session cookie and audits the address — and both exist", () => {
    expect(sec).toContain("Sitzungs-Cookie");
    expect(sec).toContain("Prüfprotokoll");
    expect(read("packages/status/src/server/console-auth.ts")).toContain('SESSION_COOKIE = "__Host-vf_console"');
    expect(read("db/migrations/0104_ops_console.sql")).toContain("client_ip  text");
  });
});
