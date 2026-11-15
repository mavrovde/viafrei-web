/**
 * #1181 feature 5 ("Frag deine KI"): the page's two or three prefilled questions, each with a link that opens it in
 * ChatGPT and in Claude and a copy button. The first question is the connect page's own (`askQuestion`), so the box,
 * the "Weiter" row and the connect page ask the same thing; the others are what the page's data answers next.
 *
 * Data terms: no question names a fuel price or any Tankerkönig figure (the MTS-K data is consumer information and
 * is not redistributed, not even as a question) — `test/ask-ai-1181.test.ts` refuses one in every language.
 *
 * The copy script is progressive enhancement like `code-copy.ts`: the buttons stay `hidden` without it or without
 * `navigator.clipboard`, and it fires NO analytics event — the closed list (`analytics/events.ts`) gains one only on
 * the owner's word.
 */
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { askQuestion, type AskAbout } from "./next-step.js";

/** The assistants a question opens in, with the address that takes a prefilled prompt. */
export const AI_APPS = [
  { id: "chatgpt", name: "ChatGPT", base: "https://chatgpt.com/?q=" },
  { id: "claude", name: "Claude", base: "https://claude.ai/new?q=" },
] as const;
export type AiApp = (typeof AI_APPS)[number];

/** At most this many questions stand in a box. */
export const AI_QUESTIONS_MAX = 3;

/** The questions for a subject, in the page's language: the connect page's first, then the two its data answers next. */
export function aiQuestions(lang: Lang, a: AskAbout): readonly string[] {
  const first = askQuestion(lang, a);
  if (a.kind === "place") return [first, t(lang, "ai.placeWarn", { place: a.place }), t(lang, "ai.placePark", { place: a.place })];
  // #1182: a Land page asks about the Land's motorways, which its page counts, instead of where to park in it
  if (a.kind === "land") return [first, t(lang, "ai.placeWarn", { place: a.place }), t(lang, "ai.landRoads", { place: a.place })];
  return [first, t(lang, "ai.roadUsual", { road: a.road }), t(lang, "ai.roadPlans", { road: a.road })];
}

/** The address that opens `question` in `app`. */
export function aiHref(app: AiApp, question: string): string {
  return `${app.base}${encodeURIComponent(question)}`;
}

export const ASK_AI = "askai";
export const ASK_AI_COPY = "askai__copy";
export const ASK_AI_COPIED = "is-copied";

/** Reveals the copy buttons and copies a row's question; no event, no storage. Idempotent (`window.vfAsk`). */
export function askCopyScript(): string {
  const btn = `.${ASK_AI_COPY}`;
  return (
    `(()=>{const w=window;if(w.vfAsk||!navigator.clipboard)return;w.vfAsk=1;` +
    `for(const b of document.querySelectorAll(${JSON.stringify(btn)}))b.hidden=false;` +
    `document.addEventListener("click",async e=>{const b=e.target instanceof Element?e.target.closest(${JSON.stringify(btn)}):null;if(!b)return;` +
    `const r=b.closest("li"),q=r&&r.querySelector("q");if(!q)return;` +
    `try{await navigator.clipboard.writeText((q.textContent||"").trim())}catch(_){return}` +
    `const s=r.querySelector('[role="status"]');r.classList.add(${JSON.stringify(ASK_AI_COPIED)});if(s)s.textContent=b.value||"";` +
    `clearTimeout(r.vfT);r.vfT=setTimeout(()=>{r.classList.remove(${JSON.stringify(ASK_AI_COPIED)});if(s)s.textContent=""},2500)})})();`
  );
}
