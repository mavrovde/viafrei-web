/**
 * #1224: the one ask-again of a part the digest did not answer, on a fake clock — when it asks, how long it waits,
 * when it stops — and the shell's rule for which status is "did not answer".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askAgain, didNotAnswer, RETRY_WAITS_MS } from "../src/lib/fragment-retry.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";

const notAnswered = (_r: unknown, u: boolean): boolean => u;

describe("askAgain (#1224)", () => {
  it("hands `again` exactly didNotAnswer's verdict for no answer, a 200, a 404, a 500 and a 503", async () => {
    for (const status of [null, 200, 404, 500, 503]) {
      let seen: boolean | undefined;
      await askAgain(globalThis, () => Promise.resolve(status === null ? null : { status }), (_r, u) => ((seen = u), false), [], false);
      expect(seen, String(status)).toBe(didNotAnswer(status));
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** An ask answering `answers` in order (the last repeated), recording the fake clock at each ask. */
  const asker = (answers: (number | "reject")[]) => {
    const at: number[] = [];
    const ask = (): Promise<unknown> => {
      at.push(Date.now());
      const a = answers.length > 1 ? answers.shift() : answers[0];
      return a === "reject" ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve({ status: a });
    };
    return { at, ask };
  };

  it("asks at once, and again after each wait while the answer is not final; the final answer ends it", async () => {
    const t0 = Date.now();
    const a = asker([503, "reject", 200]);
    const done = askAgain(globalThis, a.ask, notAnswered, RETRY_WAITS_MS, false);
    await vi.advanceTimersByTimeAsync(0);
    expect(a.at.map((t) => t - t0)).toEqual([0]);
    await vi.advanceTimersByTimeAsync(RETRY_WAITS_MS[0]! - 1);
    expect(a.at).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(a.at).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(RETRY_WAITS_MS[1]!);
    await expect(done).resolves.toEqual({ status: 200 });
    expect(a.at.map((t) => t - t0)).toEqual([0, RETRY_WAITS_MS[0], RETRY_WAITS_MS[0]! + RETRY_WAITS_MS[1]!]);
  });

  it("spends 1 + waits.length asks, then resolves with the last answer — a rejection being null", async () => {
    const a = asker(["reject"]);
    const done = askAgain(globalThis, a.ask, notAnswered, RETRY_WAITS_MS, false);
    await vi.advanceTimersByTimeAsync(RETRY_WAITS_MS.reduce((x, y) => x + y, 0));
    await expect(done).resolves.toBeNull();
    expect(a.at).toHaveLength(1 + RETRY_WAITS_MS.length);
  });

  it("waitFirst: a part already printed as loading waits the first wait before its first ask", async () => {
    const a = asker([503]);
    const done = askAgain(globalThis, a.ask, notAnswered, RETRY_WAITS_MS, true);
    await vi.advanceTimersByTimeAsync(RETRY_WAITS_MS[0]! - 1);
    expect(a.at).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(RETRY_WAITS_MS.reduce((x, y) => x + y, 0));
    await expect(done).resolves.toEqual({ status: 503 });
    expect(a.at).toHaveLength(RETRY_WAITS_MS.length);
  });

  it("an `again` that says stop (a newer ask, a replaced placeholder) ends the asking with that answer", async () => {
    let current = true;
    const a = asker([503]);
    const done = askAgain(globalThis, a.ask, (r, u) => current && notAnswered(r, u), RETRY_WAITS_MS, false);
    await vi.advanceTimersByTimeAsync(0);
    current = false;
    await vi.advanceTimersByTimeAsync(RETRY_WAITS_MS[0]!);
    await expect(done).resolves.toEqual({ status: 503 });
    expect(a.at).toHaveLength(2);
  });

  it("the waits are the station parts' waits of 2.4.6: three more asks, the last about six seconds after the first", () => {
    expect([...RETRY_WAITS_MS]).toEqual([400, 1500, 4000]);
  });

  it("ships minified as the `retry` inline script, one self-contained expression", () => {
    expect(INLINE_SCRIPTS.retry).toMatch(/^\(async function/);
    expect(INLINE_SCRIPTS.retry).not.toMatch(/\bimport\b|\brequire\(|__name\(/);
  });
});

describe("didNotAnswer (#1224): which status is a digest that did not answer", () => {
  it("no status and every 5xx did not answer; a 2xx, 3xx or 4xx is an answer", () => {
    for (const s of [null, 500, 502, 503, 504]) expect(didNotAnswer(s), String(s)).toBe(true);
    for (const s of [200, 204, 301, 400, 404, 429]) expect(didNotAnswer(s), String(s)).toBe(false);
  });
});
