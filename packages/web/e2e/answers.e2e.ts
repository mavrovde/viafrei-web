/**
 * Every example question on the rendered pages carries its own answer
 * directly beneath it (owner 2026-10-05: "All example requests must have the
 * right response! Not only first."). Read from the BROWSER, so what a reader
 * sees is what is judged: every question element — a `.ask` (the moments, the
 * fuel requests, the connect page's five, the business cases) and a live
 * card's `.answer__q` — must be followed by its answer block as the very next
 * element (`.qa-answer`, `.answer__a`), that block must carry words and a
 * credit line, and the two counts must be equal and above zero on every page.
 * The page data is held to the same rule by `test/answers.test.ts`.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { gotoSettled } from "./settle.js";
import { startStubDigest } from "./stub-digest.js";
import { startAsksStub } from "./asks-stub.js";

const PORT = 8807;
let browser: Browser;
let shell: ChildProcess | undefined;
let stub: Awaited<ReturnType<typeof startStubDigest>> | undefined;
let asks: Awaited<ReturnType<typeof startAsksStub>> | undefined;

beforeAll(async () => {
  browser = await chromium.launch();
  stub = await startStubDigest();
  // #744: with production's live assistant answers, so the "Heute" pairs are held to the same rule as every question
  asks = await startAsksStub();
  shell = await startShell(PORT, { DIGEST_URL: stub.url, MCP_INTERNAL_URL: asks.url });
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
  await asks?.close();
});

type Tally = { questions: number; answers: number; bare: string[] };

describe("every example question has its own answer directly beneath it", () => {
  for (const path of ["/de", "/en", "/de/connect", "/en/connect", "/de/business", "/en/business"]) {
    it(`${path}: questions and answers are equal and above zero, each answer right after its question`, async () => {
      const page = await browser.newPage();
      await gotoSettled(page, `http://127.0.0.1:${PORT}${path}`);
      const tally: Tally = await page.evaluate(() => {
        const bare: string[] = [];
        let questions = 0;
        let answers = 0;
        const pairs: [string, string][] = [
          [".ask", "qa-answer"],
          [".answer__q", "answer__a"],
        ];
        for (const [q, a] of pairs) {
          for (const el of Array.from(document.querySelectorAll(q))) {
            questions += 1;
            const next = el.nextElementSibling;
            const text = (el.textContent ?? "").trim().slice(0, 60);
            if (next === null || !next.classList.contains(a)) {
              bare.push(`${q} "${text}" → ${next === null ? "nothing" : `${next.tagName}.${next.className}`}`);
              continue;
            }
            const words = (next.querySelector(".qa-answer__text, .answer__text, pre, p")?.textContent ?? next.textContent ?? "").trim();
            if (words.length < 20) bare.push(`${q} "${text}" → an answer with no words`);
            else answers += 1;
          }
        }
        // and every answer block answers a question: none stands alone
        for (const [, a] of pairs) for (const el of Array.from(document.querySelectorAll(`.${a}`))) if (el.previousElementSibling === null) bare.push(`.${a} with no question before it`);
        return { questions, answers, bare };
      });
      await page.close();
      expect(tally.bare, path).toEqual([]);
      expect(tally.questions, path).toBeGreaterThan(0);
      expect(tally.answers, path).toBe(tally.questions);
    });
  }

  it("the home answers all 27 moment questions and its one fuel request (#746; data-steward Verdict 2 caps the site at three Tankerkönig examples: three per moment, the first live where the engine asks it); each block carries a credit line", async () => {
    const page = await browser.newPage();
    await gotoSettled(page, `http://127.0.0.1:${PORT}/de`);
    const [moments, fuel, credited] = await page.evaluate(() => [
      document.querySelectorAll(".moment .ask + .qa-answer").length - document.querySelectorAll(".fuelasks .ask + .qa-answer").length,
      document.querySelectorAll(".fuelasks .ask + .qa-answer").length,
      Array.from(document.querySelectorAll(".qa-answer")).every((a) => a.querySelector(".qa-answer__credits li") !== null),
    ]);
    await page.close();
    expect(moments).toBe(27);
    expect(fuel).toBe(1);
    expect(credited).toBe(true);
  });

  it("#744: the Wegweiser and the moments' live first questions carry a live answer, each with its tool, its time and a credit line per source (#990: in the moments, no longer beside the facts)", async () => {
    const page = await browser.newPage();
    await gotoSettled(page, `http://127.0.0.1:${PORT}/de`);
    const r = await page.evaluate(() => ({
      sign: document.querySelector("figure.sign")?.getAttribute("data-live"),
      signState: document.querySelector("figure.sign")?.className,
      inNow: document.querySelectorAll("#now .live-ask").length,
      pairs: Array.from(document.querySelectorAll("#day .moment .live-ask")).map((p) => ({
        key: p.getAttribute("data-ask"),
        answered: p.querySelector(".ask + .qa-answer.live-ask__answer") !== null,
        tool: p.querySelector(".qa-answer__head code")?.textContent ?? "",
        time: p.querySelector(".qa-answer__head time")?.getAttribute("datetime") ?? "",
        credits: p.querySelectorAll(".qa-answer__credits li").length,
      })),
    }));
    await page.close();
    expect(r.sign).toBe("1");
    // The stub's answers are four minutes old: fresh, like the cards beside them (2.1.18 review).
    expect(r.signState).toContain("is-ok");
    expect(r.pairs.map((p) => p.key)).toEqual(["transit", "roads", "parking", "charging"]);
    expect(r.inNow).toBe(0);
    for (const p of r.pairs) {
      expect(p.answered, p.key ?? "").toBe(true);
      expect(p.tool).toMatch(/^[a-z_]+$/);
      expect(Number.isNaN(Date.parse(p.time))).toBe(false);
      expect(p.credits, p.key ?? "").toBeGreaterThan(0);
    }
  });
});
