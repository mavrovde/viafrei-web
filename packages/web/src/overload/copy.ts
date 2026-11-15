/**
 * #1184 phase 2 (ruling P6): the interim page's two sentences in every live language, and (#1205) the "try again" link shown when the guarded reload stops. German and English are the
 * steward's text, verbatim (`test/overload.test.ts` pins them); the others are machine translations of the English
 * (owner 2026-10-15: automatic translation is trusted for new languages).
 */
import type { Lang } from "../site/pages.js";

export const CHALLENGE_COPY: Readonly<Record<Lang, { readonly line: string; readonly noscript: string; readonly retry: string }>> = {
  de: {
    line: "Einen Moment – die Seite wird geladen.",
    noscript: "Unser Server ist gerade stark ausgelastet. Um die Seite zu laden, braucht Ihr Browser JavaScript für eine kurze Prüfung; ohne JavaScript versuchen Sie es bitte in einigen Minuten erneut.",
    retry: "Erneut versuchen",
  },
  en: {
    line: "One moment – the page is loading.",
    noscript: "Our server is under heavy load right now. To load the page, your browser needs JavaScript for a short check; without JavaScript, please try again in a few minutes.",
    retry: "Try again",
  },
  ru: {
    line: "Одну минуту – страница загружается.",
    noscript: "Наш сервер сейчас сильно загружен. Чтобы загрузить страницу, вашему браузеру нужен JavaScript для короткой проверки; без JavaScript попробуйте, пожалуйста, ещё раз через несколько минут.",
    retry: "Попробовать снова",
  },
  bg: {
    line: "Един момент – страницата се зарежда.",
    noscript: "Нашият сървър в момента е силно натоварен. За да зареди страницата, браузърът ви се нуждае от JavaScript за кратка проверка; без JavaScript, моля, опитайте отново след няколко минути.",
    retry: "Опитайте отново",
  },
  uk: {
    line: "Одну хвилину – сторінка завантажується.",
    noscript: "Наш сервер зараз дуже завантажений. Щоб завантажити сторінку, вашому браузеру потрібен JavaScript для короткої перевірки; без JavaScript спробуйте, будь ласка, ще раз за кілька хвилин.",
    retry: "Спробувати знову",
  },
  ro: {
    line: "Un moment – pagina se încarcă.",
    noscript: "Serverul nostru este foarte solicitat în acest moment. Pentru a încărca pagina, browserul dumneavoastră are nevoie de JavaScript pentru o scurtă verificare; fără JavaScript, vă rugăm să încercați din nou peste câteva minute.",
    retry: "Încercați din nou",
  },
  tr: {
    line: "Bir dakika – sayfa yükleniyor.",
    noscript: "Sunucumuz şu anda yoğun yük altında. Sayfayı yüklemek için tarayıcınızın kısa bir kontrol için JavaScript'e ihtiyacı var; JavaScript olmadan lütfen birkaç dakika sonra tekrar deneyin.",
    retry: "Tekrar dene",
  },
  fr: {
    line: "Un instant – la page se charge.",
    noscript: "Notre serveur est actuellement très sollicité. Pour charger la page, votre navigateur a besoin de JavaScript pour une courte vérification ; sans JavaScript, veuillez réessayer dans quelques minutes.",
    retry: "Réessayer",
  },
  es: {
    line: "Un momento – la página se está cargando.",
    noscript: "Nuestro servidor está muy cargado en este momento. Para cargar la página, su navegador necesita JavaScript para una breve comprobación; sin JavaScript, vuelva a intentarlo dentro de unos minutos.",
    retry: "Volver a intentarlo",
  },
  nl: {
    line: "Een ogenblik – de pagina wordt geladen.",
    noscript: "Onze server is op dit moment zwaar belast. Om de pagina te laden heeft uw browser JavaScript nodig voor een korte controle; zonder JavaScript kunt u het over een paar minuten opnieuw proberen.",
    retry: "Opnieuw proberen",
  },
  pl: {
    line: "Chwileczkę – strona się wczytuje.",
    noscript: "Nasz serwer jest teraz mocno obciążony. Aby wczytać stronę, Twoja przeglądarka potrzebuje JavaScriptu do krótkiego sprawdzenia; bez JavaScriptu spróbuj ponownie za kilka minut.",
    retry: "Spróbuj ponownie",
  },
  it: {
    line: "Un momento – la pagina si sta caricando.",
    noscript: "Il nostro server è al momento molto carico. Per caricare la pagina, il tuo browser ha bisogno di JavaScript per un breve controllo; senza JavaScript, riprova tra qualche minuto.",
    retry: "Riprova",
  },
  lt: {
    line: "Akimirką – puslapis įkeliamas.",
    noscript: "Mūsų serveris šiuo metu labai apkrautas. Kad įkeltų puslapį, jūsų naršyklei reikia „JavaScript“ trumpam patikrinimui; be „JavaScript“ bandykite dar kartą po kelių minučių.",
    retry: "Bandyti dar kartą",
  },
  cs: {
    line: "Okamžik – stránka se načítá.",
    noscript: "Náš server je právě silně vytížen. K načtení stránky potřebuje váš prohlížeč JavaScript pro krátkou kontrolu; bez JavaScriptu to prosím zkuste znovu za několik minut.",
    retry: "Zkusit znovu",
  },
  hu: {
    line: "Egy pillanat – az oldal betöltődik.",
    noscript: "Szerverünk jelenleg erősen leterhelt. Az oldal betöltéséhez böngészőjének JavaScriptre van szüksége egy rövid ellenőrzéshez; JavaScript nélkül kérjük, próbálja újra néhány perc múlva.",
    retry: "Újrapróbálkozás",
  },
  sk: {
    line: "Okamih – stránka sa načítava.",
    noscript: "Náš server je práve silne vyťažený. Na načítanie stránky potrebuje váš prehliadač JavaScript na krátku kontrolu; bez JavaScriptu to prosím skúste znova o niekoľko minút.",
    retry: "Skúsiť znova",
  },
  da: {
    line: "Et øjeblik – siden indlæses.",
    noscript: "Vores server er meget belastet lige nu. For at indlæse siden skal din browser bruge JavaScript til en kort kontrol; uden JavaScript bedes du prøve igen om nogle minutter.",
    retry: "Prøv igen",
  },
  pt: {
    line: "Um momento – a página está a carregar.",
    noscript: "O nosso servidor está muito sobrecarregado neste momento. Para carregar a página, o seu navegador precisa de JavaScript para uma breve verificação; sem JavaScript, tente novamente dentro de alguns minutos.",
    retry: "Tentar novamente",
  },
  hr: {
    line: "Trenutak – stranica se učitava.",
    noscript: "Naš je poslužitelj trenutačno jako opterećen. Za učitavanje stranice vaš preglednik treba JavaScript za kratku provjeru; bez JavaScripta pokušajte ponovno za nekoliko minuta.",
    retry: "Pokušajte ponovno",
  },
  sr: {
    line: "Trenutak – stranica se učitava.",
    noscript: "Naš server je trenutno veoma opterećen. Da bi učitao stranicu, vašem pregledaču je potreban JavaScript za kratku proveru; bez JavaScripta pokušajte ponovo za nekoliko minuta.",
    retry: "Pokušajte ponovo",
  },
  el: {
    line: "Μια στιγμή – η σελίδα φορτώνεται.",
    noscript: "Ο διακομιστής μας είναι αυτή τη στιγμή ιδιαίτερα επιβαρυμένος. Για να φορτώσει η σελίδα, το πρόγραμμα περιήγησής σας χρειάζεται JavaScript για έναν σύντομο έλεγχο· χωρίς JavaScript, δοκιμάστε ξανά σε λίγα λεπτά.",
    retry: "Δοκιμάστε ξανά",
  },
  lv: {
    line: "Mirkli – lapa tiek ielādēta.",
    noscript: "Mūsu serveris pašlaik ir ļoti noslogots. Lai ielādētu lapu, jūsu pārlūkam īsai pārbaudei vajadzīgs JavaScript; bez JavaScript, lūdzu, mēģiniet vēlreiz pēc dažām minūtēm.",
    retry: "Mēģināt vēlreiz",
  },
};
