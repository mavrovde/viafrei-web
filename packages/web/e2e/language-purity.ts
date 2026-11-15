/**
 * The owner's rule for #449 (2026-10-05): "All translated pages must contain
 * text only in the language being used, everywhere." This file is the CHECK,
 * shared by `language.e2e.ts` (against the built shell) and by anyone pointing
 * a browser at a deployed site.
 *
 * What it reads: every text node of the body, the document title, the meta
 * description, and every `aria-label`, `title` and `alt` — the words a
 * reader or a screen reader meets.
 *
 * What it exempts, each for a stated reason:
 * - `[translate="no"]` — proper names a publisher wrote (junctions, sections),
 *   which a page names and does not translate. NOT a free pass: each such
 *   name is still checked for German road vocabulary and the German junction
 *   abbreviations (`NAME_WORDS`), so a sentence cannot hide as a name;
 * - `[lang="de"]` — but ONLY when that element's whole text is licence text
 *   the register fixes verbatim (credit lines, the MTS-K note). Any other
 *   element whose `lang` differs from the page's is itself a finding. (Not a
 *   `data-verbatim` attribute: the tile fragment contract forbids `data-*` on
 *   a tile, and `lang="de"` is already what every verbatim line carries.)
 * - `[lang="de"].pcard__official` inside a DWD warning card — the place page's
 *   weather card (`#pcard-warnings`) and, since the motorway page prints the
 *   place card's warning row (owner 2026-11-02), its weather card
 *   (`#mwk-weather`) — the DWD's official German text, shown on a translated
 *   page as the binding original beside our labelled translation: the owner's
 *   one exception to "one language per page", for DWD warnings only (#937,
 *   2026-10-23);
 * - a postal address (`.pcard__addr`, marked translate="no") is not checked for
 *   road vocabulary: it is the street as the register writes it ("Raststätte
 *   Garbsen Nord" is a street), which a reader must find on a sign, and it is
 *   still not the page's copy;
 * - `a[hreflang]` and the menu's badge — the language menu, where each
 *   language is named in its own words and marked with its own `lang`
 *   ("Deutsch", "Türkçe"), and the closed menu shows the ISO badge ("RU");
 * - e-mail addresses and URLs inside a text, which are addresses, not words;
 * - `code`, `pre`, `script`, `style` — identifiers and addresses, not prose;
 * - `NAMES[lang]` — names that language itself writes in the German form
 *   (Köln in Romanian and Turkish), per language, never global;
 * - `LATIN_OK[lang]` — for the Cyrillic languages, the Latin-script words a
 *   page in that language legitimately carries: brands, product and protocol
 *   names and the client UI labels it quotes (multi-word names whole, in
 *   `LATIN_PHRASES`); unit symbols and road or line numbers are neutral.
 *
 * What it flags: German-only letters (ß everywhere; ä/ö/ü where the language
 * does not write them), a stop list of common German words, the German
 * opening quotation mark „ where the language does not use it, and — in
 * Russian, Ukrainian and Bulgarian — any Latin-script word not on that
 * language's allow-list (a German place name left in Latin script: "в Köln").
 */

export type Finding = { readonly where: string; readonly text: string; readonly why: string };

/** Languages whose own orthography opens a quotation with „ (#753 adds the Central European and Baltic ones, Serbian and Danish). */
const LOW_QUOTE_LANGS = new Set(["de", "bg", "ro", "pl", "cs", "sk", "hu", "lt", "lv", "hr", "sr", "da"]);

/** Languages written in another script than Latin — Cyrillic, and Greek since #753: a Latin word there is a finding unless it is on `LATIN_OK`. */
const CYRILLIC_LANGS = new Set(["ru", "uk", "bg", "sr", "el"]);

/** The page's `lang` attribute where it is not the route code (#764 pt-PT, #766 sr-Cyrl; `locales.ts` `htmlLang`). */
export const HTML_LANG: Readonly<Record<string, string>> = { pt: "pt-PT", sr: "sr-Cyrl" };

/** The German letters each language writes itself: Turkish and Hungarian ö and ü, Slovak ä, Spanish ü ("antigüedad"), Dutch ö ("coördinaten") (#753). */
const OWN_UMLAUTS: Readonly<Record<string, string>> = { tr: "öüÖÜ", hu: "öüÖÜ", sk: "äÄ", es: "üÜ", nl: "öÖ" };

/** Words of the German stop list that are ordinary words of another language: Dutch "die", Danish "der" and "mit" (my), Portuguese "das", Hungarian "mit" (what) (#753). */
const OWN_STOP: Readonly<Record<string, readonly string[]>> = { nl: ["die"], da: ["der", "mit"], pt: ["das"], hu: ["mit"] };

/**
 * The names the News entries, the examples and the motorway pages carry that have no exonym in the
 * Latin-script languages of #753 — written as Germany writes them (#753).
 */
const GERMAN_FORM: readonly string[] = [
  "Baden-Württemberg", "Würzburg", "Hauptwache", "Görlitz", "Münster", "Tübingen", "Eimsbüttel", "Saarbrücken", "Rüsselsheim",
  "Gröpelingen", "Römer", "Verkehrs- und Tiefbauamt", "Lichtenauer Straße", "Mannheim Hbf", "Jahnstraße", "Göttingen", "Osnabrück",
  "Straßen.NRW", "Völkerschlachtdenkmal", "Dortmund Hauptbahnhof", "Kölner Verkehrs-Betriebe AG",
  // 2.5.4 (#1040): the speed-camera entry names Düsseldorf, which these languages write as Germany does
  "Düsseldorf",
];

/** What Dutch and Danish also write as Germany does: München, Thüringen, and the agencies by their own names (#753). */
const GERMAN_FORM_NORTH: readonly string[] = [
  "Münchner Verkehrs- und Tarifverbund", "Bundesanstalt für Straßen- und Verkehrswesen", "Bundesamt für Logistik und Mobilität", "München", "Thüringen", "Düsseldorf",
];

/** Names each language writes in their German form, so their umlauts are that language's spelling. */
export const NAMES: Readonly<Record<string, readonly string[]>> = {
  // 2.0.0 (#588): the News page's questions name Tübingen and Hamburg-Eimsbüttel, which both languages write as Germany does
  // 2.0.2 (#43): the BAB messages entry asks about Saarbrücken, which both languages write as Germany does
  // 2.1.2: the city-traffic entry names Rüsselsheim, which English writes as Germany does
  // 2.2 News entries: the places, stops, stations and publishers they name as Germany writes them (Leipzig's
  // "Verkehrs- und Tiefbauamt" is the office's own name; "Mannheim Hbf" and "Dortmund Hauptbahnhof" the stations' own)
  en: ["Baden-Württemberg", "Würzburg", "Hauptwache", "Elbphilharmonie", "Görlitz", "Münster", "Tübingen", "Hamburg-Eimsbüttel", "Saarbrücken", "Rüsselsheim",
    "Bremen-Gröpelingen", "Römer", "Verkehrs- und Tiefbauamt", "Lichtenauer Straße", "Mannheim Hbf", "Ottobrunn, Jahnstraße", "Göttingen", "Osnabrück", "Straßen.NRW", "Völkerschlachtdenkmal", "Dortmund Hauptbahnhof", "Düsseldorf"],
  // 2.1.2: the city-traffic entry names Rüsselsheim (am Main), which Romanian writes as Germany does
  // 2.2 News entries: as for English above
  ro: ["Baden-Württemberg", "Köln", "München", "Nürnberg", "Würzburg", "Hauptwache", "Görlitz", "Münster", "Tübingen", "Hamburg-Eimsbüttel", "Saarbrücken", "Rüsselsheim",
    "Bremen-Gröpelingen", "Römer", "Lichtenauer Straße", "Mannheim Hbf", "Ottobrunn, Jahnstraße", "Göttingen", "Osnabrück", "Straßen.NRW", "Völkerschlachtdenkmal", "Düsseldorf"],
  // 2.2 News entries: as for English above (Turkish writes ö and ü itself)
  tr: ["Baden-Württemberg", "Köln", "Nürnberg", "Würzburg", "Hauptwache", "Thüringen", "Münih", "Lichtenauer Straße", "Mannheim Hbf", "Ottobrunn, Jahnstraße", "Straßen.NRW", "Dortmund Hauptbahnhof"],
  // #753: the fifteen. Each Latin-script language writes these places, stops, publishers and offices as Germany
  // does (GERMAN_FORM), plus its own: French and Italian say "Länder" for the German states, as their press does
  fr: [...GERMAN_FORM, "Länder"],
  es: [...GERMAN_FORM],
  it: [...GERMAN_FORM, "Länder"],
  pt: [...GERMAN_FORM],
  // Dutch and Danish keep the German names of Munich's and Thuringia's and the federal agencies' (#753)
  nl: [...GERMAN_FORM, ...GERMAN_FORM_NORTH],
  da: [...GERMAN_FORM, ...GERMAN_FORM_NORTH, "Köln", "Nürnberg"], // Danish writes Köln and Nürnberg as Germany does
  // Polish, Czech and Slovak decline the German names ("Würzburgiem", "v Münsteru", "Bádensko-Württembersko"),
  // so the match is the German stem, which the inflected form still begins with (#753)
  pl: [...GERMAN_FORM, "Württember"],
  cs: [...GERMAN_FORM, "Württember"],
  sk: [...GERMAN_FORM, "Württember"],
  hu: [...GERMAN_FORM], // Hungarian writes ö and ü itself; ä and ß only inside the German names
  // Lithuanian and Latvian adapt the cities (Miunchenas, Ķelne) but keep the stops and publishers in their own names (#759, #768)
  lt: ["Lichtenauer Straße", "Jahnstraße", "Straßen.NRW", "Stadtwerke Münster"],
  lv: ["Lichtenauer Straße", "Jahnstraße", "Straßen.NRW", "Stadtwerke Münster"],
  // 2.2 News entries: the publishers and the monument named in Latin script, as they write themselves
  ru: ["Stadtwerke Münster", "Straßen.NRW", "Völkerschlachtdenkmal"],
  uk: ["Stadtwerke Münster", "Straßen.NRW", "Völkerschlachtdenkmal"],
  bg: ["Stadtwerke Münster", "Straßen.NRW", "Völkerschlachtdenkmal"],
  sr: ["Stadtwerke Münster", "Straßen.NRW", "Völkerschlachtdenkmal"], // #766: as for Russian above
  // 2.3.21 News entry (#902): Greek names the publisher in Latin script, as Russian above does
  el: ["Straßen.NRW"],
  // #765: Croatian writes the German cities as Germany does, and forms its adjectives from them ("kölnskoj katedrali", "münchenskom")
  hr: [...GERMAN_FORM, ...GERMAN_FORM_NORTH, "Köln", "Nürnberg", "köln", "münchen"],
};

/**
 * Latin-script NAMES of several words a Cyrillic page may carry (organisations
 * and products as they are registered). Removed from the text whole before it
 * is split into words, so none of their single words has to be allowed alone.
 */
export const LATIN_PHRASES: readonly string[] = [
  // 2.5.4 (#1040): the speed-camera entry cites the statute by its own German citation, as a court or the press does
  "Abs. 1c StVO",
  // #1042: the station page names DB's waiting room by its product name, as the operator signs it
  "DB Lounge",
  "Deutsche Bahn", "Autobahn GmbH des Bundes", "Autobahn GmbH", "DELFI e.V.", "Add custom connector",
  // #1003: the connect page's new step blocks quote each client's own UI, as the Claude steps above quote "Add custom
  // connector": VS Code's command, Le Chat's buttons, GitHub's firewall settings, Copilot's sandbox header, Windsurf's file
  "MCP: Add Server", "+ Add Connector", "Custom MCP Connector", "Internet access", "Custom allowlist", "x-ms-block-by: sandbox-broker", "mcp_config.json", "mcp.viafrei.de",
  // #1090: the Claude and ChatGPT UIs' current labels, quoted as the steps above quote theirs
  "Add custom MCP server", "I understand and want to continue", "Create as a plugin",
  // #1090 (2.4.9): the four connected clients' terminal transcripts are described by the commands typed and the tool
  // that checked them, quoted as the client steps quote their UIs ("claude mcp add", like "MCP: Add Server" above), and
  // Copilot's steps name its scope choice and the file it writes by their own names (like "mcp_config.json" above)
  "claude mcp add", "claude mcp list", "gemini mcp add --scope user", "gemini mcp list", "npx -y viafrei", "Claude Code", "MCP Inspector",
  "Copilot Global", "~/.copilot/mcp-config.json",
  // v1.8.3 (C3): the licence our adaptation of a share-alike source is under, by its own name
  "CC BY-SA 4.0",
  // 1.9 (#535): the home and connect privacy lines name the one third-party measurement by its product name
  "Google Analytics",
  // 2.1.x: the transit card's licence line names the two DELFI data products by their own names
  "DELFI GTFS-RT", "DELFI SIRI ET",
  // 2.1.0/2.1.3 News entries: operators named by their brands, which they write in Latin script everywhere
  "H2 Mobility", "EWE Go",
  // 2.2 News entries: the publishers named by their own names, which they write in Latin script
  "Landesmeldestelle Berlin", "Verkehrsmanagementzentrale Bremen", "VMZ Bremen", "Kommunalservice Jena", "TechnologieRegion Karlsruhe", "NRW.Mobidrom",
  // and the park-and-ride sign's own words, as the operators print them
  "Park & Ride", "Park&Ride",
  // #766: Serbian is the first Cyrillic page to carry the German connect answers (rule 16 of #753): the Land's data portal by its own name
  "MobiData BW",
  // 2.3.21 News entries (#837): Hesse's road authority by its own name, which it writes in Latin script
  "Hessen Mobil",
  // #1020: the connect page's search description names the assistants by their product names
  "Gemini CLI", "Le Chat",
  // 2.6.16 News entry's example question: the Berlin coach station by its own name
  "Berlin ZOB",
  // 2.4.3 News entries and the motorway SID block (#707, #904): the operator, its service and the truck stop by their own names
  "Toll Collect GmbH", "Toll Collect", "Stellplatz-Informationsdienst", "Autohof Thiersheim",
  // #1106: the connect page's phone section names Microsoft's product by its own name (the capture's alt text names
  // the publisher's full name, "Autobahn GmbH des Bundes", above)
  "Copilot Studio",
  // 2.5.10 (#992's developers page): the quickstart tab of the editor and the stdio command by their own names, and the
  // Greek and Serbian example question names Berlin's street as the Thiersheim question names the town
  "VS Code", "npx viafrei", "Unter den Linden",
  // 2.5.23 (#1183): the live map's rail layer names the network operator by its own name, and its delay layer the
  // licence family of the DELFI data it draws (the full name, "CC BY-SA 4.0", is above)
  "DB InfraGO", "CC BY-SA",
];

/**
 * Latin-script words a Cyrillic page may carry: brands, protocols, quoted
 * client UI, units. Case-sensitive. Every entry must be USED on a checked page
 * — `language.e2e.ts` asserts it, so the list cannot keep a word nothing needs.
 */
export const LATIN_COMMON: readonly string[] = [
  // 2.6.16 News entry and its example question: FlixBus and FlixTrain by their brands, which they write in Latin script
  "FlixBus", "FlixTrain",
  // #1042: the station page's facility list says Wi-Fi, the term printed on the station's own signs in every language
  "Wi-Fi",
  // #1106: the connect page's phone section names the two phone systems, the vendors and the assistants by their own
  // names, as #1003 names Copilot and Cursor below; #1118: the charging blocks lead a power band with its class's name
  "Android", "iPhone", "Anthropic", "Mistral", "Perplexity", "Gemini", "Microsoft", "AC", "HPC",
  // #1112: the position bar's hint names the key by the label printed on it
  "Enter",
  "ViaFrei", "viafrei", "MCP", "Streamable", "HTTP", "SSE", "Claude", "claude.ai", "ChatGPT", "Connectors", "Create", "tools/list",
  "API", "npm", "npmjs.com/package/viafrei", "stdio", "GitHub", "Apache-2.0", "OpenStreetMap", "e-mail", "SMS", "DWD",
  "mcp.json", "verb_noun", "Europe/Berlin", "UTC", "SDK", "Smithery", "Glama", "Supercharger",
  // #1003: the assistants the connect steps name in their sentences (the note's line of names is translate="no"),
  // the buttons and panels of their UIs, the plan names Le Chat's rule refers to, and URL as the field is called
  "Copilot", "Cascade", "MCPs", "Connect", "Free", "Pro", "URL",
  // #1020: the connect description's assistant list (the two-word names are LATIN_PHRASES)
  "Cursor",
  // #746: the train category the home's restored station question names, as Deutsche Bahn writes it everywhere
  "ICE",
  // 2.5.4 (#746 re-ask): the charging example names the fast-charging plug by its standard's name, as AC and HPC above
  "CCS",
  // v1.8.2: the federal agency the tiles name as the source of a Land or a city (BKG), like DWD above
  "BKG",
  // v1.9.15: the name of Hamburg's roadworks register (#490), which the city
  // itself writes in Latin script, the way DWD and BKG are named above
  "Bauweiser",
  // 2.0.0: the feed format the News page offers by its own name (#588), like HTTP and SSE above, and
  // "IP" as in "IP-адрес", the place sheet's privacy line (#564)
  "Atom", "IP",
  // 2.4.3 (#707): the parking service by its acronym, like DWD and BKG above, and the site by its domain in the SID news
  "SID", "viafrei.de",
  // and the Greek News question names the town by its own name, as the motorway pages' junctions do (#904)
  "Thiersheim",
  // and the SID block's no-script note names what the click needs by its product name
  "JavaScript",
  // 2.0.2 (#43): the News entry names the federal agency BASt by its own acronym, like DWD and BKG above,
  // and the TMC location list by the protocol's name, like HTTP
  "BASt", "TMC",
  // 2.0.x (#693): the nearby-places card states the § 4.6 offer under the licence's own short name, like "CC BY-SA 4.0" above,
  // and the Bulgarian place cards ask the visitor's "AI асистент" by the acronym Bulgarian uses, like "API" above;
  // the offer names the copy's file format, CSV, by its own name (steward condition, #693 review)
  "ODbL", "AI", "CSV",
  // 2.1.0: the national access point by its own name, and the charge-point operators' brands the News entry
  // lists, which they write in Latin script in every market (like Supercharger above)
  "Mobilithek", "LichtBlick", "Qwello", "Wirelane", "chargecloud", "vaylens",
  // 2.2 News entries: the transport associations and the lorry-route databases by their own acronyms, like BASt, and
  // the P+R sign
  "P+R", "MVV", "NVBW", "VBN", "VRN", "VRR", "SEVAS", "ivm",
  // #766: the Serbian connect answers name the station identifier and the municipality key by their acronyms (DHID, AGS),
  // Baden-Württemberg's roadworks system (BEMaS), the roaming platform by its domain, and DELFI by its own name
  "DHID", "AGS", "BEMaS", "e-clearing.net", "DELFI",
  // 2.3.21 News entry (#941): NRW's traffic information centre by its own acronym, like BASt above
  "VIZ.NRW",
  // #1090 (owner 2026-10-28): the Claude and ChatGPT steps quote their UIs' current buttons and fields, and the ChatGPT
  // availability line names the plans by OpenAI's own names
  "Customize", "Continue", "Add", "Plugins", "Connection", "Business", "Enterprise/Edu", "Plus",
  // #1090 (2.4.9): Copilot's scope choice as its UI labels it, and the status the CLIs print beside a server ("✔ Connected")
  "Global", "Connected",
  // 2.5.4 News entry (#603): Trier's municipal utility by its own acronym, like MVV and VRR above
  "SWT",
  // 2.5.10 (#992's developers page): the copy button names the command it copies, the error list names the protocol and
  // the method a client re-opens with, the quickstart tabs two clients by their product names, and the Greek and Serbian
  // example question Leipzig's square by its own name, like Thiersheim above
  "curl", "JSON-RPC", "initialize", "Windsurf", "Codex", "Augustusplatz",
  // 2.5.23 News entry (VBB station entrances): Berlin-Brandenburg's transport association and Deutsche Bahn by their own
  // acronyms, like MVV and ICE above, and the Greek text names the U-Bahn station by its own name, like Thiersheim
  "VBB", "DB", "Hermannplatz",
];

/** International unit symbols, as on road signs and timetables (#235): neutral, and data-dependent, so not under the usage assertion. */
const UNITS = new Set(["s", "min", "h", "d", "m", "cm", "km", "kW", "km/h", "kWh"]); // km/h and kWh since #766, cm since #1042 (a platform's height): SI symbols, like kW
const LATIN_OK: Readonly<Record<string, ReadonlySet<string>>> = {
  ru: new Set(LATIN_COMMON),
  uk: new Set(LATIN_COMMON),
  bg: new Set(LATIN_COMMON),
  sr: new Set(LATIN_COMMON),
  el: new Set(LATIN_COMMON),
};

/** A road, line or route number, or a figure with a unit: language-neutral. */
const NEUTRAL_TOKEN = /^(?:[A-Z]{1,2}\d{1,4}[a-z]?|v?\d[\d.,:]*[A-Za-z%]{0,3}|[A-Z])$/u;

/** Common German words — function words and the road vocabulary of the feeds. Whole words, case-sensitive. */
const STOP =
  /(?<![\p{L}\p{N}])(?:der|die|das|und|nach|aus|Richtung|Gleis|ab|bis|frei|Stand|von|zwischen|mit|für|nicht|ist|gibt|seit|heute|Uhr|Sperrung|Vollsperrung|Baustelle|Anschlussstelle|Hauptbahnhof|Hbf|Fahrbahn|Erneuerung|Unfall|Stau|Fahrstreifen|Impressum|Datenschutz)(?![\p{L}\p{N}])/u;

/** What a publisher's NAME may not contain: German road vocabulary and the junction abbreviations, which a translated row must say in its language. */
const NAME_WORDS =
  /(?<![\p{L}\p{N}])(?:AS|AK|AD|gesperrt|Sperrung|Vollsperrung|Teilsperrung|Stau|Baustelle|Ende|Beginn|Parkplatz|Rastplatz|Rastanlage|Raststätte|Rasthof|Ausfahrt|Auffahrt|Abfahrt|Einfahrt|Zufahrt|Fahrstreifen|Fahrbahn|Höhe|Anschlussstelle|Unfall|Richtung|aus|nach|von|bis|und|zw)(?![\p{L}\p{N}])/iu;

export type PageText = {
  readonly pageLang: string;
  readonly texts: readonly { where: string; text: string }[];
  /** The text of every `[translate="no"]` element. */
  readonly names: readonly string[];
  /** Every element (outside the language menu) whose `lang` differs from the page's. */
  readonly otherLang: readonly { lang: string; text: string }[];
};

/**
 * Runs IN the page (`page.evaluate(COLLECT_JS)`) and returns a `PageText`. A
 * string, not a function, so no transpiler helper is serialised into the
 * browser.
 */
export const COLLECT_JS = String.raw`(() => {
  const texts = [];
  const pageLang = document.documentElement.lang;
  const skip = 'script,style,code,pre,a[hreflang],.langmenu__summary > [aria-hidden="true"]';
  // a name is untranslated by the NEAREST translate attribute, as HTML decides it: a translate="yes" child of a
  // translate="no" element (the stretch picker's blank option, 2.4.1) is the page's own copy and judged as such
  const named = (el) => { const t = el.closest("[translate]"); return t !== null && t.getAttribute("translate") === "no"; };
  // text inside an element marked with ANOTHER language is judged as otherLang below, not as copy
  // the BASE language is compared, so lang="sr" inside an sr-Cyrl page (a fragment marking text back in the page's language) is the page's own (#753)
  const base = (l) => (l || "").split("-")[0];
  const foreign = (el) => { const m = el.closest("[lang]"); return m !== null && m !== document.documentElement && base(m.getAttribute("lang")) !== base(pageLang); };
  const squash = (s) => (s || "").replace(/\s+/g, " ").trim();
  const label = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className.trim() !== "" ? "." + el.className.trim().split(" ")[0] : "";
    return el.tagName.toLowerCase() + id + cls;
  };
  texts.push({ where: "title", text: document.title });
  const desc = document.querySelector('meta[name="description"]');
  if (desc && desc.getAttribute("content")) texts.push({ where: "meta description", text: desc.getAttribute("content") });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const el = n.parentElement;
    if (el === null) continue;
    if (el.closest(skip) !== null || named(el) || foreign(el)) continue;
    // with scripting on, a <noscript>'s markup is ONE raw text node: parse it and judge the words a no-script reader sees
    let raw = n.textContent;
    if (el.closest("noscript") !== null) { const t = document.createElement("template"); t.innerHTML = raw || ""; raw = t.content.textContent; }
    const text = squash(raw);
    if (text !== "") texts.push({ where: label(el), text });
  }
  for (const el of Array.from(document.body.querySelectorAll("[aria-label],[title],[alt]"))) {
    if (el.closest(skip) !== null || named(el) || foreign(el)) continue;
    for (const a of ["aria-label", "title", "alt"]) {
      const v = el.getAttribute(a);
      if (v) texts.push({ where: label(el) + "@" + a, text: v });
    }
  }
  // each name element's text without the children set back to translate="yes" (judged above as the page's copy)
  // a postal address is the street the register writes, so its words are not judged as road vocabulary (owner
  // 2026-11-02: a motorway charging site prints the place card's block, address included)
  // 2.5.10: code is machine text (a tool's name, its JSON schema, a config file — English by the protocol, #992's
  // developers page), never a publisher's name, so the English "as" of a schema description is not the junction AS
  const names = Array.from(document.body.querySelectorAll('[translate="no"]')).filter((e) => e.closest(".pcard__addr") === null && e.closest("code, pre") === null).map((e) => {
    const c = e.cloneNode(true);
    for (const d of Array.from(c.querySelectorAll('[translate="yes"]'))) d.remove();
    return squash(c.textContent);
  });
  const otherLang = Array.from(document.body.querySelectorAll("[lang]"))
    .filter((e) => base(e.getAttribute("lang")) !== base(pageLang) && e.closest("a[hreflang]") === null)
    // #937, the owner's documented exception (2026-10-23): a DWD warning's official German text on a
    // translated page, labelled as the binding original beside our translation — on a DWD warning card only: the place page's and,
    // since the motorway page prints the place card's warning row (owner 2026-11-02), the motorway's.
    .filter((e) => !(base(e.getAttribute("lang")) === "de" && e.classList.contains("pcard__official") && e.closest("#pcard-warnings, #mwk-weather") !== null))
    // A child marked BACK in the page's language (the "licence text" link beside a
    // German credit line) is the page's own copy: the walker above judges it as
    // such, so it is taken out of the German-marked element's text here.
    .map((e) => {
      const c = e.cloneNode(true);
      for (const d of Array.from(c.querySelectorAll("[lang]"))) if (base(d.getAttribute("lang")) === base(pageLang)) d.remove();
      return { lang: e.getAttribute("lang"), text: squash(c.textContent) };
    });
  return { pageLang, texts, names, otherLang };
})()`;

/**
 * Judges one page's text for one language. `verbatim` is every licence string a
 * page may print in German; `used`, when given, collects the allow-list
 * entries (`LATIN_COMMON`, `LATIN_PHRASES`) this page actually needed.
 */
export function judge(lang: string, page: PageText, verbatim: readonly string[], used?: Set<string>): Finding[] {
  if (lang === "de") return [];
  const findings: Finding[] = [];
  const own = OWN_UMLAUTS[lang] ?? "";
  const umlaut = new RegExp(`[${[..."äöüÄÖÜ"].filter((c) => !own.includes(c)).join("")}ß]`, "u");
  const ownStop = OWN_STOP[lang] ?? [];
  const norm = (s: string): string => s.replace(/\s+/g, " ").trim();
  const names = NAMES[lang] ?? [];
  const latinOk = LATIN_OK[lang];
  const licence = verbatim
    .map(norm)
    .filter((s) => s !== "")
    .sort((a, b) => b.length - a.length);
  if (page.pageLang !== (HTML_LANG[lang] ?? lang)) findings.push({ where: "html", text: page.pageLang, why: `the page says it is "${page.pageLang}"` });
  for (const { where, text } of page.texts) {
    let rest = text;
    for (const name of names) rest = rest.split(name).join(" ");
    if (umlaut.test(rest)) findings.push({ where, text, why: "a German letter" });
    const stop = new RegExp(STOP.source, "gu");
    for (let m = stop.exec(rest); m !== null; m = stop.exec(rest)) {
      if (ownStop.includes(m[0])) continue;
      findings.push({ where, text, why: `the German word "${m[0]}"` });
      break;
    }
    if (!LOW_QUOTE_LANGS.has(lang) && rest.includes("„")) findings.push({ where, text, why: "the German quotation mark „" });
    if (CYRILLIC_LANGS.has(lang) && latinOk !== undefined) {
      // addresses go first: a phrase inside a URL (mcp.viafrei.de) would otherwise cut it into Latin fragments (#1090's alt text)
      let latin = rest.replace(/\S+@\S+|https?:\/\/\S+/gu, " ");
      for (const phrase of LATIN_PHRASES) {
        if (latin.includes(phrase)) used?.add(phrase);
        latin = latin.split(phrase).join(" ");
      }
      const words = latin.replace(/\S+@\S+|https?:\/\/\S+|°C/gu, " ").replace(/(?<![\p{L}\p{N}])[A-Z]{1,2} ?\d{1,4}(?![\p{L}\p{N}])/gu, " ");
      // Latin letters: À-ÿ without × (U+00D7) and ÷ (U+00F7), which are signs, not letters ("1 × Зарядка" counts marks)
      for (const raw of words.match(/[A-Za-zÀ-ÖØ-öø-ÿ][\w.+/\-À-ÖØ-öø-ÿ]*/gu) ?? []) {
        const token = raw.replace(/[.\-/]+$/u, "");
        if (latinOk.has(token)) used?.add(token);
        else if (!UNITS.has(token) && !NEUTRAL_TOKEN.test(token)) findings.push({ where, text, why: `the Latin-script word "${token}"` });
      }
    }
  }
  for (const name of page.names) {
    const w = NAME_WORDS.exec(name);
    // #1051: a publisher's name as its own register line writes it ("Freie und Hansestadt Hamburg", the freshness sign's
    // source list) is that line's text, which is accepted verbatim — a sentence still cannot hide as a name
    if (w !== null && name.length > 3 && verbatim.some((v) => norm(v).includes(norm(name)))) continue;
    if (w !== null) findings.push({ where: '[translate="no"]', text: name, why: `German "${w[0]}" inside a name` });
  }
  for (const { lang: other, text } of page.otherLang) {
    if (other.split("-")[0] !== "de") {
      findings.push({ where: `[lang="${other}"]`, text, why: `an element in "${other}" on a "${lang}" page` });
      continue;
    }
    let rest = norm(text);
    for (const l of licence) rest = rest.split(l).join(" ");
    if (rest.replace(/[\s.,;:·—–-]+/gu, "") !== "") findings.push({ where: '[lang="de"]', text, why: "German-marked text that is not licence text" });
  }
  return findings;
}
