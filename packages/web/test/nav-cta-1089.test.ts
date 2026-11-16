/**
 * #1089 (owner 2026-10-27: "The button above says just 'connect'. It must be more clear to connect to where?"): the
 * header's primary button names its target in every catalogue, its accessible name names the assistants the hero
 * lists, the hero's button says the same, and the header carries a short form for the widths where the long one
 * would push the nav. The rendered half (no wrap at 1024/1120/1280 in the longest language) is `e2e/header-1089.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { NOTE_CLIENTS } from "../src/site/connect-clients.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), "utf8");

/** The bare verb every catalogue carried before #1089 — none may keep it. */
const OLD_CTA: Readonly<Record<string, string>> = {
  bg: "Свържете", cs: "Připojit", da: "Forbind", de: "Verbinden", el: "Σύνδεση", en: "Connect", es: "Conectar", fr: "Connecter",
  hr: "Poveži", hu: "Csatlakozás", it: "Collega", lt: "Prijungti", lv: "Pievienot", nl: "Verbinden", pl: "Połącz", pt: "Ligar",
  ro: "Conectează", ru: "Подключить", sk: "Pripojiť", sr: "Повежи", tr: "Bağlan", uk: "Підключити",
};
const OLD_PRIMARY: Readonly<Record<string, string>> = { de: "In einer Minute verbinden", en: "Connect in one minute" };

describe("#1089: the header button says what it connects", () => {
  it("covers every live language (the old-value table is complete)", () => {
    for (const lang of LIVE_LANGS) expect(OLD_CTA[lang], lang).toBeDefined();
  });

  it("no catalogue keeps the bare verb; DE and EN are exactly the owner's texts", () => {
    for (const lang of LIVE_LANGS) {
      expect(t(lang, "nav.cta"), lang).not.toBe(OLD_CTA[lang]);
      expect(t(lang, "nav.cta").length, lang).toBeGreaterThan((OLD_CTA[lang] ?? "").length);
      expect(t(lang, "nav.ctaShort"), lang).not.toBe("");
      expect(t(lang, "nav.ctaShort"), lang).not.toBe(OLD_CTA[lang]);
    }
    expect(t("de", "nav.cta")).toBe("Mit Ihrer KI verbinden");
    expect(t("en", "nav.cta")).toBe("Connect to your AI");
    expect(t("de", "nav.ctaShort")).toBe("KI verbinden");
    expect(t("en", "nav.ctaShort")).toBe("Connect AI");
  });

  it("the description names the assistants from the hero's own list, in every language; the name is the visible text (WCAG 2.5.3)", () => {
    const clients = `${NOTE_CLIENTS.slice(0, 2).map((c) => c.name).join(", ")}, …`;
    expect(t("de", "nav.ctaLabel", { clients })).toBe("ViaFrei mit Ihrem KI-Assistenten verbinden (Claude, ChatGPT, …)");
    for (const lang of LIVE_LANGS) {
      const label = t(lang, "nav.ctaLabel", { clients });
      expect(label, lang).toContain("ViaFrei");
      expect(label, lang).toContain("Claude, ChatGPT, …");
    }
    const header = read("components", "Header.astro");
    expect(header).toContain('aria-describedby="site-head-cta-desc"');
    // the description stands after the link, so it is no part of the link's own text
    expect(header).toContain('</a><span id="site-head-cta-desc" hidden>{ctaLabel}</span>');
    // no aria-label: it would replace the visible text as the name (axe-core 4.14's label-content-name-mismatch)
    expect(header).not.toMatch(/site-head__cta"[^>]*aria-label/);
    expect(header).toContain('NOTE_CLIENTS.slice(0, 2)');
  });

  it("the hero's button says the same: 'mit Ihrer KI' / 'your AI'", () => {
    expect(t("de", "hero.primary")).toBe("In einer Minute mit Ihrer KI verbinden");
    expect(t("en", "hero.primary")).toBe("Connect your AI in a minute");
    for (const lang of ["de", "en"] as const) expect(t(lang, "hero.primary")).not.toBe(OLD_PRIMARY[lang]);
    for (const lang of LIVE_LANGS) if (lang !== "de") expect(t(lang, "hero.primary"), lang).not.toBe(t("de", "hero.primary"));
  });

  it("the header carries the long and the short form; the stylesheet shows one of them per width and never wraps the button", () => {
    const header = read("components", "Header.astro");
    expect(header).toMatch(/<span class="site-head__cta-long">\{t\(lang, "nav\.cta"\)\}<\/span><span class="site-head__cta-short">\{t\(lang, "nav\.ctaShort"\)\}<\/span>/);
    const css = read("styles", "site.css");
    expect(css).toContain(".site-head__cta { white-space: nowrap; }");
    expect(css).toContain(".site-head__cta-short { display: none; }");
    expect(css).toMatch(/@media \(max-width: 1279px\) \{ \.site-head__cta-long \{ display: none; \} \.site-head__cta-short \{ display: inline; \} \}/);
  });
});
