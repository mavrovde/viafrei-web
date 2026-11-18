/**
 * THE description builder of the object pages (#1310 B2): a place, a station, a motorway, an exit (or interchange) of a
 * motorway, a road and a Land — one rule for the digest (motorway, exit, road and Land pages, whose head it writes) and
 * the web shell (place and station pages), so a search result reads the same way on every page type.
 *
 * EVERGREEN. A description says what the page OFFERS for its subject — the place or road and its Land — and never what
 * is happening there now: no clock time ("Stand 15:25"), no live count ("2 Baustellen"), no "no guarantee". Those
 * changed on every crawl, and Google rewrote such snippets or dropped the page in the ranking (#1279, #1310 § 1.7). The
 * live state stays on the page, in its visible lead.
 *
 * THE LENGTH RULE. Every description is `DESCRIPTION_MIN`–`DESCRIPTION_MAX` characters, in every language and for every
 * subject: the first of these forms that fits is taken —
 *   1. `<subject> (<Land>): <offer> – <tail>.` and 2. `<subject> (<Land>): <offer>.` (where the caller holds the Land);
 *   3. `<subject>: <offer> – <tail>.` and 4. `<subject>: <offer>.`;
 *   5. `<subject>: <offer cut at its last whole word>…` (a subject of some seventy characters).
 * The copy is written so that a two-letter subject still reaches the minimum with the long form and the tail is
 * shorter than the room between the bounds, so a form taken because the one before it overflowed is never short
 * (`test/page-description.test.ts`, subjects of 2 to 100 characters in every language). The subject is never cut, so two
 * different subjects never share a description: the catalogue's uniqueness is its subjects'.
 *
 * Machine translated (owner 2026-10-15), the safety glossary's words (`PAGE_HEAD_COPY`).
 */
import type { PageHeadLang } from "./page-head-copy.js";

export const DESCRIPTION_MIN = 120;
export const DESCRIPTION_MAX = 160;

export type DescribedKind = "place" | "station" | "motorway" | "exit" | "road" | "state";

/** What a page is about: its name, and the Land(s) it lies in, already in the page's language (null: not held). */
export type DescribedSubject =
  | { readonly kind: "place" | "station" | "road" | "state"; readonly name: string; readonly land?: string | null }
  | { readonly kind: "motorway"; readonly name: string; readonly lands?: readonly string[] }
  | { readonly kind: "exit"; readonly name: string; readonly road: string; readonly land?: string | null };

type Copy = Readonly<Record<DescribedKind, string>> & { readonly tail: string };

/**
 * Per language: what each page type offers (a phrase without a final full stop) and the tail every long form ends
 * with. A state's phrase is the Land's own (its name is the subject).
 */
export const PAGE_DESCRIPTION_COPY: Readonly<Record<PageHeadLang, Copy>> = {
  de: {
    tail: " – live aus offenen Daten, mit Quelle.",
    place: "Baustellen, Sperrungen und Stau, Unwetterwarnungen, Bahnhöfe, Ladesäulen und Parkplätze in der Umgebung",
    station: "die nächsten Abfahrten mit Gleis, Aufzüge und Fahrtreppen, Bahnsteige, Ausstattung und Umgebung",
    motorway: "Stau, Sperrungen und Baustellen je Richtung, dazu Rastplätze, Laden und Parken entlang der Strecke",
    exit: "Sperrungen, Stau und Baustellen hier und in beiden Richtungen, dazu Tanken, Laden und Parken in der Nähe",
    road: "aktuelle und geplante Baustellen, Sperrungen und Umleitungen, mit Beginn und Ende, den betroffenen Orten und Karte",
    state: "Baustellen, Sperrungen und Stau, Pünktlichkeit von Bus und Bahn, Unwetterwarnungen und die Städte, mit Karte",
  },
  en: {
    tail: " – live from open data, with sources.",
    place: "roadworks, closures and traffic jams, weather warnings, stations, charging points and parking nearby",
    station: "the next departures with platform, lifts and escalators, step-free access, facilities and surroundings",
    motorway: "jams, closures and roadworks in each direction, plus rest areas, charging and parking along the route",
    exit: "closures, jams and roadworks here and in both directions, plus fuel, charging and parking nearby",
    road: "current and planned roadworks, closures and detours, with start and end, the places they affect and a map",
    state: "roadworks, closures and jams, bus and rail punctuality, weather warnings and its cities, with a map",
  },
  bg: {
    tail: " – на живо от отворени данни, с източник.",
    place: "ремонти, затваряния и задръствания, предупреждения за времето, гари, зарядни станции и паркинги наоколо",
    station: "следващите заминавания с коловоз, асансьори и ескалатори, перони, удобства и околности на гарата",
    motorway: "задръствания, затваряния и ремонти по посоки, плюс места за почивка, зареждане и паркиране по трасето",
    exit: "затваряния, задръствания и ремонти тук и в двете посоки, плюс гориво, зареждане и паркиране наблизо",
    road: "текущи и планирани ремонти, затваряния и обходи, с начало и край, засегнатите населени места и карта",
    state: "ремонти, затваряния и задръствания, точност на автобуси и влакове, предупреждения за времето и градове",
  },
  cs: {
    tail: " – živě z otevřených dat, se zdrojem.",
    place: "práce na silnici, uzavírky a kolony, výstrahy před počasím, nádraží, nabíjecí stanice a parkování v okolí",
    station: "nejbližší odjezdy s kolejí, výtahy a eskalátory, nástupiště, vybavení a okolí stanice",
    motorway: "kolony, uzavírky a práce na silnici v obou směrech, odpočívky, nabíjení a parkování podél trasy",
    exit: "uzavírky, kolony a práce na silnici zde i v obou směrech, k tomu tankování, nabíjení a parkování poblíž",
    road: "aktuální a plánované práce na silnici, uzavírky a objížďky, se začátkem a koncem, dotčená místa a mapa",
    state: "práce na silnici, uzavírky a kolony, přesnost autobusů a vlaků, výstrahy před počasím a města, s mapou",
  },
  da: {
    tail: " – live fra åbne data, med kilde.",
    place: "vejarbejde, spærringer og kø, vejrvarsler, stationer, ladestandere og parkering i nærheden af byen",
    station: "de næste afgange med spor, elevatorer og rulletrapper, perroner, faciliteter og omgivelser",
    motorway: "kø, spærringer og vejarbejde i hver retning samt rastepladser, opladning og parkering langs ruten",
    exit: "spærringer, kø og vejarbejde her og i begge retninger samt tankning, opladning og parkering i nærheden",
    road: "aktuelle og planlagte vejarbejder, spærringer og omkørsler, med start og slut, de berørte steder og et kort",
    state: "vejarbejde, spærringer og kø, punktlighed for bus og tog, vejrvarsler og byerne i delstaten, med kort",
  },
  el: {
    tail: " – ζωντανά από ανοιχτά δεδομένα, με πηγή.",
    place: "έργα, κλεισίματα και μποτιλιαρίσματα, προειδοποιήσεις καιρού, σταθμοί, φόρτιση και στάθμευση στην περιοχή",
    station: "οι επόμενες αναχωρήσεις με αποβάθρα, ανελκυστήρες και κυλιόμενες σκάλες, παροχές και γύρω περιοχή",
    motorway: "μποτιλιαρίσματα, κλεισίματα και έργα ανά κατεύθυνση, χώροι ανάπαυσης, φόρτιση και στάθμευση στη διαδρομή",
    exit: "κλεισίματα, μποτιλιαρίσματα και έργα εδώ και στις δύο κατευθύνσεις, καύσιμα, φόρτιση και στάθμευση κοντά",
    road: "τρέχοντα και προγραμματισμένα έργα, κλεισίματα και παρακάμψεις, με αρχή και τέλος, οι περιοχές και χάρτης",
    state: "έργα, κλεισίματα και μποτιλιαρίσματα, ακρίβεια λεωφορείων και τρένων, προειδοποιήσεις καιρού και πόλεις",
  },
  es: {
    tail: " – en directo con datos abiertos y fuente.",
    place: "obras, cortes y atascos, avisos meteorológicos, estaciones, puntos de recarga y aparcamientos cercanos",
    station: "las próximas salidas con vía, ascensores y escaleras mecánicas, andenes, servicios y alrededores",
    motorway: "atascos, cortes y obras por sentido, además de áreas de descanso, recarga y aparcamiento en la ruta",
    exit: "cortes, atascos y obras aquí y en ambos sentidos, además de gasolineras, recarga y aparcamiento cerca",
    road: "obras, cortes y desvíos actuales y previstos, con su inicio y su fin, las localidades afectadas y un mapa",
    state: "obras, cortes y atascos, puntualidad de autobuses y trenes, avisos meteorológicos y sus ciudades, con mapa",
  },
  fr: {
    tail: " – en direct, données ouvertes et sources.",
    place: "travaux, fermetures et bouchons, alertes météo, gares, bornes de recharge et parkings à proximité",
    station: "les prochains départs avec voie, ascenseurs et escalators, quais, équipements et alentours de la gare",
    motorway: "bouchons, fermetures et travaux par sens, ainsi qu’aires de repos, recharge et parkings sur le trajet",
    exit: "fermetures, bouchons et travaux ici et dans les deux sens, plus carburant, recharge et parkings proches",
    road: "travaux, fermetures et déviations en cours et prévus, avec début et fin, les communes concernées et une carte",
    state: "travaux, fermetures et bouchons, ponctualité des bus et trains, alertes météo et ses villes, avec carte",
  },
  hr: {
    tail: " – uživo iz otvorenih podataka, s izvorom.",
    place: "radovi, zatvaranja i gužve, upozorenja o vremenu, kolodvori, punionice i parkirališta u blizini",
    station: "sljedeći polasci s kolosijekom, dizala i pokretne stepenice, peroni, oprema i okolica kolodvora",
    motorway: "gužve, zatvaranja i radovi po smjeru, uz odmorišta, punjenje i parkiranje duž cijele dionice",
    exit: "zatvaranja, gužve i radovi ovdje i u oba smjera, uz gorivo, punjenje i parkiranje u blizini",
    road: "aktualni i planirani radovi, zatvaranja i obilasci, s početkom i krajem, pogođena mjesta i karta",
    state: "radovi, zatvaranja i gužve, točnost autobusa i vlakova, upozorenja o vremenu i gradovi, s kartom",
  },
  hu: {
    tail: " – élőben, nyílt adatokból, forrással.",
    place: "útépítések, lezárások és torlódások, időjárási figyelmeztetések, állomások, töltők és parkolók a közelben",
    station: "a következő indulások vágánnyal, liftek és mozgólépcsők, peronok, szolgáltatások és a környék",
    motorway: "torlódások, lezárások és útépítések irányonként, pihenők, töltés és parkolás az útvonal mentén",
    exit: "lezárások, torlódások és útépítések itt és mindkét irányban, tankolás, töltés és parkolás a közelben",
    road: "aktuális és tervezett útépítések, lezárások és terelések, kezdettel és véggel, az érintett helyek és térkép",
    state: "útépítések, lezárások és torlódások, buszok és vonatok pontossága, időjárási figyelmeztetések és városok",
  },
  it: {
    tail: " – in diretta da dati aperti, con fonte.",
    place: "lavori, chiusure e code, allerte meteo, stazioni, colonnine di ricarica e parcheggi nei dintorni",
    station: "le prossime partenze con binario, ascensori e scale mobili, banchine, servizi e dintorni della stazione",
    motorway: "code, chiusure e lavori per direzione, oltre ad aree di servizio, ricarica e parcheggi lungo il percorso",
    exit: "chiusure, code e lavori qui e in entrambe le direzioni, oltre a carburante, ricarica e parcheggi vicini",
    road: "lavori, chiusure e deviazioni in corso e previsti, con inizio e fine, le località interessate e una mappa",
    state: "lavori, chiusure e code, puntualità di bus e treni, allerte meteo e le sue città, con una mappa",
  },
  lt: {
    tail: " – tiesiogiai iš atvirų duomenų.",
    place: "kelio darbai, uždarymai ir spūstys, orų įspėjimai, stotys, įkrovimo vietos ir stovėjimo aikštelės netoliese",
    station: "artimiausi išvykimai su keliu, liftai ir eskalatoriai, peronai, patogumai ir stoties apylinkės",
    motorway: "spūstys, uždarymai ir kelio darbai kiekviena kryptimi, poilsio aikštelės, įkrovimas ir stovėjimas",
    exit: "uždarymai, spūstys ir kelio darbai čia ir abiem kryptimis, kuras, įkrovimas ir stovėjimas netoliese",
    road: "esami ir planuojami kelio darbai, uždarymai ir apylankos, su pradžia ir pabaiga, paveiktos vietovės ir žemėlapis",
    state: "kelio darbai, uždarymai ir spūstys, autobusų ir traukinių punktualumas, orų įspėjimai ir miestai su žemėlapiu",
  },
  lv: {
    tail: " – tiešraidē no atvērtajiem datiem.",
    place: "ceļa darbi, slēgšanas un sastrēgumi, laikapstākļu brīdinājumi, stacijas, uzlāde un stāvvietas tuvumā",
    station: "nākamie atiešanas laiki ar sliežu ceļu, lifti un eskalatori, perons, ērtības un stacijas apkārtne",
    motorway: "sastrēgumi, slēgšanas un ceļa darbi katrā virzienā, atpūtas vietas, uzlāde un stāvvietas ceļa malā",
    exit: "slēgšanas, sastrēgumi un ceļa darbi šeit un abos virzienos, degviela, uzlāde un stāvvietas tuvumā",
    road: "pašreizējie un plānotie ceļa darbi, slēgšanas un apvedceļi, ar sākumu un beigām, skartās vietas un karte",
    state: "ceļa darbi, slēgšanas un sastrēgumi, autobusu un vilcienu precizitāte, laikapstākļu brīdinājumi un pilsētas",
  },
  nl: {
    tail: " – live uit open data, met bron.",
    place: "wegwerkzaamheden, afsluitingen en files, weerwaarschuwingen, stations, laadpalen en parkeren in de buurt",
    station: "de volgende vertrekken met spoor, liften en roltrappen, perrons, voorzieningen en de omgeving",
    motorway: "files, afsluitingen en werkzaamheden per richting, plus verzorgingsplaatsen, laden en parkeren langs de route",
    exit: "afsluitingen, files en werkzaamheden hier en in beide richtingen, plus tanken, laden en parkeren vlakbij",
    road: "huidige en geplande werkzaamheden, afsluitingen en omleidingen, met begin en einde, de plaatsen en een kaart",
    state: "werkzaamheden, afsluitingen en files, stiptheid van bus en trein, weerwaarschuwingen en de steden, met kaart",
  },
  pl: {
    tail: " – na żywo z otwartych danych, ze źródłem.",
    place: "roboty drogowe, zamknięcia i korki, ostrzeżenia pogodowe, dworce, ładowarki i parkingi w okolicy",
    station: "najbliższe odjazdy z torem, windy i schody ruchome, perony, udogodnienia i okolica dworca",
    motorway: "korki, zamknięcia i roboty drogowe w każdym kierunku, a także MOP-y, ładowanie i parkingi na trasie",
    exit: "zamknięcia, korki i roboty drogowe tutaj i w obu kierunkach, a także paliwo, ładowanie i parkingi obok",
    road: "bieżące i planowane roboty drogowe, zamknięcia i objazdy, z początkiem i końcem, miejscowości oraz mapa",
    state: "roboty drogowe, zamknięcia i korki, punktualność autobusów i pociągów, ostrzeżenia pogodowe i miasta",
  },
  pt: {
    tail: " – em direto, de dados abertos, com fonte.",
    place: "obras, cortes e filas, avisos meteorológicos, estações, pontos de carregamento e estacionamento perto",
    station: "as próximas partidas com linha, elevadores e escadas rolantes, plataformas, serviços e arredores",
    motorway: "filas, cortes e obras por sentido, além de áreas de serviço, carregamento e estacionamento no percurso",
    exit: "cortes, filas e obras aqui e nos dois sentidos, além de combustível, carregamento e estacionamento perto",
    road: "obras, cortes e desvios atuais e previstos, com início e fim, as localidades afetadas e um mapa",
    state: "obras, cortes e filas, pontualidade de autocarros e comboios, avisos meteorológicos e cidades, com mapa",
  },
  ro: {
    tail: " – live din date deschise, cu sursă.",
    place: "lucrări, închideri și ambuteiaje, avertizări meteo, gări, stații de încărcare și parcări în apropiere",
    station: "următoarele plecări cu linia, lifturi și scări rulante, peroane, facilități și împrejurimile gării",
    motorway: "ambuteiaje, închideri și lucrări pe sensuri, plus zone de odihnă, încărcare și parcare de-a lungul traseului",
    exit: "închideri, ambuteiaje și lucrări aici și în ambele sensuri, plus carburant, încărcare și parcare aproape",
    road: "lucrări, închideri și ocoliri actuale și planificate, cu început și sfârșit, localitățile afectate și o hartă",
    state: "lucrări, închideri și ambuteiaje, punctualitatea autobuzelor și trenurilor, avertizări meteo și orașe",
  },
  ru: {
    tail: " – онлайн по открытым данным.",
    place: "дорожные работы, перекрытия и пробки, погодные предупреждения, вокзалы, зарядка и парковки рядом",
    station: "ближайшие отправления с путём, лифты и эскалаторы, платформы, удобства и окрестности вокзала",
    motorway: "пробки, перекрытия и дорожные работы по направлениям, стоянки, зарядка и парковки вдоль трассы",
    exit: "перекрытия, пробки и дорожные работы здесь и в обоих направлениях, а также АЗС, зарядка и парковки",
    road: "текущие и запланированные дорожные работы, перекрытия и объезды, с началом и концом, места и карта",
    state: "дорожные работы, перекрытия и пробки, пунктуальность автобусов и поездов, погодные предупреждения",
  },
  sk: {
    tail: " – naživo z otvorených dát, so zdrojom.",
    place: "práce na ceste, uzávierky a kolóny, výstrahy pred počasím, stanice, nabíjanie a parkovanie v okolí",
    station: "najbližšie odchody s koľajou, výťahy a eskalátory, nástupištia, vybavenie a okolie stanice",
    motorway: "kolóny, uzávierky a práce na ceste v oboch smeroch, odpočívadlá, nabíjanie a parkovanie pozdĺž trasy",
    exit: "uzávierky, kolóny a práce na ceste tu aj v oboch smeroch, k tomu tankovanie, nabíjanie a parkovanie",
    road: "aktuálne a plánované práce na ceste, uzávierky a obchádzky, so začiatkom a koncom, dotknuté miesta a mapa",
    state: "práce na ceste, uzávierky a kolóny, presnosť autobusov a vlakov, výstrahy pred počasím a mestá, s mapou",
  },
  sr: {
    tail: " – уживо из отворених података.",
    place: "радови, затварања и гужве, упозорења о времену, станице, пуњачи и паркиралишта у близини места",
    station: "следећи поласци са колосеком, лифтови и покретне степенице, перони, опрема и околина станице",
    motorway: "гужве, затварања и радови по смеру, уз одморишта, пуњење и паркирање дуж целе деонице",
    exit: "затварања, гужве и радови овде и у оба смера, уз гориво, пуњење и паркирање у близини",
    road: "актуелни и планирани радови, затварања и обилазнице, са почетком и крајем, погођена места и мапа",
    state: "радови, затварања и гужве, тачност аутобуса и возова, упозорења о времену и градови, са мапом",
  },
  tr: {
    tail: " – açık verilerden canlı, kaynaklı.",
    place: "çevredeki yol çalışmaları, kapanmalar, trafik sıkışıklığı, hava uyarıları, istasyonlar, şarj ve otoparklar",
    station: "peron bilgisiyle sonraki kalkışlar, asansörler ve yürüyen merdivenler, olanaklar ve istasyon çevresi",
    motorway: "her iki yönde trafik, kapanmalar ve yol çalışmaları, güzergâh boyunca dinlenme tesisleri, şarj ve otopark",
    exit: "burada ve her iki yönde kapanmalar, trafik ve yol çalışmaları, yakınlarda yakıt, şarj ve otopark",
    road: "güncel ve planlanan yol çalışmaları, kapanmalar ve alternatif yollar, başlangıç ve bitişleri, yerler ve harita",
    state: "yol çalışmaları, kapanmalar ve trafik, otobüs ve tren dakikliği, hava uyarıları ve şehirler, haritayla",
  },
  uk: {
    tail: " – наживо з відкритих даних, з джерелом.",
    place: "дорожні роботи, перекриття й затори, попередження про погоду, вокзали, зарядні станції та паркування поруч",
    station: "найближчі відправлення з колією, ліфти й ескалатори, платформи, зручності та околиці вокзалу",
    motorway: "затори, перекриття й дорожні роботи за напрямками, а також стоянки, зарядка й паркування вздовж траси",
    exit: "перекриття, затори й дорожні роботи тут і в обох напрямках, а також пальне, зарядка й паркування поруч",
    road: "поточні й заплановані дорожні роботи, перекриття та об’їзди, з початком і кінцем, населені пункти і карта",
    state: "дорожні роботи, перекриття й затори, пунктуальність автобусів і поїздів, попередження про погоду та міста",
  },
};

const held = (s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== "";

/** The subject as the description names it, with and without its Land. */
function subjectsOf(s: DescribedSubject): { readonly withLand: string | null; readonly bare: string } {
  const name = s.name.trim();
  if (s.kind === "motorway") {
    const lands = (s.lands ?? []).filter(held).map((x) => x.trim());
    return { withLand: lands.length === 0 ? null : `${name} (${lands.join(", ")})`, bare: name };
  }
  if (s.kind === "exit") {
    const road = s.road.trim();
    return { withLand: held(s.land) ? `${name} (${road}, ${s.land.trim()})` : null, bare: `${name} (${road})` };
  }
  // a Land's page names the Land itself; a city-state's place is named once ("Berlin", never "Berlin (Berlin)")
  return { withLand: s.kind !== "state" && held(s.land) && s.land.trim() !== name ? `${name} (${s.land.trim()})` : null, bare: name };
}

/** The text cut at its last whole word within `max` characters, "…" included. */
function cutAtWord(text: string, max: number): string {
  const room = text.slice(0, max - 1);
  const at = room.lastIndexOf(" ");
  return `${trimTrailingPunctuation(at > 0 ? room.slice(0, at) : room)}…`;
}

/** The characters a cut never ends on: white space and the separators , ; : – — -. */
const TRAILING = /[\s,;:–—-]/u;

/** `text` without its trailing white space and separators: one linear pass from the end, no backtracking. */
function trimTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && TRAILING.test(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
}

/** The page's meta description: the first form of the length rule that fits (see the header). */
export function pageDescription(lang: PageHeadLang, subject: DescribedSubject): string {
  const c = PAGE_DESCRIPTION_COPY[lang];
  const offer = c[subject.kind];
  const { withLand, bare } = subjectsOf(subject);
  // French sets a no-break space before the colon, as the site's French titles do ("Bavière : autoroutes …")
  const colon = lang === "fr" ? "\u00a0: " : ": ";
  const forms = [...(withLand === null ? [] : [`${withLand}${colon}${offer}${c.tail}`, `${withLand}${colon}${offer}.`]), `${bare}${colon}${offer}${c.tail}`, `${bare}${colon}${offer}.`];
  const fit = forms.find((f) => f.length <= DESCRIPTION_MAX);
  if (fit !== undefined) return fit;
  const head = `${bare}${colon}`;
  // a subject that leaves too little room for the offer is the description alone, cut at a word
  return head.length >= DESCRIPTION_MAX - 20 ? cutAtWord(bare, DESCRIPTION_MAX) : `${head}${cutAtWord(offer, DESCRIPTION_MAX - head.length)}`;
}
