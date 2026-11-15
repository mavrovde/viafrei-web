/**
 * Shell test pins — the phrases the tests look for in each language of #753, copied from
 * that language's own strings (GENERATED with the catalogues; edit the pin with the string).
 * A registered language with no pins is a test failure, not a skip.
 */
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

export const OLD_LANGS = ["de", "en", "ru", "bg", "uk", "ro", "tr"] as const;
export type NewWebLang = Exclude<Lang, (typeof OLD_LANGS)[number]>;
export const isOldLang = (l: string): boolean => (OLD_LANGS as readonly string[]).includes(l);

export type WebPins = {
  /** The word for "current"/"currently", never on the fuel page. */
  readonly current: string;
  /** The word for "all", never the first word of the fuel link or page. */
  readonly all: string;
  readonly noWarranty: string;
  readonly unverified: string;
  readonly lands: Readonly<Record<"Niedersachsen" | "Sachsen" | "Thüringen", string>>;
  readonly kielOut: string;
  readonly kielWhy: string;
  readonly summary: string;
  readonly kvbWarranty: string;
  /** The word for a motorway's course, never in the fallback lead. */
  readonly course: string;
  /** Keys whose value is rightly the German or English word in this language. */
  readonly same?: readonly string[];
  readonly fuelTitle: string;
  readonly fuelLead: string;
};

export const WEB_PINS: Readonly<Record<string, WebPins>> = {
  "cs": {
    "current": "aktuáln",
    "all": "vš",
    "noWarranty": "bez záruky správnosti a úplnosti",
    "unverified": "neověřená",
    "lands": {
      "Niedersachsen": "Dolním Sasku",
      "Sachsen": "Sasku",
      "Thüringen": "Durynsku"
    },
    "kielOut": "uzavřen",
    "kielWhy": "kanalizace",
    "summary": "(Příklad, shrnuto; nástroj ho ukazuje celý)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG poskytuje data bez jakékoli záruky.",
    "course": "průběh",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "devPage.licence"
    ],
    "fuelTitle": "Čerpací stanice podle spolkových zemí – výběr s cenami",
    "fuelLead": "Až tři čerpací stanice v každé spolkové zemi, nejlevnější Super E10 nahoře. Vybrány ze stanic, které sledujeme – tedy ne nutně nejlevnější v dané zemi. Každá cena je uvedena s časem, kdy jsme ji zjistili. Informace pro spotřebitele, ne seznam všech čerpacích stanic."
  },
  "da": {
    "current": "aktuel",
    "all": "all",
    "noWarranty": "uden garanti for korrekthed eller fuldstændighed",
    "unverified": "ukontrollerede",
    "lands": {
      "Niedersachsen": "Niedersachsen",
      "Sachsen": "Sachsen",
      "Thüringen": "Thüringen"
    },
    "kielOut": "spærret",
    "kielWhy": "kloakarbejde",
    "summary": "(Eksempel, sammenfattet; værktøjet viser det i fuld længde)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG leverer dataene uden nogen garanti.",
    "course": "forløb",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeAi",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "devPage.releaseLine",
      "devPage.statusHeading",
      "place.motorway.radius",
      "newsPage.released",
      "bizPage.u2t"
    ],
    "fuelTitle": "Tankstationer pr. delstat – et udvalg med priser",
    "fuelLead": "Op til tre tankstationer pr. delstat, den billigste blyfri 95 E10 først. Udvalgt blandt de stationer, vi observerer – altså ikke nødvendigvis de billigste i delstaten. Hver pris vises med klokkeslættet, hvor vi observerede den. Information til forbrugere, ingen liste over hver tankstation."
  },
  "el": {
    "current": "τρέχουσ",
    "all": "όλ",
    "noWarranty": "χωρίς εγγύηση ακρίβειας και πληρότητας",
    "unverified": "δεν έχουν ελεγχθεί",
    "lands": {
      "Niedersachsen": "Κάτω Σαξονία",
      "Sachsen": "Σαξονία",
      "Thüringen": "Θουριγγία"
    },
    "kielOut": "κλειστός",
    "kielWhy": "αποχέτευσης",
    "summary": "(Παράδειγμα, συνοπτικά· το εργαλείο το δείχνει ολόκληρο)",
    "kvbWarranty": "Η Kölner Verkehrs-Betriebe AG δίνει τα δεδομένα χωρίς καμία εγγύηση.",
    "course": "χάραξ",
    "same": [],
    "fuelTitle": "Πρατήρια καυσίμων ανά κρατίδιο – μια επιλογή με τιμές",
    "fuelLead": "Έως τρία πρατήρια ανά κρατίδιο, πρώτα η φθηνότερη αμόλυβδη E10. Επιλέγονται από τα πρατήρια που παρατηρούμε – άρα όχι απαραίτητα τα φθηνότερα στο κρατίδιο. Κάθε τιμή εμφανίζεται με την ώρα που την παρατηρήσαμε. Ενημέρωση για καταναλωτές, όχι κατάλογος όλων των πρατηρίων."
  },
  "es": {
    "current": "actual",
    "all": "tod",
    "noWarranty": "ni garantía de exactitud o integridad",
    "unverified": "no están verificados",
    "lands": {
      "Niedersachsen": "Baja Sajonia",
      "Sachsen": "Sajonia",
      "Thüringen": "Turingia"
    },
    "kielOut": "cortado",
    "kielWhy": "alcantarillado",
    "summary": "(ejemplo resumido; la herramienta lo muestra completo)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG facilita los datos sin ninguna garantía.",
    "course": "trazado",
    "same": [
      "devPage.promptsHeading"
    ],
    "fuelTitle": "Gasolineras por estado federado: una selección con precios",
    "fuelLead": "Hasta tres gasolineras por estado federado, primero la más barata en Super E10. Elegidas entre las estaciones que observamos, así que no necesariamente las más baratas del estado. Cada precio se muestra con la hora en que lo observamos. Información al consumidor, no una lista de todas las gasolineras."
  },
  "fr": {
    "current": "actuel",
    "all": "tou",
    "noWarranty": "ni garantie d’exactitude ou d’exhaustivité",
    "unverified": "ne sont pas vérifiées",
    "lands": {
      "Niedersachsen": "Basse-Saxe",
      "Sachsen": "Saxe",
      "Thüringen": "Thuringe"
    },
    "kielOut": "fermé",
    "kielWhy": "assainissement",
    "summary": "(exemple résumé ; l’outil l’affiche en entier)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG fournit les données sans aucune garantie.",
    "course": "tracé",
    "same": [
      "devPage.releaseLine",
      "devPage.promptsHeading",
      "devPage.discussions",
      "newsPage.sources",
      "newsPage.released",
      "examplesPage.question",
      "ask.question"
    ],
    "fuelTitle": "Stations-service par Land – une sélection avec les prix",
    "fuelLead": "Jusqu’à trois stations-service par Land, la moins chère en Super E10 en premier. Choisies parmi les stations que nous observons – donc pas forcément les moins chères du Land. Chaque prix est affiché avec l’heure à laquelle nous l’avons observé. Information des consommateurs, pas une liste de toutes les stations-service."
  },
  "hr": {
    "current": "trenutačn",
    "all": "sv",
    "noWarranty": "bez jamstva točnosti i potpunosti",
    "unverified": "neprovjereni",
    "lands": {
      "Niedersachsen": "Donjoj Saskoj",
      "Sachsen": "Saskoj",
      "Thüringen": "Tiringiji"
    },
    "kielOut": "zatvoren",
    "kielWhy": "kanalizaciji",
    "summary": "(Primjer, sažeto; alat ga prikazuje u cijelosti)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG daje podatke bez ikakvog jamstva.",
    "course": "trasu",
    "same": [],
    "fuelTitle": "Benzinske postaje po saveznim zemljama – izbor s cijenama",
    "fuelLead": "Do tri benzinske postaje po saveznoj zemlji, najjeftiniji Super E10 prvi. Odabrane među postajama koje pratimo – dakle ne nužno najjeftinije u saveznoj zemlji. Svaka cijena stoji uz vrijeme kad smo je zabilježili. Informacija za potrošače, a ne popis svih benzinskih postaja."
  },
  "hu": {
    "current": "aktuál",
    "all": "mind",
    "noWarranty": "a helyesség és teljesség garanciája nélkül",
    "unverified": "ellenőrizetlen",
    "lands": {
      "Niedersachsen": "Alsó-Szászország",
      "Sachsen": "Szászország",
      "Thüringen": "Türingiá"
    },
    "kielOut": "le van zárva",
    "kielWhy": "csatornaépítés",
    "summary": "(Példa, összefoglalva; az eszköz teljes egészében mutatja)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG az adatokat szavatosság nélkül adja közre.",
    "course": "nyomvonal",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "connectPage.claudeAi"
    ],
    "fuelTitle": "Benzinkutak tartományonként – válogatás árakkal",
    "fuelLead": "Tartományonként legfeljebb három benzinkút, elöl a legolcsóbb Super E10. Az általunk megfigyelt kutak közül válogatva – tehát nem feltétlenül a tartomány legolcsóbbjai. Minden ár azzal az időponttal szerepel, amikor megfigyeltük. Tájékoztatás fogyasztóknak, nem az összes benzinkút listája."
  },
  "it": {
    "current": "attual",
    "all": "Tutt",
    "noWarranty": "senza garanzia di esattezza e completezza",
    "unverified": "non sono verificati",
    "lands": {
      "Niedersachsen": "Bassa Sassonia",
      "Sachsen": "Sassonia",
      "Thüringen": "Turingia"
    },
    "kielOut": "chiuso",
    "kielWhy": "fognatura",
    "summary": "(Esempio, riassunto; nello strumento è completo)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG fornisce i dati senza alcuna garanzia.",
    "course": "tracciato",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "footer.privacy",
      "consent.more",
      "connectPage.claudeAi",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors"
    ],
    "fuelTitle": "Distributori per Land – una selezione con i prezzi",
    "fuelLead": "Fino a tre distributori per Land, prima la Super E10 più economica. Scelti tra i distributori che osserviamo – quindi non necessariamente i più economici del Land. Ogni prezzo è riportato con l’ora in cui l’abbiamo rilevato. Un’informazione per i consumatori, non un elenco di tutti i distributori."
  },
  "lt": {
    "current": "dabartin",
    "all": "vis",
    "noWarranty": "be tikslumo ar išsamumo garantijos",
    "unverified": "nepatikrinti",
    "lands": {
      "Niedersachsen": "Žemutinėje Saksonijoje",
      "Sachsen": "Saksonijoje",
      "Thüringen": "Tiuringijoje"
    },
    "kielOut": "uždarytas",
    "kielWhy": "kanalizacijos",
    "summary": "(Pavyzdys, apibendrintas; įrankis jį rodo visą)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG teikia duomenis be jokios garantijos.",
    "course": "trasa",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors"
    ],
    "fuelTitle": "Degalinės pagal žemes – atranka su kainomis",
    "fuelLead": "Iki trijų degalinių kiekvienoje žemėje, pirmiausia pigiausias Super E10. Atrinkta iš mūsų stebimų degalinių – todėl nebūtinai pigiausios žemėje. Kiekviena kaina rodoma su laiku, kada ją pastebėjome. Informacija vartotojams, o ne visų degalinių sąrašas."
  },
  "lv": {
    "current": "pašreiz",
    "all": "vis",
    "noWarranty": "bez precizitātes vai pilnīguma garantijas",
    "unverified": "nav pārbaudīti",
    "lands": {
      "Niedersachsen": "Lejassaksijā",
      "Sachsen": "Saksijā",
      "Thüringen": "Tīringenē"
    },
    "kielOut": "slēgts",
    "kielWhy": "kanalizācijas",
    "summary": "(Piemērs, apkopots; rīks to rāda pilnībā)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG sniedz datus bez jebkādas garantijas.",
    "course": "trase",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "devPage.licence"
    ],
    "fuelTitle": "Degvielas uzpildes stacijas pa federālajām zemēm – izlase ar cenām",
    "fuelLead": "Līdz trim stacijām katrā federālajā zemē, vispirms lētākais Super E10. Izvēlētas no mūsu novērotajām stacijām – tāpēc ne obligāti lētākās zemē. Katra cena ir parādīta ar laiku, kad to novērojām. Informācija patērētājiem, nevis visu staciju saraksts."
  },
  "nl": {
    "current": "actue",
    "all": "all",
    "noWarranty": "zonder garantie voor juistheid of volledigheid",
    "unverified": "ongecontroleerd",
    "lands": {
      "Niedersachsen": "Nedersaksen",
      "Sachsen": "Saksen",
      "Thüringen": "Thüringen"
    },
    "kielOut": "afgesloten",
    "kielWhy": "riolering",
    "summary": "(Voorbeeld, samengevat; de tool toont het volledig)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG levert de gegevens zonder enige garantie.",
    "course": "verloop",
    "same": [
      "meta.siteName",
      "nav.brand",
      "connect.clients.chatgpt",
      "footer.privacy",
      "consent.more",
      "connectPage.claudeAi",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "devPage.toolsHeading",
      "devPage.promptsHeading",
      "devPage.statusHeading",
      "day.moments.charging.title",
      "examplesPage.domain.charging",
      "examplesPage.domain.fuel",
      "seo.crumbHome",
      "ask.tool",
      "newsPage.connect"
    ],
    "fuelTitle": "Tankstations per deelstaat – een selectie met prijzen",
    "fuelLead": "Per deelstaat tot drie tankstations, de goedkoopste Euro 95 E10 eerst. Gekozen uit de stations die we waarnemen – dus niet noodzakelijk de goedkoopste in de deelstaat. Elke prijs staat erbij met het tijdstip waarop we hem waarnamen. Informatie voor consumenten, geen lijst van elk tankstation."
  },
  "pl": {
    "current": "aktualn",
    "all": "wszyst",
    "noWarranty": "bez gwarancji poprawności i kompletności",
    "unverified": "niezweryfikowane",
    "lands": {
      "Niedersachsen": "Dolnej Saksonii",
      "Sachsen": "Saksonii",
      "Thüringen": "Turyngii"
    },
    "kielOut": "zamknięty",
    "kielWhy": "kanalizacji",
    "summary": "(Przykład, w skrócie; narzędzie pokazuje go w całości)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG udostępnia dane bez żadnej gwarancji.",
    "course": "przebieg",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "devPage.statusHeading"
    ],
    "fuelTitle": "Stacje paliw według krajów związkowych – wybór z cenami",
    "fuelLead": "Do trzech stacji paliw w każdym kraju związkowym, najpierw najtańsza benzyna Super E10. Wybrane spośród stacji, które obserwujemy – więc niekoniecznie najtańsze w danym kraju. Każda cena jest podana z godziną, o której ją zaobserwowaliśmy. Informacja dla konsumentów, a nie lista wszystkich stacji paliw."
  },
  "pt": {
    "current": "atual",
    "all": "Tod",
    "noWarranty": "sem garantia de exatidão e de exaustividade",
    "unverified": "não foram verificados",
    "lands": {
      "Niedersachsen": "Baixa Saxónia",
      "Sachsen": "Saxónia",
      "Thüringen": "Turíngia"
    },
    "kielOut": "cortado",
    "kielWhy": "saneamento",
    "summary": "(Exemplo, resumido; na ferramenta, completo)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG disponibiliza os dados sem qualquer garantia.",
    "course": "traçado",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeAi",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "devPage.promptsHeading"
    ],
    "fuelTitle": "Postos de combustível por estado federado – uma seleção com preços",
    "fuelLead": "Até três postos de combustível por estado federado, primeiro a gasolina Super E10 mais barata. Escolhidos entre os postos que observamos – por isso não necessariamente os mais baratos do estado. Cada preço é indicado com a hora a que o observámos. Informação para o consumidor, não uma lista de todos os postos de combustível."
  },
  "sk": {
    "current": "aktuáln",
    "all": "vš",
    "noWarranty": "bez záruky správnosti a úplnosti",
    "unverified": "neoverené",
    "lands": {
      "Niedersachsen": "Dolnom Sasku",
      "Sachsen": "Sasku",
      "Thüringen": "Durínsku"
    },
    "kielOut": "uzavretý",
    "kielWhy": "kanalizácie",
    "summary": "(Príklad, zhrnuté; nástroj ho ukazuje celý)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG poskytuje dáta bez akejkoľvek záruky.",
    "course": "priebeh",
    "same": [
      "meta.siteName",
      "nav.brand",
      "beta.label",
      "connect.clients.chatgpt",
      "connectPage.claudeDesktop",
      "connectPage.claudeCode",
      "connectPage.chatgpt",
      "connectPage.editors",
      "connectPage.claudeAi"
    ],
    "fuelTitle": "Čerpacie stanice podľa spolkových krajín – výber s cenami",
    "fuelLead": "Až tri čerpacie stanice v každej spolkovej krajine, najlacnejší Super E10 prvý. Vybrané zo staníc, ktoré sledujeme – teda nie nutne najlacnejšie v krajine. Každá cena je uvedená s časom, keď sme ju zaznamenali. Informácia pre spotrebiteľov, nie zoznam všetkých čerpacích staníc."
  },
  "sr": {
    "current": "тренутн",
    "all": "св",
    "noWarranty": "без гаранције тачности и потпуности",
    "unverified": "непроверени",
    "lands": {
      "Niedersachsen": "Доњој Саксонији",
      "Sachsen": "Саксонији",
      "Thüringen": "Тирингији"
    },
    "kielOut": "затворен",
    "kielWhy": "канализацији",
    "summary": "(Пример, сажето; алат га приказује у целости)",
    "kvbWarranty": "Kölner Verkehrs-Betriebe AG даје податке без икакве гаранције.",
    "course": "трасу",
    "same": [],
    "fuelTitle": "Бензинске пумпе по савезним државама – избор са ценама",
    "fuelLead": "До три бензинске пумпе по савезној држави, најјефтинији Супер E10 први. Изабране међу пумпама које пратимо – дакле не обавезно најјефтиније у савезној држави. Свака цена стоји уз време када смо је забележили. Информација за потрошаче, а не списак свих бензинских пумпи."
  }
};

export const NEW_WEB_LANGS = LIVE_LANGS.filter((l) => !isOldLang(l)) as readonly NewWebLang[];

/** One pin per live language of #753; throws for a language with none. */
export function webPinned<T>(pick: (p: WebPins) => T): Readonly<Record<NewWebLang, T>> {
  return Object.fromEntries(
    NEW_WEB_LANGS.map((l: string) => {
      const p = WEB_PINS[l];
      if (p === undefined) throw new Error(`no test pins for ${l}`);
      return [l, pick(p)];
    }),
  ) as Record<NewWebLang, T>;
}
