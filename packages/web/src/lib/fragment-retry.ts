/**
 * #1224: ONE rule for a part of a page the digest did not answer — the object pages' around block and a station page's
 * parts (2.4.6, `REFRESH_JS`), the location island's place cards and the page's filler (`lib/fill.ts`): the part keeps its
 * loading state and is asked again after `RETRY_WAITS_MS`, and says its error sentence only once those waits are spent.
 *
 * Two halves, one home:
 *  - the shell's side: `didNotAnswer` — no status (a deadline, a refused connection) or a 5xx is a digest that did not
 *    answer, which a page shows as loading; any other status is an answer (a 404 is "no such thing", final);
 *  - the browser's side: `askAgain`, the one fetch-and-retry, serialised into each inline script that asks a part again
 *    (`scripts/inline-min.ts` ships it minified as the `retry` inline script; `REFRESH_JS` carries its source).
 */

/** The waits before each new ask, ms: three more asks, the last about six seconds after the first. Measured at 2.4.6. */
export const RETRY_WAITS_MS: readonly number[] = [400, 1500, 4000];

/** Whether a fragment's status is a digest (or shell) that did not answer — asked again — rather than an answer. */
export function didNotAnswer(status: number | null): boolean {
  return status === null || status >= 500;
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- runs in a browser, serialised with `toString`; `w` is the page's window */
/**
 * Ask `ask()` until `again(answer)` says the answer is final, waiting `waits[n]` before each new ask (and before the
 * first, when `waitFirst`: a part the server already printed as loading has been asked once). A rejected ask is the
 * answer `null` (no answer at all). `again` is handed, beside the answer, whether it is a response the digest did not
 * answer — `didNotAnswer`'s rule, the one browser copy of it (pinned equal by `fragment-retry.test.ts`) — so a caller
 * never writes the rule again. Resolves with the last answer — the final one, or the last of the spent asks.
 *
 * Self-contained ON PURPOSE: it references only its parameters, so its `toString` runs alone in a page.
 */
export async function askAgain(w: any, ask: () => Promise<unknown>, again: (answer: unknown, unanswered: boolean) => boolean, waits: readonly number[], waitFirst: boolean): Promise<unknown> {
  let last: unknown = null;
  for (let n = waitFirst ? 0 : -1; n < waits.length; n += 1) {
    if (n >= 0) await new Promise((r) => w.setTimeout(r, waits[n]));
    try {
      last = await ask();
    } catch {
      last = null;
    }
    if (!again(last, last === null || (last as any).status >= 500)) return last;
  }
  return last;
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
