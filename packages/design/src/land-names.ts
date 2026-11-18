/**
 * The sixteen Länder by their two-digit AGS key, as each of the 22 page languages names them (#1310 B2): the digest
 * names a Land from its own catalogues (`landOf`, `packages/digest/src/cards/shared/html.ts`), and the shell, which
 * reads no digest code, needs the same names for a place page's description. A leaf table, held equal to the digest's
 * for every language and key by `packages/digest/src/presentation/land-names-1310.test.ts`.
 */
import type { PageHeadLang } from "./page-head-copy.js";

export const LAND_KEYS = ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16"] as const;
export type LandKey = (typeof LAND_KEYS)[number];

const N: Readonly<Record<PageHeadLang, readonly string[]>> = {
  de: ["Schleswig-Holstein","Hamburg","Niedersachsen","Bremen","Nordrhein-Westfalen","Hessen","Rheinland-Pfalz","Baden-Württemberg","Bayern","Saarland","Berlin","Brandenburg","Mecklenburg-Vorpommern","Sachsen","Sachsen-Anhalt","Thüringen"],
  en: ["Schleswig-Holstein","Hamburg","Lower Saxony","Bremen","North Rhine-Westphalia","Hesse","Rhineland-Palatinate","Baden-Württemberg","Bavaria","Saarland","Berlin","Brandenburg","Mecklenburg-Western Pomerania","Saxony","Saxony-Anhalt","Thuringia"],
  bg: ["Шлезвиг-Холщайн","Хамбург","Долна Саксония","Бремен","Северен Рейн-Вестфалия","Хесен","Рейнланд-Пфалц","Баден-Вюртемберг","Бавария","Саарланд","Берлин","Бранденбург","Мекленбург-Предна Померания","Саксония","Саксония-Анхалт","Тюрингия"],
  cs: ["Šlesvicko-Holštýnsko","Hamburk","Dolní Sasko","Brémy","Severní Porýní-Vestfálsko","Hesensko","Porýní-Falc","Bádensko-Württembersko","Bavorsko","Sársko","Berlín","Braniborsko","Meklenbursko-Přední Pomořansko","Sasko","Sasko-Anhaltsko","Durynsko"],
  da: ["Slesvig-Holsten","Hamborg","Niedersachsen","Bremen","Nordrhein-Westfalen","Hessen","Rheinland-Pfalz","Baden-Württemberg","Bayern","Saarland","Berlin","Brandenburg","Mecklenburg-Vorpommern","Sachsen","Sachsen-Anhalt","Thüringen"],
  el: ["Σλέσβιχ-Χολστάιν","Αμβούργο","Κάτω Σαξονία","Βρέμη","Βόρεια Ρηνανία-Βεστφαλία","Έσση","Ρηνανία-Παλατινάτο","Βάδη-Βυρτεμβέργη","Βαυαρία","Σάαρλαντ","Βερολίνο","Βρανδεμβούργο","Μεκλεμβούργο-Δυτική Πομερανία","Σαξονία","Σαξονία-Άνχαλτ","Θουριγγία"],
  es: ["Schleswig-Holstein","Hamburgo","Baja Sajonia","Bremen","Renania del Norte-Westfalia","Hesse","Renania-Palatinado","Baden-Wurtemberg","Baviera","Sarre","Berlín","Brandeburgo","Mecklemburgo-Pomerania Occidental","Sajonia","Sajonia-Anhalt","Turingia"],
  fr: ["Schleswig-Holstein","Hambourg","Basse-Saxe","Brême","Rhénanie-du-Nord-Westphalie","Hesse","Rhénanie-Palatinat","Bade-Wurtemberg","Bavière","Sarre","Berlin","Brandebourg","Mecklembourg-Poméranie-Occidentale","Saxe","Saxe-Anhalt","Thuringe"],
  hr: ["Schleswig-Holstein","Hamburg","Donja Saska","Bremen","Sjeverna Rajna-Vestfalija","Hessen","Porajnje-Falačka","Baden-Württemberg","Bavarska","Saarland","Berlin","Brandenburg","Mecklenburg-Zapadno Pomorje","Saska","Saska-Anhalt","Tiringija"],
  hu: ["Schleswig-Holstein","Hamburg","Alsó-Szászország","Bréma","Észak-Rajna-Vesztfália","Hessen","Rajna-vidék-Pfalz","Baden-Württemberg","Bajorország","Saar-vidék","Berlin","Brandenburg","Mecklenburg-Elő-Pomeránia","Szászország","Szász-Anhalt","Türingia"],
  it: ["Schleswig-Holstein","Amburgo","Bassa Sassonia","Brema","Renania Settentrionale-Vestfalia","Assia","Renania-Palatinato","Baden-Württemberg","Baviera","Saarland","Berlino","Brandeburgo","Meclemburgo-Pomerania Anteriore","Sassonia","Sassonia-Anhalt","Turingia"],
  lt: ["Šlėzvigas-Holšteinas","Hamburgas","Žemutinė Saksonija","Brėmenas","Šiaurės Reinas-Vestfalija","Hesenas","Reinas-Pfalcas","Badenas-Viurtembergas","Bavarija","Saro kraštas","Berlynas","Brandenburgas","Meklenburgas-Pomeranija","Saksonija","Saksonija-Anhaltas","Tiuringija"],
  lv: ["Šlēsviga-Holšteina","Hamburga","Lejassaksija","Brēmene","Ziemeļreina-Vestfālene","Hese","Reinzeme-Pfalca","Bādene-Virtemberga","Bavārija","Zāra","Berlīne","Brandenburga","Mēklenburga-Priekšpomerānija","Saksija","Saksija-Anhalte","Tīringene"],
  nl: ["Sleeswijk-Holstein","Hamburg","Nedersaksen","Bremen","Noordrijn-Westfalen","Hessen","Rijnland-Palts","Baden-Württemberg","Beieren","Saarland","Berlijn","Brandenburg","Mecklenburg-Voor-Pommeren","Saksen","Saksen-Anhalt","Thüringen"],
  pl: ["Szlezwik-Holsztyn","Hamburg","Dolna Saksonia","Brema","Nadrenia Północna-Westfalia","Hesja","Nadrenia-Palatynat","Badenia-Wirtembergia","Bawaria","Saara","Berlin","Brandenburgia","Meklemburgia-Pomorze Przednie","Saksonia","Saksonia-Anhalt","Turyngia"],
  pt: ["Schleswig-Holstein","Hamburgo","Baixa Saxónia","Bremen","Renânia do Norte-Vestefália","Hesse","Renânia-Palatinado","Baden-Württemberg","Baviera","Sarre","Berlim","Brandemburgo","Meclemburgo-Pomerânia Ocidental","Saxónia","Saxónia-Anhalt","Turíngia"],
  ro: ["Schleswig-Holstein","Hamburg","Saxonia Inferioară","Bremen","Renania de Nord-Westfalia","Hessa","Renania-Palatinat","Baden-Württemberg","Bavaria","Saarland","Berlin","Brandenburg","Mecklenburg-Pomerania Inferioară","Saxonia","Saxonia-Anhalt","Turingia"],
  ru: ["Шлезвиг-Гольштейн","Гамбург","Нижняя Саксония","Бремен","Северный Рейн — Вестфалия","Гессен","Рейнланд-Пфальц","Баден-Вюртемберг","Бавария","Саар","Берлин","Бранденбург","Мекленбург — Передняя Померания","Саксония","Саксония-Анхальт","Тюрингия"],
  sk: ["Šlezvicko-Holštajnsko","Hamburg","Dolné Sasko","Brémy","Severné Porýnie-Vestfálsko","Hesensko","Porýnie-Falcko","Bádensko-Württembersko","Bavorsko","Sársko","Berlín","Brandenbursko","Meklenbursko-Predné Pomoransko","Sasko","Sasko-Anhaltsko","Durínsko"],
  sr: ["Шлезвиг-Холштајн","Хамбург","Доња Саксонија","Бремен","Северна Рајна-Вестфалија","Хесен","Рајна-Палатинат","Баден-Виртемберг","Баварска","Сарланд","Берлин","Бранденбург","Мекленбург-Западно Поморје","Саксонија","Саксонија-Анхалт","Тирингија"],
  tr: ["Schleswig-Holstein","Hamburg","Aşağı Saksonya","Bremen","Kuzey Ren-Vestfalya","Hessen","Rheinland-Pfalz","Baden-Württemberg","Bavyera","Saarland","Berlin","Brandenburg","Mecklenburg-Ön Pomeranya","Saksonya","Saksonya-Anhalt","Thüringen"],
  uk: ["Шлезвіг-Гольштейн","Гамбург","Нижня Саксонія","Бремен","Північний Рейн — Вестфалія","Гессен","Рейнланд-Пфальц","Баден-Вюртемберг","Баварія","Саар","Берлін","Бранденбург","Мекленбург — Передня Померанія","Саксонія","Саксонія-Ангальт","Тюрингія"],
};

/** A Land in the page's language by its key (or any AGS that starts with it), or null for anything else. */
export function landNameOf(lang: PageHeadLang, ags: string | null | undefined): string | null {
  if (ags == null) return null;
  const i = (LAND_KEYS as readonly string[]).indexOf(ags.slice(0, 2));
  return i < 0 || !/^\d{2}/.test(ags) ? null : (N[lang][i] ?? null);
}
