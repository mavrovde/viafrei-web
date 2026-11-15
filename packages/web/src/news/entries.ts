/**
 * The "New on ViaFrei" and "Plans" entries of the News page (#588).
 *
 * Every entry is APPROVED text: `scripts/news-draft.ts` drafts one from the
 * release's CHANGELOG block when a credits id ships without an entry, and a
 * person writes the wording here. `test/news.test.ts` fails while a credits id
 * of `catalogue.credits` is neither named by an entry nor in
 * `CREDITS_BEFORE_NEWS`, so an integration cannot ship silently.
 *
 * One language per page (#449): an entry is shown in exactly the languages it
 * has text for; a missing translation leaves it out of that page and never
 * falls back to German. The credit lines are not here: they are rendered from
 * the register (`catalogue.credits`, German and verbatim) by `credits` id.
 *
 * The ask question is a real question the named tool answers from the named
 * source; the date is the day the release that shipped it was cut.
 *
 * Plans (`kind: "plan"`): an open issue the OWNER has labelled `planned` on
 * GitHub (the label exists since 2026-10-12; only the owner applies it). A plan
 * says "planned" and promises no date: `release` is null, it carries NO credit
 * lines (nothing of the source is served yet, so nothing is attributed), and
 * its `ask` is a real question the named tool will answer once it ships; `date`
 * is the day the plan was listed. When its issue ships, the entry is removed or
 * becomes a "new" entry with its release, date and credits; when the label is
 * taken off, it is removed. `scripts/news-plans.ts` (run by the lead at a
 * release; it calls `gh`, so never in a test) lists the `planned` issues with
 * no entry here and every plan entry whose issue is closed or unlabelled.
 */
import type { Lang } from "../site/pages.js";
import { newsTextsFor } from "./i18n/index.js";

export const NEWS_KINDS = ["new", "plan"] as const;
export type NewsKind = (typeof NEWS_KINDS)[number];

export type NewsText = {
  readonly title: string;
  readonly body: string;
  /** The ready-made question for an assistant connected to ViaFrei. */
  readonly ask: string;
};

export type NewsEntry = {
  /** The permalink anchor: lower-case, digits and hyphens. */
  readonly id: string;
  readonly kind: NewsKind;
  /** `YYYY-MM-DD`: a "new" entry's release date; a plan's listing day. */
  readonly date: string;
  /** The release that shipped it; null for a plan, which promises none. */
  readonly release: string | null;
  readonly issue: number;
  /** Register ids from `catalogue.credits`, rendered as the entry's source lines. Empty for a plan. */
  readonly credits: readonly string[];
  /** The tool that answers `ask`. */
  readonly tool: string;
  readonly text: Partial<Record<Lang, NewsText>>;
};

// 2.1 (#646–#670): the AFIR operators read from their own Mobilithek publications.
const AFIR_OPERATORS_2_1 = [
  "mobilithek_afir_pump_stat",
  "mobilithek_afir_edri_stat",
  "mobilithek_afir_edri_dyn",
  "mobilithek_afir_audi_stat",
  "mobilithek_afir_audi_dyn",
  "mobilithek_afir_enerando_dyn",
  "mobilithek_afir_enio_stat",
  "mobilithek_afir_enio_dyn",
  "mobilithek_afir_evprice_stat",
  "mobilithek_afir_evprice_dyn",
  "mobilithek_afir_ewe_stat",
  "mobilithek_afir_ewe_dyn",
  "mobilithek_afir_gls_stat",
  "mobilithek_afir_gls_dyn",
  "mobilithek_afir_gpjoule_stat",
  "mobilithek_afir_gpjoule_dyn",
  "mobilithek_afir_gridco_stat",
  "mobilithek_afir_gridco_dyn",
  "mobilithek_afir_eround_stat",
  "mobilithek_afir_eround_dyn",
  "mobilithek_afir_inergia_stat",
  "mobilithek_afir_inergia_dyn",
  "mobilithek_afir_rudnick_stat",
  "mobilithek_afir_lichtblick_stat",
  "mobilithek_afir_lichtblick_dyn",
  "mobilithek_afir_monta_stat",
  "mobilithek_afir_monta_dyn",
  "mobilithek_afir_qwello_stat",
  "mobilithek_afir_qwello_dyn",
  "mobilithek_afir_road_stat",
  "mobilithek_afir_road_dyn",
  "mobilithek_afir_smatrics_stat",
  "mobilithek_afir_smatrics_dyn",
  "mobilithek_afir_wirelane_stat",
  "mobilithek_afir_wirelane_dyn",
  "mobilithek_afir_chargecloud_stat",
  "mobilithek_afir_chargecloud_dyn",
  "mobilithek_afir_vaylens_stat",
  "mobilithek_afir_vaylens_dyn",
  "mobilithek_afir_ladenetz_stat",
  "mobilithek_afir_ladenetz_dyn",
  "mobilithek_afir_ladebusiness_stat",
  "mobilithek_afir_ladebusiness_dyn",
] as const;

const PARKAPI_BW = [
  "parkapi_bw_karlsruhe", "parkapi_bw_freiburg", "parkapi_bw_vrs", "parkapi_bw_mannheim", "parkapi_bw_stuttgart", "parkapi_bw_heidelberg", "parkapi_bw_konstanz",
  "parkapi_bw_buchen", "parkapi_bw_aalen", "parkapi_bw_ulm", "parkapi_bw_friedrichshafen", "parkapi_bw_herrenberg", "parkapi_bw_vrn", "parkapi_bw_pbw", "parkapi_bw_p_m_bw",
] as const;

const NEWS_INLINE: readonly NewsEntry[] = [
  {
    // 2.6.18 (#1304): the speed-enforcement locations on the motorway pages and their exit pages, not only on the place
    // card. Drafted at 2.6.18 under the owner's standing "Yes to any news" (2026-10-24); the cut re-dates it.
    id: "blitzer-autobahnseiten",
    kind: "new",
    date: "2026-11-14",
    release: "2.6.18",
    issue: 1304,
    credits: ["mobilithek_speed_karlsruhe", "osm_speed_cameras"],
    tool: "find_speed_cameras",
    text: {
      de: { title: "Blitzer-Standorte auf den Autobahnseiten", body: "Die Seite einer Autobahn und die Seiten ihrer Anschlussstellen zeigen jetzt auch die veröffentlichten Standorte der Geschwindigkeitsüberwachung entlang der Strecke, jeweils mit der Anschlussstelle, der sie zugeordnet sind – aus den amtlichen Listen der Städte und, wo keine Stadt eine Liste veröffentlicht, aus OpenStreetMap. Die Angaben sind nur für die Planung vor der Fahrt oder während eines Halts bestimmt; die Karte trägt den Hinweis nach § 23 Abs. 1c StVO.", ask: "Ich plane eine Fahrt über die A 5 bei Karlsruhe: Wo stehen dort feste Blitzer?" },
      en: { title: "Speed camera locations on the motorway pages", body: "A motorway's page and the pages of its junctions now also show the published speed-enforcement locations along the route, each with the junction it is assigned to — from the cities' official lists and, where no city publishes one, from OpenStreetMap. They are meant only for planning before the trip or during a stop; the card carries the notice under § 23 Abs. 1c StVO.", ask: "I am planning a trip on the A 5 by Karlsruhe: where are the fixed speed cameras there?" },
      ru: { title: "Места контроля скорости на страницах автобанов", body: "Страница автобана и страницы его развязок теперь показывают и опубликованные места контроля скорости вдоль трассы, каждое — с развязкой, к которой оно отнесено: из официальных списков городов, а где город списка не публикует, — из OpenStreetMap. Эти сведения предназначены только для планирования до поездки или во время остановки; карточка содержит указание по § 23 Abs. 1c StVO.", ask: "Я планирую поездку по A 5 у Карлсруэ: где там стоят стационарные камеры?" },
      bg: { title: "Места за контрол на скоростта на страниците на магистралите", body: "Страницата на една магистрала и страниците на нейните пътни възли вече показват и публикуваните места за контрол на скоростта по трасето, всяко с пътния възел, към който е отнесено — от официалните списъци на градовете, а където град не публикува такъв, от OpenStreetMap. Данните са предназначени само за планиране преди пътуването или по време на престой; картата носи указанието по § 23 Abs. 1c StVO.", ask: "Планирам пътуване по A 5 при Карлсруе: къде има стационарни камери там?" },
      uk: { title: "Місця контролю швидкості на сторінках автобанів", body: "Сторінка автобану та сторінки його розв’язок тепер показують і опубліковані місця контролю швидкості вздовж траси, кожне — з розв’язкою, до якої його віднесено: з офіційних списків міст, а де місто списку не публікує, — з OpenStreetMap. Ці дані призначені лише для планування до поїздки або під час зупинки; картка містить застереження за § 23 Abs. 1c StVO.", ask: "Я планую поїздку по A 5 біля Карлсруе: де там стаціонарні камери?" },
      ro: { title: "Locurile de control al vitezei pe paginile autostrăzilor", body: "Pagina unei autostrăzi și paginile nodurilor ei arată acum și locurile publicate de control al vitezei de-a lungul traseului, fiecare cu nodul căruia îi este atribuit — din listele oficiale ale orașelor și, unde niciun oraș nu publică una, din OpenStreetMap. Datele sunt destinate doar planificării înainte de călătorie sau în timpul unei opriri; cardul poartă mențiunea conform § 23 Abs. 1c StVO.", ask: "Plănuiesc o călătorie pe A 5 la Karlsruhe: unde sunt radarele fixe acolo?" },
      tr: { title: "Otoyol sayfalarında hız denetimi noktaları", body: "Bir otoyolun sayfası ve kavşaklarının sayfaları artık güzergâh boyunca yayımlanan hız denetimi noktalarını da, her birini atandığı kavşakla birlikte gösteriyor — şehirlerin resmi listelerinden ve hiçbir şehrin liste yayımlamadığı yerlerde OpenStreetMap'ten. Bilgiler yalnızca yolculuktan önce ya da bir mola sırasında planlama içindir; kart § 23 Abs. 1c StVO uyarınca uyarıyı taşır.", ask: "A 5 üzerinden Karlsruhe'ye bir yolculuk planlıyorum: orada sabit radarlar nerede?" },
    },
  },
  {
    // 2.6.16 (the ingestor's #3, #1293): FlixBus and FlixTrain beside the DELFI board in get_departures and on
    // the stations card. Drafted at the 2.6.16 cut under the owner's standing "Yes to any news" (2026-10-24).
    id: "flixbus-flixtrain-abfahrten",
    kind: "new",
    date: "2026-11-13",
    release: "2.6.16",
    issue: 1293,
    credits: ["flix_transit"],
    tool: "get_departures",
    text: {
      de: { title: "FlixBus und FlixTrain bei den Abfahrten", body: "ViaFrei zeigt jetzt neben den Abfahrten des Nahverkehrs auch die Fernbusse von FlixBus und die Züge von FlixTrain, die in der Nähe einer Haltestelle abfahren – an der Haltestelle und auf der Bahnhofskarte. Wo FlixBus eine aktuelle Prognose liefert, steht die erwartete Zeit dabei, sonst die Fahrplanzeit. Buchung und Preise gibt es nur bei FlixBus selbst.", ask: "Wann fährt der nächste FlixBus ab Berlin ZOB?" },
      en: { title: "FlixBus and FlixTrain in the departures", body: "Beside the local transport departures, ViaFrei now also shows the FlixBus coaches and FlixTrain trains that leave near a stop — at the stop and on the station card. Where FlixBus provides a current prediction, the expected time is given, otherwise the timetable time. Booking and fares are only available from FlixBus itself.", ask: "When does the next FlixBus leave from Berlin ZOB?" },
      ru: { title: "FlixBus и FlixTrain в расписании отправлений", body: "Рядом с отправлениями местного транспорта ViaFrei теперь показывает и междугородние автобусы FlixBus и поезда FlixTrain, которые отправляются поблизости от остановки, — на остановке и на карточке вокзала. Где FlixBus даёт текущий прогноз, указано ожидаемое время, иначе — время по расписанию. Бронирование и цены — только у самого FlixBus.", ask: "Когда отправляется следующий FlixBus от Berlin ZOB?" },
      bg: { title: "FlixBus и FlixTrain в заминаванията", body: "До заминаванията на местния транспорт ViaFrei вече показва и междуградските автобуси на FlixBus и влаковете на FlixTrain, които тръгват близо до спирка — на спирката и в картата на гарата. Където FlixBus дава актуална прогноза, е посочен очакваният час, иначе — часът по разписание. Резервации и цени има само при самия FlixBus.", ask: "Кога тръгва следващият FlixBus от Berlin ZOB?" },
      uk: { title: "FlixBus і FlixTrain у відправленнях", body: "Поруч із відправленнями місцевого транспорту ViaFrei тепер показує й міжміські автобуси FlixBus і поїзди FlixTrain, що відправляються поблизу зупинки, — на зупинці та на картці вокзалу. Де FlixBus дає поточний прогноз, указано очікуваний час, інакше — час за розкладом. Бронювання та ціни — лише в самого FlixBus.", ask: "Коли відправляється наступний FlixBus від Berlin ZOB?" },
      ro: { title: "FlixBus și FlixTrain la plecări", body: "Pe lângă plecările transportului local, ViaFrei arată acum și autocarele FlixBus și trenurile FlixTrain care pleacă în apropierea unei stații — la stație și pe cardul gării. Unde FlixBus oferă o prognoză actuală, este dată ora așteptată, altfel ora din orar. Rezervările și prețurile sunt disponibile doar la FlixBus.", ask: "Când pleacă următorul FlixBus din Berlin ZOB?" },
      tr: { title: "Kalkışlarda FlixBus ve FlixTrain", body: "ViaFrei artık yerel ulaşımın kalkışlarının yanında bir durağın yakınından kalkan FlixBus otobüslerini ve FlixTrain trenlerini de gösteriyor — durakta ve istasyon kartında. FlixBus güncel bir tahmin verdiğinde beklenen saat, aksi halde tarife saati verilir. Rezervasyon ve fiyatlar yalnızca FlixBus'ta.", ask: "Berlin ZOB'dan bir sonraki FlixBus ne zaman kalkıyor?" },
    },
  },
  {
    // 2.6 (#1012, #1013, #1015): the speed-enforcement publications of Konstanz, Bottrop and Essen, added to
    // find_speed_cameras and the speed card in the 2.6 line (not 2.5.4's). Drafted by ingest-dev 2026-11-12 under the
    // owner's standing "Yes to any news" (2026-10-24); the cut sets the release and re-dates it to the release day.
    id: "blitzer-bottrop-essen-konstanz",
    kind: "new",
    date: "2026-11-13",
    release: "2.6.14",
    issue: 1015,
    credits: ["essen_geschwindigkeit", "mobilithek_speed_bottrop", "mobilithek_speed_konstanz"],
    tool: "find_speed_cameras",
    text: {
      de: { title: "Blitzer-Standorte in Bottrop, Essen und Konstanz", body: "ViaFrei kennt jetzt auch die Standorte der Geschwindigkeitsüberwachung, die Bottrop, Essen und Konstanz veröffentlichen: in Bottrop die aktuellen Messstellen, in Essen die Straßen der angekündigten mobilen Kontrollen der Woche, in Konstanz die festen Messanlagen der Stadt. Die Angaben sind nur für die Planung vor der Fahrt oder während eines Halts bestimmt; jede Antwort trägt den Hinweis nach § 23 Abs. 1c StVO.", ask: "Ich plane eine Fahrt nach Essen: Wo wird diese Woche kontrolliert?" },
      en: { title: "Speed camera locations in Bottrop, Essen and Konstanz", body: "ViaFrei now also knows the speed-enforcement locations that Bottrop, Essen and Konstanz publish: Bottrop's current check sites, the streets of Essen's announced mobile checks for the week, and Konstanz's fixed measuring sites. They are meant only for planning before the trip or during a stop; every answer carries the notice under § 23 Abs. 1c StVO.", ask: "I am planning a trip to Essen: where are the checks this week?" },
      ru: { title: "Места контроля скорости в Ботропе, Эссене и Констанце", body: "ViaFrei теперь знает и места контроля скорости, которые публикуют Ботроп, Эссен и Констанц: в Ботропе — текущие места измерений, в Эссене — улицы объявленных мобильных проверок на неделю, в Констанце — стационарные пункты измерения города. Данные предназначены только для планирования до поездки или во время остановки; каждый ответ содержит указание по § 23 Abs. 1c StVO.", ask: "Я планирую поездку в Эссен: где на этой неделе контроль?" },
      bg: { title: "Места за контрол на скоростта в Ботроп, Есен и Констанц", body: "ViaFrei вече познава и местата за контрол на скоростта, които публикуват Ботроп, Есен и Констанц: в Ботроп — текущите места за измерване, в Есен — улиците на обявените мобилни проверки за седмицата, в Констанц — стационарните пунктове за измерване на града. Данните са само за планиране преди пътуването или по време на спиране; всеки отговор съдържа указанието по § 23 Abs. 1c StVO.", ask: "Планирам пътуване до Есен: къде има проверки тази седмица?" },
      uk: { title: "Місця контролю швидкості в Ботропі, Ессені та Констанці", body: "ViaFrei тепер знає й місця контролю швидкості, які публікують Ботроп, Ессен і Констанц: у Ботропі — поточні місця вимірювання, в Ессені — вулиці оголошених мобільних перевірок на тиждень, у Констанці — стаціонарні пункти вимірювання міста. Дані призначені лише для планування до поїздки або під час зупинки; кожна відповідь містить застереження за § 23 Abs. 1c StVO.", ask: "Я планую поїздку до Ессена: де цього тижня перевірки?" },
      ro: { title: "Locuri de control al vitezei în Bottrop, Essen și Konstanz", body: "ViaFrei cunoaște acum și locurile de control al vitezei publicate de Bottrop, Essen și Konstanz: în Bottrop locurile actuale de măsurare, în Essen străzile controalelor mobile anunțate pentru săptămână, în Konstanz punctele fixe de măsurare ale orașului. Datele sunt doar pentru planificare înainte de drum sau în timpul unei opriri; fiecare răspuns poartă nota conform § 23 Abs. 1c StVO.", ask: "Plănuiesc o călătorie la Essen: unde sunt controale săptămâna aceasta?" },
      tr: { title: "Bottrop, Essen ve Konstanz'da hız denetimi noktaları", body: "ViaFrei artık Bottrop, Essen ve Konstanz'ın yayımladığı hız denetimi noktalarını da biliyor: Bottrop'ta güncel ölçüm noktaları, Essen'de haftanın duyurulan mobil denetimlerinin sokakları, Konstanz'da şehrin sabit ölçüm noktaları. Bilgiler yalnızca yolculuktan önce veya bir mola sırasında planlama içindir; her yanıt § 23 Abs. 1c StVO notunu taşır.", ask: "Essen'e bir yolculuk planlıyorum: bu hafta nerede denetim var?" },
    },
  },
  {
    // 2.5 (#1075): the VBB's station entrances and lifts, answered by check_station_facilities and the stations card.
    // Approved under the owner's standing "Yes to any news" (2026-10-24); the cut re-dates it to the release day.
    id: "aufzuege-u-bahnhoefe-berlin-brandenburg",
    kind: "new",
    date: "2026-11-09",
    release: "2.5.23",
    issue: 1075,
    credits: ["vbb_haltestellenzugaenge"],
    tool: "check_station_facilities",
    text: {
      de: { title: "Berlin und Brandenburg: Aufzüge und Zugänge an U-Bahn- und Straßenbahnhöfen", body: "ViaFrei liest jetzt das Verzeichnis der Haltestellenzugänge des VBB. Für jeden Bahnhof in Berlin und Brandenburg, an dem es Aufzüge verzeichnet, steht da, wie viele Aufzüge es gibt und wie viele Zugänge von der Straße, davon wie viele mit Aufzug – auch an reinen U-Bahnhöfen wie Hermannplatz, die keine DB-Station sind. Das Verzeichnis sagt, was gebaut ist, nicht ob ein Aufzug gerade fährt; ViaFrei nennt dazu das Datum der Datei.", ask: "Hat der U-Bahnhof Hermannplatz einen Aufzug?" },
      en: { title: "Berlin and Brandenburg: lifts and entrances at U-Bahn and tram stations", body: "ViaFrei now reads the VBB's list of station entrances. For every station in Berlin and Brandenburg where it lists lifts, it says how many lifts there are and how many entrances from the street, and how many of those have a lift — including pure U-Bahn stations such as Hermannplatz that are no DB station. The list says what is built, not whether a lift is working now; ViaFrei gives the file's date with it.", ask: "Does the Hermannplatz U-Bahn station have a lift?" },
      ru: { title: "Берлин и Бранденбург: лифты и входы на станциях метро и трамвая", body: "ViaFrei теперь читает перечень входов на станции VBB. Для каждой станции в Берлине и Бранденбурге, где в нём указаны лифты, сказано, сколько там лифтов и сколько входов с улицы, и у скольких из них есть лифт — в том числе на станциях только метро, как Германплац, которые не являются станциями DB. Перечень говорит о том, что построено, а не о том, работает ли лифт сейчас; ViaFrei указывает дату файла.", ask: "Есть ли лифт на станции метро Германплац?" },
      bg: { title: "Берлин и Бранденбург: асансьори и входове на станции на метрото и трамвая", body: "ViaFrei вече чете списъка на входовете на станциите на VBB. За всяка станция в Берлин и Бранденбург, за която в него има асансьори, се посочва колко асансьора има и колко входа от улицата, и колко от тях са с асансьор — включително на станции само на метрото като Херманплац, които не са станции на DB. Списъкът казва какво е построено, а не дали асансьорът работи в момента; ViaFrei посочва датата на файла.", ask: "Има ли асансьор на метростанция Херманплац?" },
      uk: { title: "Берлін і Бранденбург: ліфти та входи на станціях метро й трамвая", body: "ViaFrei тепер читає перелік входів на станції VBB. Для кожної станції в Берліні та Бранденбурзі, де в ньому вказано ліфти, сказано, скільки там ліфтів і скільки входів з вулиці, і скільки з них мають ліфт — зокрема на станціях лише метро, як Германплац, що не є станціями DB. Перелік каже, що збудовано, а не чи працює ліфт зараз; ViaFrei зазначає дату файлу.", ask: "Чи є ліфт на станції метро Германплац?" },
      ro: { title: "Berlin și Brandenburg: lifturi și intrări în stațiile de metrou și tramvai", body: "ViaFrei citește acum lista intrărilor în stații a VBB. Pentru fiecare stație din Berlin și Brandenburg la care lista indică lifturi, se arată câte lifturi sunt și câte intrări dinspre stradă, și câte dintre ele au lift — inclusiv în stații doar de metrou, precum Hermannplatz, care nu sunt stații DB. Lista spune ce este construit, nu dacă un lift funcționează acum; ViaFrei indică data fișierului.", ask: "Are stația de metrou Hermannplatz un lift?" },
      tr: { title: "Berlin ve Brandenburg: metro ve tramvay istasyonlarında asansörler ve girişler", body: "ViaFrei artık VBB'nin istasyon girişleri listesini okuyor. Listenin asansör gösterdiği Berlin ve Brandenburg'daki her istasyon için kaç asansör ve sokaktan kaç giriş olduğu, bunlardan kaçında asansör bulunduğu belirtilir — Hermannplatz gibi DB istasyonu olmayan yalnızca metro istasyonlarında da. Liste neyin inşa edildiğini söyler, bir asansörün şu anda çalışıp çalışmadığını değil; ViaFrei dosyanın tarihini de verir.", ask: "Hermannplatz metro istasyonunda asansör var mı?" },
    },
  },
  {
    // 2.5.14 (#1043): a tram level with an underground OpenStreetMap station within 300 m is a station page, credited
    // to the ODbL match (`osm_underground_stations`), which no MCP tool answers from, so the ask is the departures
    // tool's, as for the maps' streets (#1099). Approved under the owner's standing "Yes to any news" (2026-10-24);
    // dated by the Linux round of 2.5.14, the cut re-dates it to the release day.
    id: "stadtbahn-stationen-unter-der-erde",
    kind: "new",
    date: "2026-11-05",
    release: "2.5.14",
    issue: 1043,
    credits: ["osm_underground_stations"],
    tool: "get_departures",
    text: {
      de: { title: "Unterirdische Stadtbahnstationen mit eigener Seite", body: "ViaFrei gibt jetzt auch unterirdischen Stadtbahnstationen eine eigene Bahnhofsseite. Ob eine Straßenbahnhaltestelle unter der Erde liegt, sagt der Fahrplan nicht; ViaFrei erkennt es mit Daten von OpenStreetMap, wenn dort im Umkreis von 300 Metern eine unterirdische Station eingetragen ist. Die Seite nennt die Linien, die dort halten, und ihre nächsten Abfahrten, und sie nennt OpenStreetMap als Quelle.", ask: "Was fährt am Neumarkt in Köln als Nächstes ab?" },
      en: { title: "Underground light-rail stations get their own page", body: "ViaFrei now gives underground light-rail (Stadtbahn) stations a station page of their own. The timetable does not say whether a tram stop lies underground; ViaFrei recognises it from OpenStreetMap data when an underground station is mapped there within 300 metres. The page names the lines that stop there and their next departures, and it names OpenStreetMap as its source.", ask: "What leaves Neumarkt in Cologne next?" },
      ru: { title: "Подземные станции скоростного трамвая получили свои страницы", body: "ViaFrei теперь создаёт собственную страницу станции и для подземных станций скоростного трамвая. Расписание не говорит, находится ли трамвайная остановка под землёй; ViaFrei определяет это по данным OpenStreetMap, если там в радиусе 300 метров отмечена подземная станция. Страница называет линии, которые там останавливаются, и их ближайшие отправления, а источником указан OpenStreetMap.", ask: "Что следующим отправляется с Ноймаркта в Кёльне?" },
      bg: { title: "Подземните станции на леката железница получиха собствени страници", body: "ViaFrei вече дава собствена страница и на подземните станции на леката железница. Разписанието не казва дали трамвайната спирка е под земята; ViaFrei разпознава това по данни от OpenStreetMap, когато там в радиус от 300 метра е отбелязана подземна станция. Страницата назовава линиите, които спират там, и следващите им заминавания, а като източник посочва OpenStreetMap.", ask: "Какво тръгва следващо от Ноймаркт в Кьолн?" },
      uk: { title: "Підземні станції швидкісного трамвая отримали власні сторінки", body: "ViaFrei тепер створює власну сторінку станції й для підземних станцій швидкісного трамвая. Розклад не каже, чи трамвайна зупинка лежить під землею; ViaFrei визначає це за даними OpenStreetMap, якщо там у радіусі 300 метрів позначено підземну станцію. Сторінка називає лінії, що там зупиняються, та їхні найближчі відправлення, а джерелом зазначено OpenStreetMap.", ask: "Що наступним вирушає з Ноймаркту в Кельні?" },
      ro: { title: "Stațiile subterane de metrou ușor au pagina lor", body: "ViaFrei oferă acum și stațiilor subterane de metrou ușor (Stadtbahn) o pagină de stație proprie. Orarul nu spune dacă o stație de tramvai se află sub pământ; ViaFrei recunoaște acest lucru din datele OpenStreetMap, atunci când acolo este cartografiată o stație subterană pe o rază de 300 de metri. Pagina numește liniile care opresc acolo și următoarele lor plecări și indică OpenStreetMap ca sursă.", ask: "Ce pleacă următorul de la Neumarkt din Köln?" },
      tr: { title: "Yeraltındaki hafif raylı istasyonların kendi sayfası var", body: "ViaFrei artık yeraltındaki hafif raylı sistem (Stadtbahn) istasyonlarına da kendi istasyon sayfasını veriyor. Bir tramvay durağının yeraltında olup olmadığını tarife söylemez; ViaFrei bunu, OpenStreetMap'te 300 metre içinde yeraltı istasyonu işaretlendiğinde OpenStreetMap verileriyle anlar. Sayfa orada duran hatları ve sonraki kalkışlarını gösterir ve kaynak olarak OpenStreetMap'i belirtir.", ask: "Köln'deki Neumarkt'tan sıradaki ne kalkıyor?" },
    },
  },
  {
    // 2.5.4 (#1040): drafted by ingest-dev 2026-11-01, approved under the owner's standing "Yes to any news"
    // (2026-10-24) and dated at the 2.5.4 cut. The text holds the read rule: published locations for planning,
    // the notice on every answer, never a warning while driving.
    id: "blitzer-standorte-planung",
    kind: "new",
    date: "2026-11-02",
    release: "2.5.4",
    issue: 1040,
    credits: ["mobilithek_speed_aachen", "mobilithek_speed_duesseldorf", "mobilithek_speed_karlsruhe", "mobilithek_speed_koeln"],
    tool: "find_speed_cameras",
    text: {
      de: { title: "Blitzer-Standorte für die Reiseplanung", body: "ViaFrei kennt jetzt die Standorte der Geschwindigkeitsüberwachung, die Aachen, Düsseldorf, Karlsruhe und Köln veröffentlichen. Die Angaben sind nur für die Planung vor der Fahrt oder während eines Halts bestimmt: Nach § 23 Abs. 1c StVO darf, wer fährt, keine App nutzen, die Verkehrskontrollen anzeigt. Jede Antwort trägt diesen Hinweis.", ask: "Ich plane eine Fahrt nach Düsseldorf: Wo stehen dort feste Blitzer?" },
      en: { title: "Speed camera locations for trip planning", body: "ViaFrei now knows the speed-enforcement locations that Aachen, Düsseldorf, Karlsruhe and Cologne publish. They are meant only for planning before the trip or during a stop: under § 23 Abs. 1c StVO a driver may not use an app that shows traffic enforcement. Every answer carries this notice.", ask: "I am planning a trip to Düsseldorf: where are the fixed speed cameras there?" },
      ru: { title: "Камеры контроля скорости для планирования поездки", body: "ViaFrei теперь знает места контроля скорости, которые публикуют Ахен, Дюссельдорф, Карлсруэ и Кёльн. Эти данные предназначены только для планирования до поездки или во время остановки: по § 23 Abs. 1c StVO водитель не вправе пользоваться приложением, показывающим контроль. Каждый ответ содержит это указание.", ask: "Я планирую поездку в Дюссельдорф: где там стационарные камеры скорости?" },
      bg: { title: "Камери за скорост за планиране на пътуването", body: "ViaFrei вече познава местата за контрол на скоростта, които публикуват Аахен, Дюселдорф, Карлсруе и Кьолн. Данните са само за планиране преди пътуването или по време на спиране: според § 23 Abs. 1c StVO водачът не може да ползва приложение, което показва контрола. Всеки отговор съдържа това указание.", ask: "Планирам пътуване до Дюселдорф: къде са стационарните камери за скорост там?" },
      uk: { title: "Камери контролю швидкості для планування поїздки", body: "ViaFrei тепер знає місця контролю швидкості, які публікують Аахен, Дюссельдорф, Карлсруе й Кельн. Ці дані призначені лише для планування до поїздки або під час зупинки: за § 23 Abs. 1c StVO водій не може користуватися застосунком, що показує контроль. Кожна відповідь містить це застереження.", ask: "Я планую поїздку до Дюссельдорфа: де там стаціонарні камери швидкості?" },
      ro: { title: "Radare de viteză pentru planificarea călătoriei", body: "ViaFrei cunoaște acum locurile de control al vitezei publicate de Aachen, Düsseldorf, Karlsruhe și Köln. Datele sunt doar pentru planificare înainte de drum sau în timpul unei opriri: conform § 23 Abs. 1c StVO, șoferul nu poate folosi o aplicație care arată controalele. Fiecare răspuns poartă această notă.", ask: "Plănuiesc o călătorie la Düsseldorf: unde sunt radarele fixe de acolo?" },
      tr: { title: "Yolculuk planlaması için hız kameraları", body: "ViaFrei artık Aachen, Düsseldorf, Karlsruhe ve Köln'ün yayımladığı hız denetimi noktalarını biliyor. Bilgiler yalnızca yolculuktan önce veya bir mola sırasında planlama içindir: § 23 Abs. 1c StVO'ya göre sürücü, denetimleri gösteren bir uygulama kullanamaz. Her yanıt bu notu taşır.", ask: "Düsseldorf'a bir yolculuk planlıyorum: oradaki sabit hız kameraları nerede?" },
    },
  },
  {
    // 2.5.4 (#603): SWT Trier's car parks and parking lots with their live free spaces, the first parking source for
    // Trier. Drafted under the owner's standing "Yes to any news" (2026-10-24).
    id: "parken-trier",
    kind: "new",
    date: "2026-11-02",
    release: "2.5.4",
    issue: 603,
    credits: ["mobilithek_park_trier_static", "mobilithek_park_trier_dyn"],
    tool: "find_parking",
    text: {
      de: { title: "Parkhäuser in Trier mit freien Plätzen", body: "ViaFrei liest jetzt die Parkhäuser und Parkplätze der Stadtwerke Trier mit ihren freien Plätzen live. Für Trier kannte ViaFrei bisher kein Parkhaus; jetzt nennt es 28 Parkhäuser und Parkplätze und wie viele Plätze dort gerade frei sind.", ask: "Wo ist in Trier gerade ein Parkhaus frei?" },
      en: { title: "Car parks in Trier with free spaces", body: "ViaFrei now reads the car parks and parking lots of the Trier public utility (SWT) with their free spaces live. Until now ViaFrei knew no car park in Trier; now it names 28 car parks and lots and how many spaces are free there right now.", ask: "Where is there a car park with free spaces in Trier right now?" },
      ru: { title: "Паркинги Трира со свободными местами", body: "ViaFrei теперь читает паркинги и парковки городского предприятия Трира (SWT) со свободными местами в реальном времени. Раньше ViaFrei не знал ни одного паркинга в Трире; теперь он называет 28 паркингов и парковок и сколько мест там свободно прямо сейчас.", ask: "Где в Трире сейчас есть свободный паркинг?" },
      bg: { title: "Паркинги в Трир със свободни места", body: "ViaFrei вече чете паркингите и паркоместата на градското предприятие на Трир (SWT) със свободните им места на живо. Досега ViaFrei не познаваше нито един паркинг в Трир; сега назовава 28 паркинга и паркоместа и колко места са свободни там в момента.", ask: "Къде в Трир има свободен паркинг в момента?" },
      uk: { title: "Паркінги Трира з вільними місцями", body: "ViaFrei тепер читає паркінги та парковки міського підприємства Трира (SWT) із вільними місцями в реальному часі. Досі ViaFrei не знав жодного паркінгу в Трирі; тепер він називає 28 паркінгів і парковок і скільки місць там вільно саме зараз.", ask: "Де в Трирі зараз є вільний паркінг?" },
      ro: { title: "Parcări din Trier cu locuri libere", body: "ViaFrei citește acum parcările și locurile de parcare ale companiei municipale din Trier (SWT) cu locurile lor libere în timp real. Până acum ViaFrei nu cunoștea nicio parcare din Trier; acum numește 28 de parcări și câte locuri sunt libere acolo chiar acum.", ask: "Unde găsesc acum o parcare cu locuri libere în Trier?" },
      tr: { title: "Trier'deki otoparklar ve boş yerleri", body: "ViaFrei artık Trier belediye şirketinin (SWT) otoparklarını ve park alanlarını boş yerleriyle birlikte canlı okuyor. ViaFrei şimdiye kadar Trier'de hiçbir otopark bilmiyordu; şimdi 28 otoparkı ve park alanını ve orada şu anda kaç yerin boş olduğunu söylüyor.", ask: "Trier'de şu anda boş yeri olan bir otopark nerede?" },
    },
  },
  {
    // 2.4.2 (#617): Stadt Konstanz's car parks with their live free spaces, the first live count for Konstanz (the
    // ParkAPI bundle's copy carried none); a lot both publish is one entry crediting both. Approved under the owner's standing "Yes to any news" (2026-10-24).
    id: "parken-konstanz",
    kind: "new",
    date: "2026-10-26",
    release: "2.4.2",
    issue: 617,
    credits: ["mobilithek_park_konstanz_static", "mobilithek_park_konstanz_dyn"],
    tool: "find_parking",
    text: {
      de: { title: "Parkhäuser in Konstanz mit freien Plätzen", body: "ViaFrei liest jetzt die Parkhäuser und Parkplätze der Stadt Konstanz mit ihren freien Plätzen live. Für Konstanz gab es bisher nur die Lage der Parkhäuser; jetzt nennt ViaFrei, wie viele Plätze gerade frei sind. Ein Parkhaus, das zwei Quellen veröffentlichen, steht einmal in der Antwort, und beide Herausgeber werden genannt.", ask: "Wo ist in Konstanz gerade ein Parkhaus frei?" },
      en: { title: "Car parks in Konstanz with free spaces", body: "ViaFrei now reads the car parks of the City of Konstanz with their free spaces live. Until now ViaFrei only knew where Konstanz's car parks are; now it says how many spaces are free right now. A car park two sources publish is listed once in the answer, and both publishers are named.", ask: "Where is there a car park with free spaces in Konstanz right now?" },
      ru: { title: "Паркинги Констанца со свободными местами", body: "ViaFrei теперь читает паркинги и парковки города Констанц со свободными местами в реальном времени. Раньше ViaFrei знал только, где находятся паркинги Констанца; теперь он говорит, сколько мест свободно прямо сейчас. Паркинг, который публикуют два источника, указан в ответе один раз, и названы оба издателя.", ask: "Где в Констанце сейчас есть свободный паркинг?" },
      bg: { title: "Паркинги в Констанц със свободни места", body: "ViaFrei вече чете паркингите на град Констанц със свободните им места на живо. Досега ViaFrei знаеше само къде се намират паркингите в Констанц; сега казва колко места са свободни в момента. Паркинг, който публикуват два източника, е посочен веднъж в отговора и се назовават и двамата издатели.", ask: "Къде в Констанц има свободен паркинг в момента?" },
      uk: { title: "Паркінги Констанца з вільними місцями", body: "ViaFrei тепер читає паркінги та парковки міста Констанц із вільними місцями в реальному часі. Досі ViaFrei знав лише, де розташовані паркінги Констанца; тепер він каже, скільки місць вільно саме зараз. Паркінг, який публікують два джерела, зазначено у відповіді один раз, і названо обох видавців.", ask: "Де в Констанці зараз є вільний паркінг?" },
      ro: { title: "Parcări din Konstanz cu locuri libere", body: "ViaFrei citește acum parcările orașului Konstanz cu locurile lor libere în timp real. Până acum ViaFrei știa doar unde sunt parcările din Konstanz; acum spune câte locuri sunt libere chiar acum. O parcare publicată de două surse apare o singură dată în răspuns, iar ambii editori sunt numiți.", ask: "Unde găsesc acum o parcare cu locuri libere în Konstanz?" },
      tr: { title: "Konstanz'daki otoparklar ve boş yerleri", body: "ViaFrei artık Konstanz şehrinin otoparklarını boş yerleriyle birlikte canlı okuyor. ViaFrei şimdiye kadar yalnızca Konstanz'daki otoparkların yerini biliyordu; şimdi şu anda kaç yerin boş olduğunu söylüyor. İki kaynağın yayımladığı bir otopark yanıtta bir kez yer alıyor ve iki yayıncının adı da veriliyor.", ask: "Konstanz'da şu anda boş yeri olan bir otopark nerede?" },
    },
  },
  {
    // 2.4.2 (#616): the Landeshauptstadt Wiesbaden's car parks and their live percentage (W-2/W-3: the publisher's
    // percentage only, no derived free count). Approved under the owner's standing "Yes to any news" (2026-10-24).
    id: "parken-wiesbaden",
    kind: "new",
    date: "2026-10-26",
    release: "2.4.2",
    issue: 616,
    credits: ["mobilithek_park_wiesbaden_static", "mobilithek_park_wiesbaden_dyn"],
    tool: "find_parking",
    text: {
      de: { title: "Parkhäuser in Wiesbaden mit ihrer Belegung", body: "ViaFrei liest jetzt die Parkhäuser und Tiefgaragen der Landeshauptstadt Wiesbaden und ihre Belegung live: zu jedem Haus, zu wie viel Prozent es laut Stadt gerade belegt ist. Ist eine Meldung älter, sagt ViaFrei, wann sie kam, statt sie als aktuell auszugeben.", ask: "Wo ist in Wiesbaden gerade ein Parkhaus frei?" },
      en: { title: "Car parks in Wiesbaden with their occupancy", body: "ViaFrei now reads the car parks and underground garages of the City of Wiesbaden and their occupancy live: for each one, how full it is right now in per cent, as the city reports it. When a report is older, ViaFrei says when it came instead of passing it off as current.", ask: "Where is there a car park with space in Wiesbaden right now?" },
      ru: { title: "Паркинги Висбадена с их загруженностью", body: "ViaFrei теперь читает паркинги и подземные гаражи города Висбаден и их загруженность в реальном времени: для каждого — на сколько процентов он сейчас занят по данным города. Если сообщение устарело, ViaFrei говорит, когда оно пришло, а не выдаёт его за актуальное.", ask: "Где в Висбадене сейчас есть свободный паркинг?" },
      bg: { title: "Паркинги във Висбаден с тяхната заетост", body: "ViaFrei вече чете паркингите и подземните гаражи на град Висбаден и тяхната заетост на живо: за всеки от тях на колко процента е зает в момента според града. Ако съобщението е по-старо, ViaFrei казва кога е дошло, вместо да го представя като актуално.", ask: "Къде във Висбаден има свободен паркинг в момента?" },
      uk: { title: "Паркінги Вісбадена з їхньою заповненістю", body: "ViaFrei тепер читає паркінги та підземні гаражі міста Вісбаден і їхню заповненість у реальному часі: для кожного — на скільки відсотків він зараз зайнятий за даними міста. Якщо повідомлення застаріле, ViaFrei каже, коли воно надійшло, а не видає його за актуальне.", ask: "Де у Вісбадені зараз є вільний паркінг?" },
      ro: { title: "Parcări etajate din Wiesbaden cu gradul lor de ocupare", body: "ViaFrei citește acum parcările etajate și subterane ale orașului Wiesbaden și gradul lor de ocupare în timp real: pentru fiecare, cât la sută este ocupată acum, după datele orașului. Când un raport este mai vechi, ViaFrei spune când a sosit, în loc să-l prezinte drept actual.", ask: "Unde găsesc acum o parcare cu locuri libere în Wiesbaden?" },
      tr: { title: "Wiesbaden'daki otoparklar ve doluluk oranları", body: "ViaFrei artık Wiesbaden şehrinin katlı ve yeraltı otoparklarını ve doluluklarını canlı okuyor: her biri için, şehrin bildirdiğine göre şu anda yüzde kaç dolu olduğu. Bir bildirim eskiyse ViaFrei onu güncelmiş gibi göstermek yerine ne zaman geldiğini söylüyor.", ask: "Wiesbaden'da şu anda yeri olan bir otopark nerede?" },
    },
  },
  {
    // 2.3.23 (#1020): the summary of the 2.3 line — the motorway pages and their panels, the new Mobilithek sources, the
    // charging operators, the strategic rerouting (named only as "when it publishes one"), the clock-change fix and the
    // connection. No figure: every count the site states is read at build time (`site/facts.ts`). Approved under the
    // owner's standing "Yes to any news" (2026-10-24). The credit lines are the 2.3 roadworks and traffic sources.
    id: "viafrei-2-3",
    kind: "new",
    date: "2026-10-25",
    release: "2.3.23",
    issue: 1020,
    // The cut (2.3.23): the "more charging operators" of the text are the four of #665, #845, #846 and #1021.
    // `mobilithek_routing_bab` (#690) is NOT credited here: its feed is empty and production holds no row of it,
    // so it waits in NEWS_DRAFTS (`strategisches-routing-autobahn`) — published ≠ live.
    credits: [
      "mobilithek_roadworks_akd",
      "mobilithek_roadworks_nrw_lvz",
      "mobilithek_traffic_nrw",
      "mobilithek_traffic_hamburg",
      "mobilithek_afir_tcbackend_stat",
      "mobilithek_afir_tcbackend_dyn",
      "mobilithek_afir_elu_stat",
      "mobilithek_afir_elu_dyn",
      "mobilithek_afir_chargepool",
      "mobilithek_afir_eliso_stat",
      "mobilithek_afir_eliso_dyn",
    ],
    tool: "check_autobahn_traffic",
    text: {
      de: { title: "ViaFrei 2.3: Autobahnseiten, mehr Quellen, mehr Assistenten", body: "Jede Autobahn hat jetzt ihre Seite mit Tafeln für Verkehr, Baustellen, Parken und Laden, jede mit dem Alter ihrer Daten. Neu sind Baustellen und Verkehrsmeldungen aus weiteren Ländern, mehr Ladesäulenbetreiber und die strategischen Umleitungsempfehlungen der Autobahn GmbH, sobald sie welche veröffentlicht. Abfahrten stimmen auch über die Zeitumstellung. ViaFrei verbinden Sie in Claude, ChatGPT und den anderen Assistenten der Verbinden-Seite – nur dann sind die Antworten live.", ask: "Wie ist die Lage auf der A3 gerade?" },
      en: { title: "ViaFrei 2.3: motorway pages, more sources, more assistants", body: "Every motorway now has its page, with panels for traffic, roadworks, parking and charging, each showing how old its data is. New are roadworks and traffic messages from more states, more charging operators, and the Autobahn GmbH's strategic rerouting advice whenever it publishes one. Departures are right across the clock change too. Connect ViaFrei in Claude, ChatGPT and the other assistants on the connect page – only then are the answers live.", ask: "What is the situation on the A3 right now?" },
      ru: { title: "ViaFrei 2.3: страницы автобанов, больше источников и ассистентов", body: "У каждого автобана теперь своя страница с панелями движения, ремонтов, парковок и зарядки, и на каждой видно, насколько свежи данные. Добавлены дорожные работы и сообщения из других земель, новые операторы зарядных станций и стратегические рекомендации объезда Autobahn GmbH, когда она их публикует. Отправления верны и при переводе часов. Подключите ViaFrei в Claude, ChatGPT и других ассистентах со страницы подключения – только тогда ответы актуальны.", ask: "Какая сейчас обстановка на A3?" },
      bg: { title: "ViaFrei 2.3: страници за магистралите, повече източници и асистенти", body: "Всяка магистрала вече има своя страница с табла за движението, ремонтите, паркирането и зареждането, всяко с възрастта на данните си. Нови са ремонтите и пътните съобщения от още провинции, повече оператори на зарядни станции и стратегическите препоръки за обход на Autobahn GmbH, когато публикува такива. Заминаванията са точни и при смяната на часовото време. Свържете ViaFrei в Claude, ChatGPT и другите асистенти от страницата за свързване – само тогава отговорите са на живо.", ask: "Каква е обстановката на A3 в момента?" },
      uk: { title: "ViaFrei 2.3: сторінки автобанів, більше джерел і асистентів", body: "Кожен автобан тепер має свою сторінку з панелями руху, ремонтів, паркування й зарядки, і на кожній видно, наскільки свіжі дані. Додано дорожні роботи й повідомлення з інших земель, нових операторів зарядних станцій і стратегічні рекомендації об’їзду Autobahn GmbH, коли вона їх публікує. Відправлення правильні й під час переведення годинника. Підключіть ViaFrei у Claude, ChatGPT та інших асистентах зі сторінки підключення – лише тоді відповіді актуальні.", ask: "Яка зараз ситуація на A3?" },
      ro: { title: "ViaFrei 2.3: pagini de autostradă, mai multe surse și asistenți", body: "Fiecare autostradă are acum pagina ei, cu panouri pentru trafic, lucrări, parcare și încărcare, fiecare arătând cât de vechi sunt datele. Noi sunt lucrările și mesajele de trafic din mai multe landuri, mai mulți operatori de încărcare și recomandările strategice de ocolire ale Autobahn GmbH, de câte ori publică una. Plecările sunt corecte și la schimbarea orei. Conectați ViaFrei în Claude, ChatGPT și ceilalți asistenți de pe pagina de conectare – doar atunci răspunsurile sunt live.", ask: "Care este situația pe A3 acum?" },
      tr: { title: "ViaFrei 2.3: otoyol sayfaları, daha çok kaynak, daha çok asistan", body: "Her otoyolun artık trafik, yol çalışmaları, otopark ve şarj panelleri olan kendi sayfası var; her panel verisinin ne kadar eski olduğunu gösterir. Yeni olanlar: daha fazla eyaletten yol çalışmaları ve trafik mesajları, daha fazla şarj işletmecisi ve Autobahn GmbH yayımladığında stratejik yön değiştirme önerileri. Kalkış saatleri saat değişiminde de doğru. ViaFrei'yi Claude, ChatGPT ve bağlantı sayfasındaki diğer asistanlara bağlayın – yanıtlar ancak o zaman canlıdır.", ask: "A3'te şu anda durum ne?" },
    },
  },
  {
    // 2.3.21 (#836, #837): drafted by access-point-dev, approved by the owner 2026-10-24 ("Yes to any news"), live with 2.3.21.
    id: "kurzzeitbaustellen-hessen",
    kind: "new",
    date: "2026-10-24",
    release: "2.3.21",
    issue: 836,
    credits: ["mobilithek_roadworks_akd", "mobilithek_roadworks_he", "mobilithek_roadworks_he_gesammelt"],
    tool: "find_roadworks_ahead",
    text: {
      de: { title: "Nachtbaustellen auf Autobahnen und Baustellen in Hessen", body: "ViaFrei kennt jetzt die geplanten Arbeitsstellen kürzerer Dauer der Autobahn GmbH: nächtliche Sperrungen und Fahrstreifen für einen Tag, jede mit ihren eigenen Zeitfenstern. Außerhalb ihres Fensters heißt eine solche Baustelle „geplant“, mit ihren Daten. Dazu kommen die Baustellen von Hessen Mobil auf Bundes- und Landesstraßen und auf einem Teil der Kreisstraßen in Hessen.", ask: "Ist die A3 heute Nacht gesperrt?" },
      en: { title: "Night works on the motorways, and roadworks in Hessen", body: "ViaFrei now knows the Autobahn GmbH's planned short-duration works: night closures and lanes for a day, each with its own time windows. Outside its window such a works is called planned, with its dates. Hessen Mobil's roadworks on federal and state roads, and on some district roads in Hessen, come with them.", ask: "Is the A3 closed tonight?" },
      ru: { title: "Ночные работы на автобанах и дорожные работы в Гессене", body: "ViaFrei теперь знает запланированные кратковременные работы Autobahn GmbH: ночные перекрытия и полосы на один день, каждая со своими временными окнами. Вне своего окна такие работы называются запланированными, с их датами. Вместе с ними — дорожные работы Hessen Mobil на федеральных и земельных дорогах и на части районных дорог в Гессене.", ask: "Перекрыта ли A3 сегодня ночью?" },
      bg: { title: "Нощни ремонти по автомагистралите и ремонти в Хесен", body: "ViaFrei вече познава планираните краткосрочни ремонти на Autobahn GmbH: нощни затваряния и ленти за един ден, всеки със свои времеви прозорци. Извън прозореца си такъв ремонт се нарича планиран, с датите си. Към тях се добавят ремонтите на Hessen Mobil по федералните и провинциалните пътища и по част от окръжните пътища в Хесен.", ask: "Затворена ли е A3 тази нощ?" },
      uk: { title: "Нічні роботи на автобанах і дорожні роботи в Гессені", body: "ViaFrei тепер знає заплановані короткочасні роботи Autobahn GmbH: нічні перекриття та смуги на один день, кожна зі своїми часовими вікнами. Поза своїм вікном такі роботи називаються запланованими, з їхніми датами. Разом із ними — дорожні роботи Hessen Mobil на федеральних і земельних дорогах та на частині районних доріг у Гессені.", ask: "Чи перекрита A3 сьогодні вночі?" },
      ro: { title: "Lucrări de noapte pe autostrăzi și lucrări rutiere în Hessa", body: "ViaFrei cunoaște acum lucrările de scurtă durată planificate ale Autobahn GmbH: închideri pe timp de noapte și benzi pentru o zi, fiecare cu propriile intervale de timp. În afara intervalului său, o astfel de lucrare este numită planificată, cu datele ei. Li se adaugă lucrările Hessen Mobil pe drumurile federale și ale landului și pe o parte din drumurile districtuale din Hessa.", ask: "Este A3 închisă la noapte?" },
      tr: { title: "Otoyollarda gece çalışmaları ve Hessen'de yol çalışmaları", body: "ViaFrei artık Autobahn GmbH'nin planlanmış kısa süreli çalışmalarını biliyor: gece kapatmaları ve bir günlük şerit çalışmaları, her biri kendi zaman aralıklarıyla. Böyle bir çalışma, kendi aralığının dışında tarihleriyle birlikte planlanmış olarak anılır. Bunlara Hessen Mobil'in Hessen'deki federal ve eyalet yollarında ve bazı ilçe yollarındaki çalışmaları ekleniyor.", ask: "A3 bu gece kapalı mı?" },
    },
  },
  {
    // 2.3.21 (#902): drafted by access-point-dev, approved by the owner 2026-10-24 ("Yes"), live with 2.3.21.
    id: "nrw-baustellen-landesstrassen",
    kind: "new",
    date: "2026-10-24",
    release: "2.3.21",
    issue: 902,
    credits: ["mobilithek_roadworks_nrw_lvz"],
    tool: "check_road_status",
    text: {
      de: { title: "Nordrhein-Westfalen: Baustellen auf Bundes-, Landes- und Kreisstraßen", body: "ViaFrei liest jetzt die Arbeitsstellen von Straßen.NRW auf den Bundes-, Landes- und Kreisstraßen in Nordrhein-Westfalen. Fragen Sie nach einer Straße oder einem Ort: ViaFrei nennt die Baustellen dort. Eine Baustelle, die erst noch beginnt, wird als geplant genannt, mit ihrem Beginn.", ask: "Gibt es Baustellen auf der L968?" },
      en: { title: "North Rhine-Westphalia: roadworks on federal, state and district roads", body: "ViaFrei now reads Straßen.NRW's roadworks on the federal, state and district roads of North Rhine-Westphalia. Ask about a road or a place and ViaFrei names the works there. Works that have not started yet are named as planned, with their start date.", ask: "Are there roadworks on the L968?" },
      ru: { title: "Северный Рейн-Вестфалия: дорожные работы на федеральных, земельных и районных дорогах", body: "ViaFrei теперь читает дорожные работы Straßen.NRW на федеральных, земельных и районных дорогах Северного Рейна-Вестфалии. Спросите о дороге или месте — ViaFrei назовёт работы там. Работы, которые ещё не начались, называются запланированными, с датой начала.", ask: "Есть ли дорожные работы на L968?" },
      bg: { title: "Северен Рейн-Вестфалия: ремонти по федералните, провинциалните и окръжните пътища", body: "ViaFrei вече чете ремонтите на Straßen.NRW по федералните, провинциалните и окръжните пътища в Северен Рейн-Вестфалия. Попитайте за път или място — ViaFrei назовава ремонтите там. Ремонт, който още не е започнал, се посочва като планиран, с датата на началото си.", ask: "Има ли ремонти по L968?" },
      uk: { title: "Північний Рейн-Вестфалія: дорожні роботи на федеральних, земельних і районних дорогах", body: "ViaFrei тепер читає дорожні роботи Straßen.NRW на федеральних, земельних і районних дорогах Північного Рейну-Вестфалії. Запитайте про дорогу чи місце — ViaFrei назве роботи там. Роботи, які ще не почалися, називаються запланованими, з датою початку.", ask: "Чи є дорожні роботи на L968?" },
      ro: { title: "Renania de Nord-Westfalia: lucrări pe drumurile federale, de land și de district", body: "ViaFrei citește acum lucrările Straßen.NRW de pe drumurile federale, de land și de district din Renania de Nord-Westfalia. Întrebați despre un drum sau un loc și ViaFrei numește lucrările de acolo. Lucrările care nu au început încă sunt numite planificate, cu data de început.", ask: "Sunt lucrări pe L968?" },
      tr: { title: "Kuzey Ren-Vestfalya: federal, eyalet ve ilçe yollarında yol çalışmaları", body: "ViaFrei artık Straßen.NRW'nin Kuzey Ren-Vestfalya'daki federal, eyalet ve ilçe yollarındaki yol çalışmalarını okuyor. Bir yolu ya da bir yeri sorun, ViaFrei oradaki çalışmaları söyler. Henüz başlamamış çalışmalar başlangıç tarihleriyle birlikte planlanmış olarak söylenir.", ask: "L968'de yol çalışması var mı?" },
    },
  },
  {
    // 2.3.21 (#941): drafted by access-point-dev, approved by the owner 2026-10-24 ("Yes"), live with 2.3.21.
    id: "ausfallsicherheit-verkehrsmeldungen",
    kind: "new",
    date: "2026-10-24",
    release: "2.3.21",
    issue: 941,
    // 2.5.2 (#1121): VIZ.NRW's Einzeldatensätze are the NMS failover twin of the same messages — this entry's subject.
    credits: ["mobilithek_traffic_nrw", "mobilithek_traffic_hamburg", "mobilithek_roadworks_mv_planned", "mobilithek_los_nrw_lanes", "mobilithek_traffic_nrw_einzel"],
    tool: "check_road_status",
    text: {
      de: { title: "Mehr Ausfallsicherheit für Verkehrsmeldungen und Verkehrslage", body: "ViaFrei liest jetzt auch die Verkehrsmeldungen von VIZ.NRW und der Landesmeldestelle Hamburg. Dazu kommen die geplanten Baustellen in Mecklenburg-Vorpommern und die Verkehrslage je Fahrstreifen auf den Autobahnen in NRW. Jede Meldung erscheint nur einmal, und jede Quelle, die sie trägt, wird genannt. Fällt eine Quelle aus, antwortet ViaFrei aus der anderen.", ask: "Gibt es gerade Verkehrsmeldungen in Hamburg?" },
      en: { title: "More resilience for traffic messages and traffic flow", body: "ViaFrei now also reads the traffic messages of VIZ.NRW and of the Hamburg traffic reporting centre. It also reads planned roadworks in Mecklenburg-Western Pomerania and the traffic flow per lane on the motorways of North Rhine-Westphalia. Each message is shown once, and every source that carries it is named. If one source fails, ViaFrei answers from the other.", ask: "Are there any traffic messages in Hamburg right now?" },
      ru: { title: "Больше надёжности для дорожных сообщений и обстановки на дорогах", body: "ViaFrei теперь читает и дорожные сообщения VIZ.NRW и земельного центра дорожных сообщений Гамбурга. Кроме того, добавлены запланированные дорожные работы в Мекленбурге-Передней Померании и обстановка по каждой полосе на автобанах Северного Рейна-Вестфалии. Каждое сообщение показывается один раз, и называется каждый источник, который его передаёт. Если один источник отказывает, ViaFrei отвечает по другому.", ask: "Есть ли сейчас дорожные сообщения в Гамбурге?" },
      bg: { title: "Повече надеждност за пътните съобщения и пътната обстановка", body: "ViaFrei вече чете и пътните съобщения на VIZ.NRW и на провинциалния център за пътни съобщения в Хамбург. Добавени са и планираните ремонти в Мекленбург-Предна Померания и обстановката по всяка лента на магистралите в Северен Рейн-Вестфалия. Всяко съобщение се показва веднъж и се посочва всеки източник, който го носи. Ако един източник откаже, ViaFrei отговаря от другия.", ask: "Има ли в момента пътни съобщения в Хамбург?" },
      uk: { title: "Більше надійності для дорожніх повідомлень і ситуації на дорогах", body: "ViaFrei тепер читає й дорожні повідомлення VIZ.NRW та земельного центру дорожніх повідомлень Гамбурга. Також додано заплановані дорожні роботи в Мекленбурзі-Передній Померанії та ситуацію на кожній смузі автобанів Північного Рейну-Вестфалії. Кожне повідомлення показується один раз, і називається кожне джерело, що його передає. Якщо одне джерело відмовляє, ViaFrei відповідає з іншого.", ask: "Чи є зараз дорожні повідомлення в Гамбурзі?" },
      ro: { title: "Mai multă siguranță pentru mesajele de trafic și situația traficului", body: "ViaFrei citește acum și mesajele de trafic ale VIZ.NRW și ale centrului de raportare a traficului din Hamburg. Se adaugă lucrările planificate din Mecklenburg-Pomerania Inferioară și situația traficului pe fiecare bandă pe autostrăzile din Renania de Nord-Westfalia. Fiecare mesaj apare o singură dată și este numită fiecare sursă care îl transmite. Dacă o sursă cade, ViaFrei răspunde din cealaltă.", ask: "Sunt acum mesaje de trafic în Hamburg?" },
      tr: { title: "Trafik mesajları ve trafik durumu için daha fazla güvenilirlik", body: "ViaFrei artık VIZ.NRW'nin ve Hamburg eyalet trafik bildirim merkezinin trafik mesajlarını da okuyor. Buna Mecklenburg-Ön Pomeranya'daki planlanmış yol çalışmaları ve Kuzey Ren-Vestfalya otoyollarında şerit başına trafik durumu ekleniyor. Her mesaj bir kez gösterilir ve onu taşıyan her kaynak belirtilir. Bir kaynak devre dışı kalırsa ViaFrei diğerinden yanıt verir.", ask: "Hamburg'da şu anda trafik mesajı var mı?" },
    },
  },
  {
    // 2.2.9 integration, approved by the owner 2026-10-19 ("I approve news"), live with 2.2.10 after the prod check.
    id: "lkw-beschraenkungen-koeln",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.9",
    issue: 843,
    credits: ["lorry_koeln_beschraenkungen"],
    tool: "check_road_status",
    text: {
      de: { title: "Gewichts- und Höhengrenzen der Stadt Köln", body: "ViaFrei liest jetzt die Straßenbeschränkungen, die die Stadt Köln veröffentlicht: Gewichtsgrenzen an Brücken, Durchfahrtshöhen an Unterführungen und weitere Lkw-Verbote. Für einen Ort in Köln nennt ViaFrei die nächsten mit Art, Wert und Straße; fehlt ein Wert, sagt ViaFrei das. Es gilt die Beschilderung vor Ort.", ask: "Welche Durchfahrtshöhen gibt es für Lkw am Kölner Dom?" },
      en: { title: "Cologne's weight and height limits", body: "ViaFrei now reads the road restrictions the City of Cologne publishes: weight limits on bridges, clearance heights at underpasses and other lorry bans. For a place in Cologne, ViaFrei names the nearest with their kind, value and street; where a value is missing, ViaFrei says so. The signs on site apply.", ask: "Which clearance heights apply to lorries near Cologne Cathedral?" },
      ru: { title: "Ограничения по массе и высоте в Кёльне", body: "ViaFrei теперь читает дорожные ограничения, которые публикует город Кёльн: ограничения массы на мостах, высоту проезда под путепроводами и другие запреты для грузовиков. Для места в Кёльне ViaFrei называет ближайшие с их видом, значением и улицей; если значение не указано, ViaFrei так и говорит. Действуют знаки на месте.", ask: "Какие ограничения высоты для грузовиков есть у Кёльнского собора?" },
      bg: { title: "Ограничения за маса и височина в Кьолн", body: "ViaFrei вече чете пътните ограничения, които публикува град Кьолн: ограничения на масата по мостове, височини за преминаване под подлези и други забрани за камиони. За място в Кьолн ViaFrei посочва най-близките с вида, стойността и улицата; ако стойност липсва, ViaFrei го казва. Важат знаците на място.", ask: "Какви ограничения на височината за камиони има край катедралата в Кьолн?" },
      uk: { title: "Обмеження маси й висоти в Кельні", body: "ViaFrei тепер читає дорожні обмеження, які публікує місто Кельн: обмеження маси на мостах, висоту проїзду під шляхопроводами та інші заборони для вантажівок. Для місця в Кельні ViaFrei називає найближчі з їхнім видом, значенням і вулицею; якщо значення не вказано, ViaFrei так і каже. Діють знаки на місці.", ask: "Які обмеження висоти для вантажівок є біля Кельнського собору?" },
      ro: { title: "Limitele de masă și înălțime din Köln", body: "ViaFrei citește acum restricțiile rutiere pe care le publică orașul Köln: limite de masă pe poduri, înălțimi de trecere la pasaje și alte interdicții pentru camioane. Pentru un loc din Köln, ViaFrei le numește pe cele mai apropiate, cu tipul, valoarea și strada; când lipsește o valoare, ViaFrei spune asta. Se aplică indicatoarele de pe teren.", ask: "Ce limite de înălțime pentru camioane sunt lângă catedrala din Köln?" },
      tr: { title: "Köln'ün ağırlık ve yükseklik sınırları", body: "ViaFrei artık Köln şehrinin yayımladığı yol kısıtlamalarını okuyor: köprülerdeki ağırlık sınırları, alt geçitlerdeki yükseklik sınırları ve diğer kamyon yasakları. Köln'deki bir yer için ViaFrei en yakınları türü, değeri ve sokağıyla veriyor; bir değer yoksa ViaFrei bunu söylüyor. Yerindeki işaretler geçerlidir.", ask: "Köln Katedrali çevresinde kamyonlar için hangi yükseklik sınırları var?" },
    },
  },
  {
    // 2.2.9 integration, approved by the owner 2026-10-19 ("I approve news"), live with 2.2.10 after the prod check.
    id: "parken-kiel",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.9",
    issue: 608,
    credits: ["kiel_parkplaetze", "kiel_park_ride"],
    tool: "find_parking",
    text: {
      de: { title: "Parkplätze, Parkhäuser und P+R in Kiel", body: "ViaFrei liest jetzt die Parkplätze, Parkhäuser, Tiefgaragen und Park-&-Ride-Anlagen, die die Landeshauptstadt Kiel veröffentlicht: 194 Standorte mit ihrer Lage und Art. Die Stadt veröffentlicht dazu weder die Zahl der Plätze noch die Belegung, und ViaFrei sagt das, statt eine Zahl zu erfinden.", ask: "Wo gibt es in Kiel ein Parkhaus?" },
      en: { title: "Car parks, multi-storeys and P+R in Kiel", body: "ViaFrei now reads the car parks, multi-storey car parks, underground garages and Park & Ride sites the City of Kiel publishes: 194 sites with their location and kind. The city publishes neither the number of spaces nor the occupancy, and ViaFrei says so instead of inventing a figure.", ask: "Where is there a multi-storey car park in Kiel?" },
      ru: { title: "Парковки, паркинги и P+R в Киле", body: "ViaFrei теперь читает парковки, многоэтажные и подземные паркинги и площадки Park & Ride, которые публикует город Киль: 194 мест с их расположением и типом. Город не публикует ни количество мест, ни загрузку, и ViaFrei так и говорит, а не выдумывает число.", ask: "Где в Киле есть многоэтажный паркинг?" },
      bg: { title: "Паркинги, многоетажни паркинги и P+R в Кил", body: "ViaFrei вече чете паркингите, многоетажните и подземните паркинги и площадките Park & Ride, които публикува град Кил: 194 места с тяхното местоположение и вид. Градът не публикува нито броя на местата, нито заетостта, и ViaFrei го казва, вместо да измисля число.", ask: "Къде в Кил има многоетажен паркинг?" },
      uk: { title: "Парковки, паркінги та P+R у Кілі", body: "ViaFrei тепер читає парковки, багатоповерхові й підземні паркінги та майданчики Park & Ride, які публікує місто Кіль: 194 місць з їхнім розташуванням і типом. Місто не публікує ні кількості місць, ні заповненості, і ViaFrei так і каже, а не вигадує число.", ask: "Де в Кілі є багатоповерховий паркінг?" },
      ro: { title: "Parcări, parcări supraetajate și P+R în Kiel", body: "ViaFrei citește acum parcările, parcările supraetajate și subterane și parcările Park & Ride pe care le publică orașul Kiel: 194 locații, cu poziția și tipul lor. Orașul nu publică nici numărul de locuri, nici gradul de ocupare, iar ViaFrei spune asta în loc să inventeze o cifră.", ask: "Unde există o parcare supraetajată în Kiel?" },
      tr: { title: "Kiel'de otoparklar, katlı otoparklar ve P+R", body: "ViaFrei artık Kiel şehrinin yayımladığı otoparkları, katlı ve yeraltı otoparklarını ve Park & Ride alanlarını okuyor: konumu ve türüyle 194 yer. Şehir ne yer sayısını ne de doluluğu yayımlıyor; ViaFrei bir sayı uydurmak yerine bunu söylüyor.", ask: "Kiel'de nerede katlı otopark var?" },
    },
  },
  {
    // 2.2.9 integration, approved by the owner 2026-10-19 ("I approve news"), live with 2.2.10 after the prod check.
    id: "behindertenparkplaetze-frankfurt",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.9",
    issue: 614,
    credits: ["frankfurt_behindertenparkplaetze"],
    tool: "find_parking",
    text: {
      de: { title: "Behindertenparkplätze in Frankfurt am Main", body: "ViaFrei kennt jetzt die 458 Standorte mit Behindertenparkplätzen, die die Stadt Frankfurt am Main veröffentlicht, zusammen 615 reservierte Plätze, jeweils mit Anschrift, Zahl der Plätze und den Zeiten, zu denen sie reserviert sind. Ein Sensor meldet dort nicht, ob ein Platz frei ist, und ViaFrei sagt das, statt es zu raten.", ask: "Wo ist in Frankfurt ein Behindertenparkplatz in der Nähe des Römers?" },
      en: { title: "Disabled-badge bays in Frankfurt am Main", body: "ViaFrei now knows the 458 sites with disabled-badge bays the City of Frankfurt am Main publishes, 615 reserved spaces in all, each with its address, the number of spaces and the times they are reserved. No sensor reports whether a space is free, and ViaFrei says so instead of guessing.", ask: "Where is a disabled-badge bay near the Römer in Frankfurt?" },
      ru: { title: "Парковочные места для людей с инвалидностью во Франкфурте-на-Майне", body: "ViaFrei теперь знает 458 мест с парковками для людей с инвалидностью, которые публикует город Франкфурт-на-Майне, всего 615 зарезервированных мест — с адресом, числом мест и временем, когда они зарезервированы. Датчика, сообщающего, свободно ли место, там нет, и ViaFrei так и говорит, а не гадает.", ask: "Где во Франкфурте есть парковка для людей с инвалидностью рядом с Рёмером?" },
      bg: { title: "Места за паркиране на хора с увреждания във Франкфурт на Майн", body: "ViaFrei вече познава 458-те обекта с места за хора с увреждания, които публикува град Франкфурт на Майн — общо 615 запазени места, всяко с адрес, брой места и часовете, в които е запазено. Няма сензор, който да казва дали мястото е свободно, и ViaFrei го казва, вместо да гадае.", ask: "Къде във Франкфурт има място за хора с увреждания близо до Рьомер?" },
      uk: { title: "Паркувальні місця для людей з інвалідністю у Франкфурті-на-Майні", body: "ViaFrei тепер знає 458 місць із паркуванням для людей з інвалідністю, які публікує місто Франкфурт-на-Майні, разом 615 зарезервованих місць — з адресою, кількістю місць і часом, коли вони зарезервовані. Датчика, який повідомляв би, чи вільне місце, там немає, і ViaFrei так і каже, а не вгадує.", ask: "Де у Франкфурті є паркування для людей з інвалідністю біля Ремера?" },
      ro: { title: "Locuri de parcare pentru persoane cu dizabilități în Frankfurt am Main", body: "ViaFrei cunoaște acum cele 458 de amplasamente cu locuri pentru persoane cu dizabilități pe care le publică orașul Frankfurt am Main, în total 615 locuri rezervate, fiecare cu adresa, numărul de locuri și orele în care este rezervat. Niciun senzor nu arată dacă un loc este liber, iar ViaFrei spune asta în loc să ghicească.", ask: "Unde este un loc de parcare pentru persoane cu dizabilități lângă Römer, în Frankfurt?" },
      tr: { title: "Frankfurt am Main'de engelli park yerleri", body: "ViaFrei artık Frankfurt am Main şehrinin yayımladığı, engelli park yeri bulunan 458 konumu biliyor: toplam 615 ayrılmış yer, her biri adresi, yer sayısı ve ayrıldığı saatlerle. Bir yerin boş olup olmadığını bildiren bir sensör yok; ViaFrei tahmin etmek yerine bunu söylüyor.", ask: "Frankfurt'ta Römer yakınında nerede engelli park yeri var?" },
    },
  },
  {
    // 2.2.9 (#615): drafted by ingest-dev, approved by the owner 2026-10-19 ("sure"), live after the prod check.
    // Dated as the 2.2.9 block, which the cut re-dates. The text holds the answer's rule: the city's
    // network, its classes and streets, its date, and that it is no all-clear.
    id: "lkw-netz-koeln",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.9",
    issue: 615,
    credits: ["lorry_koeln_verbindungen"],
    tool: "check_road_status",
    text: {
      de: { title: "Das Lkw-Netz der Stadt Köln", body: "ViaFrei liest jetzt die Lkw-Verbindungen, die die Stadt Köln veröffentlicht: die Straßen, über die die Stadt den Lkw-Verkehr führt, in vier Klassen von der Autobahn bis zur Verbindung für den Lieferverkehr. Für einen Ort in Köln nennt ViaFrei den nächsten Abschnitt jeder Klasse mit seinen Straßen und dem Stand der Daten, neben den Lkw-Beschränkungen aus SEVAS. Das Netz ist keine Freigabe: Es gilt die Beschilderung vor Ort.", ask: "Über welche Straßen führt Köln den Lkw-Verkehr am Dom?" },
      en: { title: "Cologne's own lorry network", body: "ViaFrei now reads the lorry connections the City of Cologne publishes: the streets the city routes lorry traffic over, in four classes from the motorway to the connection for deliveries. For a place in Cologne, ViaFrei names the nearest section of each class with its streets and the date of the data, beside the lorry restrictions from SEVAS. The network is not an all-clear: the signs on site apply.", ask: "Which streets does Cologne route lorries over near the cathedral?" },
      ru: { title: "Сеть для грузовиков города Кёльна", body: "ViaFrei теперь читает маршруты для грузовиков, которые публикует город Кёльн: улицы, по которым город направляет грузовое движение, в четырёх классах — от автобана до подъездов для доставки. Для места в Кёльне ViaFrei называет ближайший участок каждого класса с его улицами и датой данных, рядом с ограничениями для грузовиков из SEVAS. Эта сеть не означает, что проезд разрешён: действуют дорожные знаки на месте.", ask: "По каким улицам Кёльн направляет грузовики у собора?" },
      bg: { title: "Мрежата за камиони на град Кьолн", body: "ViaFrei вече чете връзките за камиони, които публикува град Кьолн: улиците, по които градът насочва движението на камиони, в четири класа — от магистралата до връзката за доставки. За място в Кьолн ViaFrei посочва най-близкия участък от всеки клас с неговите улици и датата на данните, редом с ограниченията за камиони от SEVAS. Мрежата не е разрешение: важат пътните знаци на място.", ask: "По кои улици Кьолн насочва камионите край катедралата?" },
      uk: { title: "Мережа для вантажівок міста Кельна", body: "ViaFrei тепер читає маршрути для вантажівок, які публікує місто Кельн: вулиці, якими місто спрямовує вантажний рух, у чотирьох класах — від автобану до під'їздів для доставки. Для місця в Кельні ViaFrei називає найближчу ділянку кожного класу з її вулицями та датою даних, поруч з обмеженнями для вантажівок із SEVAS. Ця мережа не означає дозволу: діють дорожні знаки на місці.", ask: "Якими вулицями Кельн спрямовує вантажівки біля собору?" },
      ro: { title: "Rețeaua pentru camioane a orașului Köln", body: "ViaFrei citește acum legăturile pentru camioane pe care le publică orașul Köln: străzile pe care orașul dirijează traficul de camioane, în patru clase, de la autostradă până la legătura pentru livrări. Pentru un loc din Köln, ViaFrei numește cel mai apropiat tronson din fiecare clasă, cu străzile lui și data datelor, alături de restricțiile pentru camioane din SEVAS. Rețeaua nu înseamnă că drumul e liber: se aplică indicatoarele de pe teren.", ask: "Pe ce străzi dirijează Köln camioanele lângă catedrală?" },
      tr: { title: "Köln şehrinin kamyon ağı", body: "ViaFrei artık Köln şehrinin yayımladığı kamyon bağlantılarını okuyor: şehrin kamyon trafiğini yönlendirdiği sokaklar, otoyoldan teslimat bağlantısına kadar dört sınıfta. Köln'deki bir yer için ViaFrei her sınıfın en yakın kesimini sokaklarıyla ve verinin tarihiyle, SEVAS'taki kamyon kısıtlamalarının yanında veriyor. Bu ağ bir serbest geçiş izni değildir: yerindeki trafik işaretleri geçerlidir.", ask: "Köln katedral çevresinde kamyonları hangi sokaklardan yönlendiriyor?" },
    },
  },
  {
    // 2.2.6 (#568, #572): drafted by ingest-dev, approved by the owner 2026-10-19. The text holds the read rule:
    // measured, not reported; dicht is never a jam; Hamburg lists only what is not flowing, so no free count.
    id: "verkehrslage-hamburg-bonn",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.6",
    issue: 568,
    credits: ["hh_verkehrslage", "bonn_verkehrslage"],
    tool: "check_road_status",
    text: {
      de: { title: "Hamburg und Bonn: die gemessene Verkehrslage in der Stadt", body: "ViaFrei liest jetzt alle fünf Minuten die Verkehrslage, die Hamburg und Bonn für ihre Straßen veröffentlichen, und sagt für einen Ort, wie viele Abschnitte im Umkreis von 10 km dicht, zähfließend oder im Stillstand sind und wie weit der nächste Stau entfernt ist. Als Stau zählt nur zähfließender Verkehr oder Stillstand, dichter Verkehr nicht. Hamburg veröffentlicht nur die Abschnitte, die nicht frei fließen, deshalb nennt ViaFrei dort keine Zahl freier Abschnitte. Ist der Stand der Stadt älter als 30 Minuten, sagt ViaFrei nichts dazu.", ask: "Wie ist der Verkehr gerade in Hamburg?" },
      en: { title: "Hamburg and Bonn: the measured traffic state in the city", body: "ViaFrei now reads, every five minutes, the traffic state Hamburg and Bonn publish for their streets, and says for a place how many segments within 10 km are heavy, slow-moving or at a standstill and how far away the nearest jam is. Only slow-moving traffic or a standstill counts as a jam, heavy traffic does not. Hamburg publishes only the segments that are not flowing freely, so ViaFrei gives no count of free segments there. When the city's reading is older than 30 minutes, ViaFrei says nothing about it.", ask: "How is the traffic in Hamburg right now?" },
      ru: { title: "Гамбург и Бонн: измеренная дорожная обстановка в городе", body: "ViaFrei теперь каждые пять минут читает дорожную обстановку, которую Гамбург и Бонн публикуют для своих улиц, и говорит для места, сколько участков в радиусе 10 км с плотным, медленным движением или в заторе и как далеко ближайшая пробка. Пробкой считается только медленное движение или затор, плотное движение — нет. Гамбург публикует только участки, где движение не свободное, поэтому там ViaFrei не называет число свободных участков. Если данные города старше 30 минут, ViaFrei о них ничего не говорит.", ask: "Какая сейчас обстановка на дорогах Гамбурга?" },
      bg: { title: "Хамбург и Бон: измерената пътна обстановка в града", body: "ViaFrei вече чете на всеки пет минути пътната обстановка, която Хамбург и Бон публикуват за своите улици, и казва за едно място колко участъка в радиус 10 км са с натоварено, бавно движение или в застой и колко далеч е най-близкото задръстване. За задръстване се смята само бавното движение или застоят, натовареното движение — не. Хамбург публикува само участъците, където движението не е свободно, затова там ViaFrei не дава броя на свободните участъци. Ако данните на града са по-стари от 30 минути, ViaFrei не казва нищо за тях.", ask: "Какво е движението в Хамбург в момента?" },
      uk: { title: "Гамбург і Бонн: виміряна дорожня ситуація в місті", body: "ViaFrei тепер кожні п'ять хвилин читає дорожню ситуацію, яку Гамбург і Бонн публікують для своїх вулиць, і каже для місця, скільки ділянок у радіусі 10 км мають щільний, повільний рух або стоять і як далеко найближчий затор. Затором вважається лише повільний рух або зупинка, щільний рух — ні. Гамбург публікує лише ділянки, де рух не вільний, тому там ViaFrei не називає кількість вільних ділянок. Якщо дані міста старші за 30 хвилин, ViaFrei нічого про них не каже.", ask: "Яка зараз ситуація на дорогах Гамбурга?" },
      ro: { title: "Hamburg și Bonn: starea traficului măsurată în oraș", body: "ViaFrei citește acum, la fiecare cinci minute, starea traficului pe care Hamburg și Bonn o publică pentru străzile lor și spune, pentru un loc, câte segmente pe o rază de 10 km sunt aglomerate, cu circulație lentă sau blocate și cât de departe este cel mai apropiat ambuteiaj. Doar circulația lentă sau blocajul contează drept ambuteiaj, traficul aglomerat nu. Hamburg publică doar segmentele unde circulația nu este liberă, așa că acolo ViaFrei nu dă un număr de segmente libere. Când datele orașului sunt mai vechi de 30 de minute, ViaFrei nu spune nimic despre ele.", ask: "Cum este traficul acum în Hamburg?" },
      tr: { title: "Hamburg ve Bonn: şehirde ölçülen trafik durumu", body: "ViaFrei artık Hamburg ve Bonn'un sokakları için yayımladığı trafik durumunu beş dakikada bir okuyor ve bir yer için 10 km içinde kaç kesimin yoğun, yavaş akan veya duran trafikte olduğunu ve en yakın sıkışıklığın ne kadar uzakta olduğunu söylüyor. Yalnızca yavaş akan veya duran trafik sıkışıklık sayılıyor, yoğun trafik sayılmıyor. Hamburg yalnızca serbest akmayan kesimleri yayımladığı için ViaFrei orada serbest kesim sayısı vermiyor. Şehrin verisi 30 dakikadan eskiyse ViaFrei bu konuda bir şey söylemiyor.", ask: "Hamburg'da şu an trafik nasıl?" },
    },
  },
  {
    // 2.2.6 (#574, #575): drafted by ingest-dev, approved by the owner 2026-10-19.
    id: "muenchen-baustellen-umweltzone",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.6",
    issue: 574,
    credits: ["muenchen_baustellen", "muenchen_umweltzone"],
    tool: "find_roadworks_ahead",
    text: {
      de: { title: "München: Baustellen der Stadt und die eigene Grenze der Umweltzone", body: "ViaFrei liest jetzt die Baustellen, die die Landeshauptstadt München für die nächsten vier Wochen veröffentlicht, und die Grenze ihrer Umweltzone mit den freigegebenen Transferflächen. Die Stadt trägt Baustellen vor allem in der Innenstadt und an den Hauptverkehrsstraßen ein; das steht bei jeder Antwort. Vorübergehende Haltverbote gelten nicht als Einschränkung der Fahrbahn. Bei der Umweltzone entscheidet die Grenze der Stadt, das Verzeichnis des Umweltbundesamts steht daneben.", ask: "Welche Baustellen gibt es diese Woche in München?" },
      en: { title: "Munich: the city's roadworks and its own low-emission-zone boundary", body: "ViaFrei now reads the roadworks the City of Munich publishes for the next four weeks, and the boundary of its low-emission zone with the released transfer areas. The city records roadworks mainly in the inner districts and on main roads; every answer says so. A temporary no-stopping zone is not counted as a restriction of the carriageway. For the zone, the city's own boundary decides, with the Umweltbundesamt's register beside it.", ask: "Which roadworks are there in Munich this week?" },
      ru: { title: "Мюнхен: дорожные работы города и собственная граница экологической зоны", body: "ViaFrei теперь читает дорожные работы, которые город Мюнхен публикует на ближайшие четыре недели, и границу его экологической зоны с освобождёнными переходными участками. Город вносит работы в основном в центре и на главных улицах; об этом говорится в каждом ответе. Временный запрет остановки не считается ограничением проезжей части. Для экологической зоны решает граница города, реестр Федерального ведомства по охране окружающей среды указан рядом.", ask: "Какие дорожные работы идут на этой неделе в Мюнхене?" },
      bg: { title: "Мюнхен: ремонтите на града и собствената граница на екологичната зона", body: "ViaFrei вече чете ремонтите, които град Мюнхен публикува за следващите четири седмици, и границата на екологичната му зона с освободените преходни площи. Градът вписва ремонтите основно в центъра и по главните улици; това се казва във всеки отговор. Временната забрана за спиране не се смята за ограничение на платното. За екологичната зона решава границата на града, а регистърът на Федералната служба по околна среда стои до нея.", ask: "Какви ремонти има тази седмица в Мюнхен?" },
      uk: { title: "Мюнхен: дорожні роботи міста та власна межа екологічної зони", body: "ViaFrei тепер читає дорожні роботи, які місто Мюнхен публікує на наступні чотири тижні, і межу його екологічної зони зі звільненими перехідними ділянками. Місто вносить роботи переважно в центрі та на головних вулицях; про це сказано в кожній відповіді. Тимчасова заборона зупинки не вважається обмеженням проїзної частини. Для екологічної зони вирішує межа міста, реєстр Федерального відомства з охорони довкілля наведено поруч.", ask: "Які дорожні роботи тривають цього тижня в Мюнхені?" },
      ro: { title: "München: lucrările orașului și propria limită a zonei cu emisii reduse", body: "ViaFrei citește acum lucrările rutiere pe care orașul München le publică pentru următoarele patru săptămâni și limita zonei sale cu emisii reduse, cu suprafețele de tranzit exceptate. Orașul înregistrează lucrările mai ales în centru și pe arterele principale; fiecare răspuns spune acest lucru. O interdicție temporară de oprire nu este socotită restricție a carosabilului. Pentru zonă decide limita orașului, iar registrul Agenției Federale de Mediu apare alături.", ask: "Ce lucrări rutiere sunt săptămâna aceasta în München?" },
      tr: { title: "Münih: belediyenin yol çalışmaları ve düşük emisyon bölgesinin kendi sınırı", body: "ViaFrei artık Münih Belediyesi'nin önümüzdeki dört hafta için yayımladığı yol çalışmalarını ve düşük emisyon bölgesinin sınırını, serbest bırakılan geçiş alanlarıyla birlikte okuyor. Belediye çalışmaları çoğunlukla şehir merkezinde ve ana caddelerde kaydediyor; her yanıtta bu belirtiliyor. Geçici durma yasağı, taşıt yolunun kısıtlanması sayılmıyor. Bölge için belediyenin kendi sınırı belirleyici, Federal Çevre Ajansı'nın kaydı yanında yer alıyor.", ask: "Bu hafta Münih'te hangi yol çalışmaları var?" },
    },
  },
  {
    // 2.2.6 (#638): drafted by ingest-dev, approved by the owner 2026-10-19.
    id: "lang-lkw-positivnetz",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.6",
    issue: 638,
    credits: ["lorry_bast_langlkw", "lorry_hh_langlkw"],
    tool: "check_road_status",
    text: {
      de: { title: "Darf der Lang-Lkw hier fahren? Das Positivnetz der BASt", body: "ViaFrei liest jetzt den Auszug der Bundesanstalt für Straßen- und Verkehrswesen aus dem Positivnetz für Lang-Lkw und sagt für eine Straße, ob sie darin verzeichnet ist, und für einen Ort, welche Strecken in der Nähe dazugehören. Der Auszug ist laut BASt weder vollständig noch rechtlich verbindlich und nicht für die Navigation gedacht; verbindlich ist die Verordnung, und ViaFrei sagt das bei jeder Antwort dazu. Hamburgs Netz aus dem Feldversuch nennt ViaFrei mit seinem Stand von 2015.", ask: "Darf ich mit dem Lang-Lkw auf die A7?" },
      en: { title: "May a long lorry drive here? BASt's positive network", body: "ViaFrei now reads the Federal Highway Research Institute's extract of the positive network for long lorries and says for a road whether it is listed, and for a place which roads nearby belong to it. BASt states that the extract is neither complete nor legally binding and not meant for navigation; the ordinance is what binds, and ViaFrei says so with every answer. Hamburg's network from the field trial is given with its 2015 date.", ask: "May I take a long lorry on the A7?" },
      ru: { title: "Можно ли здесь ехать на удлинённом грузовике? Сеть BASt", body: "ViaFrei теперь читает выписку Федерального научно-исследовательского института дорог из сети для удлинённых грузовиков и говорит для дороги, внесена ли она в эту сеть, а для места — какие участки поблизости в неё входят. По словам BASt, выписка не является ни полной, ни юридически обязательной и не предназначена для навигации; обязательным является постановление, и ViaFrei говорит об этом в каждом ответе. Сеть Гамбурга из полевого испытания ViaFrei называет с её состоянием на 2015 год.", ask: "Можно ли мне на удлинённом грузовике выехать на A7?" },
      bg: { title: "Може ли удължен камион да се движи тук? Мрежата на BASt", body: "ViaFrei вече чете извлечението на Федералния институт за пътни изследвания от мрежата за удължени камиони и казва за един път дали е включен в нея, а за едно място — кои участъци наблизо са част от нея. Според BASt извлечението не е нито пълно, нито правно обвързващо и не е предназначено за навигация; обвързваща е наредбата и ViaFrei го казва при всеки отговор. Мрежата на Хамбург от полевото изпитване ViaFrei посочва с данните ѝ от 2015 г.", ask: "Мога ли с удължен камион да карам по A7?" },
      uk: { title: "Чи можна тут їхати подовженою вантажівкою? Мережа BASt", body: "ViaFrei тепер читає витяг Федерального науково-дослідного інституту доріг із мережі для подовжених вантажівок і каже для дороги, чи внесена вона до цієї мережі, а для місця — які ділянки поблизу до неї належать. За словами BASt, витяг не є ні повним, ні юридично обов'язковим і не призначений для навігації; обов'язковою є постанова, і ViaFrei каже про це в кожній відповіді. Мережу Гамбурга з польового випробування ViaFrei називає з її станом на 2015 рік.", ask: "Чи можна мені подовженою вантажівкою виїхати на A7?" },
      ro: { title: "Poate circula aici un camion lung? Rețeaua BASt", body: "ViaFrei citește acum extrasul Institutului Federal de Cercetări Rutiere din rețeaua pentru camioane lungi și spune, pentru un drum, dacă este inclus în ea, iar pentru un loc, ce tronsoane din apropiere fac parte din ea. Potrivit BASt, extrasul nu este nici complet, nici obligatoriu din punct de vedere juridic și nu este destinat navigației; obligatorie este ordonanța, iar ViaFrei spune asta la fiecare răspuns. Rețeaua din Hamburg din testul pilot este dată cu situația din 2015.", ask: "Pot circula cu un camion lung pe A7?" },
      tr: { title: "Uzun kamyon burada gidebilir mi? BASt'ın ağı", body: "ViaFrei artık Federal Karayolu Araştırma Enstitüsü'nün uzun kamyonlar için ağdan aldığı özeti okuyor ve bir yol için bu ağda yer alıp almadığını, bir yer için de yakındaki hangi kesimlerin bu ağa ait olduğunu söylüyor. BASt'a göre özet ne eksiksiz ne de hukuken bağlayıcıdır ve navigasyon için düşünülmemiştir; bağlayıcı olan yönetmeliktir ve ViaFrei bunu her yanıtta belirtiyor. Hamburg'un saha denemesinden kalan ağını ViaFrei 2015 tarihli hâliyle veriyor.", ask: "Uzun kamyonla A7'ye çıkabilir miyim?" },
    },
  },
  {
    // 2.2.6 (#641): drafted by ingest-dev, approved by the owner 2026-10-19. The text holds the ruling's conditions:
    // the values as published, the signs on site binding, not for route guidance.
    id: "durchfahrtshoehen-bremen",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.6",
    issue: 641,
    credits: ["lorry_hb_durchfahrtshoehen", "lorry_hb_fuehrungshoehen"],
    tool: "check_road_status",
    text: {
      de: { title: "Durchfahrtshöhen und Gewichtsgrenzen in Bremen", body: "ViaFrei liest jetzt die Durchfahrtshöhen und Gewichtsgrenzen, die die Verkehrsmanagementzentrale Bremen für Lkw veröffentlicht. Für einen Ort in Bremen nennt ViaFrei die nächsten Angaben genau so, wie die VMZ Bremen sie veröffentlicht, mit dem Tag, an dem sie gelesen wurden. Verbindlich ist allein die Beschilderung vor Ort; die Angaben sind nicht für die Routenführung bestimmt, und wo keine Angabe steht, heißt das nicht, dass keine Beschränkung besteht.", ask: "Welche Durchfahrtshöhen gibt es in Bremen-Gröpelingen für meinen Lkw?" },
      en: { title: "Height and weight limits in Bremen", body: "ViaFrei now reads the height and weight limits for lorries that the Verkehrsmanagementzentrale Bremen publishes. For a place in Bremen, ViaFrei gives the nearest entries exactly as VMZ Bremen publishes them, with the day they were read. Only the signs on site are binding; the entries are not for route guidance, and where no entry is listed that does not mean there is no restriction.", ask: "What height limits are there for my lorry in Bremen-Gröpelingen?" },
      ru: { title: "Ограничения высоты и массы в Бремене", body: "ViaFrei теперь читает ограничения высоты и массы для грузовиков, которые публикует Verkehrsmanagementzentrale Bremen. Для места в Бремене ViaFrei приводит ближайшие записи точно так, как их публикует VMZ Bremen, с датой, когда они были прочитаны. Обязательны только дорожные знаки на месте; данные не предназначены для построения маршрута, и отсутствие записи не означает отсутствия ограничения.", ask: "Какие ограничения высоты есть для моего грузовика в Бремене-Грёпелингене?" },
      bg: { title: "Ограничения на височината и масата в Бремен", body: "ViaFrei вече чете ограниченията на височината и масата за камиони, които публикува Verkehrsmanagementzentrale Bremen. За място в Бремен ViaFrei посочва най-близките записи точно така, както ги публикува VMZ Bremen, с деня, в който са прочетени. Задължителни са само пътните знаци на място; данните не са предназначени за маршрутизиране и липсата на запис не означава, че няма ограничение.", ask: "Какви ограничения на височината има за моя камион в Бремен-Грьопелинген?" },
      uk: { title: "Обмеження висоти й маси в Бремені", body: "ViaFrei тепер читає обмеження висоти й маси для вантажівок, які публікує Verkehrsmanagementzentrale Bremen. Для місця в Бремені ViaFrei наводить найближчі записи саме так, як їх публікує VMZ Bremen, із датою, коли їх прочитано. Обов'язковими є лише дорожні знаки на місці; дані не призначені для прокладання маршруту, а відсутність запису не означає відсутності обмеження.", ask: "Які обмеження висоти є для моєї вантажівки в Бремені-Грепелінгені?" },
      ro: { title: "Limite de înălțime și de masă în Bremen", body: "ViaFrei citește acum limitele de înălțime și de masă pentru camioane pe care le publică Verkehrsmanagementzentrale Bremen. Pentru un loc din Bremen, ViaFrei dă cele mai apropiate înregistrări exact așa cum le publică VMZ Bremen, cu ziua în care au fost citite. Obligatorii sunt doar indicatoarele de pe teren; datele nu sunt destinate ghidării pe traseu, iar lipsa unei înregistrări nu înseamnă că nu există o restricție.", ask: "Ce limite de înălțime sunt pentru camionul meu în Bremen-Gröpelingen?" },
      tr: { title: "Bremen'de yükseklik ve ağırlık sınırları", body: "ViaFrei artık Verkehrsmanagementzentrale Bremen'in kamyonlar için yayımladığı yükseklik ve ağırlık sınırlarını okuyor. Bremen'deki bir yer için ViaFrei en yakın kayıtları VMZ Bremen'in yayımladığı şekliyle, okundukları günle birlikte veriyor. Yalnızca yerindeki trafik işaretleri bağlayıcıdır; veriler rota yönlendirmesi için değildir ve bir kaydın bulunmaması kısıtlama olmadığı anlamına gelmez.", ask: "Bremen-Gröpelingen'de kamyonum için hangi yükseklik sınırları var?" },
    },
  },
  {
    // 2.2.6 (#639, #640): drafted by ingest-dev, approved by the owner 2026-10-19.
    id: "lkw-beschraenkungen-nrw-rheinmain",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.6",
    issue: 639,
    credits: ["lorry_sevas_nrw", "lorry_ivm_vorrangnetz", "lorry_ivm_beschilderung"],
    tool: "check_road_status",
    text: {
      de: { title: "Durchfahrtshöhen, Gewichtsgrenzen und Lkw-Verbote in Nordrhein-Westfalen und Rhein-Main", body: "ViaFrei liest jetzt die Lkw-Daten der Kommunen in Nordrhein-Westfalen über NRW.Mobidrom (SEVAS) und das Lkw-Vorrangnetz und die Lkw-Beschilderung der ivm für die Region Frankfurt RheinMain. Für einen Ort sagt ViaFrei, welche Durchfahrtshöhen, Gewichts- und Breitengrenzen und Lkw-Verbote in der Nähe stehen, wer davon ausgenommen ist und wo das nächste Lkw-Vorrangnetz verläuft. Wo kein Herausgeber solche Daten veröffentlicht, sagt ViaFrei das, statt eine Freigabe zu melden.", ask: "Gibt es in Haan niedrige Durchfahrtshöhen für meinen Lkw?" },
      en: { title: "Height limits, weight limits and lorry bans in North Rhine-Westphalia and Rhine-Main", body: "ViaFrei now reads the North Rhine-Westphalian municipalities' lorry data through NRW.Mobidrom (SEVAS) and ivm's lorry priority network and lorry signs for the Frankfurt RheinMain region. For a place, ViaFrei says which height, weight and width limits and lorry bans are nearby, who is exempt and where the nearest lorry priority route runs. Where no publisher publishes such data, ViaFrei says so instead of reporting an all-clear.", ask: "Are there low height limits for my lorry in Haan?" },
      ru: { title: "Ограничения высоты и массы и запреты для грузовиков в Северном Рейне-Вестфалии и Рейн-Майне", body: "ViaFrei теперь читает данные муниципалитетов Северного Рейна-Вестфалии для грузовиков через NRW.Mobidrom (SEVAS), а также приоритетную сеть и дорожные знаки для грузовиков ivm в регионе Франкфурт-Рейн-Майн. Для места ViaFrei говорит, какие ограничения высоты, массы и ширины и запреты для грузовиков есть поблизости, на кого они не распространяются и где проходит ближайший приоритетный маршрут для грузовиков. Где ни один издатель таких данных не публикует, ViaFrei так и говорит, а не сообщает, что проезд свободен.", ask: "Есть ли в Хане низкие ограничения высоты для моего грузовика?" },
      bg: { title: "Ограничения на височината и масата и забрани за камиони в Северен Рейн-Вестфалия и Рейн-Майн", body: "ViaFrei вече чете данните на общините в Северен Рейн-Вестфалия за камиони чрез NRW.Mobidrom (SEVAS), както и приоритетната мрежа и пътните знаци за камиони на ivm за региона Франкфурт-Рейн-Майн. За едно място ViaFrei казва какви ограничения на височината, масата и ширината и забрани за камиони има наблизо, кой е изключен от тях и къде минава най-близкият приоритетен маршрут за камиони. Където никой издател не публикува такива данни, ViaFrei го казва, вместо да съобщава, че пътят е свободен.", ask: "Има ли в Хаан ниски ограничения на височината за моя камион?" },
      uk: { title: "Обмеження висоти й маси та заборони для вантажівок у Північному Рейні-Вестфалії та Рейн-Майні", body: "ViaFrei тепер читає дані громад Північного Рейну-Вестфалії для вантажівок через NRW.Mobidrom (SEVAS), а також пріоритетну мережу й дорожні знаки для вантажівок ivm у регіоні Франкфурт-Рейн-Майн. Для місця ViaFrei каже, які обмеження висоти, маси й ширини та заборони для вантажівок є поблизу, на кого вони не поширюються і де проходить найближчий пріоритетний маршрут для вантажівок. Де жоден видавець таких даних не публікує, ViaFrei так і каже, а не повідомляє, що проїзд вільний.", ask: "Чи є в Гаані низькі обмеження висоти для моєї вантажівки?" },
      ro: { title: "Limite de înălțime și de masă și interdicții pentru camioane în Renania de Nord-Westfalia și Rin-Main", body: "ViaFrei citește acum datele pentru camioane ale comunelor din Renania de Nord-Westfalia prin NRW.Mobidrom (SEVAS), precum și rețeaua prioritară și indicatoarele pentru camioane ale ivm pentru regiunea Frankfurt RheinMain. Pentru un loc, ViaFrei spune ce limite de înălțime, masă și lățime și ce interdicții pentru camioane sunt în apropiere, cine este exceptat și pe unde trece cea mai apropiată rută prioritară pentru camioane. Unde niciun editor nu publică astfel de date, ViaFrei spune asta în loc să anunțe că drumul e liber.", ask: "Sunt în Haan limite joase de înălțime pentru camionul meu?" },
      tr: { title: "Kuzey Ren-Vestfalya ve Ren-Main'de yükseklik ve ağırlık sınırları ile kamyon yasakları", body: "ViaFrei artık Kuzey Ren-Vestfalya belediyelerinin kamyon verilerini NRW.Mobidrom (SEVAS) üzerinden, ivm'nin Frankfurt RheinMain bölgesi için kamyon öncelikli ağını ve kamyon tabelalarını da okuyor. Bir yer için ViaFrei, yakında hangi yükseklik, ağırlık ve genişlik sınırları ile kamyon yasakları bulunduğunu, kimlerin bunlardan muaf olduğunu ve en yakın kamyon öncelikli güzergâhın nereden geçtiğini söylüyor. Hiçbir yayıncının böyle veri yayımlamadığı yerde ViaFrei yolun açık olduğunu bildirmek yerine bunu söylüyor.", ask: "Haan'da kamyonum için alçak yükseklik sınırları var mı?" },
    },
  },
  {
    // 2.2.5 (#586, #612): drafted by ingest-dev, approved by the owner 2026-10-19.
    id: "barrierefreie-haltestellen-dresden-muenster",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.5",
    issue: 586,
    credits: ["dresden_bf_haltestellen", "muenster_bf_haltestellen"],
    tool: "check_station_facilities",
    text: {
      de: { title: "Dresden und Münster: Welche Haltestelle ist barrierefrei?", body: "ViaFrei liest jetzt das Haltestellenkataster der Landeshauptstadt Dresden für 750 Bus- und Straßenbahnhaltestellen und die Liste der barrierefreien Bushaltestellen der Stadtwerke Münster. Für eine Haltestelle in Dresden steht da, an wie vielen Steigen der Einstieg stufenlos, nur mit der Rampe des Fahrzeugs, eingeschränkt oder gar nicht barrierefrei ist, dazu die Bordhöhe. Für Münster steht, ob die Haltestelle barrierefrei oder eingeschränkt barrierefrei ist, mit dem Hinweis der Stadtwerke. Eine Haltestelle, die nicht in der Liste steht, ist damit nicht als unzugänglich gemeldet.", ask: "Ist die Haltestelle Theaterplatz in Dresden barrierefrei?" },
      en: { title: "Dresden and Münster: which stop is step-free?", body: "ViaFrei now reads the Landeshauptstadt Dresden's register of 750 bus and tram stops and Stadtwerke Münster's list of step-free bus stops. For a stop in Dresden it says at how many boarding points boarding is level, needs the vehicle's ramp, is limited or is not step-free, with the kerb height. For Münster it says whether the stop is step-free or partly so, with Stadtwerke Münster's note. A stop missing from the list is not reported as inaccessible.", ask: "Is the Theaterplatz stop in Dresden step-free?" },
      ru: { title: "Дрезден и Мюнстер: какая остановка доступна без ступенек?", body: "ViaFrei теперь читает реестр остановок города Дрезден — 750 автобусных и трамвайных остановок — и список безбарьерных автобусных остановок Stadtwerke Münster. Для остановки в Дрездене указано, на скольких платформах посадка без ступенек, только с пандусом транспорта, частично доступна или недоступна, а также высота бордюра. Для Мюнстера указано, доступна ли остановка полностью или частично, с примечанием Stadtwerke Münster. Остановка, которой нет в списке, не считается недоступной.", ask: "Доступна ли остановка Театерплац в Дрездене без ступенек?" },
      bg: { title: "Дрезден и Мюнстер: коя спирка е безбариерна?", body: "ViaFrei вече чете регистъра на спирките на град Дрезден — 750 автобусни и трамвайни спирки — и списъка с безбариерни автобусни спирки на Stadtwerke Münster. За спирка в Дрезден се посочва на колко перона качването е без стъпало, само с рампата на превозното средство, частично безбариерно или не е безбариерно, както и височината на бордюра. За Мюнстер се посочва дали спирката е безбариерна или частично безбариерна, с бележката на Stadtwerke Münster. Спирка, която липсва в списъка, не се отчита като недостъпна.", ask: "Безбариерна ли е спирка Театерплац в Дрезден?" },
      uk: { title: "Дрезден і Мюнстер: яка зупинка безбар’єрна?", body: "ViaFrei тепер читає реєстр зупинок міста Дрезден — 750 автобусних і трамвайних зупинок — і список безбар’єрних автобусних зупинок Stadtwerke Münster. Для зупинки в Дрездені вказано, на скількох платформах посадка без сходинки, лише з пандусом транспорту, частково безбар’єрна або не безбар’єрна, а також висоту бордюру. Для Мюнстера вказано, чи зупинка безбар’єрна повністю або частково, з приміткою Stadtwerke Münster. Зупинку, якої немає в списку, не вважають недоступною.", ask: "Чи безбар’єрна зупинка Театерплац у Дрездені?" },
      ro: { title: "Dresda și Münster: ce stație este accesibilă fără trepte?", body: "ViaFrei citește acum registrul stațiilor orașului Dresda, cu 750 de stații de autobuz și tramvai, și lista stațiilor de autobuz accesibile ale Stadtwerke Münster. Pentru o stație din Dresda se arată la câte peroane urcarea este fără trepte, doar cu rampa vehiculului, parțial accesibilă sau neaccesibilă, împreună cu înălțimea bordurii. Pentru Münster se arată dacă stația este accesibilă sau parțial accesibilă, cu nota Stadtwerke Münster. O stație care lipsește din listă nu este raportată ca inaccesibilă.", ask: "Este stația Theaterplatz din Dresda accesibilă fără trepte?" },
      tr: { title: "Dresden ve Münster: hangi durak engelsiz?", body: "ViaFrei artık Dresden şehrinin 750 otobüs ve tramvay durağını kapsayan durak kaydını ve Stadtwerke Münster'in engelsiz otobüs durakları listesini okuyor. Dresden'deki bir durak için kaç peronda binişin basamaksız olduğu, yalnızca aracın rampasıyla mümkün olduğu, kısmen engelsiz olduğu ya da engelsiz olmadığı ve kaldırım yüksekliği gösterilir. Münster için durağın engelsiz mi yoksa kısmen engelsiz mi olduğu, Stadtwerke Münster'in notuyla birlikte gösterilir. Listede olmayan bir durak erişilemez olarak bildirilmiş sayılmaz.", ask: "Dresden'deki Theaterplatz durağı engelsiz mi?" },
    },
  },
  {
    // 2.2.5 (#636): drafted by ingest-dev, approved by the owner 2026-10-19 (the data-steward ruling on the register row is still pending).
    id: "barrierefreiheit-aus-openstreetmap",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.5",
    issue: 636,
    credits: ["tuc_vdv462"],
    tool: "check_station_facilities",
    text: {
      de: { title: "Barrierefreiheit aus OpenStreetMap: Bordhöhen, Leitsysteme und Aufzüge an Haltestellen in ganz Deutschland", body: "ViaFrei liest jetzt den Export der TU Chemnitz, der für Haltestellen in ganz Deutschland aus OpenStreetMap zusammenstellt, was Freiwillige dort eingetragen haben: Bordhöhen, Hochborde, taktile Leitsysteme, Aufzüge, Rampen, Treppen und Fahrtreppen, für gut 4 000 Haltestellen. ViaFrei zeigt diese Angaben, wo keine amtliche Erhebung die Haltestelle beschreibt, und sagt dazu, dass es Kartierungen sind und keine Erhebung: Was niemand eingetragen hat, fehlt.", ask: "Hat die Haltestelle Lichtenauer Straße in Chemnitz ein Hochbord?" },
      en: { title: "Step-free access from OpenStreetMap: kerb heights, tactile paving and lifts at stops across Germany", body: "ViaFrei now reads TU Chemnitz's export, which gathers from OpenStreetMap what volunteers have mapped at stops across Germany: kerb heights, raised kerbs, tactile paving, lifts, ramps, stairs and escalators, for some 4,000 stops. ViaFrei shows these facts where no official survey describes the stop, and says that they are mapped, not surveyed: what nobody has entered is missing.", ask: "Does the Lichtenauer Straße stop in Chemnitz have a raised kerb?" },
      ru: { title: "Доступность по данным OpenStreetMap: высота бордюров, тактильные полосы и лифты на остановках по всей Германии", body: "ViaFrei теперь читает выгрузку Технического университета Хемница, которая собирает из OpenStreetMap то, что добровольцы отметили на остановках по всей Германии: высоту бордюров, высокие бордюры, тактильные полосы, лифты, пандусы, лестницы и эскалаторы — примерно для 4 000 остановок. ViaFrei показывает эти сведения там, где остановку не описывает официальное обследование, и уточняет, что это картографические отметки, а не обследование: чего никто не отметил, того нет.", ask: "Есть ли высокий бордюр на остановке Лихтенауэр-штрассе в Хемнице?" },
      bg: { title: "Достъпност по данни от OpenStreetMap: височина на бордюра, тактилни ивици и асансьори на спирки в цяла Германия", body: "ViaFrei вече чете експорта на Техническия университет в Кемниц, който събира от OpenStreetMap това, което доброволци са въвели за спирки в цяла Германия: височина на бордюра, високи бордюри, тактилни ивици, асансьори, рампи, стълби и ескалатори — за около 4 000 спирки. ViaFrei показва тези данни там, където официално проучване не описва спирката, и посочва, че това са картографски данни, а не проучване: каквото никой не е въвел, липсва.", ask: "Има ли висок бордюр на спирка Лихтенауер Щрасе в Кемниц?" },
      uk: { title: "Доступність за даними OpenStreetMap: висота бордюрів, тактильні смуги й ліфти на зупинках по всій Німеччині", body: "ViaFrei тепер читає вивантаження Технічного університету Хемніца, яке збирає з OpenStreetMap те, що волонтери позначили на зупинках по всій Німеччині: висоту бордюрів, високі бордюри, тактильні смуги, ліфти, пандуси, сходи й ескалатори — приблизно для 4 000 зупинок. ViaFrei показує ці дані там, де зупинку не описує офіційне обстеження, і зазначає, що це картографічні позначки, а не обстеження: чого ніхто не позначив, того немає.", ask: "Чи є високий бордюр на зупинці Ліхтенауер-штрассе в Хемніці?" },
      ro: { title: "Accesibilitate din OpenStreetMap: înălțimea bordurii, benzi tactile și lifturi în stații din toată Germania", body: "ViaFrei citește acum exportul Universității Tehnice din Chemnitz, care adună din OpenStreetMap ce au cartografiat voluntarii în stații din toată Germania: înălțimea bordurii, borduri înalte, benzi tactile, lifturi, rampe, scări și scări rulante, pentru aproximativ 4.000 de stații. ViaFrei arată aceste date acolo unde niciun studiu oficial nu descrie stația și precizează că sunt cartografieri, nu un studiu: ce nu a introdus nimeni lipsește.", ask: "Are stația Lichtenauer Straße din Chemnitz bordură înaltă?" },
      tr: { title: "OpenStreetMap'ten erişilebilirlik: Almanya genelinde duraklarda kaldırım yüksekliği, hissedilebilir yüzeyler ve asansörler", body: "ViaFrei artık Chemnitz Teknik Üniversitesi'nin, gönüllülerin Almanya genelindeki duraklar için OpenStreetMap'e girdiklerini derleyen dışa aktarımını okuyor: kaldırım yükseklikleri, yüksek kaldırımlar, hissedilebilir yüzeyler, asansörler, rampalar, merdivenler ve yürüyen merdivenler, yaklaşık 4.000 durak için. ViaFrei bu bilgileri, durağı resmî bir araştırmanın tanımlamadığı yerlerde gösterir ve bunların araştırma değil haritalama olduğunu belirtir: kimsenin girmediği bilgi eksiktir.", ask: "Chemnitz'deki Lichtenauer Straße durağında yüksek kaldırım var mı?" },
    },
  },
  {
    // 2.2.5 (#634): drafted by ingest-dev, approved by the owner 2026-10-19.
    id: "auslastung-mvv-regionalbus",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.5",
    issue: 634,
    credits: ["mvv_bus_load"],
    tool: "get_departures",
    text: {
      de: { title: "Regionalbusse im MVV: wie voll der Bus meistens ist", body: "Bei den Abfahrten eines Regionalbusses im Münchner Verkehrs- und Tarifverbund steht jetzt, wie voll er zu dieser Zeit meistens ist, von schwach besetzt bis sehr voll mit Stehplätzen. Die Werte stammen aus den automatischen Fahrgastzählungen des MVV und sind typische Werte, keine Echtzeit. An Werktagen nennt ViaFrei Schultage und Ferien getrennt, wenn sie sich unterscheiden.", ask: "Wie voll ist der Bus 210 ab Ottobrunn, Jahnstraße morgen früh?" },
      en: { title: "MVV regional buses: how full the bus usually is", body: "The departures of a regional bus in the Munich transport association MVV now say how full it usually is at that time, from light to very busy with standing room only. The values come from MVV's automatic passenger counts and are typical values, not realtime. On weekdays ViaFrei gives school days and holidays separately when they differ.", ask: "How full is bus 210 from Ottobrunn, Jahnstraße tomorrow morning?" },
      ru: { title: "Региональные автобусы MVV: насколько обычно заполнен автобус", body: "У отправлений регионального автобуса транспортного объединения Мюнхена (MVV) теперь указано, насколько он обычно заполнен в это время — от свободного до переполненного, только стоячие места. Значения взяты из автоматических подсчётов пассажиров MVV; это типичные значения, а не данные реального времени. По будним дням ViaFrei отдельно называет учебные дни и каникулы, если они различаются.", ask: "Насколько заполнен автобус 210 от остановки Оттобрунн, Яннштрассе завтра утром?" },
      bg: { title: "Регионални автобуси на MVV: колко пълен обикновено е автобусът", body: "При тръгванията на регионален автобус от транспортното обединение на Мюнхен (MVV) вече пише колко пълен обикновено е той по това време — от свободно до препълнено, само правостоящи. Стойностите идват от автоматичните преброявания на пътници на MVV и са типични стойности, а не данни в реално време. В делнични дни ViaFrei посочва учебните дни и ваканцията поотделно, когато се различават.", ask: "Колко пълен е автобус 210 от Отобрун, Яннщрасе утре сутрин?" },
      uk: { title: "Регіональні автобуси MVV: наскільки зазвичай заповнений автобус", body: "Біля відправлень регіонального автобуса транспортного об'єднання Мюнхена (MVV) тепер указано, наскільки він зазвичай заповнений у цей час — від вільного до переповненого, лише стоячі місця. Значення взято з автоматичних підрахунків пасажирів MVV; це типові значення, а не дані реального часу. У будні ViaFrei окремо називає навчальні дні й канікули, якщо вони відрізняються.", ask: "Наскільки заповнений автобус 210 від зупинки Оттобрунн, Яннштрасе завтра вранці?" },
      ro: { title: "Autobuzele regionale MVV: cât de plin este de obicei autobuzul", body: "La plecările unui autobuz regional din asociația de transport a Münchenului (MVV) scrie acum cât de plin este de obicei la acea oră, de la liber până la foarte aglomerat, doar locuri în picioare. Valorile provin din numărătorile automate de pasageri ale MVV și sunt valori tipice, nu în timp real. În zilele lucrătoare ViaFrei indică separat zilele de școală și vacanța, atunci când diferă.", ask: "Cât de plin este autobuzul 210 din Ottobrunn, Jahnstraße mâine dimineață?" },
      tr: { title: "MVV bölgesel otobüsleri: otobüs genellikle ne kadar dolu", body: "Münih ulaşım birliği MVV'nin bölgesel otobüslerinin kalkışlarında artık otobüsün o saatte genellikle ne kadar dolu olduğu yazıyor: boştan, yalnızca ayakta yer kalan çok kalabalığa kadar. Değerler MVV'nin otomatik yolcu sayımlarından gelir; gerçek zamanlı değil, tipik değerlerdir. Hafta içi okul günleri ile tatil farklıysa ViaFrei bunları ayrı ayrı belirtir.", ask: "Ottobrunn, Jahnstraße'den kalkan 210 numaralı otobüs yarın sabah ne kadar dolu?" },
    },
  },
  {
    // 2.2.5 (#571): drafted by ingest-dev, approved by the owner 2026-10-19.
    id: "ladestatus-hamburg",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.5",
    issue: 571,
    credits: ["hh_emobility"],
    tool: "find_charging_station",
    text: {
      de: { title: "Hamburg: ob eine öffentliche Ladesäule gerade frei ist, auch von der Stadt", body: "ViaFrei liest jetzt den Ladestatus der rund 2 500 öffentlichen Ladepunkte, den die Freie und Hansestadt Hamburg laufend veröffentlicht. Er ergänzt die Ladesäulen, die ViaFrei schon kennt: An einer Hamburger Ladesäule steht jetzt, ob sie frei, belegt oder außer Betrieb ist und seit wann, und die Stadt wird als Quelle genannt.", ask: "Wo ist in Hamburg-Altona gerade eine Ladesäule frei?" },
      en: { title: "Hamburg: whether a public charger is free right now, from the city too", body: "ViaFrei now reads the charging status of Hamburg's roughly 2,500 public charge points, which the Free and Hanseatic City of Hamburg publishes as it changes. It adds to the chargers ViaFrei already knows: a Hamburg charger now shows whether it is free, in use or out of order, and since when, and the city is named as the source.", ask: "Where is a charger free in Hamburg-Altona right now?" },
      ru: { title: "Гамбург: свободна ли сейчас общественная зарядная станция — и по данным города", body: "ViaFrei теперь читает статус примерно 2 500 общественных точек зарядки, который Вольный и ганзейский город Гамбург публикует по мере изменений. Он дополняет зарядные станции, которые ViaFrei уже знает: у гамбургской станции теперь видно, свободна ли она, занята или не работает и с какого времени, а город указан как источник.", ask: "Где в Гамбурге-Альтоне сейчас свободна зарядная станция?" },
      bg: { title: "Хамбург: дали обществена зарядна станция е свободна в момента — и по данни на града", body: "ViaFrei вече чете статуса на около 2 500 обществени точки за зареждане, който Свободният и ханзейски град Хамбург публикува при всяка промяна. Той допълва зарядните станции, които ViaFrei вече познава: при хамбургска станция вече се вижда дали е свободна, заета или неработеща и от кога, а градът е посочен като източник.", ask: "Къде в Хамбург-Алтона има свободна зарядна станция в момента?" },
      uk: { title: "Гамбург: чи вільна зараз громадська зарядна станція — і за даними міста", body: "ViaFrei тепер читає статус приблизно 2 500 громадських точок заряджання, який Вільне й ганзейське місто Гамбург публікує в міру змін. Він доповнює зарядні станції, які ViaFrei вже знає: біля гамбурзької станції тепер видно, чи вона вільна, зайнята чи не працює і відколи, а місто названо джерелом.", ask: "Де в Гамбурзі-Альтоні зараз вільна зарядна станція?" },
      ro: { title: "Hamburg: dacă o stație publică de încărcare este liberă acum, și de la oraș", body: "ViaFrei citește acum starea celor aproximativ 2.500 de puncte publice de încărcare, pe care Orașul Liber și Hanseatic Hamburg o publică pe măsură ce se schimbă. Ea completează stațiile pe care ViaFrei le cunoaște deja: la o stație din Hamburg se vede acum dacă este liberă, ocupată sau scoasă din funcțiune și de când, iar orașul este numit ca sursă.", ask: "Unde este liberă acum o stație de încărcare în Hamburg-Altona?" },
      tr: { title: "Hamburg: herkese açık bir şarj noktası şu anda boş mu, artık şehirden de", body: "ViaFrei artık Hür ve Hansa Şehri Hamburg'un değiştikçe yayımladığı yaklaşık 2.500 herkese açık şarj noktasının durumunu okuyor. Bu, ViaFrei'nin zaten bildiği şarj istasyonlarını tamamlar: Hamburg'daki bir istasyonun boş, dolu ya da arızalı olduğu ve ne zamandan beri öyle olduğu artık görünür ve şehir kaynak olarak belirtilir.", ask: "Hamburg-Altona'da şu anda boş bir şarj noktası nerede?" },
    },
  },
  {
    // 2.2.5 (#635): drafted by access-point-dev, approved by the owner 2026-10-19.
    id: "barrierefreiheit-baden-wuerttemberg",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.5",
    issue: 635,
    credits: ["bfrk_spnv", "bfrk_oepnv"],
    tool: "check_station_facilities",
    text: {
      de: { title: "Baden-Württemberg: Aufzüge, Rampen und Leitstreifen an Bahnhöfen und Haltestellen", body: "ViaFrei liest jetzt die Erhebung zur Barrierefreiheit der NVBW für 1 104 Bahnhöfe und 14 065 Bus- und Straßenbahnhaltestellen in Baden-Württemberg. An einem Bahnhof steht neben dem Zustand der Aufzüge, was vor Ort erhoben wurde: wie viele Aufzüge mit welcher Türbreite und Kabinengröße, wie steil die Rampen sind und wie viele Bahnsteige Blindenleitstreifen haben. Die Daten sind ungeprüfte Rohdaten der Erhebung, und ViaFrei sagt das dazu.", ask: "Wie barrierefrei ist Mannheim Hbf?" },
      en: { title: "Baden-Württemberg: lifts, ramps and guidance strips at stations and stops", body: "ViaFrei now reads the NVBW's step-free access survey of 1,104 railway stations and 14,065 bus and tram stops in Baden-Württemberg. Beside the state of a station's lifts, it now shows what was surveyed on site: how many lifts, with which door width and cabin size, how steep the ramps are, and how many platforms have a tactile guidance strip. The data is the survey's unchecked raw data, and ViaFrei says so.", ask: "How step-free is Mannheim Hbf?" },
      ru: { title: "Баден-Вюртемберг: лифты, пандусы и тактильные полосы на вокзалах и остановках", body: "ViaFrei теперь читает обследование доступности NVBW: 1 104 вокзала и 14 065 автобусных и трамвайных остановок в Баден-Вюртемберге. Рядом с состоянием лифтов на вокзале теперь видно, что было обследовано на месте: сколько лифтов, какой ширины двери и размера кабины, насколько круты пандусы и на скольких платформах есть тактильные полосы. Это непроверенные исходные данные обследования, и ViaFrei об этом говорит.", ask: "Насколько доступен вокзал Мангейм?" },
      bg: { title: "Баден-Вюртемберг: асансьори, рампи и тактилни ивици на гари и спирки", body: "ViaFrei вече чете проучването за достъпност на NVBW за 1 104 гари и 14 065 автобусни и трамвайни спирки в Баден-Вюртемберг. До състоянието на асансьорите на гарата вече се вижда какво е проучено на място: колко асансьора, с каква ширина на вратата и размер на кабината, колко стръмни са рампите и колко перона имат тактилна ивица. Това са непроверени първични данни от проучването и ViaFrei го казва.", ask: "Колко достъпна е гара Манхайм?" },
      uk: { title: "Баден-Вюртемберг: ліфти, пандуси й тактильні смуги на вокзалах і зупинках", body: "ViaFrei тепер читає обстеження доступності NVBW: 1 104 вокзали та 14 065 автобусних і трамвайних зупинок у Баден-Вюртемберзі. Поруч зі станом ліфтів на вокзалі тепер видно, що було обстежено на місці: скільки ліфтів, якої ширини двері й розміру кабіни, наскільки круті пандуси та на скількох платформах є тактильна смуга. Це неперевірені первинні дані обстеження, і ViaFrei про це каже.", ask: "Наскільки доступний вокзал Мангайм?" },
      ro: { title: "Baden-Württemberg: lifturi, rampe și benzi tactile în gări și stații", body: "ViaFrei citește acum studiul de accesibilitate al NVBW pentru 1.104 gări și 14.065 de stații de autobuz și tramvai din Baden-Württemberg. Lângă starea lifturilor dintr-o gară se vede acum ce s-a constatat la fața locului: câte lifturi, cu ce lățime a ușii și ce mărime a cabinei, cât de abrupte sunt rampele și câte peroane au bandă tactilă. Datele sunt date brute neverificate ale studiului, iar ViaFrei spune acest lucru.", ask: "Cât de accesibilă este gara Mannheim Hbf?" },
      tr: { title: "Baden-Württemberg: istasyon ve duraklarda asansörler, rampalar ve hissedilebilir yüzeyler", body: "ViaFrei artık NVBW'nin Baden-Württemberg'deki 1.104 tren istasyonu ve 14.065 otobüs ve tramvay durağına ilişkin erişilebilirlik araştırmasını okuyor. Bir istasyondaki asansörlerin durumunun yanında yerinde tespit edilenler de görünüyor: kaç asansör olduğu, kapı genişliği ve kabin boyutu, rampaların ne kadar dik olduğu ve kaç peronda hissedilebilir yüzey bulunduğu. Veriler araştırmanın doğrulanmamış ham verileridir ve ViaFrei bunu belirtir.", ask: "Mannheim Hbf ne kadar engelsiz?" },
    },
  },
  {
    // 2.2.5 (#632): drafted by access-point-dev, approved by the owner 2026-10-19.
    id: "vrn-echtzeit-rhein-neckar",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.5",
    issue: 632,
    credits: ["vrn_rt"],
    tool: "check_transit_disruption",
    text: {
      de: { title: "Busse und Straßenbahnen im Rhein-Neckar-Gebiet: Echtzeit auch vom VRN", body: "ViaFrei liest jetzt die Echtzeitdaten des Verkehrsverbunds Rhein-Neckar für Busse und Straßenbahnen von Mannheim und Heidelberg bis Mainz und Kaiserslautern. Melden die bundesweiten Daten für einen dieser Kreise gerade nichts oder sind sie veraltet, zeigt ViaFrei die Pünktlichkeit aus den Daten des VRN und sagt dazu, dass Züge darin nicht enthalten sind.", ask: "Wie pünktlich sind Busse und Bahnen in Mannheim gerade?" },
      en: { title: "Buses and trams in the Rhine-Neckar area: realtime from VRN too", body: "ViaFrei now reads the Verkehrsverbund Rhein-Neckar's realtime data for buses and trams from Mannheim and Heidelberg to Mainz and Kaiserslautern. When the nationwide data reports nothing for one of these districts, or is out of date, ViaFrei shows punctuality from VRN's data and says that it carries no trains.", ask: "How punctual are buses and trains in Mannheim right now?" },
      ru: { title: "Автобусы и трамваи в регионе Рейн-Неккар: данные реального времени и от VRN", body: "ViaFrei теперь читает данные реального времени транспортного объединения Рейн-Неккар (VRN) по автобусам и трамваям от Мангейма и Гейдельберга до Майнца и Кайзерслаутерна. Если общегерманские данные по одному из этих районов сейчас ничего не сообщают, ViaFrei показывает пунктуальность по данным VRN и указывает, что поездов в них нет.", ask: "Насколько пунктуальны сейчас автобусы и поезда в Мангейме?" },
      bg: { title: "Автобуси и трамваи в региона Рейн-Некар: данни в реално време и от VRN", body: "ViaFrei вече чете данните в реално време на транспортното обединение Рейн-Некар (VRN) за автобуси и трамваи от Манхайм и Хайделберг до Майнц и Кайзерслаутерн. Когато общогерманските данни не съобщават нищо за някой от тези окръзи, ViaFrei показва точността по данните на VRN и посочва, че влакове не са включени.", ask: "Колко точни са в момента автобусите и влаковете в Манхайм?" },
      uk: { title: "Автобуси й трамваї в регіоні Рейн-Неккар: дані реального часу і від VRN", body: "ViaFrei тепер читає дані реального часу транспортного об'єднання Рейн-Неккар (VRN) для автобусів і трамваїв від Мангайма й Гайдельберга до Майнца й Кайзерслаутерна. Коли загальнонімецькі дані щодо одного з цих районів нічого не повідомляють, ViaFrei показує пунктуальність за даними VRN і зазначає, що потягів у них немає.", ask: "Наскільки пунктуальні зараз автобуси й потяги в Мангаймі?" },
      ro: { title: "Autobuze și tramvaie în regiunea Rin-Neckar: date în timp real și de la VRN", body: "ViaFrei citește acum datele în timp real ale asociației de transport Rin-Neckar (VRN) pentru autobuze și tramvaie, de la Mannheim și Heidelberg până la Mainz și Kaiserslautern. Când datele la nivel național nu raportează nimic pentru unul dintre aceste districte, ViaFrei arată punctualitatea din datele VRN și precizează că trenurile nu sunt incluse.", ask: "Cât de punctuale sunt acum autobuzele și trenurile în Mannheim?" },
      tr: { title: "Ren-Neckar bölgesinde otobüs ve tramvaylar: VRN'den de gerçek zamanlı veri", body: "ViaFrei artık Ren-Neckar Ulaşım Birliği'nin (VRN) Mannheim ve Heidelberg'den Mainz ve Kaiserslautern'e kadar otobüs ve tramvaylara ait gerçek zamanlı verilerini okuyor. Ülke genelindeki veriler bu ilçelerden biri için şu anda bir şey bildirmediğinde ViaFrei dakikliği VRN verilerinden gösterir ve bunlarda tren bulunmadığını belirtir.", ask: "Mannheim'da otobüs ve trenler şu anda ne kadar dakik?" },
    },
  },
  {
    // 2.2.5 (#631): drafted by access-point-dev, approved by the owner 2026-10-19.
    id: "vbn-echtzeit-niedersachsen-bremen",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.5",
    issue: 631,
    credits: ["vbn_siri_et"],
    tool: "check_transit_disruption",
    text: {
      de: { title: "Bremen und Niedersachsen: Echtzeit auch vom VBN", body: "ViaFrei liest jetzt die Echtzeitprognosen des Verkehrsverbunds Bremen/Niedersachsen für Busse, Straßenbahnen und Züge, von Bremen und Oldenburg über Hannover und Braunschweig bis Göttingen und Osnabrück. Melden die bundesweiten Daten für Bremen oder einen dieser Kreise gerade nichts oder sind sie veraltet, zeigt ViaFrei die Pünktlichkeit aus den Daten des VBN und nennt die Quelle dazu.", ask: "Wie pünktlich sind Busse und Bahnen in Bremen gerade?" },
      en: { title: "Bremen and Lower Saxony: realtime from VBN too", body: "ViaFrei now reads the Verkehrsverbund Bremen/Niedersachsen's realtime predictions for buses, trams and trains, from Bremen and Oldenburg through Hanover and Braunschweig to Göttingen and Osnabrück. When the nationwide data reports nothing for Bremen or one of these districts, or is out of date, ViaFrei shows punctuality from VBN's data and names the source.", ask: "How punctual are buses and trains in Bremen right now?" },
      ru: { title: "Бремен и Нижняя Саксония: данные реального времени и от VBN", body: "ViaFrei теперь читает прогнозы реального времени транспортного объединения Бремен/Нижняя Саксония (VBN) по автобусам, трамваям и поездам — от Бремена и Ольденбурга через Ганновер и Брауншвейг до Гёттингена и Оснабрюка. Если общегерманские данные по Бремену или одному из этих районов сейчас ничего не сообщают или устарели, ViaFrei показывает пунктуальность по данным VBN и называет источник.", ask: "Насколько пунктуальны сейчас автобусы и поезда в Бремене?" },
      bg: { title: "Бремен и Долна Саксония: данни в реално време и от VBN", body: "ViaFrei вече чете прогнозите в реално време на транспортното обединение Бремен/Долна Саксония (VBN) за автобуси, трамваи и влакове — от Бремен и Олденбург през Хановер и Брауншвайг до Гьотинген и Оснабрюк. Когато общогерманските данни не съобщават нищо за Бремен или някой от тези окръзи или са остарели, ViaFrei показва точността по данните на VBN и посочва източника.", ask: "Колко точни са в момента автобусите и влаковете в Бремен?" },
      uk: { title: "Бремен і Нижня Саксонія: дані реального часу і від VBN", body: "ViaFrei тепер читає прогнози реального часу транспортного об'єднання Бремен/Нижня Саксонія (VBN) для автобусів, трамваїв і потягів — від Бремена й Ольденбурга через Ганновер і Брауншвайг до Геттінгена й Оснабрюка. Коли загальнонімецькі дані щодо Бремена чи одного з цих районів нічого не повідомляють або застаріли, ViaFrei показує пунктуальність за даними VBN і називає джерело.", ask: "Наскільки пунктуальні зараз автобуси й потяги в Бремені?" },
      ro: { title: "Bremen și Saxonia Inferioară: date în timp real și de la VBN", body: "ViaFrei citește acum prognozele în timp real ale asociației de transport Bremen/Saxonia Inferioară (VBN) pentru autobuze, tramvaie și trenuri, de la Bremen și Oldenburg prin Hanovra și Braunschweig până la Göttingen și Osnabrück. Când datele la nivel național nu raportează nimic pentru Bremen sau pentru unul dintre aceste districte ori sunt depășite, ViaFrei arată punctualitatea din datele VBN și numește sursa.", ask: "Cât de punctuale sunt acum autobuzele și trenurile în Bremen?" },
      tr: { title: "Bremen ve Aşağı Saksonya: VBN'den de gerçek zamanlı veri", body: "ViaFrei artık Bremen/Aşağı Saksonya Ulaşım Birliği'nin (VBN) otobüs, tramvay ve trenlere ait gerçek zamanlı tahminlerini okuyor: Bremen ve Oldenburg'dan Hannover ve Braunschweig üzerinden Göttingen ve Osnabrück'e kadar. Ülke genelindeki veriler Bremen ya da bu ilçelerden biri için şu anda bir şey bildirmediğinde veya güncel olmadığında ViaFrei dakikliği VBN verilerinden gösterir ve kaynağı belirtir.", ask: "Bremen'de otobüs ve trenler şu anda ne kadar dakik?" },
    },
  },
  {
    // 2.2.4 (#573 and the portals): drafted by ingest-dev, approved by the lead 2026-10-18.
    id: "baustellen-staedte-laender",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.4",
    issue: 573,
    credits: ["kiel_baustellen", "sh_baustellen", "bb_baustellen", "freiburg_baustellen", "stuttgart_baustellen", "karlsruhe_tba", "frankfurt_verkehr", "berlin_planb", "duisburg_baustellen", "aachen_baustellen", "ingolstadt_baustellen", "koeln_baustellen", "muenster_baustellen", "dortmund_baustellen"],
    tool: "find_roadworks_ahead",
    text: {
      de: { title: "Baustellen der Städte und Länder", body: "ViaFrei kennt jetzt auch die Baustellen, die Städte und Länder selbst veröffentlichen — von Kiel und Schleswig-Holstein über Brandenburg, Berlin, Köln, Dortmund, Münster, Duisburg und Aachen bis Frankfurt, Karlsruhe, Stuttgart, Freiburg und Ingolstadt. Jede Baustelle steht einmal da, mit jeder Quelle, die sie meldet.", ask: "Welche Baustellen gibt es gerade in Dortmund?" },
      en: { title: "Roadworks from cities and federal states", body: "ViaFrei now also knows the roadworks that cities and federal states publish themselves — from Kiel and Schleswig-Holstein through Brandenburg, Berlin, Cologne, Dortmund, Münster, Duisburg and Aachen to Frankfurt, Karlsruhe, Stuttgart, Freiburg and Ingolstadt. Each work is listed once, with every source that reports it.", ask: "Which roadworks are there in Dortmund right now?" },
      ru: { title: "Дорожные работы городов и земель", body: "ViaFrei теперь знает и дорожные работы, которые города и земли публикуют сами, — от Киля и Шлезвиг-Гольштейна через Бранденбург, Берлин, Кёльн, Дортмунд, Мюнстер, Дуйсбург и Ахен до Франкфурта, Карлсруэ, Штутгарта, Фрайбурга и Ингольштадта. Каждая работа указана один раз, со всеми источниками, которые о ней сообщают.", ask: "Какие дорожные работы сейчас идут в Дортмунде?" },
      bg: { title: "Ремонти по пътищата от градове и провинции", body: "ViaFrei вече познава и ремонтите, които градовете и провинциите публикуват сами — от Кил и Шлезвиг-Холщайн през Бранденбург, Берлин, Кьолн, Дортмунд, Мюнстер, Дуисбург и Аахен до Франкфурт, Карлсруе, Щутгарт, Фрайбург и Инголщат. Всеки ремонт е показан веднъж, с всеки източник, който го съобщава.", ask: "Какви ремонти има в момента в Дортмунд?" },
      uk: { title: "Дорожні роботи міст і земель", body: "ViaFrei тепер знає й дорожні роботи, які міста та землі публікують самі, — від Кіля і Шлезвіг-Гольштейну через Бранденбург, Берлін, Кельн, Дортмунд, Мюнстер, Дуйсбург і Ахен до Франкфурта, Карлсруе, Штутгарта, Фрайбурга й Інгольштадта. Кожну роботу наведено один раз, з усіма джерелами, що про неї повідомляють.", ask: "Які дорожні роботи зараз тривають у Дортмунді?" },
      ro: { title: "Lucrări rutiere de la orașe și landuri", body: "ViaFrei cunoaște acum și lucrările rutiere pe care orașele și landurile le publică ele însele — de la Kiel și Schleswig-Holstein, prin Brandenburg, Berlin, Köln, Dortmund, Münster, Duisburg și Aachen, până la Frankfurt, Karlsruhe, Stuttgart, Freiburg și Ingolstadt. Fiecare lucrare apare o singură dată, cu fiecare sursă care o raportează.", ask: "Ce lucrări rutiere sunt acum în Dortmund?" },
      tr: { title: "Şehirlerin ve eyaletlerin yol çalışmaları", body: "ViaFrei artık şehirlerin ve eyaletlerin kendi yayımladığı yol çalışmalarını da biliyor — Kiel ve Schleswig-Holstein'dan Brandenburg, Berlin, Köln, Dortmund, Münster, Duisburg ve Aachen üzerinden Frankfurt, Karlsruhe, Stuttgart, Freiburg ve Ingolstadt'a kadar. Her çalışma, onu bildiren tüm kaynaklarla birlikte bir kez gösteriliyor.", ask: "Şu anda Dortmund'da hangi yol çalışmaları var?" },
    },
  },
  {
    // 2.2.4 (#575, #637): drafted by ingest-dev, approved by the lead 2026-10-18.
    id: "umweltzone-am-punkt",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.4",
    issue: 575,
    credits: ["berlin_umweltzone", "aachen_umweltzone", "duisburg_umweltzone", "uba_umweltzonen"],
    tool: "get_driving_rules",
    text: {
      de: { title: "Liegt dieser Ort in einer Umweltzone?", body: "ViaFrei prüft eine Adresse oder einen Punkt gegen die veröffentlichten Grenzen der Umweltzonen: innerhalb, in einer freigegebenen Fläche, außerhalb mit Entfernung — oder unbekannt. Grundlage sind die Grenzen der Städte und das Verzeichnis des Umweltbundesamts mit allen deutschen Zonen, jeweils mit dem Stand der Daten.", ask: "Liegt der Alexanderplatz in der Berliner Umweltzone?" },
      en: { title: "Is this place in a low-emission zone?", body: "ViaFrei checks an address or a point against the published low-emission-zone boundaries: inside, in a released area, outside with the distance — or unknown. It reads the cities' own boundaries and the Umweltbundesamt's register of every German zone, each with the date of its data.", ask: "Is Alexanderplatz inside Berlin's low-emission zone?" },
      ru: { title: "Находится ли это место в экологической зоне?", body: "ViaFrei проверяет адрес или точку по опубликованным границам экологических зон: внутри, на освобождённой территории, снаружи с расстоянием — или неизвестно. Основа — границы, публикуемые городами, и реестр Федерального ведомства по охране окружающей среды со всеми зонами Германии, каждая с датой данных.", ask: "Находится ли Александерплац в экологической зоне Берлина?" },
      bg: { title: "В екологична зона ли е това място?", body: "ViaFrei проверява адрес или точка спрямо публикуваните граници на екологичните зони: вътре, в освободена площ, извън — с разстоянието — или неизвестно. Основа са границите на градовете и регистърът на Федералната служба по околна среда с всички германски зони, всяка с датата на данните.", ask: "В берлинската екологична зона ли е Александерплац?" },
      uk: { title: "Чи це місце в екологічній зоні?", body: "ViaFrei перевіряє адресу або точку за опублікованими межами екологічних зон: усередині, на звільненій ділянці, поза зоною з відстанню — або невідомо. Основа — межі, які публікують міста, і реєстр Федерального відомства з охорони довкілля з усіма зонами Німеччини, кожна з датою даних.", ask: "Чи Александерплац в екологічній зоні Берліна?" },
      ro: { title: "Este acest loc într-o zonă cu emisii reduse?", body: "ViaFrei verifică o adresă sau un punct față de limitele publicate ale zonelor cu emisii reduse: în interior, într-o suprafață exceptată, în afară cu distanța — sau necunoscut. Se bazează pe limitele publicate de orașe și pe registrul Agenției Federale de Mediu cu toate zonele din Germania, fiecare cu data datelor.", ask: "Este Alexanderplatz în zona cu emisii reduse a Berlinului?" },
      tr: { title: "Bu yer düşük emisyon bölgesinde mi?", body: "ViaFrei bir adresi ya da noktayı yayımlanmış düşük emisyon bölgesi sınırlarına göre denetliyor: içeride, serbest bırakılmış bir alanda, dışarıda mesafesiyle — ya da bilinmiyor. Şehirlerin kendi sınırlarını ve Federal Çevre Ajansı'nın tüm Alman bölgelerini içeren kaydını, her birini verinin tarihiyle okuyor.", ask: "Alexanderplatz Berlin'in düşük emisyon bölgesinde mi?" },
    },
  },
  {
    // 2.2.4 (#580): drafted by ingest-dev, approved by the lead 2026-10-18.
    id: "dortmund-sensoren-behindertenparkplaetze-ladeplaetze",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.4",
    issue: 580,
    credits: ["dortmund_parksensoren"],
    tool: "find_parking",
    text: {
      de: { title: "Dortmund: freie Behindertenparkplätze und der Stellplatz an der Ladesäule", body: "In Dortmund melden Sensoren im Straßenraum, ob ein Behindertenparkplatz oder der Stellplatz einer Ladesäule gerade frei ist. ViaFrei nennt bei der Parkplatzsuche die nächsten Behindertenparkplätze und bei einer Ladesäule, ob ihr Stellplatz belegt ist — jeweils mit der Zeit der letzten Sensormeldung.", ask: "Gibt es einen freien Behindertenparkplatz in der Nähe des Dortmunder Hauptbahnhofs?" },
      en: { title: "Dortmund: free disabled-badge bays and the bay beside a charger", body: "In Dortmund, sensors in the street report whether a disabled-badge bay or the bay of a charge point is free right now. When you look for parking, ViaFrei names the nearest disabled-badge bays, and at a charge point it says whether its bay is taken — each with the time of the sensor's last message.", ask: "Is there a free disabled-badge bay near Dortmund Hauptbahnhof?" },
      ru: { title: "Дортмунд: свободные места для людей с инвалидностью и место у зарядной станции", body: "В Дортмунде датчики на улицах сообщают, свободно ли сейчас место для людей с инвалидностью или место у зарядной станции. При поиске парковки ViaFrei называет ближайшие места для людей с инвалидностью, а у зарядной станции — занято ли её место, каждый раз со временем последнего сообщения датчика.", ask: "Есть ли свободное место для людей с инвалидностью рядом с главным вокзалом Дортмунда?" },
      bg: { title: "Дортмунд: свободни места за хора с увреждания и мястото до зарядната станция", body: "В Дортмунд сензори на улицата съобщават дали място за хора с увреждания или мястото на зарядна станция е свободно в момента. При търсене на паркинг ViaFrei посочва най-близките места за хора с увреждания, а при зарядна станция — дали мястото ѝ е заето, всеки път с часа на последното съобщение на сензора.", ask: "Има ли свободно място за хора с увреждания близо до Централна гара Дортмунд?" },
      uk: { title: "Дортмунд: вільні місця для людей з інвалідністю та місце біля зарядної станції", body: "У Дортмунді датчики на вулицях повідомляють, чи вільне зараз місце для людей з інвалідністю або місце біля зарядної станції. Під час пошуку паркування ViaFrei називає найближчі місця для людей з інвалідністю, а біля зарядної станції — чи зайняте її місце, щоразу з часом останнього повідомлення датчика.", ask: "Чи є вільне місце для людей з інвалідністю біля головного вокзалу Дортмунда?" },
      ro: { title: "Dortmund: locuri libere pentru persoane cu dizabilități și locul de lângă stația de încărcare", body: "În Dortmund, senzorii de pe stradă raportează dacă un loc pentru persoane cu dizabilități sau locul unei stații de încărcare este liber acum. Când cauți parcare, ViaFrei numește cele mai apropiate locuri pentru persoane cu dizabilități, iar la o stație de încărcare spune dacă locul ei este ocupat — de fiecare dată cu ora ultimului mesaj al senzorului.", ask: "Există un loc liber pentru persoane cu dizabilități lângă gara centrală din Dortmund?" },
      tr: { title: "Dortmund: boş engelli park yerleri ve şarj istasyonunun yanındaki yer", body: "Dortmund'da sokaklardaki sensörler, bir engelli park yerinin ya da bir şarj istasyonunun park yerinin şu anda boş olup olmadığını bildiriyor. ViaFrei park yeri ararken en yakın engelli park yerlerini, bir şarj istasyonunda ise park yerinin dolu olup olmadığını — her seferinde sensörün son mesajının saatiyle — söylüyor.", ask: "Dortmund Hauptbahnhof yakınında boş bir engelli park yeri var mı?" },
    },
  },
  {
    // 2.2.3 (#604, #606, #691, #598): drafted by ingest-dev, approved by the lead 2026-10-18.
    id: "zweite-quelle-berlin-sachsen-autobahn",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.3",
    issue: 604,
    credits: ["mobilithek_viz_berlin", "mobilithek_traffic_lms_berlin", "mobilithek_sperrinfosys_sn", "mobilithek_ald_14d"],
    tool: "check_road_status",
    text: {
      de: { title: "Baustellen und Sperrungen aus zwei Quellen: Berlin, Sachsen und die Autobahnen", body: "ViaFrei liest jetzt die Verkehrsinformationszentrale Berlin, die Landesmeldestelle Berlin, das Sperrinformationssystem Sachsen und die Arbeitsstellen der Autobahn GmbH für die nächsten 14 Tage. Eine Meldung, die zwei Quellen führen, steht einmal in der Antwort, und beide werden genannt; ist eine Quelle gerade nicht aktuell, antwortet die andere allein, und Umleitungen in Sachsen nennt ViaFrei als Hinweis auf die Beschilderung, nie als Route.", ask: "Welche Straßen sind gerade bei mir in Berlin-Mitte gesperrt?" },
      en: { title: "Roadworks and closures from two sources: Berlin, Saxony and the motorways", body: "ViaFrei now reads Berlin's traffic information centre, the Landesmeldestelle Berlin, Saxony's closure information system and the Autobahn GmbH's roadworks for the next 14 days. A message two sources carry is listed once in the answer, and both are named; when one source is not current the other answers alone, and ViaFrei gives detours in Saxony as signage context, never as a route.", ask: "Which roads are closed near me in Berlin-Mitte right now?" },
      ru: { title: "Дорожные работы и перекрытия из двух источников: Берлин, Саксония и автобаны", body: "ViaFrei теперь читает центр дорожной информации Берлина, Landesmeldestelle Berlin, систему информации о перекрытиях Саксонии и дорожные работы Autobahn GmbH на ближайшие 14 дней. Сообщение, которое ведут два источника, показывается в ответе один раз, и названы оба; если один источник сейчас не актуален, отвечает другой, а объезды в Саксонии ViaFrei называет как указание на дорожные знаки, никогда как маршрут.", ask: "Какие улицы сейчас перекрыты рядом со мной в Берлин-Митте?" },
      bg: { title: "Ремонти и затворени пътища от два източника: Берлин, Саксония и аутобаните", body: "ViaFrei вече чете центъра за пътна информация на Берлин, Landesmeldestelle Berlin, системата за информация за затваряния на Саксония и ремонтите на Autobahn GmbH за следващите 14 дни. Съобщение, което водят два източника, стои веднъж в отговора, и двата са посочени; ако единият източник в момента не е актуален, отговаря другият, а обходите в Саксония ViaFrei посочва като указание за пътните знаци, никога като маршрут.", ask: "Кои улици са затворени близо до мен в Берлин-Мите в момента?" },
      uk: { title: "Дорожні роботи й перекриття з двох джерел: Берлін, Саксонія та автобани", body: "ViaFrei тепер читає центр дорожньої інформації Берліна, Landesmeldestelle Berlin, систему інформації про перекриття Саксонії та дорожні роботи Autobahn GmbH на найближчі 14 днів. Повідомлення, яке ведуть два джерела, стоїть у відповіді один раз, і названо обидва; якщо одне джерело зараз не актуальне, відповідає інше, а об'їзди в Саксонії ViaFrei називає як вказівку на дорожні знаки, ніколи як маршрут.", ask: "Які вулиці зараз перекриті біля мене в Берлін-Мітте?" },
      ro: { title: "Lucrări și închideri din două surse: Berlin, Saxonia și autostrăzile", body: "ViaFrei citește acum centrul de informații rutiere din Berlin, Landesmeldestelle Berlin, sistemul de informații despre închideri din Saxonia și lucrările Autobahn GmbH pentru următoarele 14 zile. Un mesaj pe care îl au două surse apare o singură dată în răspuns, iar ambele sunt numite; când o sursă nu este actuală, răspunde cealaltă singură, iar ocolirile din Saxonia ViaFrei le dă ca indicație a semnalizării, niciodată ca traseu.", ask: "Ce străzi sunt închise acum lângă mine în Berlin-Mitte?" },
      tr: { title: "İki kaynaktan yol çalışmaları ve kapanışlar: Berlin, Saksonya ve otoyollar", body: "ViaFrei artık Berlin trafik bilgi merkezini, Landesmeldestelle Berlin'i, Saksonya kapanış bilgi sistemini ve Autobahn GmbH'nin önümüzdeki 14 günlük yol çalışmalarını okuyor. İki kaynağın taşıdığı bir mesaj yanıtta bir kez yer alıyor ve ikisi de anılıyor; bir kaynak güncel değilse diğeri tek başına yanıtlıyor ve ViaFrei Saksonya'daki sapmaları bir rota olarak değil, tabelalara işaret olarak veriyor.", ask: "Şu anda Berlin-Mitte'de yakınımda hangi yollar kapalı?" },
    },
  },
  {
    // 2.2.3 (#595, #596, #597): drafted by ingest-dev, approved by the lead 2026-10-18.
    id: "baustellen-bayern-mv-umleitungen-nrw",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.3",
    issue: 595,
    credits: ["mobilithek_roadworks_bayern", "mobilithek_roadworks_mv", "mobilithek_detours_nrw"],
    tool: "find_roadworks_ahead",
    text: {
      de: { title: "Baustellen in Bayern und Mecklenburg-Vorpommern, Umleitungen in Nordrhein-Westfalen", body: "ViaFrei liest jetzt die Baustellen und Verkehrsmeldungen der Zentralstelle Verkehrsmanagement Bayern, die Arbeitsstellen des Landesamts für Straßenbau und Verkehr Mecklenburg-Vorpommern auf Bundes- und Landesstraßen und die ausgeschilderten Umleitungen von Straßen.NRW. Eine Umleitung nennt ViaFrei als Hinweis auf die Beschilderung, nie als Routenempfehlung.", ask: "Gibt es nächste Woche Baustellen auf der B14?" },
      en: { title: "Roadworks in Bavaria and Mecklenburg-Western Pomerania, detours in North Rhine-Westphalia", body: "ViaFrei now reads the roadworks and traffic messages of Bavaria's traffic management centre, the works of Mecklenburg-Western Pomerania's roads authority on federal and state roads, and Straßen.NRW's signed detours. ViaFrei gives a detour as signage context, never as a route recommendation.", ask: "Are there roadworks on the B14 next week?" },
      ru: { title: "Дорожные работы в Баварии и Мекленбурге-Передней Померании, объезды в Северном Рейне-Вестфалии", body: "ViaFrei теперь читает дорожные работы и сообщения центра управления движением Баварии, работы дорожного ведомства Мекленбурга-Передней Померании на федеральных и земельных дорогах и обозначенные объезды Straßen.NRW. Объезд ViaFrei называет как указание на дорожные знаки, никогда как рекомендацию маршрута.", ask: "Будут ли на следующей неделе дорожные работы на B14?" },
      bg: { title: "Ремонти в Бавария и Мекленбург-Предна Померания, обходи в Северен Рейн-Вестфалия", body: "ViaFrei вече чете ремонтите и пътните съобщения на центъра за управление на движението в Бавария, ремонтите на пътната служба на Мекленбург-Предна Померания по федералните и провинциалните пътища и обозначените обходи на Straßen.NRW. Обход ViaFrei посочва като указание за пътните знаци, никога като препоръка за маршрут.", ask: "Ще има ли ремонти по B14 следващата седмица?" },
      uk: { title: "Дорожні роботи в Баварії та Мекленбурзі-Передній Померанії, об'їзди в Північному Рейні-Вестфалії", body: "ViaFrei тепер читає дорожні роботи й повідомлення центру керування рухом Баварії, роботи дорожнього відомства Мекленбургу-Передньої Померанії на федеральних і земельних дорогах та позначені об'їзди Straßen.NRW. Об'їзд ViaFrei називає як вказівку на дорожні знаки, ніколи як рекомендацію маршруту.", ask: "Чи будуть наступного тижня дорожні роботи на B14?" },
      ro: { title: "Lucrări în Bavaria și Mecklenburg-Pomerania Inferioară, ocoliri în Renania de Nord-Westfalia", body: "ViaFrei citește acum lucrările și mesajele de trafic ale centrului de management al traficului din Bavaria, lucrările autorității rutiere din Mecklenburg-Pomerania Inferioară pe drumurile federale și regionale și ocolirile semnalizate ale Straßen.NRW. ViaFrei dă o ocolire ca indicație a semnalizării, niciodată ca recomandare de traseu.", ask: "Sunt lucrări pe B14 săptămâna viitoare?" },
      tr: { title: "Bavyera ve Mecklenburg-Vorpommern'de yol çalışmaları, Kuzey Ren-Vestfalya'da sapmalar", body: "ViaFrei artık Bavyera trafik yönetim merkezinin yol çalışmalarını ve trafik mesajlarını, Mecklenburg-Vorpommern karayolları idaresinin federal ve eyalet yollarındaki çalışmalarını ve Straßen.NRW'nin tabelalı sapmalarını okuyor. ViaFrei bir sapmayı rota önerisi olarak değil, her zaman tabelalara işaret olarak veriyor.", ask: "Gelecek hafta B14'te yol çalışması var mı?" },
    },
  },
  {
    // 2.2.3 (#602): drafted by ingest-dev, approved by the lead 2026-10-18.
    id: "verkehrslage-autobahn-nrw",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.3",
    issue: 602,
    credits: ["mobilithek_los_nrw"],
    tool: "check_autobahn_traffic",
    text: {
      de: { title: "Die Verkehrslage an den Messstellen der Autobahnen in Nordrhein-Westfalen", body: "ViaFrei liest jetzt die Verkehrslage, die die Autobahn GmbH an rund 2 000 Messstellen in Nordrhein-Westfalen misst, und sagt für eine Autobahn, wo der Verkehr frei, dicht, zähfließend oder im Stillstand ist.", ask: "Wie ist gerade der Verkehr auf der A1 in Nordrhein-Westfalen?" },
      en: { title: "The traffic state at the motorway measuring sites in North Rhine-Westphalia", body: "ViaFrei now reads the traffic state the Autobahn GmbH measures at about 2,000 sites in North Rhine-Westphalia and says for a motorway where traffic is free-flowing, dense, slow or at a standstill.", ask: "How is the traffic on the A1 in North Rhine-Westphalia right now?" },
      ru: { title: "Дорожная обстановка на пунктах измерения автобанов в Северном Рейне-Вестфалии", body: "ViaFrei теперь читает дорожную обстановку, которую Autobahn GmbH измеряет примерно на 2 000 пунктах в Северном Рейне-Вестфалии, и говорит для автобана, где движение свободное, плотное, медленное или стоит.", ask: "Какая сейчас обстановка на A1 в Северном Рейне-Вестфалии?" },
      bg: { title: "Пътната обстановка в измервателните пунктове на аутобаните в Северен Рейн-Вестфалия", body: "ViaFrei вече чете пътната обстановка, която Autobahn GmbH измерва в около 2 000 пункта в Северен Рейн-Вестфалия, и казва за един аутобан къде движението е свободно, натоварено, бавно или в застой.", ask: "Какво е движението по A1 в Северен Рейн-Вестфалия в момента?" },
      uk: { title: "Дорожня ситуація на пунктах вимірювання автобанів у Північному Рейні-Вестфалії", body: "ViaFrei тепер читає дорожню ситуацію, яку Autobahn GmbH вимірює приблизно на 2 000 пунктах у Північному Рейні-Вестфалії, і каже для автобана, де рух вільний, щільний, повільний або стоїть.", ask: "Який зараз рух на A1 у Північному Рейні-Вестфалії?" },
      ro: { title: "Starea traficului la punctele de măsurare de pe autostrăzile din Renania de Nord-Westfalia", body: "ViaFrei citește acum starea traficului pe care Autobahn GmbH o măsoară la aproximativ 2.000 de puncte din Renania de Nord-Westfalia și spune, pentru o autostradă, unde traficul este liber, dens, lent sau blocat.", ask: "Cum este acum traficul pe A1 în Renania de Nord-Westfalia?" },
      tr: { title: "Kuzey Ren-Vestfalya'da otoyol ölçüm noktalarında trafik durumu", body: "ViaFrei artık Autobahn GmbH'nin Kuzey Ren-Vestfalya'da yaklaşık 2.000 noktada ölçtüğü trafik durumunu okuyor ve bir otoyol için trafiğin nerede akıcı, yoğun, ağır ya da durmuş olduğunu söylüyor.", ask: "Kuzey Ren-Vestfalya'da A1'de şu anda trafik nasıl?" },
    },
  },
  {
    // 2.2.2 (#769, #770): approved by the lead 2026-10-18.
    id: "parken-wuppertal-leipzig-pr",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.2",
    issue: 769,
    credits: ["mobilithek_park_wuppertal_static", "mobilithek_park_leipzig_pr_static", "mobilithek_park_leipzig_pr_dyn"],
    tool: "find_parking",
    text: {
      de: { title: "Mehr Parkhäuser in Wuppertal und P+R in Leipzig mit freien Plätzen", body: "ViaFrei liest jetzt die Parkhaus-Tabelle der Stadt Wuppertal, die 33 Parkhäuser und Parkplätze mehr kennt als bisher, und die P+R-Anlagen des Verkehrs- und Tiefbauamts Leipzig mit freien Plätzen live, darunter erstmals die freien Plätze am Völkerschlachtdenkmal. Eine Anlage, die zwei Quellen veröffentlichen, steht einmal in der Antwort, und beide Herausgeber werden genannt.", ask: "Wo gibt es in Leipzig gerade freie P+R-Plätze?" },
      en: { title: "More car parks in Wuppertal and Leipzig's P+R sites with free spaces", body: "ViaFrei now reads the City of Wuppertal's car-park table, which knows 33 more car parks than before, and the Leipzig Verkehrs- und Tiefbauamt's P+R sites with live free spaces, for the first time with the free spaces at Völkerschlachtdenkmal. A site two sources publish is listed once in the answer, and both publishers are named.", ask: "Where are there free P+R spaces in Leipzig right now?" },
      ru: { title: "Больше паркингов в Вуппертале и площадки P+R в Лейпциге со свободными местами", body: "ViaFrei теперь читает таблицу паркингов города Вупперталь, где на 33 паркинга больше, чем раньше, и площадки P+R управления транспорта и дорожного строительства Лейпцига со свободными местами в реальном времени, впервые и свободные места у Völkerschlachtdenkmal. Площадка, которую публикуют два источника, показывается в ответе один раз, и названы оба издателя.", ask: "Где в Лейпциге сейчас есть свободные места P+R?" },
      bg: { title: "Повече паркинги във Вупертал и P+R площадки в Лайпциг със свободни места", body: "ViaFrei вече чете таблицата с паркинги на град Вупертал, в която има 33 паркинга повече от досега, и P+R площадките на службата за транспорт и пътно строителство на Лайпциг със свободни места на живо, за първи път и свободните места при Völkerschlachtdenkmal. Площадка, която публикуват два източника, стои веднъж в отговора, и двамата издатели са посочени.", ask: "Къде в Лайпциг има свободни P+R места в момента?" },
      uk: { title: "Більше паркінгів у Вупперталі та майданчики P+R у Лейпцигу з вільними місцями", body: "ViaFrei тепер читає таблицю паркінгів міста Вупперталь, у якій на 33 паркінги більше, ніж досі, і майданчики P+R управління транспорту й дорожнього будівництва Лейпцига з вільними місцями в реальному часі, уперше й вільні місця біля Völkerschlachtdenkmal. Майданчик, який публікують два джерела, стоїть у відповіді один раз, і названо обох видавців.", ask: "Де в Лейпцигу зараз є вільні місця P+R?" },
      ro: { title: "Mai multe parcări în Wuppertal și parcări P+R în Leipzig cu locuri libere", body: "ViaFrei citește acum tabelul de parcări al orașului Wuppertal, care cunoaște cu 33 de parcări mai mult decât până acum, și parcările P+R ale biroului de transport și construcții rutiere din Leipzig, cu locuri libere în timp real, pentru prima dată și locurile libere de la Völkerschlachtdenkmal. O parcare publicată de două surse apare o singură dată în răspuns, iar ambii editori sunt numiți.", ask: "Unde sunt acum locuri P+R libere în Leipzig?" },
      tr: { title: "Wuppertal'de daha fazla otopark ve Leipzig'de boş yerli P+R alanları", body: "ViaFrei artık Wuppertal şehrinin, öncekinden 33 otopark daha fazlasını içeren otopark tablosunu ve Leipzig Ulaşım ve Yol Yapım Dairesi'nin canlı boş yer bilgisiyle P+R alanlarını okuyor; Völkerschlachtdenkmal'daki boş yerler de ilk kez var. İki kaynağın yayımladığı bir alan yanıtta bir kez yer alıyor ve iki yayıncı da anılıyor.", ask: "Leipzig'de şu anda nerede boş P+R yeri var?" },
    },
  },
  {
    // 2.2.2 (#613, #626, #627, #629, #630): approved by the lead 2026-10-18.
    id: "parken-freiburg-herrenberg-jena-vrr-karlsruhe",
    kind: "new",
    date: "2026-10-18",
    release: "2.2.2",
    issue: 613,
    credits: ["freiburg_parkleitsystem", "freiburg_park_ride", "herrenberg_parkapi", "jena_parkdaten", "vrr_park_ride", "trk_lkw_parken"],
    tool: "find_parking",
    text: {
      de: { title: "Parken in Freiburg, Herrenberg, Jena, im VRR und Lkw-Parkplätze um Karlsruhe", body: "ViaFrei liest jetzt fünf weitere Herausgeber direkt: das Parkleitsystem und die P+R-Anlagen der Stadt Freiburg mit freien Plätzen live, die Parkplätze der Stadt Herrenberg, die Parkplätze und Parkhäuser des Kommunalservice Jena, die Park&Ride-Anlagen im Verkehrsverbund Rhein-Ruhr und die Lkw-Parkplätze der TechnologieRegion Karlsruhe. Wo ein Herausgeber keine Belegung veröffentlicht, sagt ViaFrei das, statt eine Zahl zu erfinden.", ask: "Wo ist in Freiburg gerade ein Parkhaus mit freien Plätzen?" },
      en: { title: "Parking in Freiburg, Herrenberg, Jena, the VRR area and lorry bays around Karlsruhe", body: "ViaFrei now reads five more publishers directly: the City of Freiburg's parking guidance system and P+R sites with live free spaces, the City of Herrenberg's car parks, Kommunalservice Jena's car parks, the Park&Ride sites of the Rhine-Ruhr transport association and the TechnologieRegion Karlsruhe's lorry bays. Where a publisher does not publish occupancy, ViaFrei says so instead of inventing a figure.", ask: "Which car park in Freiburg has free spaces right now?" },
      ru: { title: "Парковки во Фрайбурге, Херренберге, Йене, в регионе VRR и стоянки для грузовиков у Карлсруэ", body: "ViaFrei теперь напрямую читает данные ещё пяти издателей: систему управления парковками и площадки P+R города Фрайбург со свободными местами в реальном времени, парковки города Херренберг, парковки и паркинги Kommunalservice Jena, площадки Park&Ride транспортного союза Рейн-Рур и стоянки для грузовиков TechnologieRegion Karlsruhe. Если издатель не публикует загрузку, ViaFrei так и говорит, а не выдумывает число.", ask: "В каком паркинге Фрайбурга сейчас есть свободные места?" },
      bg: { title: "Паркиране във Фрайбург, Херенберг, Йена, в района на VRR и места за камиони около Карлсруе", body: "ViaFrei вече чете директно още петима издатели: системата за насочване към паркинги и P+R площадките на град Фрайбург със свободни места на живо, паркингите на град Херенберг, паркингите и многоетажните паркинги на Kommunalservice Jena, Park&Ride площадките на транспортния съюз Рейн-Рур и местата за камиони на TechnologieRegion Karlsruhe. Когато издател не публикува заетост, ViaFrei го казва, вместо да измисля число.", ask: "Кой паркинг във Фрайбург има свободни места в момента?" },
      uk: { title: "Паркування у Фрайбурзі, Герренберзі, Єні, в регіоні VRR і стоянки для вантажівок біля Карлсруе", body: "ViaFrei тепер напряму читає дані ще п'ятьох видавців: систему керування паркуванням і майданчики P+R міста Фрайбург із вільними місцями в реальному часі, парковки міста Герренберг, парковки й паркінги Kommunalservice Jena, майданчики Park&Ride транспортного об'єднання Рейн-Рур і стоянки для вантажівок TechnologieRegion Karlsruhe. Якщо видавець не публікує заповненість, ViaFrei так і каже, а не вигадує число.", ask: "У якому паркінгу Фрайбурга зараз є вільні місця?" },
      ro: { title: "Parcare în Freiburg, Herrenberg, Jena, în zona VRR și locuri pentru camioane lângă Karlsruhe", body: "ViaFrei citește acum direct încă cinci editori: sistemul de ghidare la parcări și parcările P+R ale orașului Freiburg, cu locuri libere în timp real, parcările orașului Herrenberg, parcările și parcările supraetajate ale Kommunalservice Jena, parcările Park&Ride ale asociației de transport Rin-Ruhr și locurile pentru camioane ale TechnologieRegion Karlsruhe. Acolo unde un editor nu publică gradul de ocupare, ViaFrei spune asta în loc să inventeze o cifră.", ask: "Ce parcare din Freiburg are acum locuri libere?" },
      tr: { title: "Freiburg, Herrenberg, Jena, VRR bölgesinde otopark ve Karlsruhe çevresinde kamyon park yerleri", body: "ViaFrei artık beş yayıncıyı daha doğrudan okuyor: Freiburg şehrinin otopark yönlendirme sistemi ve canlı boş yer bilgisiyle P+R alanları, Herrenberg şehrinin otoparkları, Kommunalservice Jena'nın otoparkları ve katlı otoparkları, Ren-Ruhr ulaşım birliğinin Park&Ride alanları ve TechnologieRegion Karlsruhe'nin kamyon park yerleri. Bir yayıncı doluluk yayımlamıyorsa ViaFrei bir sayı uydurmak yerine bunu söylüyor.", ask: "Freiburg'da şu anda hangi katlı otoparkta boş yer var?" },
    },
  },
  {
    id: "live-antworten-auf-der-seite",
    kind: "new",
    date: "2026-10-15",
    release: "2.1.18",
    issue: 745,
    credits: ["dwd_road"],
    tool: "check_road_status",
    text: {
      de: { title: "Live-Antworten Ihres KI-Assistenten auf der Startseite und bei jedem Ort", body: "Neben jeder Zahl auf der Startseite steht jetzt die Frage, die Sie Ihrem KI-Assistenten stellen können, und was die Werkzeuge von ViaFrei gerade darauf antworten: mit dem Werkzeug, der Uhrzeit der Daten und jeder Quelle. Auch die Karten eines Ortes zeigen die Antworten für diesen Ort, zu Warnungen, Straßen, Orten in der Nähe, Laden und Parken. Es ist dieselbe Antwort, die Ihr Assistent bekommt, wenn er mit ViaFrei verbunden ist.", ask: "Ist auf den Straßen um Pulheim gerade etwas gesperrt?" },
      en: { title: "Your AI assistant's live answers on the home page and for every place", body: "Beside every figure on the home page there is now the question you can ask your AI assistant, and what ViaFrei's tools are answering to it right now: with the tool, the time of the data and every source. A place's cards show the answers for that place too, on warnings, roads, places nearby, charging and parking. It is the same answer your assistant gets when it is connected to ViaFrei.", ask: "Is anything closed on the roads around Pulheim right now?" },
      ru: { title: "Живые ответы вашего ИИ-ассистента на главной странице и для каждого места", body: "Рядом с каждой цифрой на главной странице теперь стоит вопрос, который можно задать ИИ-ассистенту, и то, что инструменты ViaFrei отвечают на него прямо сейчас: с названием инструмента, временем данных и каждым источником. Карточки места тоже показывают ответы для этого места — о предупреждениях, дорогах, местах поблизости, зарядке и парковке. Это тот же ответ, который получает ваш ассистент, подключённый к ViaFrei.", ask: "Перекрыто ли сейчас что-нибудь на дорогах вокруг Пульхайма?" },
      bg: { title: "Отговорите на живо на вашия ИИ асистент на началната страница и за всяко място", body: "До всяко число на началната страница вече стои въпросът, който можете да зададете на своя ИИ асистент, и какво отговарят инструментите на ViaFrei в момента: с инструмента, часа на данните и всеки източник. Картите на едно място също показват отговорите за това място — за предупреждения, пътища, места наблизо, зареждане и паркиране. Това е същият отговор, който получава вашият асистент, когато е свързан с ViaFrei.", ask: "Затворено ли е нещо по пътищата около Пулхайм в момента?" },
      uk: { title: "Живі відповіді вашого ШІ-асистента на головній сторінці й для кожного місця", body: "Біля кожного числа на головній сторінці тепер стоїть запитання, яке можна поставити ШІ-асистенту, і те, що інструменти ViaFrei відповідають на нього просто зараз: з назвою інструмента, часом даних і кожним джерелом. Картки місця теж показують відповіді для цього місця — про попередження, дороги, місця поблизу, заряджання й паркування. Це та сама відповідь, яку отримує ваш асистент, під'єднаний до ViaFrei.", ask: "Чи перекрито зараз щось на дорогах довкола Пульгайма?" },
      ro: { title: "Răspunsurile live ale asistentului dvs. AI pe pagina principală și pentru fiecare loc", body: "Lângă fiecare cifră de pe pagina principală stă acum întrebarea pe care o puteți pune asistentului AI și ce răspund chiar acum instrumentele ViaFrei: cu instrumentul, ora datelor și fiecare sursă. Cardurile unui loc arată și ele răspunsurile pentru acel loc, despre avertizări, drumuri, locuri din apropiere, încărcare și parcare. Este același răspuns pe care îl primește asistentul dvs. când este conectat la ViaFrei.", ask: "Este ceva închis acum pe drumurile din jurul orașului Pulheim?" },
      tr: { title: "Yapay zekâ asistanınızın canlı yanıtları ana sayfada ve her yer için", body: "Ana sayfadaki her rakamın yanında artık yapay zekâ asistanınıza sorabileceğiniz soru ve ViaFrei araçlarının şu anda verdiği yanıt duruyor: araç, verinin saati ve her kaynakla birlikte. Bir yerin kartları da o yer için yanıtları gösteriyor: uyarılar, yollar, yakındaki yerler, şarj ve park. Bu, asistanınızın ViaFrei'ye bağlıyken aldığı yanıtın aynısı.", ask: "Pulheim çevresindeki yollarda şu anda kapalı bir yer var mı?" },
    },
  },
  {
    id: "autobahn-seiten",
    kind: "new",
    date: "2026-10-14",
    release: "2.1.13",
    issue: 715,
    credits: ["bast_lcl", "mobilithek_bab_messages"],
    tool: "check_autobahn_traffic",
    text: {
      de: { title: "Eine Live-Seite für jede deutsche Autobahn", body: "Alle 122 Autobahnen haben jetzt eine eigene Seite mit einer Karte ihres Verlaufs, den Sperrungen, Staus und Baustellen von jetzt und den geplanten Vollsperrungen der nächsten sieben Tage mit ihren Umleitungen. Dazu kommen Lkw-Parkplätze mit freien Plätzen, Ladesäulen nach Leistung, Straßenwetter und Warnungen, Kameras, das Lkw-Fahrverbot und die Autobahnkreuze. Die Startseite zeigt die zehn Autobahnen, auf denen gerade am meisten los ist.", ask: "Wie ist die Lage auf der A7 gerade?" },
      en: { title: "A live page for every German motorway", body: "All 122 motorways now have a page of their own, with a map of the road, its closures, jams and roadworks right now, and the full closures planned for the next seven days with their detours. There are lorry parks with free spaces, chargers by power, road weather and warnings, cameras, the lorry ban and the interchanges as well. The home page shows the ten motorways with the most going on right now.", ask: "What is the situation on the A7 right now?" },
      ru: { title: "Страница в реальном времени для каждого автобана Германии", body: "У всех 122 автобанов теперь есть своя страница: карта трассы, перекрытия, пробки и дорожные работы прямо сейчас и полные перекрытия на ближайшие семь дней с объездами. Там же стоянки для грузовиков со свободными местами, зарядные станции по мощности, дорожная погода и предупреждения, камеры, запрет движения грузовиков и развязки. Главная страница показывает десять автобанов, где сейчас больше всего происходит.", ask: "Какая сейчас обстановка на A7?" },
      bg: { title: "Страница на живо за всяка германска магистрала", body: "Всички 122 магистрали вече имат своя страница с карта на трасето, затварянията, задръстванията и ремонтите в момента и пълните затваряния през следващите седем дни с техните обходи. Има още паркинги за камиони със свободни места, зарядни станции по мощност, пътно време и предупреждения, камери, забраната за камиони и пътните възли. Началната страница показва десетте магистрали, на които в момента се случва най-много.", ask: "Каква е ситуацията на A7 в момента?" },
      uk: { title: "Сторінка в реальному часі для кожного німецького автобану", body: "Усі 122 автобани тепер мають власну сторінку: мапа траси, перекриття, затори й дорожні роботи просто зараз і повні перекриття на найближчі сім днів з об'їздами. Там же стоянки для вантажівок із вільними місцями, зарядні станції за потужністю, дорожня погода й попередження, камери, заборона руху вантажівок і розв'язки. Головна сторінка показує десять автобанів, де зараз найбільше відбувається.", ask: "Яка зараз ситуація на A7?" },
      ro: { title: "O pagină live pentru fiecare autostradă germană", body: "Toate cele 122 de autostrăzi au acum o pagină proprie, cu o hartă a traseului, închiderile, ambuteiajele și lucrările de acum și închiderile complete planificate pentru următoarele șapte zile, cu ocolirile lor. Sunt și parcări pentru camioane cu locuri libere, stații de încărcare după putere, vremea pe drum și avertizări, camere, interdicția pentru camioane și nodurile rutiere. Pagina principală arată cele zece autostrăzi pe care se întâmplă cel mai mult acum.", ask: "Care este situația pe A7 acum?" },
      tr: { title: "Almanya'daki her otoyol için canlı bir sayfa", body: "122 otoyolun hepsinin artık kendi sayfası var: yolun haritası, şu anki kapanmalar, trafik sıkışıklıkları ve yol çalışmaları ile önümüzdeki yedi gün için planlanan tam kapanmalar ve alternatif güzergâhları. Ayrıca boş yeri olan kamyon otoparkları, güce göre şarj noktaları, yol havası ve uyarılar, kameralar, kamyon yasağı ve kavşaklar da var. Ana sayfa şu anda en çok şey olan on otoyolu gösteriyor.", ask: "A7'de şu anda durum nasıl?" },
    },
  },
  {
    id: "wasserstoff-bruecken-bahnhoefe",
    kind: "new",
    date: "2026-10-13",
    release: "2.1.3",
    issue: 645,
    credits: ["mobilithek_h2_stations", "mobilithek_bridges_sh", "mobilithek_park_kassel_static", "mobilithek_park_kassel_dyn"],
    tool: "find_hydrogen_station",
    text: {
      de: { title: "Wasserstoff-Tankstellen, Brücken in Schleswig-Holstein und mehr zu jedem Bahnhof", body: "ViaFrei kennt jetzt die Wasserstoff-Tankstellen von H2 Mobility mit ihren Zapfpunkten für Pkw und Lkw, die Zustände der großen Brücken in Schleswig-Holstein und die Parkhäuser der Stadt Kassel mit ihrer Belegung. Auf den Ortsseiten steht bei jedem Bahnhof, welche Aufzüge und Fahrtreppen laufen, welche Steige stufenfrei sind und welche Parkhäuser direkt daneben liegen. Die Wetterkarte zeigt die nächsten Stunden an der nächsten Straßenwetterstation, und die Pünktlichkeit gilt jetzt für den Kreis.", ask: "Wo ist die nächste Wasserstoff-Tankstelle für einen Lkw bei Hamburg?" },
      en: { title: "Hydrogen stations, Schleswig-Holstein's bridges and more on every station", body: "ViaFrei now knows H2 Mobility's hydrogen stations with their car and truck dispensers, the state of the large bridges in Schleswig-Holstein, and the City of Kassel's car parks with their occupancy. On the place pages, every station now says which lifts and escalators are running, which platforms are step-free and which car parks are right next to it. The weather card shows the next hours at the nearest road-weather station, and punctuality is now given for the district.", ask: "Where is the nearest hydrogen station for a truck near Hamburg?" },
      ru: { title: "Водородные заправки, мосты Шлезвиг-Гольштейна и больше о каждом вокзале", body: "ViaFrei теперь знает водородные заправки H2 Mobility с колонками для легковых и грузовых машин, состояние больших мостов в Шлезвиг-Гольштейне и парковки города Кассель с их заполненностью. На страницах мест у каждого вокзала указано, какие лифты и эскалаторы работают, какие платформы без ступеней и какие парковки рядом. Карточка погоды показывает ближайшие часы на ближайшей дорожной метеостанции, а пунктуальность теперь дана по району.", ask: "Где ближайшая водородная заправка для грузовика около Гамбурга?" },
      bg: { title: "Водородни станции, мостовете в Шлезвиг-Холщайн и повече за всяка гара", body: "ViaFrei вече познава водородните станции на H2 Mobility с колонките им за леки коли и камиони, състоянието на големите мостове в Шлезвиг-Холщайн и паркингите на град Касел със заетостта им. На страниците на местата при всяка гара пише кои асансьори и ескалатори работят, кои перони са без стъпала и кои паркинги са точно до нея. Картата за времето показва следващите часове при най-близката пътна метеостанция, а точността вече е дадена за окръга.", ask: "Къде е най-близката водородна станция за камион край Хамбург?" },
      uk: { title: "Водневі заправки, мости Шлезвіг-Гольштейну й більше про кожен вокзал", body: "ViaFrei тепер знає водневі заправки H2 Mobility з колонками для легкових і вантажних авто, стан великих мостів у Шлезвіг-Гольштейні та паркінги міста Кассель із їхньою заповненістю. На сторінках місць біля кожного вокзалу вказано, які ліфти й ескалатори працюють, які платформи без сходинок і які паркінги поруч. Картка погоди показує найближчі години на найближчій дорожній метеостанції, а пунктуальність тепер подано за районом.", ask: "Де найближча воднева заправка для вантажівки біля Гамбурга?" },
      ro: { title: "Stații de hidrogen, podurile din Schleswig-Holstein și mai mult despre fiecare gară", body: "ViaFrei cunoaște acum stațiile de hidrogen H2 Mobility cu pompele lor pentru autoturisme și camioane, starea podurilor mari din Schleswig-Holstein și parcările orașului Kassel cu gradul lor de ocupare. Pe paginile locurilor, la fiecare gară scrie ce lifturi și scări rulante funcționează, ce peroane sunt fără trepte și ce parcări sunt chiar lângă ea. Cardul vremii arată orele următoare la cea mai apropiată stație meteo rutieră, iar punctualitatea este dată acum pe district.", ask: "Unde este cea mai apropiată stație de hidrogen pentru un camion lângă Hamburg?" },
      tr: { title: "Hidrojen istasyonları, Schleswig-Holstein köprüleri ve her istasyon hakkında daha fazlası", body: "ViaFrei artık H2 Mobility'nin otomobil ve kamyon pompalı hidrojen istasyonlarını, Schleswig-Holstein'daki büyük köprülerin durumunu ve Kassel şehrinin doluluk bilgili otoparklarını biliyor. Yer sayfalarında her istasyonun hangi asansör ve yürüyen merdivenlerinin çalıştığı, hangi peronların basamaksız olduğu ve hemen yanında hangi otoparkların bulunduğu yazıyor. Hava kartı en yakın yol hava istasyonunda sonraki saatleri gösteriyor; dakiklik artık ilçe için veriliyor.", ask: "Hamburg yakınında kamyon için en yakın hidrojen istasyonu nerede?" },
    },
  },
  {
    id: "baustellen-bremen-kassel-leipzig",
    kind: "new",
    date: "2026-10-13",
    release: "2.1.2",
    issue: 594,
    credits: ["mobilithek_roadworks_bremen", "mobilithek_traffic_kassel", "mobilithek_traffic_leipzig", "mobilithek_traffic_ruesselsheim", "mobilithek_roadworks_nlstbv"],
    tool: "check_road_status",
    text: {
      de: { title: "Baustellen und Sperrungen in Bremen, Kassel, Leipzig und Rüsselsheim", body: "ViaFrei liest jetzt die Verkehrsmeldungen der Städte Bremen, Kassel, Leipzig und Rüsselsheim am Main und die Arbeitsstellen und Sperrungen der niedersächsischen Landesbehörde außerhalb der Autobahnen. Die Meldungen der Städte stehen auch auf den Ortsseiten, ebenso die von Köln und Hannover.", ask: "Gibt es in Bremen gerade Sperrungen in der Innenstadt?" },
      en: { title: "Roadworks and closures in Bremen, Kassel, Leipzig and Rüsselsheim", body: "ViaFrei now reads the traffic messages of the cities of Bremen, Kassel, Leipzig and Rüsselsheim am Main, and the Lower Saxony road authority's works and closures away from the motorways. The cities' messages are also on the place pages, as are Cologne's and Hanover's.", ask: "Are there any closures in central Bremen right now?" },
      ru: { title: "Дорожные работы и перекрытия в Бремене, Касселе, Лейпциге и Рюссельсхайме", body: "ViaFrei теперь читает дорожные сообщения городов Бремен, Кассель, Лейпциг и Рюссельсхайм-на-Майне, а также дорожные работы и перекрытия дорожного ведомства Нижней Саксонии вне автобанов. Сообщения городов есть и на страницах мест, как и сообщения Кёльна и Ганновера.", ask: "Есть ли сейчас перекрытия в центре Бремена?" },
      bg: { title: "Ремонти и затваряния в Бремен, Касел, Лайпциг и Рюселсхайм", body: "ViaFrei вече чете пътните съобщения на градовете Бремен, Касел, Лайпциг и Рюселсхайм на Майн, както и ремонтите и затварянията на пътното ведомство на Долна Саксония извън аутобаните. Съобщенията на градовете са и на страниците на местата, както и тези на Кьолн и Хановер.", ask: "Има ли в момента затваряния в центъра на Бремен?" },
      uk: { title: "Дорожні роботи й перекриття в Бремені, Касселі, Лейпцигу та Рюссельсгаймі", body: "ViaFrei тепер читає дорожні повідомлення міст Бремен, Кассель, Лейпциг і Рюссельсгайм-на-Майні, а також дорожні роботи й перекриття дорожнього відомства Нижньої Саксонії поза автобанами. Повідомлення міст є й на сторінках місць, як і повідомлення Кельна та Ганновера.", ask: "Чи є зараз перекриття в центрі Бремена?" },
      ro: { title: "Lucrări și închideri în Bremen, Kassel, Leipzig și Rüsselsheim", body: "ViaFrei citește acum mesajele de trafic ale orașelor Bremen, Kassel, Leipzig și Rüsselsheim am Main, precum și lucrările și închiderile autorității rutiere din Saxonia Inferioară în afara autostrăzilor. Mesajele orașelor sunt și pe paginile locurilor, la fel ca cele din Köln și Hanovra.", ask: "Sunt acum închideri în centrul Bremenului?" },
      tr: { title: "Bremen, Kassel, Leipzig ve Rüsselsheim'da yol çalışmaları ve kapanmalar", body: "ViaFrei artık Bremen, Kassel, Leipzig ve Rüsselsheim am Main şehirlerinin trafik mesajlarını ve Aşağı Saksonya karayolu idaresinin otoyollar dışındaki çalışma ve kapanmalarını okuyor. Şehirlerin mesajları, Köln ve Hannover'inkiler gibi yer sayfalarında da yer alıyor.", ask: "Bremen şehir merkezinde şu anda kapalı yol var mı?" },
    },
  },
  {
    id: "ladepunkte-23-betreiber",
    kind: "new",
    date: "2026-10-13",
    release: "2.1.0",
    issue: 646,
    credits: AFIR_OPERATORS_2_1,
    tool: "find_charging_station",
    text: {
      de: { title: "Ladepunkte von 23 weiteren Betreibern", body: "ViaFrei liest jetzt die eigenen Veröffentlichungen von 23 weiteren Ladepunkt-Betreibern auf der Mobilithek, darunter EWE Go, LichtBlick, Qwello, Wirelane, chargecloud und vaylens. Wo ein Betreiber meldet, ob ein Ladepunkt frei ist, zeigen wir das, aber nie, wenn die Meldung älter als 30 Minuten ist.", ask: "Wo ist in Münster gerade eine Ladesäule frei?" },
      en: { title: "Charge points from 23 more operators", body: "ViaFrei now reads the own Mobilithek publications of 23 more charge-point operators, among them EWE Go, LichtBlick, Qwello, Wirelane, chargecloud and vaylens. Where an operator reports whether a charge point is free, we show it, but never when the report is older than 30 minutes.", ask: "Where is a charging station free in Münster right now?" },
      ru: { title: "Зарядные точки ещё 23 операторов", body: "ViaFrei теперь читает собственные публикации ещё 23 операторов зарядных станций на платформе Mobilithek, среди них EWE Go, LichtBlick, Qwello, Wirelane, chargecloud и vaylens. Если оператор сообщает, свободна ли точка зарядки, мы это показываем, но никогда, если сообщение старше 30 минут.", ask: "Где в Мюнстере сейчас свободна зарядная станция?" },
      bg: { title: "Точки за зареждане от още 23 оператори", body: "ViaFrei вече чете собствените публикации на още 23 оператори на зарядни станции в платформата Mobilithek, сред тях EWE Go, LichtBlick, Qwello, Wirelane, chargecloud и vaylens. Когато операторът съобщава дали точката за зареждане е свободна, показваме това, но никога, ако съобщението е по-старо от 30 минути.", ask: "Къде в Мюнстер има свободна зарядна станция в момента?" },
      uk: { title: "Точки заряджання ще 23 операторів", body: "ViaFrei тепер читає власні публікації ще 23 операторів зарядних станцій на платформі Mobilithek, серед них EWE Go, LichtBlick, Qwello, Wirelane, chargecloud і vaylens. Якщо оператор повідомляє, чи вільна точка заряджання, ми це показуємо, але ніколи, якщо повідомлення старше за 30 хвилин.", ask: "Де в Мюнстері зараз вільна зарядна станція?" },
      ro: { title: "Puncte de încărcare de la încă 23 de operatori", body: "ViaFrei citește acum publicațiile proprii ale altor 23 de operatori de stații de încărcare de pe platforma Mobilithek, printre ei EWE Go, LichtBlick, Qwello, Wirelane, chargecloud și vaylens. Unde un operator raportează dacă un punct de încărcare este liber, îl afișăm, dar niciodată dacă raportarea este mai veche de 30 de minute.", ask: "Unde este acum liberă o stație de încărcare în Münster?" },
      tr: { title: "23 operatörden daha şarj noktaları", body: "ViaFrei artık 23 şarj noktası operatörünün daha Mobilithek'teki kendi yayınlarını okuyor; aralarında EWE Go, LichtBlick, Qwello, Wirelane, chargecloud ve vaylens var. Bir operatör şarj noktasının boş olup olmadığını bildirdiğinde bunu gösteriyoruz, ancak bildirim 30 dakikadan eskiyse asla.", ask: "Münster'de şu anda boş bir şarj istasyonu nerede?" },
    },
  },
  {
    id: "autobahn-verkehrsmeldungen",
    kind: "new",
    date: "2026-10-12",
    release: "2.0.2",
    issue: 43,
    credits: ["mobilithek_bab_messages", "bast_lcl"],
    tool: "check_road_status",
    text: {
      de: { title: "Verkehrsmeldungen der Autobahn GmbH, mit Ort", body: "ViaFrei liest jetzt alle fünf Minuten die Verkehrsmeldungen der Autobahn GmbH zu Sperrungen und Verlustzeiten. Die Meldungen werden über die TMC-Ortsliste der BASt ihrer Autobahn und ihren Bezugspunkten zugeordnet, etwa Anschlussstellen.", ask: "Ist die A620 bei Saarbrücken gerade gesperrt?" },
      en: { title: "Autobahn GmbH traffic messages, located", body: "ViaFrei now reads the Autobahn GmbH's traffic messages on closures and delays every five minutes. The messages are placed on their motorway and at their reference points, such as junctions, through the BASt TMC location list.", ask: "Is the A620 near Saarbrücken closed right now?" },
      ru: { title: "Дорожные сообщения Autobahn GmbH с привязкой к месту", body: "ViaFrei теперь каждые пять минут читает сообщения Autobahn GmbH о перекрытиях и задержках. Сообщения по списку мест TMC федерального ведомства BASt привязываются к своему автобану и опорным точкам, например развязкам.", ask: "Перекрыт ли сейчас A620 у Саарбрюккена?" },
      bg: { title: "Пътни съобщения на Autobahn GmbH, с местоположение", body: "ViaFrei вече чете на всеки пет минути съобщенията на Autobahn GmbH за затваряния и закъснения. Съобщенията се свързват чрез списъка с места TMC на федералното ведомство BASt с техния аутобан и опорните им точки, например възли.", ask: "Затворен ли е в момента A620 край Саарбрюкен?" },
      uk: { title: "Дорожні повідомлення Autobahn GmbH із прив'язкою до місця", body: "ViaFrei тепер кожні п'ять хвилин читає повідомлення Autobahn GmbH про перекриття та затримки. Повідомлення за списком місць TMC федерального відомства BASt прив'язуються до свого автобану та опорних точок, наприклад розв'язок.", ask: "Чи перекрита зараз A620 біля Саарбрюккена?" },
      ro: { title: "Mesajele de trafic ale Autobahn GmbH, localizate", body: "ViaFrei citește acum la fiecare cinci minute mesajele Autobahn GmbH despre închideri și întârzieri. Mesajele sunt plasate pe autostrada lor și în punctele lor de referință, de exemplu noduri, prin lista de locații TMC a BASt.", ask: "Este închisă acum A620 lângă Saarbrücken?" },
      tr: { title: "Autobahn GmbH trafik mesajları, konumuyla", body: "ViaFrei artık Autobahn GmbH'nin kapanma ve gecikme mesajlarını beş dakikada bir okuyor. Mesajlar, BASt'ın TMC konum listesi aracılığıyla kendi otoyollarına ve kavşak gibi referans noktalarına yerleştiriliyor.", ask: "Saarbrücken yakınındaki A620 şu anda kapalı mı?" },
    },
  },
  {
    id: "muenchen-pr-prognosen",
    kind: "new",
    date: "2026-10-11",
    release: "1.9.16",
    issue: 494,
    credits: ["muc_parken_parkhaeuser", "muc_parken_pr", "muc_parken_prognosen"],
    tool: "find_parking",
    text: {
      de: { title: "Parkhäuser und P+R in München, mit Prognose", body: "ViaFrei kennt jetzt Münchens Parkhäuser und P+R-Anlagen. Wo eine P+R-Anlage keine Live-Belegung meldet, nennen wir die Prognose der Stadt für die aktuelle Stunde, mit ihrem Datum, und nie als freie Plätze.", ask: "Wo kann ich in München an einem P+R parken und mit der U-Bahn weiterfahren?" },
      en: { title: "Car parks and park-and-ride in Munich, with forecasts", body: "ViaFrei now knows Munich's car parks and park-and-ride sites. Where a P+R site reports no live occupancy, we give the city's forecast for the current hour, with its date, and never as free spaces.", ask: "Where can I park at a park-and-ride in Munich and take the U-Bahn on?" },
      ru: { title: "Парковки и перехватывающие парковки в Мюнхене, с прогнозом", body: "ViaFrei теперь знает парковочные дома и перехватывающие парковки Мюнхена. Если перехватывающая парковка не сообщает текущую загрузку, мы называем прогноз города на текущий час с его датой и никогда не выдаём его за свободные места.", ask: "Где в Мюнхене можно оставить машину на перехватывающей парковке и поехать дальше на метро?" },
      bg: { title: "Паркинги и буферни паркинги в Мюнхен, с прогноза", body: "ViaFrei вече познава паркингите и буферните паркинги на Мюнхен. Когато буферен паркинг не съобщава текуща заетост, даваме прогнозата на града за текущия час, с нейната дата, и никога като свободни места.", ask: "Къде в Мюнхен мога да паркирам на буферен паркинг и да продължа с метрото?" },
      uk: { title: "Паркінги та перехоплювальні парковки в Мюнхені, з прогнозом", body: "ViaFrei тепер знає паркінги та перехоплювальні парковки Мюнхена. Якщо перехоплювальна парковка не повідомляє поточну заповненість, ми називаємо прогноз міста на поточну годину з його датою і ніколи не подаємо його як вільні місця.", ask: "Де в Мюнхені можна залишити авто на перехоплювальній парковці й поїхати далі метро?" },
      ro: { title: "Parcări și P+R în München, cu prognoză", body: "ViaFrei cunoaște acum parcările etajate și parcările P+R din München. Unde o parcare P+R nu raportează ocuparea în timp real, oferim prognoza orașului pentru ora curentă, cu data ei, și niciodată ca locuri libere.", ask: "Unde pot parca într-un P+R în München și să continui cu metroul?" },
      tr: { title: "Münih'te otoparklar ve P+R, tahminle birlikte", body: "ViaFrei artık Münih'in katlı otoparklarını ve P+R alanlarını biliyor. Bir P+R alanı anlık doluluk bildirmediğinde, şehrin o saat için tahminini tarihiyle birlikte veriyoruz; bunu asla boş yer olarak göstermiyoruz.", ask: "Münih'te bir P+R'a park edip metroyla nereden devam edebilirim?" },
    },
  },
  {
    id: "parkapi-baden-wuerttemberg",
    kind: "new",
    date: "2026-10-11",
    release: "1.9.16",
    issue: 493,
    credits: PARKAPI_BW,
    tool: "find_parking",
    text: {
      de: { title: "Freie Parkplätze in Baden-Württemberg", body: "Die Live-Belegung der Parkhäuser in Baden-Württemberg kommt jetzt aus MobiData BWs ParkAPI, alle fünf Minuten, nur aus Quellen mit passender Lizenz. Eine Meldung, die beim Herausgeber älter als 30 Minuten ist, zeigen wir nicht als Belegung.", ask: "Wo finde ich in Karlsruhe gerade einen freien Parkplatz im Parkhaus?" },
      en: { title: "Free parking spaces in Baden-Württemberg", body: "Live car-park occupancy across Baden-Württemberg now comes from MobiData BW's ParkAPI, every five minutes, from licensed sources only. A reading older than 30 minutes by the publisher's clock is not shown as occupancy.", ask: "Where can I find a free space in a car park in Karlsruhe right now?" },
      ru: { title: "Свободные парковочные места в Баден-Вюртемберге", body: "Текущая загрузка парковок в Баден-Вюртемберге теперь поступает из открытого сервиса данных земли каждые пять минут, только из источников с подходящей лицензией. Данные старше 30 минут по часам издателя мы не показываем как загрузку.", ask: "Где в Карлсруэ сейчас есть свободное место на парковке?" },
      bg: { title: "Свободни места за паркиране в Баден-Вюртемберг", body: "Текущата заетост на паркингите в Баден-Вюртемберг вече идва от отворената услуга за данни на провинцията, на всеки пет минути, само от източници с подходящ лиценз. Данни, по-стари от 30 минути по часовника на издателя, не показваме като заетост.", ask: "Къде в Карлсруе има в момента свободно място в паркинг?" },
      uk: { title: "Вільні паркомісця в Баден-Вюртемберзі", body: "Поточна заповненість паркінгів у Баден-Вюртемберзі тепер надходить із відкритого сервісу даних землі кожні п'ять хвилин, лише з джерел із відповідною ліцензією. Дані, старші за 30 хвилин за годинником видавця, ми не показуємо як заповненість.", ask: "Де в Карлсруе зараз є вільне місце в паркінгу?" },
      ro: { title: "Locuri de parcare libere în Baden-Württemberg", body: "Ocuparea în timp real a parcărilor din Baden-Württemberg vine acum din ParkAPI de la MobiData BW, la fiecare cinci minute, doar din surse cu licență potrivită. O citire mai veche de 30 de minute după ceasul editorului nu este afișată ca ocupare.", ask: "Unde găsesc acum un loc liber într-o parcare din Karlsruhe?" },
      tr: { title: "Baden-Württemberg'de boş park yerleri", body: "Baden-Württemberg'deki otoparkların anlık doluluğu artık MobiData BW'nin ParkAPI'sinden, beş dakikada bir ve yalnızca uygun lisanslı kaynaklardan geliyor. Yayıncının saatine göre 30 dakikadan eski bir veri doluluk olarak gösterilmez.", ask: "Karlsruhe'de şu anda boş yeri olan bir otopark nerede?" },
    },
  },
  {
    id: "bw-bedarfsumleitungen",
    kind: "new",
    date: "2026-10-11",
    release: "1.9.15",
    issue: 492,
    credits: ["bw_bedarfsumleitungen"],
    tool: "check_road_status",
    text: {
      de: { title: "Ausgeschilderte Umleitungen in Baden-Württemberg", body: "Passt eine Autobahnsperrung in Baden-Württemberg zu einer veröffentlichten Bedarfsumleitung, nennt ViaFrei die U-Strecke — als Hinweis auf die Beschilderung, nicht als Routenempfehlung.", ask: "Gibt es eine ausgeschilderte Umleitung für die Sperrung auf der A8 bei Stuttgart?" },
      en: { title: "Signed detours in Baden-Württemberg", body: "When an Autobahn closure in Baden-Württemberg matches a published Bedarfsumleitung, ViaFrei names the U-route — as a note on the signage, not as a route recommendation.", ask: "Is there a signed detour for the closure on the A8 near Stuttgart?" },
      ru: { title: "Обозначенные объезды в Баден-Вюртемберге", body: "Если перекрытие автобана в Баден-Вюртемберге совпадает с опубликованным маршрутом объезда, ViaFrei называет этот маршрут — как указание на дорожные знаки, а не как рекомендацию маршрута.", ask: "Есть ли обозначенный объезд перекрытия на A8 у Штутгарта?" },
      bg: { title: "Обозначени обходи в Баден-Вюртемберг", body: "Когато затваряне на аутобан в Баден-Вюртемберг съвпада с публикуван обходен маршрут, ViaFrei назовава този маршрут — като указание за пътните знаци, а не като препоръка за маршрут.", ask: "Има ли обозначен обход за затварянето на A8 край Щутгарт?" },
      uk: { title: "Позначені об'їзди в Баден-Вюртемберзі", body: "Якщо перекриття автобану в Баден-Вюртемберзі збігається з опублікованим маршрутом об'їзду, ViaFrei називає цей маршрут — як вказівку на дорожні знаки, а не як рекомендацію маршруту.", ask: "Чи є позначений об'їзд перекриття на A8 біля Штутгарта?" },
      ro: { title: "Ocoliri semnalizate în Baden-Württemberg", body: "Când o închidere de autostradă din Baden-Württemberg se potrivește cu o ocolire publicată (Bedarfsumleitung), ViaFrei numește traseul U — ca indicație despre semnalizare, nu ca recomandare de traseu.", ask: "Există o ocolire semnalizată pentru închiderea de pe A8 lângă Stuttgart?" },
      tr: { title: "Baden-Württemberg'de tabelalı sapma yolları", body: "Baden-Württemberg'de bir otoyol kapanması yayımlanmış bir sapma yoluyla (Bedarfsumleitung) eşleştiğinde ViaFrei U-güzergâhını adıyla verir — rota önerisi olarak değil, tabelalara dair bir not olarak.", ask: "Stuttgart yakınındaki A8 kapanması için tabelalı bir sapma yolu var mı?" },
    },
  },
  {
    id: "hamburg-baustellen-kameras",
    kind: "new",
    date: "2026-10-11",
    release: "1.9.15",
    issue: 490,
    credits: ["hh_bauweiser", "hh_verkehrskameras"],
    tool: "check_road_status",
    text: {
      de: { title: "Baustellen und Verkehrskameras in Hamburg", body: "Für Hamburgs Stadtstraßen nennt ViaFrei jetzt die freigegebenen Baustellen aus dem Bauweiser, aktuell oder geplant, stündlich gelesen, und bis zu zwei Standorte von Verkehrskameras in der Nähe — nur die Standorte, nie ein Bild.", ask: "Welche Baustellen gibt es gerade in Hamburg-Eimsbüttel?" },
      en: { title: "Roadworks and traffic cameras in Hamburg", body: "For Hamburg's city streets, ViaFrei now lists the released roadworks from the Bauweiser, current or planned, read hourly, and up to two nearby traffic camera locations — locations only, never an image.", ask: "Which roadworks are there in Hamburg-Eimsbüttel right now?" },
      ru: { title: "Дорожные работы и камеры в Гамбурге", body: "Для городских улиц Гамбурга ViaFrei теперь называет опубликованные дорожные работы из Bauweiser, текущие или запланированные, с ежечасным обновлением, и до двух ближайших мест установки дорожных камер — только места, никогда не изображение.", ask: "Какие дорожные работы сейчас идут в Гамбурге-Эймсбюттеле?" },
      bg: { title: "Ремонти и пътни камери в Хамбург", body: "За градските улици на Хамбург ViaFrei вече посочва публикуваните ремонтни работи от Bauweiser, текущи или планирани, обновявани всеки час, и до две места на пътни камери наблизо — само местата, никога изображение.", ask: "Какви ремонтни работи има в момента в Хамбург-Аймсбютел?" },
      uk: { title: "Дорожні роботи та камери в Гамбурзі", body: "Для міських вулиць Гамбурга ViaFrei тепер називає оприлюднені дорожні роботи з Bauweiser, поточні або заплановані, з щогодинним оновленням, і до двох найближчих місць дорожніх камер — лише місця, ніколи не зображення.", ask: "Які дорожні роботи зараз тривають у Гамбурзі-Еймсбюттелі?" },
      ro: { title: "Lucrări și camere de trafic în Hamburg", body: "Pentru străzile din Hamburg, ViaFrei listează acum lucrările publicate din Bauweiser, curente sau planificate, citite din oră în oră, și până la două amplasamente de camere de trafic din apropiere — doar amplasamentele, niciodată o imagine.", ask: "Ce lucrări sunt acum în Hamburg-Eimsbüttel?" },
      tr: { title: "Hamburg'da yol çalışmaları ve trafik kameraları", body: "ViaFrei artık Hamburg'un şehir içi yolları için Bauweiser'deki yayımlanmış güncel veya planlı yol çalışmalarını saatlik olarak ve yakındaki en fazla iki trafik kamerasının konumunu veriyor — yalnızca konumlar, asla görüntü değil.", ask: "Hamburg-Eimsbüttel'de şu anda hangi yol çalışmaları var?" },
    },
  },
  {
    id: "bemas-baden-wuerttemberg",
    kind: "new",
    date: "2026-10-11",
    release: "1.9.15",
    issue: 488,
    credits: ["bemas_bw"],
    tool: "find_roadworks_ahead",
    text: {
      de: { title: "Baustellen auf Bundes- und Landesstraßen in Baden-Württemberg", body: "ViaFrei kennt jetzt die aktuellen und geplanten Baustellen auf den Bundes- und Landesstraßen in Baden-Württemberg, alle 15 Minuten aus MobiData BW gelesen. Was der Herausgeber nicht zur Veröffentlichung freigibt, zeigen wir nicht.", ask: "Welche Baustellen kommen auf der B27 zwischen Stuttgart und Tübingen?" },
      en: { title: "Roadworks on federal and state roads in Baden-Württemberg", body: "ViaFrei now knows current and planned roadworks on Baden-Württemberg's federal and state roads, read every 15 minutes from the state's open mobility data service. Sites the publisher does not release for publication are never shown.", ask: "Which roadworks are coming up on the B27 between Stuttgart and Tübingen?" },
      ru: { title: "Дорожные работы на федеральных и земельных дорогах Баден-Вюртемберга", body: "ViaFrei теперь знает текущие и запланированные дорожные работы на федеральных и земельных дорогах Баден-Вюртемберга, обновляемые каждые 15 минут из открытого сервиса данных земли. То, что издатель не разрешает публиковать, мы не показываем.", ask: "Какие дорожные работы будут на B27 между Штутгартом и Тюбингеном?" },
      bg: { title: "Ремонти по федералните и провинциалните пътища в Баден-Вюртемберг", body: "ViaFrei вече познава текущите и планираните ремонтни работи по федералните и провинциалните пътища на Баден-Вюртемберг, четени на всеки 15 минути от отворената услуга за данни на провинцията. Това, което издателят не разрешава за публикуване, не показваме.", ask: "Какви ремонтни работи предстоят на B27 между Щутгарт и Тюбинген?" },
      uk: { title: "Дорожні роботи на федеральних і земельних дорогах Баден-Вюртемберга", body: "ViaFrei тепер знає поточні та заплановані дорожні роботи на федеральних і земельних дорогах Баден-Вюртемберга, що оновлюються кожні 15 хвилин із відкритого сервісу даних землі. Те, що видавець не дозволяє публікувати, ми не показуємо.", ask: "Які дорожні роботи будуть на B27 між Штутгартом і Тюбінгеном?" },
      ro: { title: "Lucrări pe drumurile federale și regionale din Baden-Württemberg", body: "ViaFrei cunoaște acum lucrările curente și planificate de pe drumurile federale și regionale din Baden-Württemberg, citite la fiecare 15 minute din MobiData BW. Ce editorul nu aprobă pentru publicare nu afișăm.", ask: "Ce lucrări urmează pe B27 între Stuttgart și Tübingen?" },
      tr: { title: "Baden-Württemberg'in federal ve eyalet yollarında yol çalışmaları", body: "ViaFrei artık Baden-Württemberg'in federal ve eyalet yollarındaki güncel ve planlı yol çalışmalarını, MobiData BW'den 15 dakikada bir okuyarak biliyor. Yayıncının yayıma açmadığı çalışmaları göstermiyoruz.", ask: "Stuttgart ile Tübingen arasındaki B27'de hangi yol çalışmaları geliyor?" },
    },
  },
  {
    id: "dwd-strassenzustand",
    kind: "new",
    date: "2026-10-11",
    release: "1.9.15",
    issue: 456,
    credits: ["dwd_road"],
    tool: "check_weather_warnings",
    text: {
      de: { title: "Vorhersage des Straßenzustands vom DWD", body: "Zu den Wetterwarnungen nennt ViaFrei jetzt den vorhergesagten Straßenzustand und die Fahrbahntemperatur an den nächsten Straßenwetterstationen — als Modellvorhersage gekennzeichnet, nicht als Messung und nicht als amtliche Warnung.", ask: "Wie wird der Straßenzustand morgen früh bei Kassel?" },
      en: { title: "Road-surface forecast from the DWD", body: "With the weather warnings, ViaFrei now gives the forecast road condition and surface temperature at the nearest road-weather stations — labelled as a model forecast, not a measurement and not an official warning.", ask: "What will the road surface be like near Kassel tomorrow morning?" },
      ru: { title: "Прогноз состояния дорог от DWD", body: "Вместе с предупреждениями о погоде ViaFrei теперь называет прогноз состояния дороги и температуры покрытия на ближайших дорожных метеостанциях — с пометкой «модельный прогноз», не измерение и не официальное предупреждение.", ask: "Каким будет состояние дороги у Касселя завтра утром?" },
      bg: { title: "Прогноза за състоянието на пътя от DWD", body: "Към предупрежденията за времето ViaFrei вече дава прогнозното състояние на пътя и температурата на настилката при най-близките пътни метеостанции — обозначени като моделна прогноза, не измерване и не официално предупреждение.", ask: "Какво ще е състоянието на пътя край Касел утре сутринта?" },
      uk: { title: "Прогноз стану доріг від DWD", body: "Разом із попередженнями про погоду ViaFrei тепер називає прогноз стану дороги та температури покриття на найближчих дорожніх метеостанціях — з позначкою «модельний прогноз», не вимірювання і не офіційне попередження.", ask: "Яким буде стан дороги біля Касселя завтра вранці?" },
      ro: { title: "Prognoza stării drumului de la DWD", body: "Alături de avertizările meteo, ViaFrei oferă acum starea prognozată a drumului și temperatura carosabilului la cele mai apropiate stații meteo rutiere — marcate ca prognoză de model, nu ca măsurătoare și nu ca avertizare oficială.", ask: "Cum va fi starea drumului lângă Kassel mâine dimineață?" },
      tr: { title: "DWD'den yol yüzeyi tahmini", body: "ViaFrei artık hava uyarılarının yanında en yakın yol hava istasyonlarındaki tahmini yol durumunu ve yüzey sıcaklığını veriyor — ölçüm ya da resmî uyarı olarak değil, model tahmini olarak işaretli.", ask: "Yarın sabah Kassel yakınlarında yol yüzeyi nasıl olacak?" },
    },
  },
  // --- Plans: open issues the owner labelled `planned` (2026-10-12) ---
  {
    id: "rastanlagen-lkw-stellplaetze",
    kind: "plan",
    date: "2026-10-12",
    release: null,
    issue: 623,
    credits: [],
    tool: "find_parking",
    text: {
      de: { title: "Rastanlagen an Autobahnen mit Lkw-Stellplätzen", body: "Wir planen, die Daten des Bundesamts für Logistik und Mobilität zu den bewirtschafteten Rastanlagen an Bundesautobahnen aufzunehmen: Lage, Name und die geschätzte Zahl der Lkw-Stellplätze, für ganz Deutschland. Die Zahl ist eine Schätzung des Amts, keine Live-Belegung.", ask: "Welche Rastanlage an der A2 zwischen Hannover und Dortmund hat die meisten Lkw-Stellplätze?" },
      en: { title: "Motorway rest areas with lorry capacity", body: "We plan to add the Federal Office for Logistics and Mobility's data on the managed rest areas on Germany's motorways: location, name and the estimated number of lorry spaces, for all of Germany. That number is the office's estimate, not live occupancy.", ask: "Which rest area on the A2 between Hanover and Dortmund has the most lorry spaces?" },
      ru: { title: "Площадки отдыха на автобанах с местами для грузовиков", body: "Мы планируем добавить данные Федерального ведомства логистики и мобильности об обслуживаемых площадках отдыха на федеральных автобанах: расположение, название и оценочное число мест для грузовиков по всей Германии. Это число — оценка ведомства, а не текущая загрузка.", ask: "На какой площадке отдыха на A2 между Ганновером и Дортмундом больше всего мест для грузовиков?" },
      bg: { title: "Места за почивка по аутобаните с места за камиони", body: "Планираме да добавим данните на Федералната служба по логистика и мобилност за обслужваните места за почивка по федералните аутобани: местоположение, име и прогнозния брой места за камиони в цяла Германия. Този брой е оценка на службата, а не текуща заетост.", ask: "Кое място за почивка на A2 между Хановер и Дортмунд има най-много места за камиони?" },
      uk: { title: "Майданчики відпочинку на автобанах з місцями для вантажівок", body: "Ми плануємо додати дані Федерального відомства логістики та мобільності про обслуговувані майданчики відпочинку на федеральних автобанах: розташування, назву та оцінну кількість місць для вантажівок по всій Німеччині. Ця кількість — оцінка відомства, а не поточна заповненість.", ask: "На якому майданчику відпочинку на A2 між Ганновером і Дортмундом найбільше місць для вантажівок?" },
      ro: { title: "Zone de odihnă pe autostrăzi, cu locuri pentru camioane", body: "Plănuim să adăugăm datele Oficiului Federal pentru Logistică și Mobilitate despre zonele de odihnă cu servicii de pe autostrăzile federale: amplasare, nume și numărul estimat de locuri pentru camioane, în toată Germania. Numărul este o estimare a oficiului, nu ocuparea în timp real.", ask: "Care zonă de odihnă de pe A2 între Hanovra și Dortmund are cele mai multe locuri pentru camioane?" },
      tr: { title: "Otoyollarda kamyon kapasiteli dinlenme tesisleri", body: "Federal Lojistik ve Mobilite Dairesi'nin federal otoyollardaki işletilen dinlenme tesislerine ait verilerini eklemeyi planlıyoruz: tüm Almanya için konum, ad ve tahmini kamyon park yeri sayısı. Bu sayı dairenin tahminidir, anlık doluluk değildir.", ask: "A2'de Hannover ile Dortmund arasında en çok kamyon park yeri olan dinlenme tesisi hangisi?" },
    },
  },
  {
    id: "autobahn-umleitungsempfehlungen",
    kind: "plan",
    date: "2026-10-12",
    release: null,
    issue: 690,
    credits: [],
    tool: "check_road_status",
    text: {
      de: { title: "Empfohlene Umleitungen der Autobahn GmbH", body: "Wir planen, die Umleitungsempfehlungen der Autobahn GmbH des Bundes aufzunehmen: die Strecke, die die dynamischen Wegweiser bei Staus und Sperrungen empfehlen. Dann kann ViaFrei zu einer Sperrung die Umleitung nennen, die der Betreiber selbst empfiehlt.", ask: "Wie umfahre ich die Sperrung auf der A3?" },
      en: { title: "Recommended detours from the Autobahn operator", body: "We plan to add the detour recommendations of the federal motorway operator: the route the dynamic guide signs recommend during jams and closures. ViaFrei could then name, for a closure, the detour the operator itself recommends.", ask: "How do I get around the closure on the A3?" },
      ru: { title: "Рекомендованные объезды компании Autobahn GmbH", body: "Мы планируем добавить рекомендации по объездам федеральной компании Autobahn GmbH: маршрут, который динамические указатели рекомендуют при пробках и перекрытиях. Тогда ViaFrei сможет назвать для перекрытия объезд, который рекомендует сам оператор.", ask: "Как объехать перекрытие на A3?" },
      bg: { title: "Препоръчани обходи от Autobahn GmbH", body: "Планираме да добавим препоръките за обходи на федералната компания Autobahn GmbH: маршрута, който динамичните пътни указатели препоръчват при задръствания и затваряния. Тогава ViaFrei ще може да посочи за дадено затваряне обхода, който препоръчва самият оператор.", ask: "Как да заобиколя затварянето на A3?" },
      uk: { title: "Рекомендовані об'їзди компанії Autobahn GmbH", body: "Ми плануємо додати рекомендації щодо об'їздів федеральної компанії Autobahn GmbH: маршрут, який динамічні покажчики рекомендують під час заторів і перекриттів. Тоді ViaFrei зможе назвати для перекриття об'їзд, який рекомендує сам оператор.", ask: "Як об'їхати перекриття на A3?" },
      ro: { title: "Ocolirile recomandate de Autobahn GmbH", body: "Plănuim să adăugăm recomandările de ocolire ale companiei federale Autobahn GmbH: traseul pe care panourile dinamice de direcționare îl recomandă la ambuteiaje și închideri. Atunci ViaFrei va putea numi, pentru o închidere, ocolirea recomandată chiar de operator.", ask: "Cum ocolesc închiderea de pe A3?" },
      tr: { title: "Autobahn GmbH'nin önerdiği sapma yolları", body: "Federal otoyol şirketi Autobahn GmbH'nin sapma önerilerini eklemeyi planlıyoruz: dinamik yön levhalarının trafik sıkışıklığı ve kapanmalarda önerdiği güzergâh. ViaFrei o zaman bir kapanma için operatörün kendisinin önerdiği sapma yolunu söyleyebilecek.", ask: "A3'teki kapanmayı nasıl dolaşırım?" },
    },
  },
  {
    // 2.4.3 (#904): Autohof Thiersheim's own lorry-park table (Bosch Service Solutions, CC BY 4.0) on the A93, shown
    // once beside the national table's row of the same Autohof, both credited. No occupancy: its feed is frozen and held.
    // Owner's standing yes for news (2026-10-24). Dated the 2.4.3 deploy day, like the SID entry.
    id: "lkw-parken-thiersheim",
    kind: "new",
    date: "2026-10-27",
    release: "2.4.3",
    issue: 904,
    credits: ["mobilithek_park_thiersheim_static"],
    tool: "find_parking",
    text: {
      de: { title: "Autohof Thiersheim an der A93", body: "ViaFrei kennt jetzt die Lkw-Plätze des Autohofs Thiersheim an der A93 aus der eigenen Tabelle des Autohofs: 55 Lkw-Stellplätze, Adresse und Lage. Der Autohof steht einmal in der Antwort, auch wenn ihn die bundesweite Lkw-Parkplatz-Tabelle ebenfalls führt, und beide Quellen werden genannt. Eine Belegung zeigt ViaFrei hier nicht, weil der Herausgeber seit April keine neue gemeldet hat.", ask: "Wo kann ich mit dem Lkw an der A93 bei Thiersheim parken?" },
      en: { title: "Autohof Thiersheim on the A93", body: "ViaFrei now knows the lorry spaces of the Autohof Thiersheim on the A93 from the truck stop's own table: 55 lorry spaces, its address and its location. The truck stop is listed once in the answer even though the national lorry-parking table lists it too, and both sources are named. ViaFrei shows no occupancy here, because the publisher has reported none since April.", ask: "Where can I park a lorry on the A93 near Thiersheim?" },
      ru: { title: "Autohof Thiersheim на A93", body: "ViaFrei теперь знает места для грузовиков на Autohof Thiersheim на A93 по собственной таблице этой стоянки: 55 мест для грузовиков, адрес и расположение. Стоянка указана в ответе один раз, хотя её содержит и общегерманская таблица стоянок для грузовиков, и названы оба источника. Загруженность ViaFrei здесь не показывает: издатель не сообщал её с апреля.", ask: "Где можно поставить грузовик на A93 у Тирсхайма?" },
      bg: { title: "Autohof Thiersheim на A93", body: "ViaFrei вече познава местата за камиони на Autohof Thiersheim на A93 от собствената таблица на паркинга: 55 места за камиони, адрес и местоположение. Паркингът е посочен веднъж в отговора, въпреки че го води и общогерманската таблица на паркингите за камиони, и се назовават и двата източника. Заетост ViaFrei тук не показва, защото издателят не е съобщавал такава от април.", ask: "Къде мога да паркирам камион на A93 край Тирсхайм?" },
      uk: { title: "Autohof Thiersheim на A93", body: "ViaFrei тепер знає місця для вантажівок на Autohof Thiersheim на A93 із власної таблиці цієї стоянки: 55 місць для вантажівок, адреса й розташування. Стоянку зазначено у відповіді один раз, хоча її містить і загальнонімецька таблиця стоянок для вантажівок, і названо обидва джерела. Завантаженість ViaFrei тут не показує, бо видавець не повідомляв її з квітня.", ask: "Де можна поставити вантажівку на A93 біля Тірсгайма?" },
      ro: { title: "Autohof Thiersheim pe A93", body: "ViaFrei cunoaște acum locurile pentru camioane ale Autohof Thiersheim de pe A93 din tabelul propriu al parcării: 55 de locuri pentru camioane, adresa și poziția. Parcarea apare o singură dată în răspuns, deși o listează și tabelul național al parcărilor pentru camioane, iar ambele surse sunt numite. ViaFrei nu arată aici gradul de ocupare, pentru că editorul nu a mai raportat unul din aprilie.", ask: "Unde pot parca un camion pe A93 lângă Thiersheim?" },
      tr: { title: "A93 üzerindeki Autohof Thiersheim", body: "ViaFrei artık A93 üzerindeki Autohof Thiersheim'ın tır park yerlerini tesisin kendi tablosundan biliyor: 55 tır park yeri, adresi ve konumu. Tesis, ulusal tır park tablosu da onu listelese bile yanıtta bir kez yer alıyor ve iki kaynağın adı da veriliyor. Yayıncı nisandan beri doluluk bildirmediği için ViaFrei burada doluluk göstermiyor.", ask: "A93'te Thiersheim yakınında tırımı nereye park edebilirim?" },
    },
  },
  {
    // 2.4.3 (#707): the Toll Collect SID — figures only after the person accepts the terms, section 2 (the site's
    // button, the assistant's elicitation). Owner's standing yes for news (2026-10-24). Dated the 2.4.3 deploy day,
    // like TERMS_EFFECTIVE.
    id: "lkw-stellplatzbelegung",
    kind: "new",
    date: "2026-10-27",
    release: "2.4.3",
    issue: 707,
    credits: ["toll_collect_sid"],
    tool: "find_parking",
    text: {
      de: { title: "Lkw-Stellplatzbelegung an der Autobahn", body: "ViaFrei zeigt jetzt die Belegung der Lkw-Parkplätze an den Autobahnen aus dem Stellplatz-Informationsdienst (SID) der Toll Collect GmbH. Die Zahlen erscheinen erst, wenn Sie den Nutzungsbedingungen, Abschnitt 2, zustimmen: auf viafrei.de mit „Belegung anzeigen“, in Ihrem KI-Assistenten mit der Frage, die er Ihnen stellt. Die Angaben können ungenau oder veraltet sein.", ask: "Wo sind an der A9 bei Nürnberg gerade Lkw-Parkplätze frei?" },
      en: { title: "Truck-parking occupancy on the motorways", body: "ViaFrei now shows how full the lorry parks on the motorways are, from Toll Collect GmbH's Stellplatz-Informationsdienst (SID). The figures appear only once you accept the terms of use, section 2: on viafrei.de with \"Show occupancy\", in your AI assistant through the question it asks you. The figures may be inaccurate or out of date.", ask: "Where are lorry parks free on the A9 near Nuremberg right now?" },
      ru: { title: "Загруженность стоянок для грузовиков на автобанах", body: "ViaFrei теперь показывает загруженность стоянок для грузовиков на автобанах по данным Stellplatz-Informationsdienst (SID) компании Toll Collect GmbH. Цифры появляются только после того, как вы примете условия использования, раздел 2: на viafrei.de кнопкой «Показать загруженность», в вашем ИИ-ассистенте — в ответ на его вопрос. Данные могут быть неточными или устаревшими.", ask: "Где сейчас есть свободные места для грузовиков на A9 у Нюрнберга?" },
      bg: { title: "Заетост на паркингите за камиони по магистралите", body: "ViaFrei вече показва заетостта на паркингите за камиони по магистралите от Stellplatz-Informationsdienst (SID) на Toll Collect GmbH. Цифрите се появяват едва след като приемете условията за ползване, раздел 2: на viafrei.de с „Покажи заетостта“, във вашия ИИ асистент — чрез въпроса, който той ви задава. Данните може да са неточни или остарели.", ask: "Къде има свободни места за камиони по A9 край Нюрнберг в момента?" },
      uk: { title: "Завантаженість стоянок для вантажівок на автобанах", body: "ViaFrei тепер показує завантаженість стоянок для вантажівок на автобанах за даними Stellplatz-Informationsdienst (SID) компанії Toll Collect GmbH. Цифри з'являються лише після того, як ви приймете умови використання, розділ 2: на viafrei.de кнопкою «Показати завантаженість», у вашому ШІ-асистенті — через запитання, яке він вам поставить. Дані можуть бути неточними або застарілими.", ask: "Де зараз є вільні місця для вантажівок на A9 біля Нюрнберга?" },
      ro: { title: "Gradul de ocupare al parcărilor pentru camioane pe autostrăzi", body: "ViaFrei arată acum cât de ocupate sunt parcările pentru camioane de pe autostrăzi, din Stellplatz-Informationsdienst (SID) al Toll Collect GmbH. Cifrele apar doar după ce acceptați condițiile de utilizare, secțiunea 2: pe viafrei.de cu „Afișează gradul de ocupare”, în asistentul dumneavoastră de IA prin întrebarea pe care v-o pune. Datele pot fi inexacte sau depășite.", ask: "Unde sunt acum locuri libere pentru camioane pe A9 lângă Nürnberg?" },
      tr: { title: "Otoyollarda tır park yeri doluluğu", body: "ViaFrei artık otoyollardaki tır park yerlerinin doluluğunu Toll Collect GmbH'nin Stellplatz-Informationsdienst (SID) hizmetinden gösteriyor. Rakamlar yalnızca kullanım koşullarının 2. bölümünü kabul ettiğinizde görünür: viafrei.de'de \"Doluluğu göster\" ile, yapay zekâ asistanınızda size sorduğu soruyla. Veriler hatalı veya güncel olmayabilir.", ask: "Nürnberg yakınında A9'da şu anda boş tır park yeri nerede?" },
    },
  },
  {
    // 2.4.5 (#903): VBN Connect's realtime on the departure boards (get_departures, the place card, the station
    // board), third after DELFI's SIRI ET and Trip Updates; both Connect lines credited where they carried a row.
    // Owner's standing yes for news (2026-10-24).
    id: "echtzeit-vbn-connect",
    kind: "new",
    date: "2026-10-28",
    release: "2.4.5",
    issue: 903,
    credits: ["mobilithek_connect_gtfs", "mobilithek_connect_gtfs_rt"],
    tool: "get_departures",
    text: {
      de: { title: "Echtzeit für Bus und Bahn im VBN", body: "ViaFrei liest jetzt die Echtzeitdaten des Verkehrsverbunds Bremen/Niedersachsen (VBN, Datensatz Connect). An Haltestellen in Bremen und im VBN-Gebiet zeigen die Abfahrten eine Verspätung aus diesen Daten, wo kein anderer Echtzeit-Feed die Fahrt meldet. Jede Abfahrt erscheint einmal, und jede Quelle, die sie trägt, wird genannt.", ask: "Wann fährt der nächste Bus ab Bremen Hauptbahnhof?" },
      en: { title: "Live times for buses and trains in the VBN area", body: "ViaFrei now reads the real-time data of the Verkehrsverbund Bremen/Niedersachsen (VBN, the Connect dataset). At stops in Bremen and across the VBN area, departures show a delay from this data where no other real-time feed reports the trip. Each departure appears once, and every source that carries it is named.", ask: "When does the next bus leave from Bremen's main station?" },
      ru: { title: "Данные в реальном времени для автобусов и поездов в зоне VBN", body: "ViaFrei теперь читает данные в реальном времени транспортного объединения Бремен/Нижняя Саксония (VBN, набор данных Connect). На остановках в Бремене и по всей зоне VBN отправления показывают задержку по этим данным, если ни один другой источник реального времени не сообщает о рейсе. Каждое отправление показывается один раз, и называется каждый источник, который его передаёт.", ask: "Когда отправляется следующий автобус от главного вокзала Бремена?" },
      bg: { title: "Данни в реално време за автобуси и влакове в района на VBN", body: "ViaFrei вече чете данните в реално време на транспортното обединение Бремен/Долна Саксония (VBN, набор от данни Connect). На спирките в Бремен и в целия район на VBN заминаванията показват закъснение от тези данни, когато никой друг източник в реално време не съобщава за курса. Всяко заминаване се показва веднъж и се посочва всеки източник, който го носи.", ask: "Кога тръгва следващият автобус от централната гара на Бремен?" },
      uk: { title: "Дані в реальному часі для автобусів і поїздів у зоні VBN", body: "ViaFrei тепер читає дані в реальному часі транспортного об'єднання Бремен/Нижня Саксонія (VBN, набір даних Connect). На зупинках у Бремені та в усій зоні VBN відправлення показують затримку з цих даних, якщо жодне інше джерело реального часу не повідомляє про рейс. Кожне відправлення з'являється один раз, і називається кожне джерело, яке його передає.", ask: "Коли вирушає наступний автобус від головного вокзалу Бремена?" },
      ro: { title: "Date în timp real pentru autobuze și trenuri în zona VBN", body: "ViaFrei citește acum datele în timp real ale asociației de transport Bremen/Saxonia Inferioară (VBN, setul de date Connect). La stațiile din Bremen și din întreaga zonă VBN, plecările arată o întârziere din aceste date acolo unde niciun alt flux în timp real nu raportează cursa. Fiecare plecare apare o singură dată și este numită fiecare sursă care o transmite.", ask: "Când pleacă următorul autobuz din gara centrală Bremen?" },
      tr: { title: "VBN bölgesinde otobüs ve trenler için gerçek zamanlı bilgi", body: "ViaFrei artık Bremen/Aşağı Saksonya ulaşım birliğinin (VBN, Connect veri seti) gerçek zamanlı verilerini okuyor. Bremen'deki ve VBN bölgesinin tamamındaki duraklarda, başka hiçbir gerçek zamanlı kaynak seferi bildirmediğinde kalkışlar bu verilerden bir gecikme gösterir. Her kalkış bir kez görünür ve onu taşıyan her kaynak belirtilir.", ask: "Bremen Merkez Garı'ndan bir sonraki otobüs ne zaman kalkıyor?" },
    },
  },
  {
    // 2.4.7 (#1099): the maps draw OpenStreetMap's streets of their frame (ODbL 1.0, credited and keyed where drawn).
    // Owner's standing yes for news (2026-10-24).
    id: "strassen-auf-den-karten",
    kind: "new",
    date: "2026-10-28",
    release: "2.4.7",
    issue: 1099,
    credits: ["osm_streets", "bast_lcl"],
    tool: "check_autobahn_traffic",
    text: {
      de: { title: "Straßen auf den Karten", body: "Die Karten der Autobahnseiten und der Ortsseiten zeichnen jetzt die Straßen ihres Ausschnitts aus OpenStreetMap: Bundes-, Landes- und Kreisstraßen und Wohnstraßen, von uns gezeichnet, ohne Kartendienst eines Dritten; die Autobahnen selbst zeichnen wir aus der Location Code List der BASt. So lässt sich eine Meldung auf der Karte einer Straße zuordnen.", ask: "Wie ist die Lage auf der A7 bei Kassel?" },
      en: { title: "Streets on the maps", body: "The maps of the motorway pages and the place pages now draw the streets of their frame from OpenStreetMap: federal, state and district roads and residential streets, drawn by us, with no third-party map service; the motorways themselves are drawn from BASt's Location Code List. A report on the map can now be matched to its street.", ask: "What is the situation on the A7 near Kassel?" },
      ru: { title: "Улицы на картах", body: "Карты страниц автомагистралей и страниц мест теперь показывают улицы своего фрагмента из OpenStreetMap: федеральные, земельные и районные дороги и жилые улицы, нарисованные нами, без картографического сервиса третьей стороны; сами автомагистрали мы рисуем по списку кодов местоположений BASt. Так сообщение на карте можно соотнести с улицей.", ask: "Какая обстановка на A7 у Касселя?" },
      bg: { title: "Улици на картите", body: "Картите на страниците за магистрали и за места вече показват улиците в своя обхват от OpenStreetMap: федерални, провинциални и окръжни пътища и жилищни улици, начертани от нас, без картографска услуга на трета страна; самите магистрали чертаем по списъка с кодове на местоположения на BASt. Така съобщение на картата може да се свърже с улицата си.", ask: "Каква е обстановката на A7 край Касел?" },
      uk: { title: "Вулиці на картах", body: "Карти сторінок автомагістралей і сторінок місць тепер показують вулиці свого фрагмента з OpenStreetMap: федеральні, земельні й районні дороги та житлові вулиці, намальовані нами, без картографічного сервісу третьої сторони; самі автомагістралі ми малюємо за списком кодів місцеположень BASt. Так повідомлення на карті можна пов'язати з вулицею.", ask: "Яка ситуація на A7 біля Касселя?" },
      ro: { title: "Străzi pe hărți", body: "Hărțile paginilor de autostradă și ale paginilor de localitate desenează acum străzile din cadrul lor din OpenStreetMap: drumuri federale, regionale și județene și străzi rezidențiale, desenate de noi, fără serviciul de hărți al unui terț; autostrăzile însele le desenăm după lista de coduri de locație a BASt. Astfel, un mesaj de pe hartă poate fi legat de strada sa.", ask: "Care este situația pe A7 lângă Kassel?" },
      tr: { title: "Haritalarda sokaklar", body: "Otoyol sayfalarının ve yer sayfalarının haritaları artık kendi çerçevelerindeki sokakları OpenStreetMap'ten çiziyor: federal, eyalet ve ilçe yolları ve konut sokakları, üçüncü taraf bir harita hizmeti olmadan bizim tarafımızdan çizilir; otoyolların kendisini BASt'ın konum kodu listesinden çiziyoruz. Böylece haritadaki bir bildirim sokağıyla eşleştirilebilir.", ask: "Kassel yakınında A7'de durum nasıl?" },
    },
  },
  {
    // 2.5.2 (#1121): VIZ.NRW's single messages (Einzelmeldungen), enabled as the second failover twin of the NRW traffic
    // messages. Owner's standing yes for news (2026-10-24); live with 2.5.2.
    id: "einzelmeldungen-viz-nrw",
    kind: "new",
    date: "2026-11-01",
    release: "2.5.2",
    issue: 1121,
    credits: ["mobilithek_traffic_nrw_einzel"],
    tool: "check_road_status",
    text: {
      de: { title: "Einzelmeldungen von VIZ.NRW als weitere Rückfallebene", body: "ViaFrei liest jetzt auch die Einzelmeldungen der Verkehrsinformationen NRW von VIZ.NRW. Sie sichern die Verkehrsmeldungen in Nordrhein-Westfalen ein weiteres Mal ab: Fällt eine Quelle aus, antwortet ViaFrei aus einer anderen. Jede Meldung erscheint nur einmal, und jede Quelle, die sie trägt, wird genannt.", ask: "Gibt es gerade Verkehrsmeldungen auf der A1 bei Köln?" },
      en: { title: "VIZ.NRW's single traffic messages as a further fallback", body: "ViaFrei now also reads the single messages of the North Rhine-Westphalia traffic information from VIZ.NRW. They back up the traffic messages in North Rhine-Westphalia once more: if one source fails, ViaFrei answers from another. Each message is shown once, and every source that carries it is named.", ask: "Are there any traffic messages on the A1 near Cologne right now?" },
      ru: { title: "Отдельные сообщения VIZ.NRW как ещё один резерв", body: "ViaFrei теперь читает и отдельные сообщения дорожной информации Северного Рейна-Вестфалии от VIZ.NRW. Они ещё раз резервируют дорожные сообщения в Северном Рейне-Вестфалии: если один источник отказывает, ViaFrei отвечает по другому. Каждое сообщение показывается один раз, и называется каждый источник, который его передаёт.", ask: "Есть ли сейчас дорожные сообщения на A1 у Кёльна?" },
      bg: { title: "Отделните съобщения на VIZ.NRW като още един резерв", body: "ViaFrei вече чете и отделните съобщения на пътната информация на Северен Рейн-Вестфалия от VIZ.NRW. Те още веднъж подсигуряват пътните съобщения в Северен Рейн-Вестфалия: ако един източник откаже, ViaFrei отговаря от друг. Всяко съобщение се показва веднъж и се посочва всеки източник, който го носи.", ask: "Има ли в момента пътни съобщения на A1 край Кьолн?" },
      uk: { title: "Окремі повідомлення VIZ.NRW як ще один резерв", body: "ViaFrei тепер читає й окремі повідомлення дорожньої інформації Північного Рейну-Вестфалії від VIZ.NRW. Вони ще раз резервують дорожні повідомлення в Північному Рейні-Вестфалії: якщо одне джерело відмовляє, ViaFrei відповідає з іншого. Кожне повідомлення показується один раз, і називається кожне джерело, що його передає.", ask: "Чи є зараз дорожні повідомлення на A1 біля Кельна?" },
      ro: { title: "Mesajele individuale ale VIZ.NRW ca încă o rezervă", body: "ViaFrei citește acum și mesajele individuale ale informațiilor de trafic din Renania de Nord-Westfalia de la VIZ.NRW. Ele asigură încă o dată mesajele de trafic din Renania de Nord-Westfalia: dacă o sursă cade, ViaFrei răspunde din alta. Fiecare mesaj apare o singură dată și este numită fiecare sursă care îl transmite.", ask: "Sunt acum mesaje de trafic pe A1 lângă Köln?" },
      tr: { title: "VIZ.NRW'nin tekil mesajları ek bir yedek olarak", body: "ViaFrei artık VIZ.NRW'nin Kuzey Ren-Vestfalya trafik bilgilerindeki tekil mesajları da okuyor. Bunlar Kuzey Ren-Vestfalya'daki trafik mesajlarını bir kez daha güvenceye alır: bir kaynak devre dışı kalırsa ViaFrei başka bir kaynaktan yanıt verir. Her mesaj bir kez gösterilir ve onu taşıyan her kaynak belirtilir.", ask: "Köln yakınında A1'de şu anda trafik mesajı var mı?" },
    },
  },
];

/**
 * The approved entries with every text they have: the seven languages written
 * inline above, and the fifteen of #753 (2.3.12) from `news/i18n/<lang>.json`,
 * one file per language keyed by entry id (`newsTextsFor`). `news.test.ts`
 * holds every live language to every approved entry, so a language cannot
 * ship a News page with entries missing, and an id in a language file that no
 * entry has is red too.
 */
export const NEWS_ENTRIES: readonly NewsEntry[] = NEWS_INLINE.map((e) => ({ ...e, text: { ...e.text, ...newsTextsFor(e.id) } }));

/**
 * Drafted entries the owner has not approved yet (pr-reviewer 2026-10-19: a `new` entry goes live on the
 * News page and in the Atom feeds, so an unapproved draft may not sit in NEWS_ENTRIES). A draft is NEVER
 * rendered; it only tells the credit gate that the integration has been written up, so the gate still
 * flags one that ships with no text at all. On the owner's word an entry moves into NEWS_ENTRIES.
 */
export const NEWS_DRAFTS: readonly NewsEntry[] = [
  {
    // 2.6 (#1016): HELD at the 2.6.14 cut (review). The reader, the loader and the table ship in 2.6.14, but
    // `osm_speed_cameras` is filled only after the deploy (`the deploy --install-speed-cameras all` over exports re-made
    // with 2.6.14's filter), and a NewsEntry has no liveness gate — published ≠ live. This draft moves into
    // NEWS_ENTRIES, with the release that is current then and its 15 catalogue translations (the speed lane's
    // 87de3af9e carries them), once production holds the cameras. The text holds the read rule: planning only, the
    // notice on every answer, OpenStreetMap named as the source.
    id: "blitzer-aus-openstreetmap",
    kind: "new",
    date: "2026-11-12",
    release: "2.6.14",
    issue: 1016,
    credits: ["osm_speed_cameras"],
    tool: "find_speed_cameras",
    text: {
      de: { title: "Feste Blitzer aus OpenStreetMap", body: "ViaFrei nennt jetzt auch die festen Blitzer, die in OpenStreetMap eingetragen sind, und zwar in den Gemeinden Deutschlands, die keine eigene Liste fester Anlagen veröffentlichen. Sie stehen als eigener Block mit OpenStreetMap als Quelle; wo eine Stadt ihre festen Anlagen selbst veröffentlicht, nennt ViaFrei nur die Liste der Stadt. Die Angaben sind nur für die Planung vor der Fahrt oder während eines Halts bestimmt. Zu welcher Gemeinde ein Standort gehört, bestimmt ViaFrei nach dem nächstgelegenen Gemeindepunkt des amtlichen Ortsverzeichnisses – eine Näherung an die Gemeindegrenze.", ask: "Wo stehen an meiner Strecke durch Hamburg feste Blitzer?" },
      en: { title: "Fixed speed cameras from OpenStreetMap", body: "ViaFrei now also names the fixed speed cameras mapped in OpenStreetMap, in the German municipalities that publish no list of fixed cameras of their own. They are listed as a block of their own, with OpenStreetMap named as their source; where a town publishes its own fixed cameras, ViaFrei names the town's list alone. The locations are meant only for planning before the trip or during a stop. Which municipality a location belongs to is decided by the nearest municipality point of the official gazetteer — an approximation of the municipal boundary.", ask: "Where are the fixed speed cameras on my route through Hamburg?" },
      ru: { title: "Стационарные камеры скорости из OpenStreetMap", body: "ViaFrei теперь называет и стационарные камеры контроля скорости, отмеченные в OpenStreetMap, в тех общинах Германии, которые не публикуют собственный список стационарных камер. Они приводятся отдельным блоком с указанием OpenStreetMap как источника; где город сам публикует свои стационарные камеры, ViaFrei называет только список города. Данные предназначены только для планирования до поездки или во время остановки. К какой общине относится место, ViaFrei определяет по ближайшей точке общины в официальном справочнике населённых пунктов — это приближение к границе общины.", ask: "Где стоят стационарные камеры на моём маршруте через Гамбург?" },
      bg: { title: "Стационарни камери за скорост от OpenStreetMap", body: "ViaFrei вече посочва и стационарните камери за скорост, отбелязани в OpenStreetMap, в общините в Германия, които не публикуват собствен списък на стационарните камери. Те са изброени в отделен блок с OpenStreetMap като източник; където градът сам публикува стационарните си камери, ViaFrei посочва само списъка на града. Данните са само за планиране преди пътуването или по време на спиране. Към коя община принадлежи дадено място, ViaFrei определя по най-близката точка на община в официалния справочник на населените места – приближение към границата на общината.", ask: "Къде има стационарни камери за скорост по маршрута ми през Хамбург?" },
      uk: { title: "Стаціонарні камери швидкості з OpenStreetMap", body: "ViaFrei тепер називає й стаціонарні камери контролю швидкості, позначені в OpenStreetMap, у тих громадах Німеччини, які не публікують власного списку стаціонарних камер. Вони наведені окремим блоком з OpenStreetMap як джерелом; де місто саме публікує свої стаціонарні камери, ViaFrei називає лише список міста. Дані призначені лише для планування до поїздки або під час зупинки. До якої громади належить місце, ViaFrei визначає за найближчою точкою громади в офіційному довіднику населених пунктів — це наближення до межі громади.", ask: "Де стоять стаціонарні камери на моєму маршруті через Гамбург?" },
      ro: { title: "Radare fixe din OpenStreetMap", body: "ViaFrei numește acum și radarele fixe cartografiate în OpenStreetMap, în comunele din Germania care nu publică o listă proprie de radare fixe. Ele sunt enumerate ca bloc separat, cu OpenStreetMap ca sursă; acolo unde un oraș își publică singur radarele fixe, ViaFrei numește doar lista orașului. Datele sunt doar pentru planificare înainte de drum sau în timpul unei opriri. Comuna căreia îi aparține un loc este stabilită după cel mai apropiat punct de comună din registrul oficial al localităților – o aproximare a limitei comunei.", ask: "Unde sunt radarele fixe pe traseul meu prin Hamburg?" },
      tr: { title: "OpenStreetMap'ten sabit hız kameraları", body: "ViaFrei artık OpenStreetMap'te işaretlenmiş sabit hız kameralarını, kendi sabit kamera listesini yayımlamayan Alman belediyelerinde de gösteriyor. Bunlar kaynak olarak OpenStreetMap belirtilerek ayrı bir blok halinde listelenir; bir şehir sabit kameralarını kendisi yayımlıyorsa ViaFrei yalnızca şehrin listesini gösterir. Bilgiler yalnızca yolculuktan önce veya bir mola sırasında planlama içindir. Bir noktanın hangi belediyeye ait olduğunu ViaFrei, resmî yer adları dizinindeki en yakın belediye noktasına göre belirler; bu, belediye sınırına bir yaklaşımdır.", ask: "Hamburg üzerinden geçen güzergâhımda sabit hız kameraları nerede?" },
    },
  },
  {
    // 2.5.8 (#1074): DRAFTED by the pages-1074 lane 2026-11-03 — the owner approves or rewords it before the cut, and
    // it moves into NEWS_ENTRIES then. The text holds the read rules: the counts are the Autobahn GmbH's reports on the
    // motorways in the Land (data-steward), the area is the Destatis figure, and the fuel card is a link, no price.
    id: "bundeslaender-seiten",
    kind: "new",
    date: "2026-11-03",
    release: "2.5.8",
    issue: 1074,
    credits: ["destatis_gv_laender"],
    tool: "check_autobahn_traffic",
    text: {
      de: { title: "Eine Seite für jedes Bundesland", body: "Jedes der 16 Bundesländer hat jetzt eine eigene Seite: wie viele Vollsperrungen, Staus und Baustellen die Autobahn GmbH auf den Autobahnen im Land gerade meldet, die längsten Staus, dazu Fläche, Hauptstadt, Nachbarländer und die größten Städte, jede mit ihrer Seite. Assistenten bekommen dieselbe Übersicht, wenn sie nach den Autobahnen eines Bundeslands fragen.", ask: "Wie ist die Lage auf den Autobahnen in Bayern?" },
      en: { title: "A page for every German state", body: "Each of the 16 German states now has a page of its own: how many closures, jams and roadworks the Autobahn GmbH reports on the motorways in the state right now, the longest jams, and the area, capital, neighbouring states and largest towns, each with its page. Assistants get the same overview when they ask about one state's motorways.", ask: "What is the situation on the motorways in Bavaria?" },
      ru: { title: "Страница для каждой федеральной земли", body: "У каждой из 16 федеральных земель теперь есть своя страница: сколько перекрытий, пробок и дорожных работ Autobahn GmbH сообщает сейчас на автобанах земли, самые длинные пробки, а также площадь, столица, соседние земли и крупнейшие города, у каждого своя страница. Ассистенты получают тот же обзор, когда спрашивают об автобанах одной земли.", ask: "Какая обстановка на автобанах Баварии?" },
      bg: { title: "Страница за всяка федерална провинция", body: "Всяка от 16-те федерални провинции вече има своя страница: колко затваряния, задръствания и ремонти Autobahn GmbH съобщава в момента по магистралите в провинцията, най-дългите задръствания, както и площ, столица, съседни провинции и най-големите градове, всеки със своя страница. Асистентите получават същия преглед, когато питат за магистралите на една провинция.", ask: "Каква е обстановката по магистралите в Бавария?" },
      uk: { title: "Сторінка для кожної федеральної землі", body: "Кожна з 16 федеральних земель тепер має власну сторінку: скільки перекриттів, заторів і дорожніх робіт Autobahn GmbH повідомляє зараз на автобанах землі, найдовші затори, а також площа, столиця, сусідні землі та найбільші міста, кожне зі своєю сторінкою. Асистенти отримують той самий огляд, коли питають про автобани однієї землі.", ask: "Яка ситуація на автобанах Баварії?" },
      ro: { title: "O pagină pentru fiecare land", body: "Fiecare dintre cele 16 landuri are acum propria pagină: câte închideri, ambuteiaje și lucrări raportează acum Autobahn GmbH pe autostrăzile din land, cele mai lungi ambuteiaje, precum și suprafața, capitala, landurile vecine și cele mai mari orașe, fiecare cu pagina sa. Asistenții primesc aceeași imagine de ansamblu când întreabă despre autostrăzile unui land.", ask: "Care este situația pe autostrăzile din Bavaria?" },
      tr: { title: "Her eyalet için bir sayfa", body: "Almanya'nın 16 eyaletinin her birinin artık kendi sayfası var: Autobahn GmbH'nin eyaletteki otobanlarda şu anda bildirdiği kapanış, trafik sıkışıklığı ve yol çalışması sayısı, en uzun sıkışıklıklar ve ayrıca yüzölçümü, başkent, komşu eyaletler ve her biri kendi sayfasıyla en büyük şehirler. Asistanlar bir eyaletin otobanlarını sorduğunda aynı özeti alır.", ask: "Bavyera'daki otobanlarda durum nasıl?" },
    },
  },
  {
    // 2.3.23 (#690): HELD, not unapproved. The reader and the worker ship in 2.3.23, but the Autobahn GmbH's
    // `routing_bab` feed is empty: production holds 0 strategy rows, so nothing of it can be shown yet (published ≠
    // live). The plan entry `autobahn-umleitungsempfehlungen` stays on the News page until then. This draft moves into
    // NEWS_ENTRIES, with the release that is current then, once production holds a switched strategy. The text holds
    // the read rule: the operator's recommendation, never a route of ours, only while switched.
    id: "strategisches-routing-autobahn",
    kind: "new",
    date: "2026-10-25",
    release: "2.3.23",
    issue: 690,
    credits: ["mobilithek_routing_bab"],
    tool: "check_autobahn_traffic",
    text: {
      de: { title: "Umleitungsempfehlungen der Autobahn GmbH", body: "Schaltet die Autobahn GmbH bei einem Stau oder einer Sperrung eine strategische Umleitung, nennt ViaFrei sie jetzt: auf der Seite der Autobahn unter den Umleitungen und in den Antworten zur Verkehrslage, immer als Empfehlung der Autobahn GmbH und nur, solange sie geschaltet ist.", ask: "Empfiehlt die Autobahn GmbH gerade eine Umleitung auf der A3?" },
      en: { title: "Detour recommendations from the Autobahn operator", body: "When the Autobahn GmbH switches a strategic detour for a jam or a closure, ViaFrei now names it: on the motorway's page under the detours and in the traffic answers, always as the operator's recommendation and only while it is switched.", ask: "Is the Autobahn operator recommending a detour on the A3 right now?" },
      ru: { title: "Рекомендации объезда от Autobahn GmbH", body: "Когда Autobahn GmbH включает стратегический объезд из-за пробки или перекрытия, ViaFrei теперь называет его: на странице автобана в разделе объездов и в ответах о дорожной обстановке, всегда как рекомендацию Autobahn GmbH и только пока он включён.", ask: "Рекомендует ли Autobahn GmbH сейчас объезд на A3?" },
      bg: { title: "Препоръки за обход от Autobahn GmbH", body: "Когато Autobahn GmbH включи стратегически обход заради задръстване или затваряне, ViaFrei вече го посочва: на страницата на магистралата при обходите и в отговорите за движението, винаги като препоръка на Autobahn GmbH и само докато е включен.", ask: "Препоръчва ли Autobahn GmbH в момента обход на A3?" },
      uk: { title: "Рекомендації об’їзду від Autobahn GmbH", body: "Коли Autobahn GmbH вмикає стратегічний об’їзд через затор або перекриття, ViaFrei тепер називає його: на сторінці автобану в розділі об’їздів і у відповідях про дорожню ситуацію, завжди як рекомендацію Autobahn GmbH і лише поки його ввімкнено.", ask: "Чи рекомендує Autobahn GmbH зараз об’їзд на A3?" },
      ro: { title: "Recomandări de ocolire de la Autobahn GmbH", body: "Când Autobahn GmbH activează o ocolire strategică pentru un ambuteiaj sau o închidere, ViaFrei o numește acum: pe pagina autostrăzii, la ocoliri, și în răspunsurile despre trafic, mereu ca recomandare a Autobahn GmbH și doar cât timp este activă.", ask: "Recomandă Autobahn GmbH acum o ocolire pe A3?" },
      tr: { title: "Autobahn GmbH'den sapma önerileri", body: "Autobahn GmbH bir trafik sıkışıklığı veya kapanma için stratejik bir sapma devreye aldığında ViaFrei artık bunu belirtir: otoyolun sayfasında sapmalar bölümünde ve trafik yanıtlarında, her zaman Autobahn GmbH'nin önerisi olarak ve yalnızca devrede olduğu sürece.", ask: "Autobahn GmbH şu anda A3'te bir sapma öneriyor mu?" },
    },
  },
  {
    // 2.4.4 (#1033, #1037): HELD, like `strategisches-routing-autobahn`. Bayern's strategic routes and the
    // Niedersachsen traffic strategies ship in 2.4.4; this draft moves into NEWS_ENTRIES, with the release that is
    // current then, once production holds a switched strategy of either (published ≠ live). The text holds the read
    // rule: the operator's recommendation, never a route of ours, only while it is switched; Bayern names no "until".
    // RB3 (#1033, 2.4.4 review S2): a strategy is called what its publisher calls it — Bayern's Messe guidance and
    // Niedersachsen's venue strategies are traffic guidance (strategic routing), never "detours", as the tools say them.
    id: "verkehrslenkung-bayern-niedersachsen",
    kind: "new",
    date: "2026-10-27",
    release: "2.4.4",
    issue: 1033,
    credits: ["mobilithek_routing_bayern", "mobilithek_routing_dvl_ni"],
    tool: "check_autobahn_traffic",
    text: {
      de: { title: "Verkehrslenkung in Bayern und Niedersachsen", body: "Schaltet die Autobahn GmbH in Bayern oder die Verkehrszentrale in Niedersachsen eine Verkehrslenkung (strategisches Routing), etwa zu den Parkplätzen einer Messe oder eines Stadions, nennt ViaFrei sie jetzt: in Bayern auf der Seite der Autobahn, in Niedersachsen beim Ort, und in den Antworten zur Verkehrslage – so, wie der Herausgeber sie nennt, in seinen Worten, nie als Route von ViaFrei und nur, solange sie geschaltet ist.", ask: "Lenkt die Autobahn GmbH gerade den Verkehr auf der A9 in Bayern?" },
      en: { title: "Traffic guidance in Bavaria and Lower Saxony", body: "When the Autobahn GmbH in Bavaria or the traffic centre in Lower Saxony switches traffic guidance (strategic routing), to the car parks of a trade fair or a stadium for instance, ViaFrei now names it: in Bavaria on the motorway's page, in Lower Saxony at the place, and in the traffic answers – as the publisher calls it, in its own words, never as a route of ViaFrei's and only while it is switched.", ask: "Is the Autobahn GmbH guiding traffic on the A9 in Bavaria right now?" },
      ru: { title: "Управление движением в Баварии и Нижней Саксонии", body: "Когда Autobahn GmbH в Баварии или центр управления движением в Нижней Саксонии включает управление движением (стратегическую маршрутизацию), например к парковкам выставки или стадиона, ViaFrei теперь называет его: в Баварии на странице автобана, в Нижней Саксонии у населённого пункта и в ответах о дорожной обстановке – так, как его называет издатель, его словами, никогда как маршрут ViaFrei и только пока оно включено.", ask: "Управляет ли Autobahn GmbH сейчас движением на A9 в Баварии?" },
      bg: { title: "Управление на движението в Бавария и Долна Саксония", body: "Когато Autobahn GmbH в Бавария или центърът за управление на движението в Долна Саксония включи управление на движението (стратегическо маршрутизиране), например към паркингите на панаир или стадион, ViaFrei вече го посочва: в Бавария на страницата на магистралата, в Долна Саксония при населеното място и в отговорите за движението – така, както го нарича издателят, с неговите думи, никога като маршрут на ViaFrei и само докато е включено.", ask: "Управлява ли Autobahn GmbH в момента движението на A9 в Бавария?" },
      uk: { title: "Керування рухом у Баварії та Нижній Саксонії", body: "Коли Autobahn GmbH у Баварії або центр керування рухом у Нижній Саксонії вмикає керування рухом (стратегічну маршрутизацію), наприклад до паркінгів виставки чи стадіону, ViaFrei тепер називає його: у Баварії на сторінці автобану, у Нижній Саксонії біля населеного пункту і у відповідях про дорожню ситуацію – так, як його називає видавець, його словами, ніколи як маршрут ViaFrei і лише поки його ввімкнено.", ask: "Чи керує Autobahn GmbH зараз рухом на A9 у Баварії?" },
      ro: { title: "Dirijarea traficului în Bavaria și Saxonia Inferioară", body: "Când Autobahn GmbH în Bavaria sau centrul de trafic din Saxonia Inferioară activează o dirijare a traficului (rutare strategică), de exemplu spre parcările unui târg sau ale unui stadion, ViaFrei o numește acum: în Bavaria pe pagina autostrăzii, în Saxonia Inferioară la localitate și în răspunsurile despre trafic – așa cum o numește editorul, cu cuvintele lui, niciodată ca rută a ViaFrei și doar cât timp este activă.", ask: "Dirijează Autobahn GmbH acum traficul pe A9 în Bavaria?" },
      tr: { title: "Bavyera ve Aşağı Saksonya'da trafik yönlendirmesi", body: "Bavyera'da Autobahn GmbH veya Aşağı Saksonya'daki trafik merkezi bir trafik yönlendirmesini (stratejik yönlendirme), örneğin bir fuarın veya stadyumun otoparklarına, devreye aldığında ViaFrei artık bunu belirtir: Bavyera'da otoyolun sayfasında, Aşağı Saksonya'da yerin yanında ve trafik yanıtlarında – yayıncının verdiği adla, onun sözleriyle, asla ViaFrei'nin bir rotası olarak değil ve yalnızca devrede olduğu sürece.", ask: "Autobahn GmbH şu anda Bavyera'da A9'da trafiği yönlendiriyor mu?" },
    },
  },
  {
    // 2.2.10 (#610): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: the hours the city
    // states, never "no deliveries" where it states none.
    id: "fussgaengerzonen-aachen",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 610,
    credits: ["aachen_fussgaengerzonen"],
    tool: "check_road_status",
    text: {
      de: { title: "Zufahrten zu Aachens Fußgängerzonen", body: "ViaFrei kennt jetzt die 80 Zufahrten zu den Fußgängerzonen, die die Stadt Aachen veröffentlicht, mit dem Verkehrszeichen dort und, wo die Stadt sie nennt, den Lieferzeiten. Wer nach den Straßen um einen Ort fragt, erfährt die nächsten Zufahrten, zum Beispiel „Lieferverkehr werktags 06:00–12:00 und 18:30–21:00“. Nennt die Stadt keine Zeiten, sagt ViaFrei auch keine.", ask: "Wann darf ich am Aachener Markt in die Fußgängerzone liefern?" },
      en: { title: "Entrances to Aachen's pedestrian zones", body: "ViaFrei now knows the 80 entrances to the pedestrian zones the City of Aachen publishes, with the sign there and, where the city states them, the delivery hours. Ask about the roads around a place and you hear the nearest entrances, for example \"deliveries Mon–Sat 06:00–12:00 and 18:30–21:00\". Where the city states no hours, ViaFrei states none either.", ask: "When may I make deliveries into the pedestrian zone at Aachen's Markt?" },
      ru: { title: "Въезды в пешеходные зоны Ахена", body: "ViaFrei теперь знает 80 въездов в пешеходные зоны, которые публикует город Ахен, с дорожным знаком и — где город их называет — временем доставки. Если спросить о дорогах вокруг какого-либо места, вы узнаете ближайшие въезды, например «доставка пн–сб 06:00–12:00 и 18:30–21:00». Если город время не называет, ViaFrei его тоже не называет.", ask: "Когда можно доставлять грузы в пешеходную зону у рыночной площади Ахена?" },
      bg: { title: "Входове към пешеходните зони в Аахен", body: "ViaFrei вече познава 80-те входа към пешеходните зони, които публикува град Аахен, със знака там и — където градът ги посочва — часовете за доставки. Попитате ли за пътищата около дадено място, ще научите най-близките входове, например „доставки пн–сб 06:00–12:00 и 18:30–21:00“. Ако градът не посочва часове, ViaFrei също не посочва.", ask: "Кога мога да доставям в пешеходната зона на пазарния площад в Аахен?" },
      uk: { title: "Вʼїзди до пішохідних зон Ахена", body: "ViaFrei тепер знає 80 вʼїздів до пішохідних зон, які публікує місто Ахен, із дорожнім знаком і — де місто їх називає — часом доставки. Якщо запитати про дороги навколо якогось місця, ви дізнаєтеся найближчі вʼїзди, наприклад «доставка пн–сб 06:00–12:00 і 18:30–21:00». Якщо місто часу не називає, ViaFrei теж його не називає.", ask: "Коли можна доставляти вантажі до пішохідної зони біля ринкової площі Ахена?" },
      ro: { title: "Intrările în zonele pietonale din Aachen", body: "ViaFrei cunoaște acum cele 80 de intrări în zonele pietonale pe care le publică orașul Aachen, cu indicatorul de acolo și, unde orașul le menționează, orele de livrare. Întrebați despre drumurile din jurul unui loc și aflați intrările cele mai apropiate, de exemplu „livrări lun.–sâm. 06:00–12:00 și 18:30–21:00”. Unde orașul nu menționează ore, nici ViaFrei nu menționează.", ask: "Când pot face livrări în zona pietonală din Piața Markt din Aachen?" },
      tr: { title: "Aachen'in yaya bölgelerine girişler", body: "ViaFrei artık Aachen şehrinin yayımladığı 80 yaya bölgesi girişini, oradaki trafik levhasıyla ve şehrin belirttiği yerlerde teslimat saatleriyle biliyor. Bir yerin çevresindeki yolları sorduğunuzda en yakın girişleri öğrenirsiniz, örneğin \"teslimat Pzt–Cmt 06:00–12:00 ve 18:30–21:00\". Şehir saat belirtmiyorsa ViaFrei de belirtmiyor.", ask: "Aachen'deki Markt'ta yaya bölgesine ne zaman teslimat yapabilirim?" },
    },
  },
  {
    // 2.2.12 (#573): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: a past month's median
    // for this hour of this kind of day, the month named, never a present count, a jam or free flow.
    id: "verkehrsdetektion-berlin",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.12",
    issue: 573,
    credits: ["berlin_verkehrsdetektion"],
    tool: "check_road_status",
    text: {
      de: { title: "Üblicher Verkehr an Berlins Zählstellen", body: "ViaFrei liest jetzt das Archiv der Verkehrsdetektion Berlin: die stündlichen Zählungen von über 160 Messstellen an Berliner Hauptstraßen, die das Land monatsweise veröffentlicht. Wer nach den Straßen um einen Ort in Berlin fragt, erfährt, wie viele Fahrzeuge dort zu dieser Stunde an einem Werktag, Samstag oder Sonn- und Feiertag üblicherweise gezählt wurden, und wann die Spitzenstunde ist – mit dem Messmonat. Das Archiv ist Monate alt, deshalb sagen wir nie, wie es gerade aussieht.", ask: "Wie viel Verkehr ist an einem Werktag um 8 Uhr üblicherweise in der Grunerstraße in Berlin?" },
      en: { title: "Usual traffic at Berlin's counting sites", body: "ViaFrei now reads the Verkehrsdetektion Berlin archive: the hourly counts of more than 160 measuring points on Berlin's main roads, which the State publishes month by month. Ask about the roads around a place in Berlin and you hear how many vehicles were usually counted there at this hour on a working day, a Saturday or a Sunday or holiday, and when the busiest hour is – with the month it was measured in. The archive is months old, so we never say what the street looks like right now.", ask: "How much traffic is there usually on Grunerstraße in Berlin at 8 am on a working day?" },
      ru: { title: "Обычный трафик на счётных пунктах Берлина", body: "ViaFrei теперь читает архив Verkehrsdetektion Berlin: почасовые подсчёты более чем 160 точек измерения на главных улицах Берлина, которые земля публикует помесячно. Если спросить о дорогах вокруг какого-либо места в Берлине, вы узнаете, сколько машин там обычно насчитывали в этот час в рабочий день, субботу или воскресенье и праздник, и когда час пик — с месяцем измерения. Архиву несколько месяцев, поэтому мы никогда не говорим, что происходит на улице сейчас.", ask: "Какой трафик обычно на Грунерштрассе в Берлине в 8 утра в рабочий день?" },
      bg: { title: "Обичаен трафик в точките за преброяване в Берлин", body: "ViaFrei вече чете архива Verkehrsdetektion Berlin: почасовите преброявания на над 160 точки на измерване по главните улици на Берлин, които провинцията публикува месец по месец. Попитате ли за пътищата около дадено място в Берлин, ще научите колко превозни средства обикновено са преброени там в този час в работен ден, събота или неделя и празник, и кога е пиковият час — с месеца на измерване. Архивът е на няколко месеца, затова никога не казваме как изглежда улицата в момента.", ask: "Какъв е обичайният трафик на Грунерщрасе в Берлин в 8 ч. в работен ден?" },
      uk: { title: "Звичайний трафік на пунктах підрахунку Берліна", body: "ViaFrei тепер читає архів Verkehrsdetektion Berlin: погодинні підрахунки понад 160 точок вимірювання на головних вулицях Берліна, які земля публікує щомісяця. Якщо запитати про дороги навколо якогось місця в Берліні, ви дізнаєтеся, скільки транспорту там зазвичай нараховували цієї години в робочий день, суботу чи неділю й свято, і коли година пік — з місяцем вимірювання. Архіву кілька місяців, тому ми ніколи не кажемо, що відбувається на вулиці зараз.", ask: "Який зазвичай трафік на Грунерштрасе в Берліні о 8 ранку в робочий день?" },
      ro: { title: "Traficul obișnuit la punctele de numărare din Berlin", body: "ViaFrei citește acum arhiva Verkehrsdetektion Berlin: numărările orare de la peste 160 de puncte de măsurare de pe arterele principale ale Berlinului, pe care landul le publică lună de lună. Întrebați despre drumurile din jurul unui loc din Berlin și aflați câte vehicule au fost numărate de obicei acolo la această oră într-o zi lucrătoare, sâmbătă sau duminică și sărbătoare, și când este ora de vârf — cu luna măsurării. Arhiva are câteva luni, de aceea nu spunem niciodată cum arată strada acum.", ask: "Cât trafic este de obicei pe Grunerstraße din Berlin la ora 8 într-o zi lucrătoare?" },
      tr: { title: "Berlin'in sayım noktalarında olağan trafik", body: "ViaFrei artık Verkehrsdetektion Berlin arşivini okuyor: eyaletin ay ay yayımladığı, Berlin'in ana caddelerindeki 160'tan fazla ölçüm noktasının saatlik sayımları. Berlin'de bir yerin çevresindeki yolları sorduğunuzda, orada bu saatte bir iş gününde, cumartesi ya da pazar ve tatil günlerinde genellikle kaç aracın sayıldığını ve en yoğun saatin ne zaman olduğunu ölçüm ayıyla birlikte öğrenirsiniz. Arşiv birkaç aylık olduğu için sokağın şu anki durumunu asla söylemeyiz.", ask: "Berlin'deki Grunerstraße'de bir iş günü saat 8'de genellikle ne kadar trafik olur?" },
    },
  },
  {
    // 2.2.12 (#573): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: the city's count of
    // P+R spaces is said, occupancy is not (the dataset's rush-hour survey band is no reading).
    id: "park-and-ride-berlin",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.12",
    issue: 573,
    credits: ["berlin_park_ride"],
    tool: "find_parking",
    text: {
      de: { title: "Park-and-Ride in Berlin und im Umland", body: "ViaFrei kennt jetzt die Park-and-Ride-Anlagen, die das Land Berlin veröffentlicht: 49 Anlagen in der Stadt und 59 im Umland, die der VBB erfasst hat, jeweils mit der Zahl der P+R-Stellplätze und, wo angegeben, Behindertenparkplätzen und zeitlichen Einschränkungen wie einem Wochenmarkt. Wie viele Plätze gerade frei sind, veröffentlicht niemand, und ViaFrei sagt das, statt es zu raten.", ask: "Gibt es am U-Bahnhof Rudow in Berlin einen P+R-Parkplatz?" },
      en: { title: "Park and ride in and around Berlin", body: "ViaFrei now knows the park-and-ride sites the State of Berlin publishes: 49 in the city and 59 around it recorded by the VBB, each with its number of P+R spaces and, where given, disabled spaces and time restrictions such as a weekly market. Nobody publishes how many spaces are free right now, and ViaFrei says so instead of guessing.", ask: "Is there a park-and-ride car park at Rudow U-Bahn station in Berlin?" },
      ru: { title: "Перехватывающие парковки в Берлине и пригородах", body: "ViaFrei теперь знает перехватывающие парковки (P+R), которые публикует земля Берлин: 49 в городе и 59 в пригородах по данным VBB, каждая с числом мест P+R, а где указано — мест для инвалидов и временных ограничений, например из-за рынка. Сколько мест свободно сейчас, никто не публикует, и ViaFrei так и говорит, а не гадает.", ask: "Есть ли парковка P+R у станции метро Рудов в Берлине?" },
      bg: { title: "Паркирай и пътувай в Берлин и околностите", body: "ViaFrei вече познава паркингите „Паркирай и пътувай“ (P+R), които публикува провинция Берлин: 49 в града и 59 в околностите, отчетени от VBB, всеки с броя места P+R и, където е посочено, места за хора с увреждания и времеви ограничения като пазарен ден. Колко места са свободни в момента, никой не публикува, и ViaFrei го казва, вместо да гадае.", ask: "Има ли паркинг P+R до метростанция Рудов в Берлин?" },
      uk: { title: "Перехоплювальні парковки в Берліні та передмісті", body: "ViaFrei тепер знає перехоплювальні парковки (P+R), які публікує земля Берлін: 49 у місті та 59 у передмісті за даними VBB, кожна з кількістю місць P+R і, де вказано, місць для людей з інвалідністю та часових обмежень, наприклад через ринок. Скільки місць вільно зараз, ніхто не публікує, і ViaFrei так і каже, а не вгадує.", ask: "Чи є парковка P+R біля станції метро Рудов у Берліні?" },
      ro: { title: "Park and ride în Berlin și împrejurimi", body: "ViaFrei cunoaște acum parcările park-and-ride pe care le publică landul Berlin: 49 în oraș și 59 în împrejurimi, înregistrate de VBB, fiecare cu numărul de locuri P+R și, unde este indicat, locuri pentru persoane cu dizabilități și restricții de timp, cum ar fi o zi de piață. Câte locuri sunt libere acum nu publică nimeni, iar ViaFrei spune asta în loc să ghicească.", ask: "Există o parcare P+R la stația de metrou Rudow din Berlin?" },
      tr: { title: "Berlin'de ve çevresinde park et-devam et", body: "ViaFrei artık Berlin eyaletinin yayımladığı park et-devam et (P+R) alanlarını biliyor: şehirde 49, çevrede VBB'nin kaydettiği 59 alan; her biri P+R park yeri sayısıyla ve belirtildiği yerde engelli park yerleri ve pazar günü gibi zaman kısıtlamalarıyla. Şu anda kaç yerin boş olduğunu kimse yayımlamıyor; ViaFrei tahmin etmek yerine bunu söylüyor.", ask: "Berlin'de Rudow metro istasyonunda P+R otoparkı var mı?" },
    },
  },
  {
    // 2.2.12 (#574): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the two register rows comes first. The text holds the read rule: a bay is named with
    // its signed rule, a sensor is said to be fitted, and no bay is ever called free (the city publishes no reading).
    id: "lieferzonen-muenchen",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.12",
    issue: 574,
    credits: ["muenchen_lieferzonen", "muenchen_3l_zonen"],
    tool: "check_road_status",
    text: {
      de: { title: "Lade- und Lieferzonen in München", body: "ViaFrei kennt jetzt die Lade- und Lieferzonen, die die Landeshauptstadt München für Lieferdienste und Handwerksbetriebe ausweist, mit der Regel, die dort gilt. Wer nach den Straßen um einen Ort in München fragt, erfährt die nächsten Zonen, zum Beispiel „Laden, Liefern und Leisten (auch Handwerk); Regel laut Herausgeber: Eingeschränktes Halteverbot 0-24 Uhr“. Bei Zonen mit Belegungssensor sagen wir das dazu – den Messwert veröffentlicht die Stadt nicht, deshalb nennen wir nie eine Zone frei. Vor Ort gilt die Beschilderung.", ask: "Gibt es eine Lieferzone in der Nähe des Viktualienmarkts in München?" },
      en: { title: "Loading and delivery bays in Munich", body: "ViaFrei now knows the loading and delivery bays the City of Munich marks out for delivery services and trades, with the rule that applies there. Ask about the roads around a place in Munich and you hear the nearest bays, for example \"loading, deliveries and trades' vehicles; the publisher's rule (German): Eingeschränktes Halteverbot 0-24 Uhr\". Where a bay has an occupancy sensor we say so – the city does not publish its reading, so we never call a bay free. The signs on site apply.", ask: "Is there a loading bay near the Viktualienmarkt in Munich?" },
      ru: { title: "Зоны погрузки и доставки в Мюнхене", body: "ViaFrei теперь знает зоны погрузки и доставки, которые город Мюнхен выделяет для служб доставки и ремесленников, вместе с правилом, действующим там. Если спросить о дорогах вокруг какого-либо места в Мюнхене, вы узнаете ближайшие зоны и их правила. Если в зоне есть датчик занятости, мы об этом сообщаем — показания город не публикует, поэтому мы никогда не называем зону свободной. На месте действуют знаки.", ask: "Есть ли зона погрузки рядом с Виктуалиенмаркт в Мюнхене?" },
      bg: { title: "Зони за товарене и доставка в Мюнхен", body: "ViaFrei вече познава зоните за товарене и доставка, които град Мюнхен отрежда за куриерски служби и занаятчии, заедно с правилото, което важи там. Попитате ли за пътищата около дадено място в Мюнхен, ще научите най-близките зони и техните правила. Когато зоната има сензор за заетост, казваме го — градът не публикува показанията му, затова никога не наричаме зона свободна. На място важат знаците.", ask: "Има ли зона за доставка близо до Виктуалиенмаркт в Мюнхен?" },
      uk: { title: "Зони завантаження та доставки в Мюнхені", body: "ViaFrei тепер знає зони завантаження та доставки, які місто Мюнхен виділяє для служб доставки та ремісників, разом із правилом, що там діє. Якщо запитати про дороги навколо якогось місця в Мюнхені, ви дізнаєтеся найближчі зони та їхні правила. Якщо зона має датчик зайнятості, ми про це кажемо — місто не публікує його показання, тому ми ніколи не називаємо зону вільною. На місці діють знаки.", ask: "Чи є зона доставки поблизу Віктуалієнмаркт у Мюнхені?" },
      ro: { title: "Zone de încărcare și livrare în München", body: "ViaFrei cunoaște acum zonele de încărcare și livrare pe care orașul München le rezervă serviciilor de livrare și meseriașilor, împreună cu regula care se aplică acolo. Întrebați despre drumurile din jurul unui loc din München și aflați zonele cele mai apropiate și regulile lor. Acolo unde o zonă are senzor de ocupare o spunem — orașul nu publică valorile, de aceea nu numim niciodată o zonă liberă. La fața locului se aplică indicatoarele.", ask: "Există o zonă de livrare lângă Viktualienmarkt din München?" },
      tr: { title: "Münih'te yükleme ve teslimat alanları", body: "ViaFrei artık Münih Belediyesi'nin teslimat hizmetleri ve zanaatkârlar için ayırdığı yükleme ve teslimat alanlarını, orada geçerli kuralla birlikte biliyor. Münih'te bir yerin çevresindeki yolları sorduğunuzda en yakın alanları ve kurallarını öğrenirsiniz. Bir alanda doluluk sensörü varsa bunu belirtiriz — şehir ölçümü yayımlamadığı için hiçbir alanı boş diye nitelemeyiz. Yerindeki tabelalar geçerlidir.", ask: "Münih'te Viktualienmarkt yakınında bir teslimat alanı var mı?" },
    },
  },
  {
    // 2.2.10 (#605): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: a detour is offered
    // only while its works run, and it is the authority's signed route, never one ViaFrei computes.
    id: "umleitungsstrecken-schleswig-holstein",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 605,
    credits: ["sh_umleitungsstrecken"],
    tool: "check_road_status",
    text: {
      de: { title: "Umleitungsstrecken in Schleswig-Holstein", body: "ViaFrei kennt jetzt die Umleitungsstrecken, die der Landesbetrieb Straßenbau und Verkehr Schleswig-Holstein um seine Baustellen ausschildert: für wen sie gelten, wie viel länger sie sind und bis wann. Wer nach den Straßen um einen Ort fragt, erfährt die nächsten Umleitungen, zum Beispiel „für Pkw und Lkw; 2,1 km länger; etwa 5 min mehr; bis 31. Oktober 2026“. Ist die Baustelle vorbei, nennt ViaFrei die Umleitung nicht mehr.", ask: "Gibt es in Oldenburg in Holstein gerade eine Umleitung?" },
      en: { title: "Detour routes in Schleswig-Holstein", body: "ViaFrei now knows the detour routes Schleswig-Holstein's road authority signs around its road works: who they are for, how much longer they are and until when. Ask about the roads around a place and you hear the nearest detours, for example \"for cars and lorries; 2.1 km longer; about 5 min more; until 31 October 2026\". Once the works are over, ViaFrei no longer names the detour.", ask: "Is there a detour in Oldenburg in Holstein right now?" },
      ru: { title: "Объездные маршруты в Шлезвиг-Гольштейне", body: "ViaFrei теперь знает объездные маршруты, которые дорожное ведомство земли Шлезвиг-Гольштейн обозначает вокруг своих дорожных работ: для кого они, насколько они длиннее и до какого числа действуют. Если спросить о дорогах вокруг какого-либо места, вы узнаете ближайшие объезды, например «для легковых и грузовых автомобилей; длиннее на 2,1 км; примерно на 5 мин дольше; до 31.10.2026». Когда работы закончены, ViaFrei объезд больше не называет.", ask: "Есть ли сейчас объезд в Ольденбурге-ин-Гольштейне?" },
      bg: { title: "Обходни маршрути в Шлезвиг-Холщайн", body: "ViaFrei вече познава обходните маршрути, които пътната служба на провинция Шлезвиг-Холщайн обозначава около своите ремонти: за кого са, колко по-дълги са и до кога важат. Попитате ли за пътищата около дадено място, ще научите най-близките обходи, например „за леки и товарни автомобили; по-дълъг с 2,1 км; около 5 мин повече; до 31.10.2026 г.“. Когато ремонтът приключи, ViaFrei вече не посочва обхода.", ask: "Има ли в момента обход в Олденбург в Холщайн?" },
      uk: { title: "Обʼїзні маршрути в Шлезвіг-Гольштейні", body: "ViaFrei тепер знає обʼїзні маршрути, які дорожня служба землі Шлезвіг-Гольштейн позначає навколо своїх дорожніх робіт: для кого вони, наскільки вони довші та до якої дати діють. Якщо запитати про дороги навколо якогось місця, ви дізнаєтеся найближчі обʼїзди, наприклад «для легкових і вантажних автомобілів; довший на 2,1 км; приблизно на 5 хв довше; до 31.10.2026». Коли роботи завершено, ViaFrei обʼїзд більше не називає.", ask: "Чи є зараз обʼїзд в Ольденбурзі-ін-Гольштейні?" },
      ro: { title: "Rute ocolitoare în Schleswig-Holstein", body: "ViaFrei cunoaște acum rutele ocolitoare pe care autoritatea rutieră a landului Schleswig-Holstein le semnalizează în jurul lucrărilor sale: pentru cine sunt, cu cât sunt mai lungi și până când sunt valabile. Întrebați despre drumurile din jurul unui loc și aflați ocolirile cele mai apropiate, de exemplu „pentru autoturisme și camioane; cu 2,1 km mai lungă; cu aproximativ 5 min mai mult; până la 31.10.2026”. Când lucrările s-au încheiat, ViaFrei nu mai numește ruta ocolitoare.", ask: "Există acum o rută ocolitoare în Oldenburg in Holstein?" },
      tr: { title: "Schleswig-Holstein'da alternatif güzergâhlar", body: "ViaFrei artık Schleswig-Holstein eyaletinin yol idaresinin yol çalışmalarının çevresinde işaretlediği alternatif güzergâhları biliyor: kimin için oldukları, ne kadar uzun oldukları ve ne zamana kadar geçerli oldukları. Bir yerin çevresindeki yolları sorduğunuzda en yakın alternatif güzergâhları öğrenirsiniz, örneğin \"otomobil ve kamyonlar için; 2,1 km daha uzun; yaklaşık 5 dk daha fazla; 31.10.2026 tarihine kadar\". Çalışmalar bittiğinde ViaFrei alternatif güzergâhı artık söylemiyor.", ask: "Oldenburg in Holstein'da şu anda bir alternatif güzergâh var mı?" },
    },
  },
  {
    // 2.2.10 (#575): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. Same read rule as Bochum's entry.
    id: "umweltzone-essen",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 575,
    credits: ["essen_umweltzone"],
    tool: "get_driving_rules",
    text: {
      de: { title: "Umweltzone Essen aus der Grenze der Stadt", body: "Ob ein Ort in Essen in der Umweltzone liegt, beantwortet ViaFrei jetzt aus der Grenze, die die Stadt Essen selbst veröffentlicht. Die gleiche Zone im Verzeichnis des Umweltbundesamts wird einmal genannt und beide Quellen werden angegeben; ist die Datei der Stadt veraltet, antwortet das Verzeichnis allein. Ausnahmen erteilt die Stadt, ViaFrei sagt dazu nichts.", ask: "Liegt der Essener Hauptbahnhof in der Umweltzone?" },
      en: { title: "Essen's low-emission zone from the city's own boundary", body: "Whether a place in Essen lies inside the low-emission zone is now answered from the boundary the City of Essen publishes itself. The same zone in the Umweltbundesamt's register is named once and both sources are credited; if the city's file is out of date, the register answers alone. Exemptions are the city's to grant, and ViaFrei says nothing about them.", ask: "Is Essen Hauptbahnhof inside the low-emission zone?" },
      ru: { title: "Экологическая зона Эссена по границе самого города", body: "Находится ли место в Эссене в экологической зоне, ViaFrei теперь отвечает по границе, которую публикует сам город Эссен. Та же зона в реестре Федерального ведомства по охране окружающей среды называется один раз, и указываются оба источника; если файл города устарел, отвечает один реестр. Исключения выдаёт город, ViaFrei о них ничего не говорит.", ask: "Находится ли главный вокзал Эссена в экологической зоне?" },
      bg: { title: "Екологичната зона на Есен по границата на самия град", body: "Дали място в Есен е в екологичната зона, ViaFrei вече отговаря по границата, която публикува самият град Есен. Същата зона в регистъра на Федералната служба по околна среда се назовава веднъж и се посочват и двата източника; ако файлът на града е остарял, отговаря само регистърът. Изключенията се дават от града и ViaFrei не казва нищо за тях.", ask: "В екологичната зона ли е централната гара на Есен?" },
      uk: { title: "Екологічна зона Ессена за межею самого міста", body: "Чи розташоване місце в Ессені в екологічній зоні, ViaFrei тепер відповідає за межею, яку публікує саме місто Ессен. Та сама зона в реєстрі Федерального відомства з охорони довкілля називається один раз, і зазначаються обидва джерела; якщо файл міста застарів, відповідає лише реєстр. Винятки надає місто, ViaFrei про них нічого не каже.", ask: "Чи розташований головний вокзал Ессена в екологічній зоні?" },
      ro: { title: "Zona cu emisii reduse din Essen, după limita publicată de oraș", body: "Dacă un loc din Essen se află în zona cu emisii reduse, ViaFrei răspunde acum după limita pe care o publică chiar orașul Essen. Aceeași zonă din registrul Agenției Federale de Mediu este numită o singură dată și ambele surse sunt menționate; dacă fișierul orașului este învechit, răspunde doar registrul. Excepțiile le acordă orașul, iar ViaFrei nu spune nimic despre ele.", ask: "Gara centrală din Essen se află în zona cu emisii reduse?" },
      tr: { title: "Essen'in düşük emisyon bölgesi, şehrin kendi sınırından", body: "Essen'deki bir yerin düşük emisyon bölgesinde olup olmadığını ViaFrei artık Essen şehrinin kendi yayımladığı sınırdan yanıtlıyor. Federal Çevre Ajansı'nın kaydındaki aynı bölge bir kez anılıyor ve iki kaynak da belirtiliyor; şehrin dosyası eskiyse yalnızca kayıt yanıtlıyor. İstisnaları şehir verir; ViaFrei bunlar hakkında bir şey söylemiyor.", ask: "Essen Merkez Garı düşük emisyon bölgesinde mi?" },
    },
  },
  {
    // 2.2.10 (#575): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: the city's boundary
    // decides, the national register's same zone is shown once, and no exception is claimed.
    id: "umweltzone-bochum",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 575,
    credits: ["bochum_umweltzone"],
    tool: "get_driving_rules",
    text: {
      de: { title: "Umweltzone Bochum aus der Grenze der Stadt", body: "Ob ein Ort in Bochum in der Umweltzone liegt, beantwortet ViaFrei jetzt aus der Grenze, die die Stadt Bochum selbst veröffentlicht. Die gleiche Zone im Verzeichnis des Umweltbundesamts wird einmal genannt und beide Quellen werden angegeben; ist die Datei der Stadt veraltet, antwortet das Verzeichnis allein. Ausnahmen erteilt die Stadt, ViaFrei sagt dazu nichts.", ask: "Liegt das Bochumer Rathaus in der Umweltzone?" },
      en: { title: "Bochum's low-emission zone from the city's own boundary", body: "Whether a place in Bochum lies inside the low-emission zone is now answered from the boundary the City of Bochum publishes itself. The same zone in the Umweltbundesamt's register is named once and both sources are credited; if the city's file is out of date, the register answers alone. Exemptions are the city's to grant, and ViaFrei says nothing about them.", ask: "Is Bochum's town hall inside the low-emission zone?" },
      ru: { title: "Экологическая зона Бохума по границе самого города", body: "Находится ли место в Бохуме в экологической зоне, ViaFrei теперь отвечает по границе, которую публикует сам город Бохум. Та же зона в реестре Федерального ведомства по охране окружающей среды называется один раз, и указываются оба источника; если файл города устарел, отвечает один реестр. Исключения выдаёт город, ViaFrei о них ничего не говорит.", ask: "Находится ли ратуша Бохума в экологической зоне?" },
      bg: { title: "Екологичната зона на Бохум по границата на самия град", body: "Дали място в Бохум е в екологичната зона, ViaFrei вече отговаря по границата, която публикува самият град Бохум. Същата зона в регистъра на Федералната служба по околна среда се назовава веднъж и се посочват и двата източника; ако файлът на града е остарял, отговаря само регистърът. Изключенията се дават от града и ViaFrei не казва нищо за тях.", ask: "В екологичната зона ли е кметството на Бохум?" },
      uk: { title: "Екологічна зона Бохума за межею самого міста", body: "Чи розташоване місце в Бохумі в екологічній зоні, ViaFrei тепер відповідає за межею, яку публікує саме місто Бохум. Та сама зона в реєстрі Федерального відомства з охорони довкілля називається один раз, і зазначаються обидва джерела; якщо файл міста застарів, відповідає лише реєстр. Винятки надає місто, ViaFrei про них нічого не каже.", ask: "Чи розташована ратуша Бохума в екологічній зоні?" },
      ro: { title: "Zona cu emisii reduse din Bochum, după limita publicată de oraș", body: "Dacă un loc din Bochum se află în zona cu emisii reduse, ViaFrei răspunde acum după limita pe care o publică chiar orașul Bochum. Aceeași zonă din registrul Agenției Federale de Mediu este numită o singură dată și ambele surse sunt menționate; dacă fișierul orașului este învechit, răspunde doar registrul. Excepțiile le acordă orașul, iar ViaFrei nu spune nimic despre ele.", ask: "Primăria din Bochum se află în zona cu emisii reduse?" },
      tr: { title: "Bochum'un düşük emisyon bölgesi, şehrin kendi sınırından", body: "Bochum'daki bir yerin düşük emisyon bölgesinde olup olmadığını ViaFrei artık Bochum şehrinin kendi yayımladığı sınırdan yanıtlıyor. Federal Çevre Ajansı'nın kaydındaki aynı bölge bir kez anılıyor ve iki kaynak da belirtiliyor; şehrin dosyası eskiyse yalnızca kayıt yanıtlıyor. İstisnaları şehir verir; ViaFrei bunlar hakkında bir şey söylemiyor.", ask: "Bochum belediye binası düşük emisyon bölgesinde mi?" },
    },
  },
  {
    // 2.2.10 (#576): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: the Land's own list,
    // the nearest within 25 km, the road and both names as published, a ferry said; no queue, no opening hours.
    id: "grenzuebergaenge-brandenburg",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 576,
    credits: ["bb_grenzuebergaenge"],
    tool: "check_road_status",
    text: {
      de: { title: "Grenzübergänge nach Polen in Brandenburg", body: "ViaFrei kennt jetzt die 13 Straßen-Grenzübergänge von Brandenburg nach Polen, die der Landesbetrieb Straßenwesen Brandenburg veröffentlicht, jeweils mit der Straße und dem deutschen und polnischen Ortsnamen. Wer nach dem Verkehr an einem Ort nahe der Grenze fragt, erfährt die nächsten Übergänge im Umkreis von 25 km, eine Fähre als Fähre. Wartezeiten veröffentlicht die Quelle nicht, und ViaFrei nennt keine.", ask: "Wie ist die Verkehrslage in Frankfurt (Oder)?" },
      en: { title: "Border crossings to Poland in Brandenburg", body: "ViaFrei now knows the 13 road border crossings from Brandenburg to Poland that the Landesbetrieb Straßenwesen Brandenburg publishes, each with its road and the German and Polish place names. Ask about traffic at a place near the border and you learn the nearest crossings within 25 km, a ferry said as one. The source publishes no waiting times, and ViaFrei gives none.", ask: "What is the traffic like in Frankfurt (Oder)?" },
      ru: { title: "Пограничные переходы в Польшу в Бранденбурге", body: "ViaFrei теперь знает 13 автомобильных пограничных переходов из Бранденбурга в Польшу, которые публикует Landesbetrieb Straßenwesen Brandenburg, — с дорогой и немецким и польским названием места. Если спросить о движении в месте у границы, вы узнаете ближайшие переходы в радиусе 25 км, паром — как паром. Время ожидания источник не публикует, и ViaFrei его не называет.", ask: "Какая дорожная обстановка во Франкфурте-на-Одере?" },
      bg: { title: "Гранични пунктове към Полша в Бранденбург", body: "ViaFrei вече познава 13-те пътни гранични пункта от Бранденбург към Полша, които публикува Landesbetrieb Straßenwesen Brandenburg — всеки с пътя и германското и полското име на мястото. Попитате ли за движението на място близо до границата, ще научите най-близките пунктове в радиус 25 km, а фериботът е посочен като ферибот. Източникът не публикува време за чакане и ViaFrei не посочва такова.", ask: "Каква е пътната обстановка във Франкфурт на Одер?" },
      uk: { title: "Прикордонні переходи до Польщі в Бранденбурзі", body: "ViaFrei тепер знає 13 автомобільних прикордонних переходів з Бранденбурга до Польщі, які публікує Landesbetrieb Straßenwesen Brandenburg, — з дорогою та німецькою й польською назвою місця. Якщо запитати про рух у місці біля кордону, ви дізнаєтеся найближчі переходи в радіусі 25 км, а пором названо поромом. Час очікування джерело не публікує, і ViaFrei його не називає.", ask: "Яка ситуація на дорогах у Франкфурті-на-Одері?" },
      ro: { title: "Puncte de trecere a frontierei spre Polonia în Brandenburg", body: "ViaFrei cunoaște acum cele 13 puncte rutiere de trecere a frontierei din Brandenburg spre Polonia pe care le publică Landesbetrieb Straßenwesen Brandenburg, fiecare cu drumul și cu numele german și polonez al localității. Dacă întrebați despre trafic într-un loc de lângă frontieră, aflați cele mai apropiate puncte pe o rază de 25 km, iar un feribot este numit feribot. Sursa nu publică timpi de așteptare, iar ViaFrei nu dă niciunul.", ask: "Cum este traficul în Frankfurt (Oder)?" },
      tr: { title: "Brandenburg'da Polonya'ya sınır kapıları", body: "ViaFrei artık Landesbetrieb Straßenwesen Brandenburg'un yayımladığı, Brandenburg'dan Polonya'ya geçen 13 kara yolu sınır kapısını, her birini yolu ve Almanca ve Lehçe yer adıyla biliyor. Sınıra yakın bir yerdeki trafiği sorduğunuzda 25 km içindeki en yakın kapıları öğrenirsiniz; bir feribot feribot olarak belirtilir. Kaynak bekleme sürelerini yayımlamıyor ve ViaFrei de vermiyor.", ask: "Frankfurt (Oder)'de trafik nasıl?" },
    },
  },
  {
    // 2.2.10 (#585): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: the city's list within
    // 300 m of a stop, "not listed" never "has none".
    id: "blindenampeln-frankfurt",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 585,
    credits: ["frankfurt_lsa"],
    tool: "check_station_facilities",
    text: {
      de: { title: "Ampeln mit Blindensignal in Frankfurt am Main", body: "ViaFrei kennt jetzt die 843 Ampeln, die die Stadt Frankfurt am Main veröffentlicht, und die 166 davon mit einem akustischen Signal für blinde und sehbehinderte Menschen. Wer nach einem Bahnhof oder einer Haltestelle fragt, erfährt, wie viele Ampeln im Umkreis von 300 m stehen und welche davon ein Blindensignal haben. Steht keine auf der Liste der Stadt, sagt ViaFrei genau das, und nicht, dass es keines gibt.", ask: "Gibt es an der Haltestelle Hauptfriedhof in Frankfurt Ampeln mit Blindensignal?" },
      en: { title: "Traffic signals with acoustic signals for blind pedestrians in Frankfurt am Main", body: "ViaFrei now knows the 843 traffic signals the City of Frankfurt am Main publishes, and the 166 of them with an acoustic signal for blind and partially sighted people. Ask about a station or stop and you learn how many signals stand within 300 m and which of them have an acoustic signal. Where none is on the city's list, ViaFrei says exactly that, not that there is none.", ask: "Are there traffic signals with an acoustic signal for blind pedestrians at the Hauptfriedhof stop in Frankfurt?" },
      ru: { title: "Светофоры со звуковым сигналом для незрячих во Франкфурте-на-Майне", body: "ViaFrei теперь знает 843 светофора, которые публикует город Франкфурт-на-Майне, и 166 из них со звуковым сигналом для незрячих и слабовидящих людей. Если спросить о вокзале или остановке, вы узнаете, сколько светофоров стоит в радиусе 300 м и у каких из них есть звуковой сигнал. Если в списке города нет ни одного, ViaFrei так и говорит, а не утверждает, что их нет.", ask: "Есть ли у остановки Hauptfriedhof во Франкфурте светофоры со звуковым сигналом для незрячих?" },
      bg: { title: "Светофари със звуков сигнал за незрящи във Франкфурт на Майн", body: "ViaFrei вече познава 843-те светофара, които публикува град Франкфурт на Майн, и 166-те от тях със звуков сигнал за незрящи и слабовиждащи хора. Попитате ли за гара или спирка, ще научите колко светофара има в радиус 300 m и кои от тях имат звуков сигнал. Ако в списъка на града няма нито един, ViaFrei казва точно това, а не че няма такъв.", ask: "Има ли светофари със звуков сигнал за незрящи при спирка Hauptfriedhof във Франкфурт?" },
      uk: { title: "Світлофори зі звуковим сигналом для незрячих у Франкфурті-на-Майні", body: "ViaFrei тепер знає 843 світлофори, які публікує місто Франкфурт-на-Майні, і 166 з них зі звуковим сигналом для незрячих і людей зі слабким зором. Якщо запитати про вокзал чи зупинку, ви дізнаєтеся, скільки світлофорів стоїть у радіусі 300 м і які з них мають звуковий сигнал. Якщо в переліку міста немає жодного, ViaFrei так і каже, а не стверджує, що їх немає.", ask: "Чи є біля зупинки Hauptfriedhof у Франкфурті світлофори зі звуковим сигналом для незрячих?" },
      ro: { title: "Semafoare cu semnal acustic pentru nevăzători în Frankfurt am Main", body: "ViaFrei cunoaște acum cele 843 de semafoare pe care le publică orașul Frankfurt am Main și cele 166 dintre ele cu semnal acustic pentru persoanele nevăzătoare și cu deficiențe de vedere. Dacă întrebați despre o gară sau o stație, aflați câte semafoare se află pe o rază de 300 m și care dintre ele au semnal acustic. Dacă niciunul nu este pe lista orașului, ViaFrei spune exact asta, nu că nu există.", ask: "Există semafoare cu semnal acustic pentru nevăzători la stația Hauptfriedhof din Frankfurt?" },
      tr: { title: "Frankfurt am Main'de görme engelliler için sesli sinyalli trafik ışıkları", body: "ViaFrei artık Frankfurt am Main şehrinin yayımladığı 843 trafik ışığını ve bunlardan görme engelli ve az gören kişiler için sesli sinyali olan 166'sını biliyor. Bir istasyonu veya durağı sorduğunuzda 300 m içinde kaç trafik ışığı olduğunu ve hangilerinde sesli sinyal bulunduğunu öğrenirsiniz. Şehrin listesinde hiçbiri yoksa ViaFrei tam olarak bunu söyler, hiç olmadığını değil.", ask: "Frankfurt'taki Hauptfriedhof durağında görme engelliler için sesli sinyalli trafik ışığı var mı?" },
    },
  },
  {
    // 2.2.10 (#583): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: the city's plan within
    // 1 km of a place, "not listed" never "not cleared".
    id: "winterdienst-karlsruhe",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 583,
    credits: ["karlsruhe_winterdienst"],
    tool: "check_road_status",
    text: {
      de: { title: "Winterdienst in Karlsruhe", body: "ViaFrei kennt jetzt die 6 435 Straßenabschnitte, die der Winterdienst der Stadt Karlsruhe räumt, mit ihrer Priorität. Wer nach der Lage auf den Straßen eines Ortes fragt, erfährt, welche Straßen in der Nähe im Winter geräumt werden und welche zuerst. Steht eine Straße nicht auf dem Plan der Stadt, sagt ViaFrei nicht, dass sie nicht geräumt wird.", ask: "Welche Straßen am Ettlinger Tor in Karlsruhe räumt der Winterdienst zuerst?" },
      en: { title: "Winter service in Karlsruhe", body: "ViaFrei now knows the 6,435 street sections the City of Karlsruhe's winter service clears, with their priority. Ask about the roads around a place and you learn which streets nearby are cleared in winter and which come first. Where a street is not on the city's plan, ViaFrei does not say it is not cleared.", ask: "Which streets near the Ettlinger Tor in Karlsruhe does the winter service clear first?" },
      ru: { title: "Зимняя уборка дорог в Карлсруэ", body: "ViaFrei теперь знает 6 435 участков улиц, которые убирает зимняя служба города Карлсруэ, с их приоритетом. Если спросить о дорогах вокруг какого-либо места, вы узнаете, какие улицы поблизости убираются зимой и какие в первую очередь. Если улицы нет в плане города, ViaFrei не утверждает, что её не убирают.", ask: "Какие улицы у Ettlinger Tor в Карлсруэ зимняя служба убирает в первую очередь?" },
      bg: { title: "Зимно почистване в Карлсруе", body: "ViaFrei вече познава 6 435-те участъка от улици, които зимната служба на град Карлсруе почиства, с техния приоритет. Попитате ли за пътищата около дадено място, ще научите кои улици наблизо се почистват през зимата и кои първи. Ако една улица не е в плана на града, ViaFrei не казва, че тя не се почиства.", ask: "Кои улици край Ettlinger Tor в Карлсруе зимната служба почиства първо?" },
      uk: { title: "Зимове прибирання доріг у Карлсруе", body: "ViaFrei тепер знає 6 435 ділянок вулиць, які прибирає зимова служба міста Карлсруе, з їхнім пріоритетом. Якщо запитати про дороги навколо якогось місця, ви дізнаєтеся, які вулиці поблизу прибирають узимку і які першими. Якщо вулиці немає в плані міста, ViaFrei не стверджує, що її не прибирають.", ask: "Які вулиці біля Ettlinger Tor у Карлсруе зимова служба прибирає першими?" },
      ro: { title: "Deszăpezirea în Karlsruhe", body: "ViaFrei cunoaște acum cele 6 435 de tronsoane de stradă pe care le deszăpezește serviciul de iarnă al orașului Karlsruhe, cu prioritatea lor. Dacă întrebați despre drumurile din jurul unui loc, aflați ce străzi din apropiere sunt deszăpezite iarna și care sunt primele. Dacă o stradă nu este în planul orașului, ViaFrei nu spune că nu este deszăpezită.", ask: "Ce străzi de lângă Ettlinger Tor din Karlsruhe deszăpezește mai întâi serviciul de iarnă?" },
      tr: { title: "Karlsruhe'de kış hizmeti", body: "ViaFrei artık Karlsruhe şehrinin kış hizmetinin temizlediği 6.435 sokak kesimini öncelikleriyle birlikte biliyor. Bir yerin çevresindeki yolları sorduğunuzda yakındaki hangi sokakların kışın temizlendiğini ve hangilerinin önce geldiğini öğrenirsiniz. Bir sokak şehrin planında yoksa ViaFrei onun temizlenmediğini söylemez.", ask: "Karlsruhe'de Ettlinger Tor yakınında kış hizmeti önce hangi sokakları temizliyor?" },
    },
  },
  {
    // 2.2.10 (#586): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on both register rows comes first. The text holds the read rule: the city states where
    // a ban applies and not whom or when, so the answer says so and the signs on site bind; the route network is
    // no all-clear.
    id: "lkw-verbote-dresden",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 586,
    credits: ["lorry_dresden_verbotszonen", "lorry_dresden_vorrangrouten"],
    tool: "check_road_status",
    text: {
      de: { title: "Lkw-Verbotszonen und Lkw-Vorrangrouten in Dresden", body: "ViaFrei liest jetzt die Lkw-Verbotszonen und das Lkw-Vorrangroutennetz, die die Landeshauptstadt Dresden veröffentlicht. Für einen Ort in Dresden sagt ViaFrei, ob dort ein Lkw-Verbot gilt und wie weit die nächste Lkw-Vorrangroute entfernt ist. Gewicht, Fahrzeugklasse und Zeiten nennt die Stadt nicht, und ViaFrei sagt das, statt sie zu raten: es gilt die Beschilderung vor Ort.", ask: "Gilt am Dresdner Altmarkt ein Lkw-Verbot?" },
      en: { title: "Lorry ban zones and lorry priority routes in Dresden", body: "ViaFrei now reads the lorry ban zones and the lorry priority route network the City of Dresden publishes. For a place in Dresden, ViaFrei says whether a lorry ban applies there and how far away the nearest lorry priority route runs. The city does not state weight, vehicle class or times, and ViaFrei says so instead of guessing: the signs on site apply.", ask: "Is there a lorry ban at the Altmarkt in Dresden?" },
      ru: { title: "Зоны запрета для грузовиков и приоритетные маршруты в Дрездене", body: "ViaFrei теперь читает зоны запрета для грузовиков и сеть приоритетных маршрутов для грузовиков, которые публикует столица земли Дрезден. Для места в Дрездене ViaFrei говорит, действует ли там запрет для грузовиков и как далеко ближайший приоритетный маршрут. Массу, класс транспортного средства и время город не указывает, и ViaFrei так и говорит, а не гадает: действуют знаки на месте.", ask: "Действует ли запрет для грузовиков на площади Альтмаркт в Дрездене?" },
      bg: { title: "Зони със забрана за камиони и приоритетни маршрути в Дрезден", body: "ViaFrei вече чете зоните със забрана за камиони и мрежата от приоритетни маршрути за камиони, които публикува провинциалната столица Дрезден. За място в Дрезден ViaFrei казва дали там важи забрана за камиони и колко далеч е най-близкият приоритетен маршрут. Масата, класът на превозното средство и часовете градът не посочва и ViaFrei го казва, вместо да гадае: важат знаците на място.", ask: "Важи ли забрана за камиони на площад Алтмаркт в Дрезден?" },
      uk: { title: "Зони заборони для вантажівок і пріоритетні маршрути в Дрездені", body: "ViaFrei тепер читає зони заборони для вантажівок і мережу пріоритетних маршрутів для вантажівок, які публікує столиця землі Дрезден. Для місця в Дрездені ViaFrei каже, чи діє там заборона для вантажівок і як далеко найближчий пріоритетний маршрут. Масу, клас транспортного засобу й час місто не вказує, і ViaFrei так і каже, а не вгадує: діють знаки на місці.", ask: "Чи діє заборона для вантажівок на площі Альтмаркт у Дрездені?" },
      ro: { title: "Zone interzise camioanelor și rute prioritare pentru camioane în Dresda", body: "ViaFrei citește acum zonele interzise camioanelor și rețeaua de rute prioritare pentru camioane pe care le publică orașul Dresda. Pentru un loc din Dresda, ViaFrei spune dacă acolo se aplică o interdicție pentru camioane și cât de departe trece cea mai apropiată rută prioritară. Orașul nu precizează masa, categoria vehiculului sau orele, iar ViaFrei spune asta în loc să ghicească: se aplică indicatoarele de pe teren.", ask: "Există o interdicție pentru camioane în piața Altmarkt din Dresda?" },
      tr: { title: "Dresden'de kamyon yasağı bölgeleri ve kamyon öncelikli güzergâhları", body: "ViaFrei artık Dresden eyalet başkentinin yayımladığı kamyon yasağı bölgelerini ve kamyon öncelikli güzergâh ağını okuyor. Dresden'deki bir yer için ViaFrei orada bir kamyon yasağı olup olmadığını ve en yakın kamyon öncelikli güzergâhının ne kadar uzakta olduğunu söylüyor. Şehir ağırlığı, araç sınıfını ve saatleri belirtmiyor; ViaFrei de tahmin etmek yerine bunu söylüyor: yerindeki işaretler geçerlidir.", ask: "Dresden'deki Altmarkt'ta kamyon yasağı var mı?" },
    },
  },
  {
    // 2.2.10 (#570): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: a network to apply
    // along in VEMAGS, never a permit, and no restriction data where a city publishes none.
    id: "schwertransport-netz-hamburg",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.10",
    issue: 570,
    credits: ["lorry_hh_gst_netz"],
    tool: "check_road_status",
    text: {
      de: { title: "Das Großraum- und Schwertransport-Netz in Hamburg", body: "ViaFrei liest jetzt das Großraum- und Schwertransport-Netz, das der Landesbetrieb Verkehr Hamburg veröffentlicht: die Strecken für Großraum- und Schwertransporte in und durch Hamburg. Für einen Ort in Hamburg nennt ViaFrei den nächsten Abschnitt mit seinen Straßen. Das Netz hilft beim Antrag in VEMAGS und ist keine Erlaubnis, und ViaFrei sagt das mit jeder Antwort.", ask: "Wo verläuft am Hamburger Rathaus das Netz für Schwertransporte?" },
      en: { title: "Hamburg's network for oversize and heavy transport", body: "ViaFrei now reads the network for oversize and heavy transport that Hamburg's Landesbetrieb Verkehr publishes: the routes for oversize and heavy loads in and through Hamburg. For a place in Hamburg, ViaFrei names the nearest section with its streets. The network helps with an application in VEMAGS and is no permit, and ViaFrei says so with every answer.", ask: "Where does the heavy transport network run near Hamburg's Rathaus?" },
      ru: { title: "Сеть для крупногабаритных и тяжеловесных перевозок в Гамбурге", body: "ViaFrei теперь читает сеть для крупногабаритных и тяжеловесных перевозок, которую публикует транспортное ведомство Гамбурга (Landesbetrieb Verkehr): маршруты для таких перевозок в Гамбурге и через него. Для места в Гамбурге ViaFrei называет ближайший участок с его улицами. Сеть помогает при подаче заявки в VEMAGS и не является разрешением, и ViaFrei говорит это в каждом ответе.", ask: "Где у Гамбургской ратуши проходит сеть для тяжеловесных перевозок?" },
      bg: { title: "Мрежата за извънгабаритни и тежки превози в Хамбург", body: "ViaFrei вече чете мрежата за извънгабаритни и тежки превози, която публикува транспортната служба на Хамбург (Landesbetrieb Verkehr): маршрутите за такива превози в и през Хамбург. За място в Хамбург ViaFrei посочва най-близкия участък с неговите улици. Мрежата помага при заявлението във VEMAGS и не е разрешение, и ViaFrei го казва във всеки отговор.", ask: "Къде минава мрежата за тежки превози край кметството на Хамбург?" },
      uk: { title: "Мережа для великогабаритних і великовагових перевезень у Гамбурзі", body: "ViaFrei тепер читає мережу для великогабаритних і великовагових перевезень, яку публікує транспортне відомство Гамбурга (Landesbetrieb Verkehr): маршрути для таких перевезень у Гамбурзі та через нього. Для місця в Гамбурзі ViaFrei називає найближчу ділянку з її вулицями. Мережа допомагає під час заявки у VEMAGS і не є дозволом, і ViaFrei каже це в кожній відповіді.", ask: "Де біля Гамбурзької ратуші проходить мережа для великовагових перевезень?" },
      ro: { title: "Rețeaua pentru transporturi agabaritice și grele din Hamburg", body: "ViaFrei citește acum rețeaua pentru transporturi agabaritice și grele publicată de Landesbetrieb Verkehr din Hamburg: traseele pentru astfel de transporturi în și prin Hamburg. Pentru un loc din Hamburg, ViaFrei numește cel mai apropiat tronson cu străzile lui. Rețeaua ajută la cererea din VEMAGS și nu este o autorizație, iar ViaFrei spune asta în fiecare răspuns.", ask: "Pe unde trece rețeaua pentru transporturi grele lângă primăria din Hamburg?" },
      tr: { title: "Hamburg'da ağır ve gabari dışı taşıma ağı", body: "ViaFrei artık Hamburg Landesbetrieb Verkehr'in yayımladığı ağır ve gabari dışı taşıma ağını okuyor: Hamburg içinde ve Hamburg üzerinden bu tür taşımalar için güzergâhlar. Hamburg'daki bir yer için ViaFrei en yakın kesimi sokaklarıyla birlikte veriyor. Ağ VEMAGS'taki başvuruya yardımcı olur ve bir izin değildir; ViaFrei bunu her yanıtta söylüyor.", ask: "Hamburg Belediye Sarayı yakınında ağır taşıma ağı nereden geçiyor?" },
    },
  },
  {
    // 2.2.12 (#569): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: a count is a volume per
    // quarter hour at a counting cross-section, said once, never a jam and never free flow.
    id: "verkehrszaehlung-hamburg",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.12",
    issue: 569,
    credits: ["hh_verkehrszaehlung"],
    tool: "check_road_status",
    text: {
      de: { title: "Gezählter Verkehr in Hamburg", body: "ViaFrei liest jetzt die Verkehrszählung der Hamburger Behörde für Verkehr und Mobilitätswende: wie viele Kraftfahrzeuge die Infrarot-Zählstellen der Stadt in jeder Viertelstunde gezählt haben, und an vielen Stellen auch den Schwerverkehr. Wenn Sie nach den Straßen um einen Ort fragen, nennt ViaFrei die nächsten Zählquerschnitte mit ihrer Zahl und je Richtung, zum Beispiel \"133 Kfz zwischen 20:15 und 20:30\". Eine Zählung ist eine Menge, keine Aussage über Stau oder freie Fahrt, und ViaFrei sagt das dazu.", ask: "Wie viel Verkehr ist gerade am Hamburger Hauptbahnhof?" },
      en: { title: "Counted traffic in Hamburg", body: "ViaFrei now reads the traffic counts of Hamburg's Behörde für Verkehr und Mobilitätswende: how many motor vehicles the city's infrared counting sites counted in each quarter hour, and at many sites the heavy vehicles too. When you ask about the roads around a place, ViaFrei names the nearest counting cross-sections with their number and by direction, for example \"133 motor vehicles between 20:15 and 20:30\". A count is a volume, not a statement about congestion or free flow, and ViaFrei says so.", ask: "How much traffic is there at Hamburg Hauptbahnhof right now?" },
      ru: { title: "Подсчёт транспорта в Гамбурге", body: "ViaFrei теперь читает данные подсчёта транспорта гамбургского ведомства транспорта и мобильности: сколько автомобилей насчитали городские инфракрасные пункты учёта за каждую четверть часа, а во многих местах и грузовой транспорт. Когда вы спрашиваете о дорогах вокруг места, ViaFrei называет ближайшие сечения учёта с числом и по направлениям, например «133 автомобиля с 20:15 до 20:30». Подсчёт — это количество, а не сведения о пробке или свободном движении, и ViaFrei говорит об этом.", ask: "Сколько сейчас транспорта у главного вокзала Гамбурга?" },
      bg: { title: "Преброен трафик в Хамбург", body: "ViaFrei вече чете преброяването на трафика на хамбургското ведомство за транспорт и мобилност: колко моторни превозни средства са преброили инфрачервените пунктове на града за всеки четвърт час, а на много места и тежкотоварните. Когато питате за пътищата около дадено място, ViaFrei назовава най-близките сечения за преброяване с броя и по посоки, например „133 превозни средства между 20:15 и 20:30“. Преброяването е брой, а не твърдение за задръстване или свободно движение, и ViaFrei го казва.", ask: "Колко е трафикът в момента до Централната гара на Хамбург?" },
      uk: { title: "Підрахунок транспорту в Гамбурзі", body: "ViaFrei тепер читає дані підрахунку транспорту гамбурзького відомства транспорту й мобільності: скільки автомобілів нарахували міські інфрачервоні пункти обліку за кожну чверть години, а в багатьох місцях і вантажний транспорт. Коли ви питаєте про дороги навколо місця, ViaFrei називає найближчі перерізи обліку з кількістю та за напрямками, наприклад «133 автомобілі з 20:15 до 20:30». Підрахунок — це кількість, а не відомості про затор чи вільний рух, і ViaFrei про це каже.", ask: "Скільки зараз транспорту біля головного вокзалу Гамбурга?" },
      ro: { title: "Trafic numărat în Hamburg", body: "ViaFrei citește acum numărătoarea traficului autorității pentru transport și mobilitate din Hamburg: câte autovehicule au numărat punctele de numărare cu infraroșu ale orașului în fiecare sfert de oră, iar în multe locuri și vehiculele grele. Când întrebați despre drumurile din jurul unui loc, ViaFrei numește cele mai apropiate secțiuni de numărare, cu numărul și pe sensuri, de exemplu „133 de autovehicule între 20:15 și 20:30”. O numărare este un volum, nu o afirmație despre ambuteiaj sau trafic fluid, iar ViaFrei spune asta.", ask: "Cât trafic este acum la gara centrală din Hamburg?" },
      tr: { title: "Hamburg'da sayılan trafik", body: "ViaFrei artık Hamburg Ulaştırma ve Mobilite Dairesi'nin trafik sayımlarını okuyor: şehrin kızılötesi sayım noktalarının her çeyrek saatte kaç motorlu taşıt saydığı ve birçok noktada ağır vasıtalar. Bir yerin çevresindeki yolları sorduğunuzda ViaFrei en yakın sayım kesitlerini sayılarıyla ve yönlere göre söyler, örneğin \"20:15 ile 20:30 arasında 133 motorlu taşıt\". Bir sayım bir hacimdir; trafik sıkışıklığı ya da akıcı trafik hakkında bir ifade değildir ve ViaFrei bunu da söyler.", ask: "Hamburg Ana Tren İstasyonu'nda şu anda ne kadar trafik var?" },
    },
  },
  {
    // 2.2.12 (#570): DRAFTED by ingest-dev 2026-10-19 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: a place the city keeps
    // for coaches, for parking or for setting down only, with the city's remark; never a free space.
    id: "reisebusparkplaetze-hamburg",
    kind: "new",
    date: "2026-10-19",
    release: "2.2.12",
    issue: 570,
    credits: ["hh_reisebusparkplaetze"],
    tool: "find_parking",
    text: {
      de: { title: "Plätze für Reisebusse in Hamburg", body: "ViaFrei kennt jetzt die Plätze, die Hamburg für Reisebusse ausweist: die Straße, wie viele Busse dort Platz haben und was die Stadt dazu schreibt, etwa \"Parkscheibe 2 Std.\" oder \"nur Ein- und Aussteigen\". Wenn Sie nach Parkplätzen um einen Ort fragen, nennt ViaFrei die nächsten drei in einem eigenen Abschnitt, die zum Parken zuerst. Ob dort gerade Platz frei ist, veröffentlicht die Stadt nicht; vor Ort gilt die Beschilderung.", ask: "Wo kann ein Reisebus am Hamburger Hauptbahnhof parken?" },
      en: { title: "Places for coaches in Hamburg", body: "ViaFrei now knows the places Hamburg sets aside for coaches: the street, how many coaches fit and what the city says about it, such as a two-hour parking disc or setting down and picking up only. When you ask for parking around a place, ViaFrei names the nearest three in a section of their own, those for parking first. The city does not publish whether a space is free; the signs on site apply.", ask: "Where can a coach park near Hamburg Hauptbahnhof?" },
      ru: { title: "Места для туристических автобусов в Гамбурге", body: "ViaFrei теперь знает места, которые Гамбург отводит для туристических автобусов: улицу, сколько автобусов там помещается и что пишет о месте город, например двухчасовой парковочный диск или только посадка и высадка. Когда вы спрашиваете о парковке вокруг места, ViaFrei называет три ближайших в отдельном разделе, сначала места для стоянки. Свободно ли место сейчас, город не публикует; на месте действуют знаки.", ask: "Где туристический автобус может встать у главного вокзала Гамбурга?" },
      bg: { title: "Места за туристически автобуси в Хамбург", body: "ViaFrei вече познава местата, които Хамбург отрежда за туристически автобуси: улицата, колко автобуса се побират и какво пише градът за мястото, например двучасов паркинг диск или само качване и слизане. Когато питате за паркиране около дадено място, ViaFrei назовава трите най-близки в отделен раздел, първо тези за паркиране. Дали в момента има свободно място, градът не публикува; на място важат знаците.", ask: "Къде може да паркира туристически автобус до Централната гара на Хамбург?" },
      uk: { title: "Місця для туристичних автобусів у Гамбурзі", body: "ViaFrei тепер знає місця, які Гамбург відводить для туристичних автобусів: вулицю, скільки автобусів там вміщується і що пише про місце місто, наприклад двогодинний паркувальний диск або лише посадка й висадка. Коли ви питаєте про паркування навколо місця, ViaFrei називає три найближчі в окремому розділі, спершу місця для стоянки. Чи вільне місце зараз, місто не публікує; на місці діють знаки.", ask: "Де туристичний автобус може стати біля головного вокзалу Гамбурга?" },
      ro: { title: "Locuri pentru autocare în Hamburg", body: "ViaFrei cunoaște acum locurile pe care Hamburgul le rezervă autocarelor: strada, câte autocare încap și ce scrie orașul despre loc, de exemplu disc de parcare de două ore sau doar urcare și coborâre. Când întrebați despre parcare în jurul unui loc, ViaFrei le numește pe cele mai apropiate trei într-o secțiune separată, mai întâi pe cele pentru parcare. Orașul nu publică dacă un loc este liber; la fața locului se aplică indicatoarele.", ask: "Unde poate parca un autocar lângă gara centrală din Hamburg?" },
      tr: { title: "Hamburg'da tur otobüsleri için yerler", body: "ViaFrei artık Hamburg'un tur otobüslerine ayırdığı yerleri biliyor: sokağı, kaç otobüsün sığdığını ve şehrin yer hakkında yazdıklarını, örneğin iki saatlik park diski ya da yalnızca yolcu indirme ve bindirme. Bir yerin çevresinde park yeri sorduğunuzda ViaFrei en yakın üç yeri ayrı bir bölümde, önce park içinkileri söyler. Bir yerin şu anda boş olup olmadığını şehir yayımlamaz; yerindeki işaretler geçerlidir.", ask: "Hamburg Ana Tren İstasyonu yakınında bir tur otobüsü nereye park edebilir?" },
    },
  },
  {
    // 2.2.13 (#570): DRAFTED by ingest-dev 2026-10-20 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: a numbered detour signed
    // for motorway traffic, by its number and the street of its nearest section; signage context, never a route
    // recommendation, never said to be in use.
    id: "bedarfsumleitungen-hamburg",
    kind: "new",
    date: "2026-10-20",
    release: "2.2.13",
    issue: 570,
    credits: ["hh_bedarfsumleitungen"],
    tool: "check_road_status",
    text: {
      de: { title: "Bedarfsumleitungen in Hamburg", body: "ViaFrei kennt jetzt die Bedarfsumleitungen, die in Hamburg für den Verkehr einer gesperrten Autobahn ausgeschildert sind (Zeichen 460 und 455, etwa \"U 33\"). Wenn Sie nach den Straßen um einen Ort fragen, nennt ViaFrei die nächsten drei mit ihrer Nummer und der Straße ihres nächsten Abschnitts. Das ist ein Hinweis auf die Beschilderung, keine Routenempfehlung, und sagt nicht, ob eine Umleitung gerade in Gebrauch ist.", ask: "Welche Bedarfsumleitungen gibt es in Hamburg-Harburg?" },
      en: { title: "Signed motorway detours in Hamburg", body: "ViaFrei now knows the numbered detours Hamburg signs for the traffic of a closed motorway (signs 460 and 455, such as \"U 33\"). When you ask about the roads around a place, ViaFrei names the nearest three with their number and the street of their nearest section. This is signage context, not a route recommendation, and it does not say whether a detour is in use.", ask: "Which signed motorway detours are there in Hamburg-Harburg?" },
      ru: { title: "Объезды автомагистралей в Гамбурге", body: "ViaFrei теперь знает пронумерованные объезды, которые в Гамбурге обозначены для транспорта с перекрытой автомагистрали (знаки 460 и 455, например «U 33»). Когда вы спрашиваете о дорогах вокруг места, ViaFrei называет три ближайших с номером и улицей ближайшего участка. Это указание на дорожные знаки, а не рекомендация маршрута, и оно не говорит, используется ли объезд сейчас.", ask: "Какие объезды автомагистрали есть в Гамбург-Харбурге?" },
      bg: { title: "Обходни маршрути на магистралите в Хамбург", body: "ViaFrei вече познава номерираните обходни маршрути, които в Хамбург са обозначени за движението от затворена магистрала (знаци 460 и 455, например „U 33“). Когато питате за пътищата около дадено място, ViaFrei назовава трите най-близки с номера им и улицата на най-близкия им участък. Това е указание за пътните знаци, а не препоръка за маршрут, и не казва дали обходът се използва в момента.", ask: "Какви обходни маршрути на магистралата има в Хамбург-Харбург?" },
      uk: { title: "Обʼїзди автомагістралей у Гамбурзі", body: "ViaFrei тепер знає пронумеровані обʼїзди, які в Гамбурзі позначені для транспорту з перекритої автомагістралі (знаки 460 і 455, наприклад «U 33»). Коли ви питаєте про дороги навколо місця, ViaFrei називає три найближчі з номером і вулицею найближчої ділянки. Це вказівка на дорожні знаки, а не рекомендація маршруту, і вона не каже, чи використовується обʼїзд зараз.", ask: "Які обʼїзди автомагістралі є в Гамбург-Гарбурзі?" },
      ro: { title: "Rute ocolitoare semnalizate pentru autostrăzi în Hamburg", body: "ViaFrei cunoaște acum rutele ocolitoare numerotate pe care Hamburgul le semnalizează pentru traficul unei autostrăzi închise (indicatoarele 460 și 455, de exemplu „U 33”). Când întrebați despre drumurile din jurul unui loc, ViaFrei le numește pe cele mai apropiate trei, cu numărul lor și strada celui mai apropiat tronson. Este o indicație privind semnalizarea, nu o recomandare de traseu, și nu spune dacă o rută ocolitoare este folosită acum.", ask: "Ce rute ocolitoare pentru autostradă există în Hamburg-Harburg?" },
      tr: { title: "Hamburg'da işaretli otoyol alternatif güzergâhları", body: "ViaFrei artık Hamburg'un kapalı bir otoyolun trafiği için işaretlediği numaralı alternatif güzergâhları biliyor (460 ve 455 levhaları, örneğin \"U 33\"). Bir yerin çevresindeki yolları sorduğunuzda ViaFrei en yakın üç güzergâhı numarası ve en yakın kesiminin sokağıyla söyler. Bu, işaretlemeye ilişkin bir bilgidir, güzergâh önerisi değildir ve bir güzergâhın şu anda kullanılıp kullanılmadığını söylemez.", ask: "Hamburg-Harburg'da hangi otoyol alternatif güzergâhları var?" },
    },
  },
  {
    // 2.2.13 (#570): DRAFTED by ingest-dev 2026-10-20 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on the register row comes first. The text holds the read rule: the city's register of
    // on-street bays, their rules, times and counts near a place; never an occupancy, never a fee amount.
    id: "parkraum-hamburg",
    kind: "new",
    date: "2026-10-20",
    release: "2.2.13",
    issue: 570,
    credits: ["hh_parkraum"],
    tool: "find_parking",
    text: {
      de: { title: "Parkstände am Straßenrand in Hamburg", body: "ViaFrei kennt jetzt Hamburgs Verzeichnis der öffentlichen Parkstände am Straßenrand in den erfassten Gebieten. Wenn Sie nach Parkplätzen an einem Ort fragen, nennt ViaFrei, wie viele Stellplätze im Umkreis von 300 Metern liegen, und für die nächsten Straßen die Regel: Parkschein oder Parkscheibe, zu welchen Zeiten, die Höchstparkdauer. Ob ein Platz frei ist, veröffentlicht die Stadt nicht, und ViaFrei sagt es auch nicht.", ask: "Wo kann ich in St. Georg am Straßenrand parken?" },
      en: { title: "On-street parking bays in Hamburg", body: "ViaFrei now knows Hamburg's register of public on-street parking bays in the areas the city has surveyed. When you ask about parking at a place, ViaFrei says how many bays lie within 300 metres and, for the nearest streets, the rule: pay and display or a parking disc, at which times, and the maximum stay. Whether a bay is free is not published by the city, and ViaFrei does not say it either.", ask: "Where can I park on the street in St. Georg, Hamburg?" },
      ru: { title: "Парковочные места у дороги в Гамбурге", body: "ViaFrei теперь знает реестр Гамбурга с общественными парковочными местами у дороги в обследованных районах. Когда вы спрашиваете о парковке в каком-либо месте, ViaFrei говорит, сколько мест находится в радиусе 300 метров, и для ближайших улиц называет правило: парковочный билет или парковочный диск, в какое время и максимальную продолжительность стоянки. Свободно ли место, город не публикует, и ViaFrei этого тоже не говорит.", ask: "Где можно припарковаться у дороги в Санкт-Георге в Гамбурге?" },
      bg: { title: "Места за паркиране по улиците в Хамбург", body: "ViaFrei вече познава регистъра на Хамбург с обществените места за паркиране по улиците в обследваните райони. Когато питате за паркиране на дадено място, ViaFrei казва колко места има в радиус от 300 метра и за най-близките улици назовава правилото: паркинг билет или паркинг диск, в кои часове и максималния престой. Дали едно място е свободно, градът не публикува и ViaFrei също не го казва.", ask: "Къде мога да паркирам на улицата в Санкт Георг в Хамбург?" },
      uk: { title: "Паркувальні місця біля дороги в Гамбурзі", body: "ViaFrei тепер знає реєстр Гамбурга з громадськими паркувальними місцями біля дороги в обстежених районах. Коли ви питаєте про паркування в певному місці, ViaFrei каже, скільки місць є в радіусі 300 метрів, і для найближчих вулиць називає правило: паркувальний квиток чи паркувальний диск, у який час і найдовший час стоянки. Чи вільне місце, місто не публікує, і ViaFrei цього теж не каже.", ask: "Де можна припаркуватися біля дороги в Санкт-Георгі в Гамбурзі?" },
      ro: { title: "Locuri de parcare pe stradă în Hamburg", body: "ViaFrei cunoaște acum registrul Hamburgului cu locurile publice de parcare pe stradă din zonele inventariate. Când întrebați despre parcare într-un loc, ViaFrei spune câte locuri se află pe o rază de 300 de metri și, pentru străzile cele mai apropiate, regula: tichet de parcare sau disc de parcare, la ce ore și durata maximă. Dacă un loc este liber, orașul nu publică, iar ViaFrei nu spune nici el.", ask: "Unde pot parca pe stradă în St. Georg, Hamburg?" },
      tr: { title: "Hamburg'da yol kenarı park yerleri", body: "ViaFrei artık Hamburg'un, incelenen bölgelerdeki yol kenarı kamu park yerlerinin kaydını biliyor. Bir yerde park sorduğunuzda ViaFrei 300 metre içinde kaç park yeri olduğunu ve en yakın sokaklar için kuralı söyler: park fişi mi park diski mi, hangi saatlerde ve en uzun park süresi. Bir yerin boş olup olmadığını şehir yayımlamaz, ViaFrei de söylemez.", ask: "Hamburg St. Georg'da yol kenarına nereye park edebilirim?" },
    },
  },
  {
    // 2.2.13 (#569): DRAFTED by ingest-dev 2026-10-20 — the owner approves or rewords it before the cut, and the
    // data-steward's ruling on both register rows comes first. The text holds the read rule: how many signal
    // installations lie near a place, at junctions and at crossings, and at how many buses register by detector
    // where the city publishes that; static inventory, never a signal state.
    id: "ampeln-hamburg",
    kind: "new",
    date: "2026-10-20",
    release: "2.2.13",
    issue: 569,
    credits: ["hh_lichtsignalanlagen", "hh_tld"],
    tool: "check_road_status",
    text: {
      de: { title: "Ampeln in Hamburg", body: "ViaFrei kennt jetzt die Ampelanlagen in Hamburg. Wenn Sie nach den Straßen um einen Ort fragen, nennt ViaFrei, wie viele Anlagen im Umkreis von 500 Metern stehen, an Kreuzungen und an Fußgängerüberwegen, und an wie vielen eine Busanmeldung eingerichtet ist, wo die Stadt das veröffentlicht. Ob eine Ampel gerade Grün zeigt, sagt ViaFrei nicht.", ask: "Wie viele Ampeln gibt es am Hamburger Jungfernstieg?" },
      en: { title: "Traffic signals in Hamburg", body: "ViaFrei now knows Hamburg's signal installations. When you ask about the roads around a place, ViaFrei says how many installations stand within 500 metres, at junctions and at pedestrian crossings, and at how many of them a bus registration point is set up, where the city publishes that. ViaFrei does not say whether a signal is green right now.", ask: "How many traffic lights are there at the Jungfernstieg in Hamburg?" },
      ru: { title: "Светофоры в Гамбурге", body: "ViaFrei теперь знает светофорные объекты Гамбурга. Когда вы спрашиваете о дорогах вокруг места, ViaFrei говорит, сколько объектов находится в радиусе 500 метров, на перекрёстках и на пешеходных переходах, и на скольких из них предусмотрена регистрация автобусов, если город это публикует. Горит ли сейчас зелёный, ViaFrei не говорит.", ask: "Сколько светофоров на Юнгфернштиге в Гамбурге?" },
      bg: { title: "Светофари в Хамбург", body: "ViaFrei вече познава светофарните уредби в Хамбург. Когато питате за пътищата около дадено място, ViaFrei казва колко уредби има в радиус от 500 метра, на кръстовища и на пешеходни пътеки, и на колко от тях е предвидена регистрация на автобуси, където градът публикува това. Дали светофарът свети зелено в момента, ViaFrei не казва.", ask: "Колко светофара има на Юнгфернщиг в Хамбург?" },
      uk: { title: "Світлофори в Гамбурзі", body: "ViaFrei тепер знає світлофорні об'єкти Гамбурга. Коли ви питаєте про дороги навколо місця, ViaFrei каже, скільки об'єктів є в радіусі 500 метрів, на перехрестях і на пішохідних переходах, і на скількох із них передбачено реєстрацію автобусів, якщо місто це публікує. Чи горить зараз зелений, ViaFrei не каже.", ask: "Скільки світлофорів на Юнгфернштизі в Гамбурзі?" },
      ro: { title: "Semafoare în Hamburg", body: "ViaFrei cunoaște acum instalațiile semaforizate din Hamburg. Când întrebați despre drumurile din jurul unui loc, ViaFrei spune câte instalații se află pe o rază de 500 de metri, la intersecții și la treceri de pietoni, și la câte dintre ele este prevăzută anunțarea autobuzelor, acolo unde orașul publică acest lucru. Dacă un semafor arată acum verde, ViaFrei nu spune.", ask: "Câte semafoare sunt la Jungfernstieg în Hamburg?" },
      tr: { title: "Hamburg'da trafik ışıkları", body: "ViaFrei artık Hamburg'un trafik ışığı tesislerini biliyor. Bir yerin çevresindeki yolları sorduğunuzda ViaFrei 500 metre içinde, kavşaklarda ve yaya geçitlerinde kaç tesis olduğunu ve şehrin bunu yayımladığı yerlerde kaçında otobüs bildiriminin tanımlı olduğunu söyler. Bir ışığın şu anda yeşil olup olmadığını ViaFrei söylemez.", ask: "Hamburg Jungfernstieg'de kaç trafik ışığı var?" },
    },
  },
  {
    // #1183: DRAFTED by the lane-1183 agent 2026-11-08; the owner approves or rewords it before the cut, and it
    // moves into NEWS_ENTRIES then. The read rule (steward LM-2026-11-08): the lines are DB InfraGO's network,
    // simplified; the dots are the stations, neutral; the delays are a separate CC BY-SA layer; the warnings are
    // summarised per Kreis and shown for now only.
    id: "live-karte-bahn-wetter",
    kind: "new",
    date: "2026-11-08",
    release: "2.5.22",
    issue: 1183,
    credits: ["dbinfrago_streckennetz"],
    tool: "check_weather_warnings",
    text: {
      de: { title: "Die Autobahnkarte zeigt Bahn und Wetterwarnungen", body: "Die Karte auf der Autobahn-Übersicht zeigt jetzt auf Wunsch auch das Streckennetz der Bahn mit den großen Bahnhöfen und die Wetterwarnungen des Deutschen Wetterdienstes je Kreis. Verspätungen und Ausfälle an den Bahnhöfen sind eine eigene Ebene.", ask: "Gibt es gerade Unwetterwarnungen in Köln?" },
      en: { title: "The motorway map shows rail and weather warnings", body: "The map on the motorway overview can now also show the rail network with the major stations, and the German Weather Service's warnings by district. Delays and cancellations at the stations are a layer of their own.", ask: "Are there any severe weather warnings in Cologne right now?" },
    },
  },
];

/**
 * The credits ids that were live before the News page existed (#588, 2.0.0):
 * they shipped without an entry, and listing them all as "new" would be untrue.
 * An id that is in neither this list nor an entry's `credits` is FLAGGED by
 * `test/news.test.ts`, and `scripts/news-draft.ts` drafts its entry.
 */
export const CREDITS_BEFORE_NEWS: readonly string[] = [
  "autobahn", "delfi_rt_tu", "vbb_rt", "delfi_rt_sa", "delfi_siri_sx", "delfi_siri_et", "delfi_static", "tankerkoenig", "db_timetables", "db_stada",
  "db_fasta", "dwd", "geonames", "bkg_gvisys", "delfi_zhv", "osm", "mobilithek_nms_events", "mobilithek_roadworks_bast",
  "mobilithek_roadworks_ald_ni", "mobilithek_traffic_bw", "mobilithek_traffic_berlin", "mobilithek_traffic_koeln_events", "mobilithek_traffic_sh",
  "mobilithek_traffic_hannover", "mobilithek_roadworks_ald_sn", "mobilithek_roadworks_ald_th", "polizei_hamburg_lms",
  "mobilithek_truckpark_static_geonutzv", "mobilithek_afir_ecomovement", "mobilithek_afir_enbw_stat", "mobilithek_afir_tesla_dyn",
  "mobilithek_afir_vw_dyn", "mobilithek_afir_tesla_stat", "mobilithek_afir_vw_stat", "mobilithek_afir_enbw_dyn", "mobilithek_afir_ecomovement_dyn",
  "mobilithek_afir_eclearing_stat", "mobilithek_afir_eclearing_dyn", "bnetza_lsr", "ocpdb_chargecloud", "ocpdb_taubert",
  "mobilithek_openstation_netex", "mobilithek_openstation_siri_fm", "mobilithek_park_koeln_dyn", "mobilithek_park_nrw_parken",
  "mobilithek_park_christophorus", "mobilithek_park_christophorus_occ", "mobilithek_park_bosch_dyn", "mobilithek_park_trucklounge",
  "mobilithek_park_trucklounge_occ", "mobilithek_park_nrw_pr", "mobilithek_park_bosch_static", "mobilithek_park_koeln_static", "hamburg_park_ride",
  "hamburg_parkhaeuser", "muenster_pls", "mobilithek_park_wuppertal_dyn", "mobilithek_park_dortmund_static", "dortmund_parkhauser",
  "leipzig_pr_belegung", "leipzig_pr_standorte", "gbfs_nextbike", "gbfs_donkey", "kvb_lifts", "viafrei_rules", "viafrei_watch",
];

/** The credits ids that ship with no entry and are not from before the page: what must be drafted. */
export function uncoveredCredits(catalogueIds: readonly string[], entries: readonly NewsEntry[] = [...NEWS_ENTRIES, ...NEWS_DRAFTS], before: readonly string[] = CREDITS_BEFORE_NEWS): string[] {
  const named = new Set([...before, ...entries.flatMap((e) => e.credits)]);
  return catalogueIds.filter((id) => !named.has(id));
}

/** The entries one language can show, newest first; ties by id so two builds agree. */
export function entriesFor(lang: Lang, entries: readonly NewsEntry[] = NEWS_ENTRIES): (NewsEntry & { readonly t: NewsText })[] {
  return entries
    .flatMap((e) => {
      const t = e.text[lang];
      return t === undefined ? [] : [{ ...e, t }];
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.issue - a.issue || a.id.localeCompare(b.id));
}

/** How many entries the home's News strip shows (owner 2026-10-15: "there must be usually 7 news items"). */
export const HOME_NEWS_COUNT = 7;

/**
 * The home strip's entries, most valuable first (owner 2026-10-15: "choose the most valuable integrations and
 * features"): chosen by what a driver gains, not by date. A newer entry is not shown on the home until it is ranked
 * here, but it is on the News page at once.
 */
export const HOME_NEWS: readonly string[] = [
  // #1020: the 2.3 summary leads the home strip; it took the place of "wasserstoff-bruecken-bahnhoefe" (still on the News page)
  "viafrei-2-3",
  "live-antworten-auf-der-seite",
  "autobahn-seiten",
  "autobahn-verkehrsmeldungen",
  "ladepunkte-23-betreiber",
  "parkapi-baden-wuerttemberg",
  "dwd-strassenzustand",
];

/**
 * The home strip in one language: the ranked "new" entries this language has text for, in `HOME_NEWS` order, then the
 * newest other "new" entries until `HOME_NEWS_COUNT`. A plan never: it is not news of something shipped.
 */
export function homeNewsFor(lang: Lang, entries: readonly NewsEntry[] = NEWS_ENTRIES, ranked: readonly string[] = HOME_NEWS): (NewsEntry & { readonly t: NewsText })[] {
  const shipped = entriesFor(lang, entries).filter((e) => e.kind === "new");
  const chosen = ranked.flatMap((id) => shipped.filter((e) => e.id === id));
  const rest = shipped.filter((e) => !ranked.includes(e.id));
  return [...chosen, ...rest].slice(0, HOME_NEWS_COUNT);
}

/** The newest entry's date — the News page's `lastmod` and its feed's `updated`. */
export function newestNewsDate(entries: readonly NewsEntry[] = NEWS_ENTRIES): string {
  return entries.reduce((d, e) => (e.date > d ? e.date : d), "0000-00-00");
}
