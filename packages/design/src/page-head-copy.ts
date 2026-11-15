/**
 * The words of the page head (`page-head.ts`, #1173), one key set in all 22 languages, so an empty, a stale and a failed
 * read say the same on every page type and a title leads with the same words everywhere. Machine translated (owner
 * 2026-10-15). A leaf table: the design package knows no catalogue, and the digest and the web shell both read this one.
 */
export const PAGE_HEAD_LANGS = ["de", "en", "bg", "cs", "da", "el", "es", "fr", "hr", "hu", "it", "lt", "lv", "nl", "pl", "pt", "ro", "ru", "sk", "sr", "tr", "uk"] as const;
export type PageHeadLang = (typeof PAGE_HEAD_LANGS)[number];

export type PageHeadCopy = {
  /** The lamp's name for a screen reader. */
  readonly lamp: { readonly red: string; readonly amber: string; readonly green: string; readonly unknown: string };
  /** Nothing reported: the read happened and found nothing. */
  readonly nothing: string;
  /** The read is too old to say: never good. */
  readonly stale: string;
  /** The read failed: never good. */
  readonly error: string;
  /** The top items' list, for a screen reader. */
  readonly top: string;
  /** The jump links' navigation, for a screen reader. */
  readonly jumps: string;
  /** One item's word. */
  readonly what: { readonly closure: string; readonly jam: string; readonly disruption: string; readonly roadworks: string; readonly info: string };
  /** What a title leads with: what is happening now. */
  readonly now: { readonly closure: string; readonly jam: string; readonly disruption: string; readonly roadworks: string; readonly nothing: string };
  /** The map section's short word. */
  readonly map: string;
  /** A folded list's way in: `{x}` the counted noun ("38 Baustellen"). */
  readonly showCounted: string;
  /** A collapsed section's way to the rest: `{n}` the whole count. */
  readonly showAll: string;
  readonly since: string;
  readonly until: string;
  /** FS3 (data-steward FS-2026-11-06): a folded card's or tile's visible sources line, `{list}` every publisher. */
  readonly sources: string;
};

export const PAGE_HEAD_COPY: Readonly<Record<PageHeadLang, PageHeadCopy>> = {
  de: { lamp: { red: "Rot", amber: "Gelb", green: "Grün", unknown: "Unbekannt" }, nothing: "Derzeit nichts gemeldet", stale: "Stand veraltet, aktuelle Lage unbekannt", error: "Lage derzeit unbekannt", top: "Das Wichtigste jetzt", jumps: "Auf dieser Seite", what: { closure: "Sperrung", jam: "Stau", disruption: "Störung", roadworks: "Baustelle", info: "Hinweis" }, now: { closure: "Sperrung heute", jam: "Stau aktuell", disruption: "Störung aktuell", roadworks: "Baustellen aktuell", nothing: "nichts gemeldet" }, map: "Karte", showCounted: "{x} anzeigen", showAll: "alle {n} anzeigen", since: "seit {t}", until: "bis {t}", sources: "Quellen: {list}" },
  en: { lamp: { red: "Red", amber: "Amber", green: "Green", unknown: "Unknown" }, nothing: "Nothing reported at the moment", stale: "Data out of date, current situation unknown", error: "Situation currently unknown", top: "What matters now", jumps: "On this page", what: { closure: "Closure", jam: "Jam", disruption: "Disruption", roadworks: "Roadworks", info: "Notice" }, now: { closure: "closure today", jam: "traffic jam now", disruption: "disruption now", roadworks: "roadworks now", nothing: "nothing reported" }, map: "Map", showCounted: "show {x}", showAll: "show all {n}", since: "since {t}", until: "until {t}", sources: "Sources: {list}" },
  bg: { lamp: { red: "Червено", amber: "Жълто", green: "Зелено", unknown: "Неизвестно" }, nothing: "Засега няма съобщения", stale: "Данните са остарели, текущото положение е неизвестно", error: "Положението в момента е неизвестно", top: "Най-важното сега", jumps: "На тази страница", what: { closure: "Затваряне", jam: "Задръстване", disruption: "Смущение", roadworks: "Ремонт", info: "Известие" }, now: { closure: "затваряне днес", jam: "задръстване сега", disruption: "смущение сега", roadworks: "ремонти сега", nothing: "няма съобщения" }, map: "Карта", showCounted: "покажи {x}", showAll: "покажи всички {n}", since: "от {t}", until: "до {t}", sources: "Източници: {list}" },
  cs: { lamp: { red: "Červená", amber: "Žlutá", green: "Zelená", unknown: "Neznámo" }, nothing: "Momentálně nic nehlášeno", stale: "Údaje jsou zastaralé, aktuální stav neznámý", error: "Stav je momentálně neznámý", top: "Nejdůležitější teď", jumps: "Na této stránce", what: { closure: "Uzavírka", jam: "Kolona", disruption: "Porucha", roadworks: "Práce na silnici", info: "Upozornění" }, now: { closure: "uzavírka dnes", jam: "kolona teď", disruption: "porucha teď", roadworks: "práce na silnici teď", nothing: "nic nehlášeno" }, map: "Mapa", showCounted: "zobrazit {x}", showAll: "zobrazit všech {n}", since: "od {t}", until: "do {t}", sources: "Zdroje: {list}" },
  da: { lamp: { red: "Rød", amber: "Gul", green: "Grøn", unknown: "Ukendt" }, nothing: "Intet meldt lige nu", stale: "Data er forældede, aktuel situation ukendt", error: "Situationen er ukendt lige nu", top: "Det vigtigste nu", jumps: "På denne side", what: { closure: "Spærring", jam: "Kø", disruption: "Forstyrrelse", roadworks: "Vejarbejde", info: "Bemærkning" }, now: { closure: "spærring i dag", jam: "kø lige nu", disruption: "forstyrrelse nu", roadworks: "vejarbejde nu", nothing: "intet meldt" }, map: "Kort", showCounted: "vis {x}", showAll: "vis alle {n}", since: "siden {t}", until: "til {t}", sources: "Kilder: {list}" },
  el: { lamp: { red: "Κόκκινο", amber: "Κίτρινο", green: "Πράσινο", unknown: "Άγνωστο" }, nothing: "Δεν έχει αναφερθεί κάτι αυτή τη στιγμή", stale: "Παλιά στοιχεία, η τρέχουσα κατάσταση είναι άγνωστη", error: "Η κατάσταση είναι προς το παρόν άγνωστη", top: "Τα σημαντικότερα τώρα", jumps: "Σε αυτή τη σελίδα", what: { closure: "Κλείσιμο", jam: "Μποτιλιάρισμα", disruption: "Διαταραχή", roadworks: "Έργα", info: "Ειδοποίηση" }, now: { closure: "κλείσιμο σήμερα", jam: "μποτιλιάρισμα τώρα", disruption: "διαταραχή τώρα", roadworks: "έργα τώρα", nothing: "καμία αναφορά" }, map: "Χάρτης", showCounted: "εμφάνιση: {x}", showAll: "εμφάνιση όλων ({n})", since: "από {t}", until: "έως {t}", sources: "Πηγές: {list}" },
  es: { lamp: { red: "Rojo", amber: "Ámbar", green: "Verde", unknown: "Desconocido" }, nothing: "Nada notificado por ahora", stale: "Datos antiguos, situación actual desconocida", error: "Situación desconocida por ahora", top: "Lo importante ahora", jumps: "En esta página", what: { closure: "Corte", jam: "Atasco", disruption: "Incidencia", roadworks: "Obras", info: "Aviso" }, now: { closure: "corte hoy", jam: "atasco ahora", disruption: "incidencia ahora", roadworks: "obras ahora", nothing: "nada notificado" }, map: "Mapa", showCounted: "ver {x}", showAll: "ver los {n}", since: "desde {t}", until: "hasta {t}", sources: "Fuentes: {list}" },
  fr: { lamp: { red: "Rouge", amber: "Orange", green: "Vert", unknown: "Inconnu" }, nothing: "Rien de signalé pour le moment", stale: "Données anciennes, situation actuelle inconnue", error: "Situation inconnue pour le moment", top: "L'essentiel maintenant", jumps: "Sur cette page", what: { closure: "Fermeture", jam: "Bouchon", disruption: "Perturbation", roadworks: "Travaux", info: "Avis" }, now: { closure: "fermeture aujourd'hui", jam: "bouchon en cours", disruption: "perturbation en cours", roadworks: "travaux en cours", nothing: "rien de signalé" }, map: "Carte", showCounted: "afficher {x}", showAll: "afficher les {n}", since: "depuis {t}", until: "jusqu'à {t}", sources: "Sources : {list}" },
  hr: { lamp: { red: "Crveno", amber: "Žuto", green: "Zeleno", unknown: "Nepoznato" }, nothing: "Trenutačno ništa nije prijavljeno", stale: "Podaci su zastarjeli, trenutačno stanje nepoznato", error: "Stanje je trenutačno nepoznato", top: "Najvažnije sada", jumps: "Na ovoj stranici", what: { closure: "Zatvaranje", jam: "Gužva", disruption: "Smetnja", roadworks: "Radovi", info: "Napomena" }, now: { closure: "zatvaranje danas", jam: "gužva sada", disruption: "smetnja sada", roadworks: "radovi sada", nothing: "ništa prijavljeno" }, map: "Karta", showCounted: "prikaži {x}", showAll: "prikaži svih {n}", since: "od {t}", until: "do {t}", sources: "Izvori: {list}" },
  hu: { lamp: { red: "Piros", amber: "Sárga", green: "Zöld", unknown: "Ismeretlen" }, nothing: "Jelenleg nincs bejelentés", stale: "Elavult adatok, a jelenlegi helyzet ismeretlen", error: "A helyzet jelenleg ismeretlen", top: "A legfontosabb most", jumps: "Ezen az oldalon", what: { closure: "Lezárás", jam: "Torlódás", disruption: "Zavar", roadworks: "Útépítés", info: "Megjegyzés" }, now: { closure: "lezárás ma", jam: "torlódás most", disruption: "zavar most", roadworks: "útépítés most", nothing: "nincs bejelentés" }, map: "Térkép", showCounted: "mutat: {x}", showAll: "mind a(z) {n} mutatása", since: "ettől: {t}", until: "eddig: {t}", sources: "Források: {list}" },
  it: { lamp: { red: "Rosso", amber: "Giallo", green: "Verde", unknown: "Sconosciuto" }, nothing: "Nessuna segnalazione al momento", stale: "Dati non aggiornati, situazione attuale sconosciuta", error: "Situazione al momento sconosciuta", top: "Le cose più importanti ora", jumps: "In questa pagina", what: { closure: "Chiusura", jam: "Coda", disruption: "Disservizio", roadworks: "Lavori", info: "Avviso" }, now: { closure: "chiusura oggi", jam: "coda adesso", disruption: "disservizio adesso", roadworks: "lavori adesso", nothing: "nessuna segnalazione" }, map: "Mappa", showCounted: "mostra {x}", showAll: "mostra tutti i {n}", since: "dalle {t}", until: "fino a {t}", sources: "Fonti: {list}" },
  lt: { lamp: { red: "Raudona", amber: "Geltona", green: "Žalia", unknown: "Nežinoma" }, nothing: "Šiuo metu pranešimų nėra", stale: "Duomenys pasenę, dabartinė padėtis nežinoma", error: "Padėtis šiuo metu nežinoma", top: "Svarbiausia dabar", jumps: "Šiame puslapyje", what: { closure: "Uždarymas", jam: "Spūstis", disruption: "Sutrikimas", roadworks: "Kelio darbai", info: "Pastaba" }, now: { closure: "uždarymas šiandien", jam: "spūstis dabar", disruption: "sutrikimas dabar", roadworks: "kelio darbai dabar", nothing: "pranešimų nėra" }, map: "Žemėlapis", showCounted: "rodyti: {x}", showAll: "rodyti visus {n}", since: "nuo {t}", until: "iki {t}", sources: "Šaltiniai: {list}" },
  lv: { lamp: { red: "Sarkans", amber: "Dzeltens", green: "Zaļš", unknown: "Nezināms" }, nothing: "Pašlaik nekas nav ziņots", stale: "Dati ir novecojuši, pašreizējā situācija nav zināma", error: "Situācija pašlaik nav zināma", top: "Svarīgākais tagad", jumps: "Šajā lapā", what: { closure: "Slēgšana", jam: "Sastrēgums", disruption: "Traucējums", roadworks: "Ceļa darbi", info: "Piezīme" }, now: { closure: "slēgšana šodien", jam: "sastrēgums tagad", disruption: "traucējums tagad", roadworks: "ceļa darbi tagad", nothing: "nekas nav ziņots" }, map: "Karte", showCounted: "rādīt: {x}", showAll: "rādīt visus {n}", since: "no {t}", until: "līdz {t}", sources: "Avoti: {list}" },
  nl: { lamp: { red: "Rood", amber: "Geel", green: "Groen", unknown: "Onbekend" }, nothing: "Op dit moment niets gemeld", stale: "Gegevens verouderd, huidige situatie onbekend", error: "Situatie op dit moment onbekend", top: "Het belangrijkste nu", jumps: "Op deze pagina", what: { closure: "Afsluiting", jam: "File", disruption: "Storing", roadworks: "Wegwerkzaamheden", info: "Melding" }, now: { closure: "afsluiting vandaag", jam: "file nu", disruption: "storing nu", roadworks: "werkzaamheden nu", nothing: "niets gemeld" }, map: "Kaart", showCounted: "{x} tonen", showAll: "alle {n} tonen", since: "sinds {t}", until: "tot {t}", sources: "Bronnen: {list}" },
  pl: { lamp: { red: "Czerwone", amber: "Żółte", green: "Zielone", unknown: "Nieznane" }, nothing: "Obecnie brak zgłoszeń", stale: "Dane nieaktualne, obecna sytuacja nieznana", error: "Sytuacja obecnie nieznana", top: "Najważniejsze teraz", jumps: "Na tej stronie", what: { closure: "Zamknięcie", jam: "Korek", disruption: "Zakłócenie", roadworks: "Roboty drogowe", info: "Uwaga" }, now: { closure: "zamknięcie dziś", jam: "korek teraz", disruption: "zakłócenie teraz", roadworks: "roboty drogowe teraz", nothing: "brak zgłoszeń" }, map: "Mapa", showCounted: "pokaż: {x}", showAll: "pokaż wszystkie {n}", since: "od {t}", until: "do {t}", sources: "Źródła: {list}" },
  pt: { lamp: { red: "Vermelho", amber: "Âmbar", green: "Verde", unknown: "Desconhecido" }, nothing: "Nada comunicado de momento", stale: "Dados antigos, situação atual desconhecida", error: "Situação de momento desconhecida", top: "O mais importante agora", jumps: "Nesta página", what: { closure: "Corte", jam: "Fila", disruption: "Perturbação", roadworks: "Obras", info: "Aviso" }, now: { closure: "corte hoje", jam: "fila agora", disruption: "perturbação agora", roadworks: "obras agora", nothing: "nada comunicado" }, map: "Mapa", showCounted: "mostrar {x}", showAll: "mostrar os {n}", since: "desde {t}", until: "até {t}", sources: "Fontes: {list}" },
  ro: { lamp: { red: "Roșu", amber: "Galben", green: "Verde", unknown: "Necunoscut" }, nothing: "Momentan nu este semnalat nimic", stale: "Date vechi, situația actuală necunoscută", error: "Situație momentan necunoscută", top: "Cel mai important acum", jumps: "Pe această pagină", what: { closure: "Închidere", jam: "Ambuteiaj", disruption: "Perturbare", roadworks: "Lucrări", info: "Notă" }, now: { closure: "închidere azi", jam: "ambuteiaj acum", disruption: "perturbare acum", roadworks: "lucrări acum", nothing: "nimic semnalat" }, map: "Hartă", showCounted: "arată {x}", showAll: "arată toate cele {n}", since: "din {t}", until: "până la {t}", sources: "Surse: {list}" },
  ru: { lamp: { red: "Красный", amber: "Жёлтый", green: "Зелёный", unknown: "Неизвестно" }, nothing: "Сейчас сообщений нет", stale: "Данные устарели, текущая обстановка неизвестна", error: "Обстановка сейчас неизвестна", top: "Самое важное сейчас", jumps: "На этой странице", what: { closure: "Перекрытие", jam: "Пробка", disruption: "Сбой", roadworks: "Дорожные работы", info: "Уведомление" }, now: { closure: "перекрытие сегодня", jam: "пробка сейчас", disruption: "сбой сейчас", roadworks: "дорожные работы сейчас", nothing: "сообщений нет" }, map: "Карта", showCounted: "показать: {x}", showAll: "показать все {n}", since: "с {t}", until: "до {t}", sources: "Источники: {list}" },
  sk: { lamp: { red: "Červená", amber: "Žltá", green: "Zelená", unknown: "Neznáme" }, nothing: "Momentálne nič nehlásené", stale: "Údaje sú zastarané, aktuálna situácia neznáma", error: "Situácia je momentálne neznáma", top: "Najdôležitejšie teraz", jumps: "Na tejto stránke", what: { closure: "Uzávierka", jam: "Kolóna", disruption: "Porucha", roadworks: "Práce na ceste", info: "Upozornenie" }, now: { closure: "uzávierka dnes", jam: "kolóna teraz", disruption: "porucha teraz", roadworks: "práce na ceste teraz", nothing: "nič nehlásené" }, map: "Mapa", showCounted: "zobraziť {x}", showAll: "zobraziť všetkých {n}", since: "od {t}", until: "do {t}", sources: "Zdroje: {list}" },
  sr: { lamp: { red: "Црвено", amber: "Жуто", green: "Зелено", unknown: "Непознато" }, nothing: "Тренутно ништа није пријављено", stale: "Подаци су застарели, тренутно стање непознато", error: "Стање је тренутно непознато", top: "Најважније сада", jumps: "На овој страници", what: { closure: "Затварање", jam: "Гужва", disruption: "Сметња", roadworks: "Радови", info: "Напомена" }, now: { closure: "затварање данас", jam: "гужва сада", disruption: "сметња сада", roadworks: "радови сада", nothing: "ништа пријављено" }, map: "Мапа", showCounted: "прикажи: {x}", showAll: "прикажи свих {n}", since: "од {t}", until: "до {t}", sources: "Извори: {list}" },
  tr: { lamp: { red: "Kırmızı", amber: "Sarı", green: "Yeşil", unknown: "Bilinmiyor" }, nothing: "Şu anda bildirim yok", stale: "Veriler eski, güncel durum bilinmiyor", error: "Durum şu anda bilinmiyor", top: "Şu an en önemlisi", jumps: "Bu sayfada", what: { closure: "Kapanma", jam: "Trafik sıkışıklığı", disruption: "Aksaklık", roadworks: "Yol çalışması", info: "Not" }, now: { closure: "bugün kapalı", jam: "şu an sıkışık", disruption: "şu an aksaklık", roadworks: "şu an yol çalışması", nothing: "bildirim yok" }, map: "Harita", showCounted: "{x} göster", showAll: "{n} kaydın tümünü göster", since: "{t} itibarıyla", until: "{t} tarihine kadar", sources: "Kaynaklar: {list}" },
  uk: { lamp: { red: "Червоний", amber: "Жовтий", green: "Зелений", unknown: "Невідомо" }, nothing: "Наразі повідомлень немає", stale: "Дані застаріли, поточна ситуація невідома", error: "Ситуація наразі невідома", top: "Найважливіше зараз", jumps: "На цій сторінці", what: { closure: "Перекриття", jam: "Затор", disruption: "Збій", roadworks: "Дорожні роботи", info: "Сповіщення" }, now: { closure: "перекриття сьогодні", jam: "затор зараз", disruption: "збій зараз", roadworks: "дорожні роботи зараз", nothing: "повідомлень немає" }, map: "Мапа", showCounted: "показати: {x}", showAll: "показати всі {n}", since: "з {t}", until: "до {t}", sources: "Джерела: {list}" },
};

/** A title's limit: what the snippet shows whole. */
export const NOW_TITLE_MAX = 60;
/** A description's limit. */
export const NOW_DESCRIPTION_MAX = 155;

/** What is happening now: the kind a title leads with, or none reported. */
export type NowKind = "closure" | "jam" | "disruption" | "roadworks" | "nothing";

const BRAND = " – ViaFrei";

/**
 * `<Name>: <what now> – ViaFrei`, the one title rule of a live page. A title that would run over the limit loses the brand
 * first and is never cut inside the words that say what is happening.
 */
export function nowTitle(lang: PageHeadLang, name: string, kind: NowKind): string {
  const body = `${name}: ${PAGE_HEAD_COPY[lang].now[kind]}`;
  return body.length + BRAND.length <= NOW_TITLE_MAX ? `${body}${BRAND}` : body;
}

/**
 * The status line, then the first item as far as the limit lets it: the one description rule of a live page. The first
 * item is left out rather than cut in a word.
 */
export function nowDescription(status: string, first: string | null): string {
  const a = status.trim();
  if (first === null) return a;
  const whole = `${a} ${first.trim()}`;
  return whole.length <= NOW_DESCRIPTION_MAX ? whole : a;
}
