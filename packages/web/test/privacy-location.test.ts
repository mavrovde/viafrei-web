/**
 * The Datenschutz section "Ihr Ort auf der Startseite" (#564 § 6) pinned to
 * the code that makes each sentence true: the three storage keys to the
 * island, the objection signals to the server rung, the body-not-URL claim to
 * the island's requests, DB-IP's line and licence, and the "your place stays
 * with you" line in all seven languages.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { all, text as nodeText } from "@viafrei/design/testing";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { pinnedPath } from "./pinned-source.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(pinnedPath(rel), REPO), "utf8");
const flat = (s: string): string => s.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");
const src = read("packages/web/src/components/LegalPrivacy.astro");
const sec = flat(src.slice(src.indexOf('<h3 id="ort">'), src.indexOf("<h2>6. Kontaktaufnahme per E-Mail</h2>")));
const island = read("packages/web/src/location/island.ts");

describe("the privacy notice on the place (#564)", () => {
  it("is there, before section 6", () => {
    expect(src.indexOf('<h3 id="ort">')).toBeGreaterThan(0);
    expect(sec).toContain("Ihr Ort bleibt bei Ihnen.");
  });

  it("names exactly the keys the island stores, and the leftover it deletes", () => {
    for (const k of ["viafrei.place", "viafrei.place.recent", "viafrei.place.asked"]) {
      expect(sec).toContain(k);
      expect(island).toContain(`"${k}"`);
    }
    expect([...island.matchAll(/const [A-Z]+ = "(viafrei\.[a-z.]+)"/g)].map((m) => m[1]).sort()).toEqual(["viafrei.place", "viafrei.place.asked", "viafrei.place.recent"]);
    // v2.0.10: "asked" is only ever deleted, never written
    expect(island).not.toMatch(/store\.set\(ASKED/);
    expect(island).toContain("if (store.get(ASKED) !== null) store.del(ASKED);");
  });

  it("says the area travels in the body — and the island's three requests are POSTs with a JSON body (#1171: the object lookup the third)", () => {
    expect(sec).toContain("Das Gebiet steht im Inhalt der Anfrage und nicht in deren Adresse");
    expect((island.match(/method: "POST"/g) ?? []).length).toBe(3);
  });

  describe("#1171: the one lookup with the precise position, said as the code does it", () => {
    const spot = read("packages/web/src/lib/spot.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const code = (t: string): string => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const route = code(read("packages/digest/src/server/spot-route.ts"));
    const rule = read("packages/digest/src/analysis/spot.ts");

    it("the cards still get the ~500 m area alone", () => {
      expect(sec).toContain("auf ein Gebiet von etwa 500 Metern; um die passenden Karten zu laden, wird an unseren Server nur ein solches gerundetes Gebiet übertragen.");
      // the cards' requests carry the cell key, never a coordinate
      expect(island).toMatch(/JSON\.stringify\(\{ at, lang: cfg\.lang, how:/);
    });

    it("only after the click, only for a fix of at most 150 m — the island's bound and the digest's", () => {
      expect(sec).toContain("Eine Ausnahme gibt es, und nur unmittelbar nach Ihrem Klick auf „Meinen Standort verwenden“: Gibt Ihr Browser Ihren Standort auf höchstens 150 Meter genau an, sendet die Seite einmal die genaue Position mit dieser Genauigkeitsangabe im Inhalt der Anfrage, nicht in deren Adresse, an unseren Server");
      expect(island).toContain("const SPOT_ACC = 150;");
      expect(island).toContain("if (!fromBar || acc > SPOT_ACC || cfg.spot === false) return cells();");
      expect(rule).toContain("export const SPOT_MAX_ACC = Math.max(");
      // in the body: the one fetch with the position is a POST whose body carries it
      expect(island).toMatch(/w\.fetch\("\/fragment\/spot", \{ method: "POST", [^}]*\}, body: JSON\.stringify\(\{ lat, lon, acc, lang: cfg\.lang \}\)/);
      expect(spot).toContain('body: JSON.stringify({ lat, lon, acc, lang })');
    });

    it("names the four kinds of object — exactly the kinds the lookup can open", () => {
      expect(sec).toContain("ob Sie an einem Bahnhof, einer Tankstelle oder einer Ladestation stehen, die auf dieser Website eine eigene Seite hat, oder an einer Tank- und Rastanlage oder einem Rastplatz an der Autobahn");
      expect(island).toContain("(?:station|fuel|charging|autobahn)");
      expect(spot).toContain("(?:station|fuel|charging|autobahn)");
      // the pinned digest's compiled rule: its kinds, in their order (the type `SpotKind` is compiled away)
      expect(rule).toContain('export const SPOT_ORDER = ["fuel", "station", "charging", "rest"];');
    });

    it("#1171 C4 (a): a Tank- und Rastanlage AND a Rastplatz (LCL P3.3 and P3.4) open the motorway's page — the code matches both and has no page of a rest area", () => {
      expect(sec).toContain("trifft das zu, öffnet die Seite die Seite dieser Stelle, bei einer Rastanlage die Seite der Autobahn, sonst zeigt sie wie sonst die Karten des gerundeten Gebiets.");
      expect(rule).toContain("export const SPOT_REST_STCD = [3, 4];");
      expect(read("packages/digest/src/server/spot-service.ts")).toContain('{ kind: "rest", href: motorwayPath(lang, r.road),');
    });

    it("#1171 C4 (b): the request itself is not in the access log of Punkt 3 — the page says so", () => {
      expect(sec).toContain("sie wird bei uns weder gespeichert noch protokolliert, die Anfrage selbst erscheint nicht im Zugriffsprotokoll nach Punkt 3, und auch auf Ihrem Gerät wird sie nicht gespeichert");
    });
    // cross-repo(viafrei-infra): the edge's configuration is viafrei-infra's
    it.skip("#1171 C4 (b): nginx's /fragment/spot is access_log off in both server blocks", () => {});

    it("used for this lookup only, stored and logged nowhere, on the device neither — the cell is what is remembered", () => {
      expect(sec).toContain("Die genaue Position wird nur für diese eine Suche verwendet und danach verworfen; sie wird bei uns weder gespeichert noch protokolliert, die Anfrage selbst erscheint nicht im Zugriffsprotokoll nach Punkt 3, und auch auf Ihrem Gerät wird sie nicht gespeichert – gemerkt wird, wie bei jedem Klick auf „Meinen Standort verwenden“, nur das gerundete Gebiet, hier mit dem Namen der gefundenen Stelle.");
      // the island remembers the cell key (`at = cellKey(lat, lon)`), never lat/lon
      expect(island).toContain("remember(at, s.l, \"browser\");");
      expect(island).toContain("let at = cellKey(lat, lon);");
      // the shell and the digest log by path or route template only, never the body (spot-route.test.ts, both packages, asserts the lines)
      expect(spot).not.toMatch(/logLine\(|console\./);
      expect((spot.match(/logFragmentFailure\(url,/g) ?? []).length).toBe(3);
      expect(route).not.toMatch(/\blog\.|console\.|express\.json/);
      expect(spot + route).not.toMatch(/insert into|writeFile|appendFile|cache\.set|\.set\(/);
    });
  });

  it("says a GPC or DNT signal stops the IP lookup — and the server rung checks both", () => {
    expect(sec).toContain("unterbleibt die Ortsbestimmung aus der IP-Adresse ganz");
    const server = read("packages/web/src/location/server.ts");
    expect(server).toContain('headers.get("sec-gpc") === "1"');
    expect(server).toContain('headers.get("dnt") === "1"');
  });

  describe("#1171 C5: the sheet beside the button says the exception, in every language, right after the 500 m sentence", () => {
    /** The 500 m sentence's end in each catalogue: the sentence after it begins with these words (the "likewise" sentence). */
    const NEXT: Record<(typeof LIVE_LANGS)[number], string> = {
      bg: "По същия начин той държи ", cs: "Stejně tak drží v paměti ", da: "På samme måde holder den ", de: "Ebenso hält er den Namen ", el: "Με τον ίδιο τρόπο κρατά ",
      en: "It keeps the name of a st", es: "Del mismo modo conserva ", fr: "Il garde de la même façon", hr: "Na isti način najviše sat", hu: "Az itt kiválasztott állom",
      it: "Allo stesso modo tiene in", lt: "Taip pat ne ilgiau kaip v", lv: "Tāpat ne ilgāk kā stundu ", nl: "Net zo houdt hij de naam ", pl: "Tak samo trzyma w pamięci",
      pt: "Da mesma forma, mantém em", ro: "La fel, păstrează în memo", ru: "Так же не более часа он д", sk: "Rovnako drží v pamäti naj", sr: "На исти начин највише сат",
      tr: "Burada seçilen bir istasy", uk: "Так само не довше години ",
    };

    it("de and en carry the steward's sentence verbatim, directly after the 500 m sentence", () => {
      expect(t("de", "place.privacy.body")).toContain(
        "und speichert ihn nicht. Nur direkt nach diesem Klick und wenn Ihr Browser den Standort auf höchstens 150 m genau angibt, sendet die Seite die genaue Position einmal an unseren Server, um zu prüfen, ob Sie an einem Bahnhof, einer Tankstelle, einer Ladestation oder einer Raststätte stehen; dort wird sie weder gespeichert noch protokolliert. Ebenso hält er",
      );
      expect(t("en", "place.privacy.body")).toContain(
        "and does not store it. Only right after that click, and only if your browser gives your location to within 150 m, the page sends the exact position once to our server to check whether you are at a station, a fuel station, a charging site or a motorway rest area; it is neither stored nor logged there. It keeps the name",
      );
    });

    it("every live language: one sentence naming 150 m, after the 500 m and immediately before the sentence that followed it", () => {
      expect(Object.keys(NEXT).sort()).toEqual([...LIVE_LANGS].sort());
      for (const l of LIVE_LANGS) {
        const body = t(l, "place.privacy.body");
        const at500 = body.indexOf("500");
        const at150 = body.indexOf("150");
        const next = body.indexOf(NEXT[l]);
        expect(at500, l).toBeGreaterThan(-1);
        expect(body.split("150").length - 1, l).toBe(1);
        expect(at150, l).toBeGreaterThan(at500);
        expect(next, l).toBeGreaterThan(at150);
        // the exception is one whole sentence between the two: it starts after a full stop and ends right before NEXT
        const between = body.slice(0, next);
        const start = between.lastIndexOf(". ", at150);
        expect(start, l).toBeGreaterThan(at500);
        expect(between.endsWith(". "), l).toBe(true);
        expect(between.slice(start + 2, -2).includes(". "), l).toBe(false);
      }
    });
  });

  describe("#1182 (d), steward ruling 2026-11-08 point 2: the notice applies to every page with the place bar, the station index included", () => {
    /** The ruling's clause, and the six other privacy languages saying the same. */
    const CLAUSE: Record<"de" | "en" | "ru" | "bg" | "uk" | "ro" | "tr", string> = {
      de: "Auf der Bahnhofsübersicht dient der so bestimmte Ort nur dazu, die nächstgelegenen Bahnhöfe und Haltestellen zu zeigen.",
      en: "On the station index, the place found this way is used only to show the nearest stations and stops.",
      ru: "В обзоре вокзалов определённое так место служит только для того, чтобы показать ближайшие вокзалы и остановки.",
      bg: "В прегледа на гарите така определеното място служи само за показване на най-близките гари и спирки.",
      uk: "В огляді вокзалів визначене так місце слугує лише для того, щоб показати найближчі вокзали й зупинки.",
      ro: "În prezentarea gărilor, locul stabilit astfel servește doar pentru a afișa cele mai apropiate gări și stații.",
      tr: "İstasyon listesinde bu şekilde belirlenen yer yalnızca en yakın istasyonları ve durakları göstermek için kullanılır.",
    };
    const EVERY: Record<keyof typeof CLAUSE, string> = {
      de: "Das gilt auf jeder Seite mit der Ortsleiste, auch auf der Bahnhofsübersicht.",
      en: "This applies on every page with the place bar, including the station index.",
      ru: "Это действует на каждой странице со строкой места, в том числе в обзоре вокзалов.",
      bg: "Това важи за всяка страница с лентата с място, включително прегледа на гарите.",
      uk: "Це діє на кожній сторінці з рядком місця, зокрема в огляді вокзалів.",
      ro: "Acest lucru se aplică pe fiecare pagină cu bara de loc, inclusiv în prezentarea gărilor.",
      tr: "Bu, yer çubuğu olan her sayfada, istasyon listesinde de geçerlidir.",
    };
    /** The kept sentences, word for word: the ~500 m rounding on the device, the IP address in memory only, DNT/GPC. */
    /** The kept sentences of the German notice, word for word: the ~500 m rounding on the device, the IP address in memory only. */
    const KEPT_DE = ["Ihr Standort wird auf Ihrem Gerät auf ein Gebiet von etwa 500 m gerundet", "Ihre IP-Adresse dient nur der ungefähren Ortsbestimmung im Arbeitsspeicher und wird dafür nicht gespeichert."];

    it("the place bar's notice carries both sentences in all seven privacy languages, after the kept ones", () => {
      for (const l of Object.keys(CLAUSE) as (keyof typeof CLAUSE)[]) {
        const body = t(l, "place.privacy.body");
        expect(body, l).toContain(CLAUSE[l]);
        expect(body, l).toContain(EVERY[l]);
        expect(body.indexOf(EVERY[l]), l).toBeLessThan(body.indexOf(CLAUSE[l]));
        expect(body.indexOf("500"), l).toBeLessThan(body.indexOf(EVERY[l]));
      }
      for (const k of KEPT_DE) expect(t("de", "place.privacy.body")).toContain(k);
    });

    it("every live language names the station index once in the notice (machine-translated like the rest)", () => {
      for (const l of LIVE_LANGS) {
        const body = t(l, "place.privacy.body");
        expect(body.split("150").length - 1, l).toBe(1);
        expect(body.trim().endsWith("."), l).toBe(true);
      }
      for (const l of LIVE_LANGS.filter((x) => !(x in CLAUSE))) expect(t(l, "place.privacy.body"), l).not.toBe(t("de", "place.privacy.body"));
    });

    it("the Datenschutz section says it applies to every page with the place bar, adds the clause, and keeps the three sentences word for word", () => {
      const p = flat(src.slice(src.indexOf('<p id="ort-bahnhoefe">'), src.indexOf("</p>", src.indexOf('<p id="ort-bahnhoefe">'))));
      expect(src.indexOf('<p id="ort-bahnhoefe">')).toBeGreaterThan(src.indexOf('<p id="ort-gewaehlt">'));
      expect(p).toContain("gilt nicht nur für die Startseite, sondern für jede Seite mit der Ortsleiste, auch für die Bahnhofsübersicht");
      expect(p).toContain(CLAUSE.de);
      expect(p).toContain("die oben beschriebene Ausnahme nach einem Klick auf „Meinen Standort verwenden“ gilt dort nicht".replace(/^d/u, "D"));
      // the kept sentences, unchanged in the section
      expect(sec).toContain("Die Seite rundet die Position noch auf Ihrem Gerät auf ein Gebiet von etwa 500 Metern; um die passenden Karten zu laden, wird an unseren Server nur ein solches gerundetes Gebiet übertragen.");
      expect(sec).toContain("Die IP-Adresse wird dafür nur im Arbeitsspeicher verwendet und für diesen Zweck weder gespeichert noch protokolliert noch weitergegeben");
      expect(sec).toContain("Sendet Ihr Browser das Signal „Global Privacy Control“ (Sec-GPC: 1) oder „Do Not Track“ (DNT: 1), unterbleibt die Ortsbestimmung aus der IP-Adresse ganz.");
    });
  });

  it("credits DB-IP with its prescribed words and CC BY 4.0, on the page and beside the lookup", () => {
    for (const where of [sec, flat(read("packages/web/src/components/PlaceBlock.astro"))]) {
      expect(where).toContain("IP Geolocation by DB-IP");
      expect(where).toContain("CC BY 4.0");
    }
    expect(src).toContain('href="https://db-ip.com"');
  });

  it("the sheet says, before the choice, what the browser remembers and when — in every language (v2.0.10)", () => {
    expect(t("de", "place.privacy.body")).toContain("Ihr Browser merkt sich einen Ort auf diesem Gerät nur, wenn Sie ihn in der Ortsleiste wählen");
    expect(t("de", "place.privacy.body")).toContain("Nach Ihrem Standort fragt die Seite nur, wenn Sie „Meinen Standort verwenden“ wählen");
    expect(t("de", "place.privacy.body")).toContain("haben Sie ihn in Ihrem Browser bereits dauerhaft freigegeben, liest diese Seite ihn ohne Frage und speichert nichts");
    expect(t("de", "place.privacy.body")).toContain("den Straßen- oder Ortsnamen dazu leitet unser Server aus diesem Gebiet ab; er hält ihn je Gebiet höchstens eine Stunde im Arbeitsspeicher, ohne Bezug zu Ihnen, und speichert ihn nicht.");
    // the review of v2.0.10: a picked station, place or address is held the same hour (place-service.ts label cache)
    expect(t("de", "place.privacy.body")).toContain("Ebenso hält er den Namen eines hier gewählten Bahnhofs, Orts oder einer Adresse höchstens eine Stunde im Arbeitsspeicher.");
    expect(t("en", "place.privacy.body")).toContain("It keeps the name of a station, place or address chosen here in memory for at most an hour in the same way.");
    expect(t("de", "place.privacy.body")).not.toContain("ohne ihn Ihnen zuzuordnen oder zu speichern");
    // G5.11 (#890): the sheet is shown on the motorway pages too, so the notice names "this page", never the home alone.
    const home: Record<string, string> = { de: "Startseite", en: "home page", ru: "главная страница", bg: "началната страница", uk: "головна сторінка", ro: "pagina principală", tr: "ana sayfa" };
    for (const [l, w] of Object.entries(home)) expect(t(l as "de", "place.privacy.body"), l).not.toContain(w);
    expect(t("en", "place.privacy.body")).toContain("it keeps that name in memory for at most an hour per area, without any link to you, and does not store it.");
    expect(t("de", "place.privacy.body")).toContain("solange diese Seite einen gemerkten Ort verwendet, steht das unter der Ortsleiste");
    expect(t("en", "place.privacy.body")).toContain("Your browser remembers a place on this device only when you choose it in the place bar");
    expect(t("en", "place.privacy.body")).toContain("The page asks for your location only when you choose “Use my location”");
    for (const l of LIVE_LANGS) {
      const body = t(l, "place.privacy.body");
      // every language names the bar's own buttons, as that language labels them (#1112: no window any more)
      expect(body, l).toContain(t(l, "place.sheet.useLocation"));
      expect(body, l).toContain(t(l, "place.sheet.forget"));
      expect(body, l).toContain("500");
      expect(body, l).not.toMatch(/: (Er liegt|it lives|оно есть|то е само|воно є|acesta se află|yeriniz yalnızca)/u);
      // the old rule's sentence is gone
      expect(body, l).not.toContain("Was Sie hier wählen, merkt sich nur Ihr Browser");
    }
    expect(read("packages/web/src/components/PlaceBar.astro")).toContain('"place.privacy.body"');
    // #1112: the button the text names is the bar's own
    expect(read("packages/web/src/components/PlaceBar.astro")).toContain('t(lang, "place.sheet.useLocation")');
    expect(read("packages/web/src/components/LegalPrivacy.astro")).not.toMatch(/Ortsfenster|das Fenster sagt/);
  });

  // #1112, owner sign-off 2026-11-02: the wording changes only "the window" for "the place bar" — same rule, same data,
  // no new storage — in every language. Each language's word for the old window, as the note said it before 2.5.2.
  it("names the place bar, never the old window, in every language (#1112, owner 2026-11-02)", () => {
    const WINDOW: Readonly<Record<string, RegExp>> = {
      bg: /прозор/u, cs: /okn[eě]/u, da: /vindue/u, de: /Fenster/u, el: /παράθυρ/u, en: /\bwindow\b/u, es: /ventana/u, fr: /fenêtre/u, hr: /prozor/u, hu: /ablak/u, it: /finestra/u,
      lt: /\blang[eą]/u, lv: /\blog[āa]/u, nl: /venster/u, pl: /okn[ioe]/u, pt: /janela/u, ro: /fereastr/u, ru: /окн[еоа]/u, sk: /okn[eoa]/u, sr: /прозор/u, tr: /pencere/u, uk: /вікн/u,
    };
    expect(Object.keys(WINDOW).sort()).toEqual([...LIVE_LANGS].sort());
    for (const l of LIVE_LANGS) expect(t(l, "place.privacy.body"), l).not.toMatch(WINDOW[l]!);
    expect(t("de", "place.privacy.body")).toContain("Ihr Browser merkt sich einen Ort auf diesem Gerät nur, wenn Sie ihn in der Ortsleiste wählen");
    expect(sec).toContain("Ihr Browser merkt sich einen Ort nur, wenn Sie ihn in der Ortsleiste der Seite selbst wählen");
  });

  it("the line under the bar is in every language and names the remembered place, not a German word elsewhere", () => {
    expect(t("de", "place.kept")).toBe("Ihr Browser merkt sich diesen Ort");
    expect(t("en", "place.kept")).toBe("Your browser remembers this place");
    for (const l of LIVE_LANGS.filter((x) => x !== "de")) expect(t(l, "place.kept"), l).not.toMatch(/Browser merkt|Ort\b/u);
    expect(sec).toContain("Solange die Startseite einen so gemerkten Ort verwendet, steht unter der Ortsleiste „Ihr Browser merkt sich diesen Ort“ und daneben „Ort vergessen“, das ihn sofort löscht; dass dieser Hinweis gezeigt wurde, hält die Seite nirgends fest.");
    // #1153: in the header's place row, on every page
    expect(read("packages/web/src/components/PlaceBar.astro")).toContain('id="place-kept" hidden');
    // #1224 folded the island's click wiring into its one `click(el, f)` helper (an el?.addEventListener("click", f))
    expect(island).toContain('const click = (el: any, f: (e: any) => void): void => el?.addEventListener("click", f);');
    expect(island).toContain('click($("place-kept-forget"), forget);');
  });

  it("says storage arises only from a click in the place bar — and the island writes only in the bar's handlers (v2.0.10)", () => {
    expect(sec).toContain("Ihr Browser merkt sich einen Ort nur, wenn Sie ihn in der Ortsleiste der Seite selbst wählen");
    expect(sec).toContain("Ohne einen solchen Klick schreibt die Seite keinen Ort auf Ihr Gerät.");
    expect(sec).toContain("Ihre selbst getroffene Wahl unter viafrei.place und die zuletzt gewählten Orte unter viafrei.place.recent entstehen erst, wenn Sie in der Ortsleiste selbst einen Ort, „Meinen Standort verwenden“ oder „Ganz Deutschland“ wählen; die Ortsleiste sagt Ihnen vorher, dass Ihr Browser sich diese Wahl merkt. Sie sind unbedingt erforderlich, damit");
    // the island: five writes of a choice, all through remember() and all behind a click — the pick (on the home, and
    // since #863 on a place page, just before it navigates to the chosen place's page), "use my location" (fromBar),
    // "Ganz Deutschland" (both of its controls, #1113) and the place radio going back from it (#1113); since #1153 the
    // header's own pick on a page with no cards and a place page's "make this my place" button — seven, each a click;
    // since #1158 a recent or popular chip clicked in the bar, just before it opens its own page — eight; since #1171
    // "use my location" at an object, just before it opens the object's page (the click's cell, fromBar) — nine
    expect((island.match(/remember\(/g) ?? []).length).toBe(9);
    expect(island).toMatch(/if \(!fromBar \|\| acc > SPOT_ACC \|\| cfg\.spot === false\) return cells\(\);[\s\S]{0,300}remember\(at, s\.l, "browser"\);\n\s*onDone\(\);\n\s*go\(s\.h\);/u);
    expect(island).toMatch(/if \(H\) \{\n      remember\(at, label, "manual", null, k\);/u);
    expect(island).toMatch(/list\.contains\(a\)[^\n]*\{\n\s*supersede\(\);\n\s*remember\(at, name, "manual", null, k\);\n\s*go\(href\);/u);
    // #1170: the same button, while the cards are the visitor's own position, adds that area to the recent places alone
    expect(island).toMatch(/click\(mineBtn, \(\) => \{\n    const l = located\(\);\n    if \(l !== null\) \{[\s\S]{0,160}addRecent\(l, pillRaw\);[\s\S]{0,400}if \(!onPage \|\| cfg\.server\.at === null\) \{[\s\S]{0,60}remember\(cfg\.server\.at, /u);
    // and one entry is ADDED to the recent list in one place, addRecent(), called by remember() and that click alone (the
    // other two writes are the #706 month stamp and a chip's ×, which only keep or drop entries already there)
    expect((island.match(/addRecent\(/g) ?? []).length).toBe(3);
    expect((island.match(/store\.set\(RECENT,/g) ?? []).length).toBe(3);
    expect(sec).toContain("darunter das über „Meinen Standort verwenden“ gefundene Gebiet, wenn Sie es mit „Als meinen Ort merken“ dazunehmen (seine Gebietskennung, nie Ihr Standort selbst)");
    expect(island).toContain('remember(at, pillRaw || label, "manual", null, up);');
    expect(island).toMatch(/const choose = \(at: string, label: string, href: string \| null = null, k: any = null\): void => \{\n    supersede\(\);\n    if \(onPage\) \{[\s\S]*?remember\(at, label, "manual", null, k\);\n      go\(pageOf\(at, href\)\);/u);
    expect(island).toContain("if (ok && fromBar) {");
    expect(island).toContain('remember(shown ?? at, pillRaw, "browser");');
    expect(island).toContain('remember(null, "", "germany", back);');
    expect(island).toContain("else remember(b.at, b.label, b.how);");
    // remember() is the one place a choice is set (#1113); the other two are the #706 month stamps of what is kept
    expect((island.match(/store\.set\(KEY,/g) ?? []).length).toBe(3);
    expect(island).not.toMatch(/remember\([^)]*"auto"\)/);
    expect(island).toContain('if (saved !== null && saved.how === "germany") {');
  });

  it("says what a browser-found area does next visit and that blocking the location deletes it (steward L3)", () => {
    expect(sec).toContain("Das über „Meinen Standort verwenden“ gefundene Gebiet verwendet die Startseite beim nächsten Besuch, solange Ihr Browser keinen aktuellen Standort liefert; sperren Sie die Standortfreigabe für diese Seite in Ihrem Browser, löscht die Seite dieses Gebiet beim nächsten Besuch der Startseite, sofern Ihr Browser diese Sperre meldet; sonst löscht es „Ort vergessen“.");
    expect(island).toContain('if (saved !== null && saved.how === "browser" && st === "denied") {');
  });

  it("has no remember box", () => {
    expect(read("packages/web/src/components/PlaceBlock.astro")).not.toContain("place-remember");
    expect(island).not.toContain("place-remember");
    expect(sec).not.toContain("Diesen Ort merken");
    expect(sec).toContain("Einen selbst ausgewählten Ort und die Wahl „Ganz Deutschland“ ersetzt beim nächsten Besuch weder die Ortsbestimmung aus der IP-Adresse noch der Standort Ihres Browsers");
    expect(sec).toContain("damit die Seite die Einstellung, die Sie selbst vorgenommen haben, beim nächsten Besuch beibehält");
    expect(sec).toContain("Ihre Wahl unter viafrei.place bleibt, bis Sie eine andere treffen oder „Ort vergessen“ wählen");
  });

  it("names a storage period for every key it keeps, and says the old entries are deleted (Art. 13(2)(a))", () => {
    expect(sec).not.toContain("kein Ablaufdatum");
    expect(sec).toContain("höchstens aber zwölf Monate ohne Verwendung: Jeder Eintrag trägt den Monat, in dem er zuletzt verwendet wurde (ohne Tag und Uhrzeit), und beginnt die Startseite mit Ihrer Wahl, setzt sie diesen Monat auf den laufenden. Einen Eintrag, der zwölf Monate lang nicht verwendet wurde, löscht die Seite beim nächsten Besuch.");
    // #706: the period is the island's own rule
    expect(island).toContain("const KEEP_MONTHS = 12;");
    expect(island).toContain("if (expired(k)) store.del(KEY);");
    expect(island).toContain("else if (unstamped(k)) store.set(KEY, { ...k, m: thisMonth });");
    expect(sec).toContain("Zwei Einträge, die frühere Versionen der Seite ohne einen solchen Klick angelegt haben — viafrei.place.asked und einen als „automatisch“ vermerkten Eintrag unter viafrei.place —, löscht die Seite beim nächsten Besuch.");
    expect(island).toContain('if (store.get(KEY)?.how === "auto") store.del(KEY);');
    // the old § 25 reason for "asked" and the automatic entry are gone with them
    expect(sec).not.toContain("Der Eintrag viafrei.place.asked ist unbedingt erforderlich");
    expect(sec).not.toContain("Einen automatischen Eintrag unter viafrei.place legt die Seite außerdem an");
  });

  it("does not claim a 14-month limit for the GA daily totals of the standard reports (steward 2026-10-12)", () => {
    const all = flat(src);
    expect(all).not.toContain("Bei Google gilt für diese Tagessummen die Aufbewahrungsdauer der Property");
    expect(all).toContain("In den Standardberichten von Google Analytics bleiben diese Tagessummen ohne festes Ende erhalten");
  });

  it("says the page never asks by itself, reads a standing grant without asking and stores nothing, and rounds on the device to about 500 m (v2.0.10)", () => {
    expect(sec).toContain("Die Seite fragt nicht von sich aus nach Ihrem Standort. Erst wenn Sie in der Ortsleiste „Meinen Standort verwenden“ wählen, lässt sie Ihren Browser über dessen Standortfunktion (Geolocation-API) fragen");
    expect(sec).toContain("Haben Sie die Standortfreigabe für diese Seite in Ihrem Browser schon erteilt, verwendet die Startseite den Standort bei jedem Besuch, ohne zu fragen, und speichert dabei nichts auf Ihrem Gerät; ist die Freigabe gesperrt oder noch nicht entschieden, fragt die Seite nicht und verwendet einen gemerkten Ort oder die ungefähre Ortsbestimmung aus der IP-Adresse.");
    expect(sec).toContain("auf ein Gebiet von etwa 500 Metern");
    expect(sec).toContain("Auf Ihrem Gerät wird das Gebiet nur gespeichert, wenn Sie es über „Meinen Standort verwenden“ selbst angefordert haben.");
    expect(sec).not.toContain("Bei Ihrem ersten Besuch der Startseite fragt die Seite einmal");
    // …and the island: the only automatic read is on "granted", and the sheet's button is the only other caller
    expect(island).toContain('if (st === "granted" && (saved === null || saved.how !== "manual")) {');
    expect(island).toContain("locate(settle, false, saved);");
    expect(island).toContain("locate(() => undefined, true);");
    expect((island.match(/locate\(/g) ?? []).length).toBe(2);
    expect((island.match(/getCurrentPosition\(/g) ?? []).length).toBe(1);
  });

  it("says the 400 m rule for a remembered browser area — and the island applies it", () => {
    expect(sec).toContain("Haben Sie ein Gebiet über „Meinen Standort verwenden“ gemerkt (siehe „Gewählt“), kann statt des aktuellen Gebiets dieses gemerkte übertragen werden: wenn Ihr Standort höchstens 400 Meter davon entfernt liegt, wenn Ihr Browser ihn ungenauer als auf 250 Meter angibt oder er höchstens doppelt so weit davon entfernt liegt, wie Ihr Browser ihn ungenau angibt, oder wenn Ihr Browser keinen Standort liefert. Liegt Ihr Standort höchstens 400 Meter vom Gebiet der schon angezeigten Karten entfernt, wird nichts übertragen, außer ein gemerktes Gebiet ersetzt nach dieser Regel diese Karten. Ist kein Gebiet gemerkt und gibt Ihr Browser Ihren Standort ungenauer als auf 2 Kilometer an, wird er nicht verwendet und nichts übertragen.");
    expect(island).toContain("const KEEP_M = 400;");
    // the accuracy rule the sentence states (2026-10-13), and the numbers it names
    expect(island).toContain("const TRUST_M = 250;");
    expect(island).toContain("const COARSE_M = 2_000;");
    expect(island).toContain("if (keep === null && acc > COARSE_M) return fallback();");
    expect(island).toContain("if (near(shown, lat, lon) && (keep === null || keep.at === shown || acc <= TRUST_M)) {");
    expect(island).toContain("else if (keep !== null && !(acc <= TRUST_M && dist(keep.at, lat, lon) > Math.max(KEEP_M, 2 * acc))) return fallback();");
    expect(island).toContain("if (keep !== null && near(keep.at, lat, lon)) {\n            at = keep.at;");
    const nearShown = island.slice(island.indexOf("if (near(shown, lat, lon) && ("), island.indexOf("if (keep !== null && near(keep.at"));
    expect(nearShown).toContain("return;");
    expect(nearShown).not.toContain("remember(");
  });

  it("says how the server names a browser area — derived from the rounded cell, never a house number, not kept with you (v2.0.10)", () => {
    expect(sec).toContain("Aus diesem gerundeten Gebiet leitet unser Server den Namen ab, mit dem die Seite die Gegend bezeichnet: einen Bahnhof oder einen benannten Ort nahe der Mitte des Gebiets, sonst die nächste Straße, jeweils mit der Gemeinde, etwa „nahe Dachsweg, Alsdorf“, nie eine Hausnummer.");
    expect(sec).toContain("Diesen Namen hält er je Gebiet höchstens eine Stunde im Arbeitsspeicher, ohne Bezug zu Ihnen, und speichert ihn nicht; ebenso den Namen eines in der Ortsleiste gewählten Bahnhofs, Orts oder einer Adresse.");
    expect(sec).toContain("er hält den Suchtext mit den Vorschlägen dazu höchstens zehn Minuten im Arbeitsspeicher, ohne Bezug zu Ihnen, und speichert ihn nicht.");
    const label = read("packages/digest/src/queries/place-label.ts");
    expect(label).toContain("// A cell: the street only — never the number.");
    const service = read("packages/digest/src/server/place-service.ts");
    // the pinned digest's compiled service (the type argument is compiled away)
    expect(service).toContain("const labelCache = new BoundedCache((deps.resolveCacheSeconds ?? 3_600) * 1000, max, clock);");
  });

  it("says truthfully what the IP rung hands on: a point rounded to about one kilometre, the Gemeinde determined by the card service (review S2)", () => {
    expect(sec).toContain("geht nur der dabei gefundene, auf etwa einen Kilometer gerundete Punkt, und erst dieser Dienst bestimmt daraus die Gemeinde.");
    expect(sec).not.toContain("geht nur die so gefundene Gemeinde");
  });

  it("carries the 'your place stays with you' line in every live language", () => {
    const seen = new Set<string>();
    for (const l of LIVE_LANGS) {
      const line = `${t(l, "place.privacy.title")} ${t(l, "place.privacy.body")}`;
      expect(line.length, l).toBeGreaterThan(80);
      seen.add(line);
    }
    expect(seen.size).toBe(LIVE_LANGS.length);
  });
});

describe("the fuel card's on-demand prices (#564, owner 2026-10-12), pinned to the code", () => {
  const tanken = flat(src.slice(src.indexOf('<p id="ort-tanken">'), src.indexOf("<h2>6. Kontaktaufnahme per E-Mail</h2>")));
  const internal = read("packages/mcp/src/server/internal.ts");
  const fuel = read("packages/mcp/src/server/fuel.ts");
  const tuning = read("packages/ingest/src/domain/fuel/tuning.ts");
  const areaSrc = read("packages/mcp/src/presentation/fuel-area.ts");
  const refresh = read("packages/web/src/lib/fuel-refresh.ts");

  it("says only station ids reach Tankerkönig for a price ask — and the one request body the shell sends carries the area key alone", () => {
    expect(tanken).toContain("Für die Preisabfrage einzelner Tankstellen übermittelt unser Server an Tankerkönig allein die Kennungen der Tankstellen.");
    expect(tanken).toContain("Ihre IP-Adresse oder eine sonstige Angabe zu Ihrer Person erreicht Tankerkönig in keinem dieser Fälle");
    expect(tanken).not.toContain("nie das Gebiet, der Ort");
    // the area key, and at most the flag that it is answered as its Gemeinde — nothing of the visitor's
    // (#775 W3: or the flag that the point is a motorway page's public anchor)
    expect(refresh).toContain("body: JSON.stringify(o.snap === true ? { at, snap: true } : o.anchor === true ? { at, anchor: true } : { at }),");
    // the provider request takes ids: the site door hands the port a point and a radius, and the port asks about the due STATIONS
    // (and names its door on the run row, never the area)
    // (#712: the queued entry's ids — re-read for the cache window just before it is sent)
    expect(fuel).toMatch(/await refresh\(db, left, \{ door: job\.door, \.\.\.\(fallback === undefined \? \{\} : \{ fallback \}\) \}\)/);
  });

  it("says what the site discovery sends (data-steward ruling 2026-10-12): the Gemeinde centroid and 5 km, under three held stations, once per area in five minutes", () => {
    expect(tanken).toContain("Kennen wir im Umkreis von fünf Kilometern um den gezeigten Ort weniger als drei Tankstellen");
    // the gap trigger (05880a35) and the day's place memory (#703 E4), said where the trigger is
    expect(tanken).toContain("oder verzeichnet OpenStreetMap um den Mittelpunkt der Gemeinde nähere Tankstellen in Deutschland als die uns bekannten");
    // steward 2026-10-12, T2 (b): the re-ask age said truthfully — a failed ask or a restart forgets sooner, and what is kept.
    // #712: 30 days by default (`fuel.rediscover_days`), never under one day.
    expect(tanken).toContain("dieselbe Gemeinde fragt er danach 30 Tage lang nicht erneut ab (ein von uns einstellbarer Wert, nie unter einem Tag; nach einer gescheiterten Abfrage oder einem Neustart unseres Servers auch früher) und behält dafür so lange nur den Mittelpunkt der Gemeinde im Arbeitsspeicher");
    expect(tanken).not.toContain("höchstens einmal in 24 Stunden");
    expect(internal).toContain("fuelGapAt(db, site, SITE_DISCOVER_RADIUS_KM");
    expect(fuel).toContain("export const DISCOVER_REASK_MS = FUEL_TUNING_DEFAULTS.rediscoverDays * DAY_MS;");
    expect(tuning).toContain('{ key: "fuel.rediscover_days", field: "rediscoverDays", default: 30, min: 1,');
    expect(areaSrc).toContain("export const GAP_REASK_MS = 24 * 60 * 60 * 1000;");
    expect(tanken).toContain("übermittelt werden dafür allein der Mittelpunkt der nächstgelegenen Gemeinde und ein Suchradius von fünf Kilometern");
    expect(tanken).toContain("nie Ihr Standort, das auf etwa 500 Meter gerundete Gebiet oder der aus Ihrer IP-Adresse gefundene Punkt");
    expect(internal).toContain("export const SITE_DISCOVER_RADIUS_KM = 5;");
    expect(internal).toContain("export const SITE_DISCOVER_BELOW = 3;");
    expect(internal).toContain('fuel.discover({ lat: centre.lat, lon: centre.lon, radiusKm: SITE_DISCOVER_RADIUS_KM }, "site", fallback)');
    // The page states no hourly number (#703 E8), and since #781 there is none to state: the per-door
    // ceilings are gone and the one limit is the key's one request a minute, which the page names.
    expect(fuel).not.toMatch(/export const MAX_(SITE_)?(DISCOVER|REFRESH)_PER_(HOUR|DAY)\b|export const MAX_PER_HOUR\b/);
    expect(fuel).toContain("export const KEY_REQUESTS_PER_HOUR = HOUR_S / (PROVIDER_LIMITS.tankerkoenig.minIntervalMs / 1000);");
    expect(tanken).not.toMatch(/(pro|in der|je) Stunde/);
    // "höchstens einmal in fünf Minuten" for the same area
    expect(fuel).toContain("export const RECENT_CELL_TTL_MS = 5 * 60 * 1000;");
    // the live-queries section names the site's discovery too, and the tool's gap trigger and day memory
    expect(flat(src)).toContain("die Suche nach dessen Tankstellen um den Mittelpunkt der Gemeinde");
    expect(flat(src)).toContain("weniger als drei Tankstellen oder nicht die nächstgelegenen kennen");
    expect(flat(src)).toContain("oder verzeichnet OpenStreetMap dort nähere Tankstellen in Deutschland als die uns bekannten");
    // steward 2026-10-12, T1 and T3
    expect(flat(src)).toContain("oder verzeichnet OpenStreetMap dort nähere Tankstellen in Deutschland als die uns bekannten");
    expect(flat(src)).toContain("den Suchradius an Tankerkönig. Ein so abgefragtes Gebiet fragt unser Server danach 30 Tage lang nicht erneut ab (ein von uns einstellbarer Wert, nie unter einem Tag; nach einer gescheiterten Abfrage oder einem Neustart unseres Servers auch früher); dafür behält er eine auf etwa fünf Kilometer gerundete Kennung dieses Ortes so lange und eine auf etwa 100 Meter gerundete 24 Stunden lang im Arbeitsspeicher, ohne Bezug zum Fragenden, und speichert oder protokolliert sie nicht.");
  });

  it("states the guards the MCP port enforces: ten, the 30-minute cache (never under five), once per area in five minutes", () => {
    expect(tanken).toContain("höchstens zehn Tankstellen je Abfrage, nur solche, deren Preis älter als 30 Minuten ist (ein von uns einstellbarer Wert, nie unter fünf Minuten), und für dasselbe Gebiet höchstens einmal in fünf Minuten");
    expect(fuel).toContain("export const REFRESH_FRESH_S = FUEL_CACHE_FRESH_S;");
    expect(tuning).toContain("export const FUEL_CACHE_FRESH_S = 1_800;");
    expect(tuning).toContain('{ key: "fuel.cache_fresh_s", field: "cacheFreshS", default: FUEL_CACHE_FRESH_S, min: FUEL_STATION_FLOOR_S,');
    expect(tuning).toContain("export const FUEL_STATION_FLOOR_S = 300;");
    expect(fuel).toContain("export const RECENT_CELL_TTL_MS = 5 * 60 * 1000;");
    expect(fuel).toContain("export const CELL_DEGREES = 0.05;");
    // #712, the queue (steward 2026-10-15): held while the ask waits its turn, then at most five minutes
    expect(tanken).toContain("dieser behält von Ihrem Gebiet nur eine auf etwa fünf Kilometer gerundete Kennung im Arbeitsspeicher, solange die Abfrage in seiner Warteschlange auf ihre Reihe wartet, und danach höchstens fünf Minuten");
    expect(tanken).toContain("ein Eintrag enthält nur Tankstellen-Kennungen oder den Mittelpunkt der Gemeinde (auf einer Autobahnseite den festen Punkt des Abschnitts) und diese Gebietskennung, keine Angabe zu Ihnen, und ein Neustart unseres Servers leert sie.");
    expect(tanken).not.toContain("Kennung höchstens fünf Minuten im Arbeitsspeicher");
    expect(tanken).toContain("Auf einer Autobahnseite fragt unser Server erst, wenn Sie dort die Kraftstoffpreise aufrufen");
    expect(flat(src)).toContain("Diese Abfragen bei Tankerkönig stellt unser Server — für die Werkzeuge wie für die Website — nacheinander über eine Warteschlange");
    // …and "höchstens fünf Minuten" holds in a quiet hour too: each area forgets itself on a timer (review of #564)
    expect(fuel).toContain("forget(RECENT_CELL_TTL_MS, () => {");
    expect(fuel).toContain("forget(t + ttl - now(), () => {");
  });

  it("#775 W13: says the wide refresh — the public point and 25 km, held up to the 30-minute window — pinned to the code", () => {
    const wide = read("packages/mcp/src/server/fuel.ts");
    const tk = read("packages/ingest/src/clients/tankerkoenig.ts");
    const live = flat(src.slice(src.indexOf('<h3 id="live-abfragen">'), src.indexOf('<p id="ort-tanken">')));
    // the site: the Gemeinde centroid or the motorway anchor (W3), and only that point with 25 km
    expect(tanken).toContain("im Umkreis von 25 Kilometern um den Mittelpunkt der nächstgelegenen Gemeinde (auf einer Autobahnseite um den unten beschriebenen festen Punkt des Abschnitts)");
    expect(tanken).toContain("übermittelt werden dafür allein dieser öffentlich bekannte Punkt und der Suchradius von 25 Kilometern.");
    expect(internal).toContain("const centre = isAnchor ? p : await siteOf();");
    // the tool: the ~5 km cell's centre, never the asked point
    expect(live).toContain("im Umkreis von 25 Kilometern um den Mittelpunkt des auf etwa fünf Kilometer gerundeten Gebiets, in dem der abgefragte Ort liegt — nie um den Ort selbst");
    expect(wide).toContain('const centre = place.door === "tool" ? cellCentre(place.lat, place.lon) : place.centre;');
    expect(wide).toContain("export const CELL_DEGREES = 0.05;");
    expect(tk).toContain("export const MAX_RADIUS_KM = FUEL_LIST_RADIUS_MAX_KM;");
    expect(tuning).toContain("export const FUEL_LIST_RADIUS_MAX_KM = 25;");
    // held up to the cache window (W5) — the record's own timer is the window
    expect(tanken).toContain("Diesen Punkt behält unser Server danach bis zu 30 Minuten (die Dauer des Preisfensters) im Arbeitsspeicher");
    expect(live).toContain("Diesen Mittelpunkt behält er danach bis zu 30 Minuten (die Dauer des Preisfensters) im Arbeitsspeicher");
    expect(wide).toContain("forget(t + tn2.cacheFreshS * 1000 - now(), () => {");
    expect(tuning).toContain("export const FUEL_CACHE_FRESH_S = 1_800;");
    // the narrow path stays, past the day's limit or when switched off (W6, W8, W11)
    expect(tanken).toContain("ist die Tagesgrenze an so abgefragten Tankstellen erreicht oder diese Abfrageart abgeschaltet, fragt er wie zuvor beschrieben nach einzelnen Tankstellen");
    expect(tanken).not.toContain("in keinem der beiden Fälle");
  });

  it("says the area is not logged — and the internal route logs no area", () => {
    expect(tanken).toContain("speichert oder protokolliert sie nicht");
    expect(internal).toContain("The area key is not logged");
    expect(internal).not.toMatch(/log\.[a-z]+\(\{[^}]*\bat\b/);
  });

  it("says crawlers trigger nothing — and the shell's trigger refuses a crawler", () => {
    expect(tanken).toContain("Für Suchmaschinen und andere automatische Programme wird nichts abgefragt.");
    expect(refresh).toMatch(/CRAWLER\.test\(ua\)/);
    // nor curl, a smoke test or the home's own automatic reload: only a person's navigation or a same-origin fetch
    expect(refresh).toContain('h.get("sec-fetch-mode") !== "navigate" || h.get("sec-fetch-dest") !== "document"');
    expect(refresh).toContain('return h.get("sec-fetch-site") === "same-origin" && h.get("sec-fetch-dest") === "empty" && FETCH_MODES.has(h.get("sec-fetch-mode") ?? "");');
    expect(refresh).toContain("return !isAutoReload(req.url);");
  });

  it("the live-queries section points to it", () => {
    expect(all(src, "a[href=\"#ort-tanken\"]").map(nodeText)).toContain("Aktuelle Preise für Ihren Ort");
  });
});

describe("the place cards' live answers in the privacy notice (#745, data-steward C7)", () => {
  const chosen = flat(src.slice(src.indexOf('<p id="ort-gewaehlt">'), src.indexOf("</p>", src.indexOf('<p id="ort-gewaehlt">'))));

  it("says what is asked, where, and how long it is held — the steward's sentence, verbatim", () => {
    expect(chosen).toContain(
      "Für die Live-Antworten einer Ortskarte fragt unser Server seine eigenen Werkzeuge nach dem Mittelpunkt der Gemeinde; die Antworten hält er je Gemeinde höchstens 15 Minuten im Arbeitsspeicher, ohne Bezug zu Ihnen, und speichert oder protokolliert sie nicht.",
    );
  });

  it("and the 15 minutes are the MCP process's own TTL, and its sweep's", () => {
    const engine = read("packages/mcp/src/server/site-examples.ts");
    expect(engine).toContain("export const LOCAL_TTL_MS = 15 * 60_000;");
    // An entry is dropped one sweep before it would pass 15 minutes, so none is held longer (site-examples.test.ts pins every phase).
    // the pinned mcp's compiled module puts the `break` on a line of its own
    expect(engine).toMatch(/if \(now\(\) - h\.at < LOCAL_TTL_MS - LOCAL_SWEEP_MS\)\s+break;\s+held\.delete\(ags\);/u);
  });
});
