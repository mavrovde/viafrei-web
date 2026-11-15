/**
 * #746: a recorded example goes stale. Every answer the site prints from a
 * recording — the home's moments (q1-q3), the fuel requests under the fuel
 * tile and the connect page's cards — carries the "Stand" it was asked at
 * (`values.asOf`, Europe/Berlin, "DD.MM.YYYY, HH:MM"), and this test fails
 * when any of them is more than FOURTEEN DAYS old, measured against the REAL
 * clock of the run, never a pinned one: a build two weeks after the last
 * re-ask goes red until a release asks production again (the brief of #746:
 * "re-ask every example on production, once each"). The fix is a re-ask and a
 * new date, never a longer limit.
 */
import { describe, expect, it } from "vitest";
import { FUEL_ASKS, MOMENTS, type MomentAnswer } from "../src/site/examples.js";
import { LIVE_EXAMPLES } from "../src/site/live-examples.js";

const MAX_AGE_DAYS = 14;

/** "16.10.2026, 21:13" (Europe/Berlin wall clock) → the instant. Berlin is UTC+1 or UTC+2; the hour of slack is the stricter side. */
function asOfInstant(asOf: string): Date {
  const m = /^(\d\d)\.(\d\d)\.(\d{4}), (\d\d):(\d\d)$/.exec(asOf);
  if (m === null) throw new Error(`not a "DD.MM.YYYY, HH:MM" Stand: ${asOf}`);
  const [, d, mo, y, h, mi] = m;
  // read as UTC+2 (summer time): an instant at most one hour EARLIER than the real one, so never younger than it is
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - 2, Number(mi)));
}

const recorded: readonly (readonly [string, string])[] = [
  ...MOMENTS.flatMap((m) => m.answers.map((a: MomentAnswer, i): [string, string] => [`moment ${m.key} a${String(i + 1)}`, a.values.asOf])),
  ...FUEL_ASKS.map((f): [string, string] => [`fuel request ${f.key}`, f.answer.values.asOf]),
  ...LIVE_EXAMPLES.map((e): [string, string] => [`connect card ${e.key}`, e.values["asOf"] ?? ""]),
];

describe(`every recorded example is at most ${String(MAX_AGE_DAYS)} days old, against the real clock (#746)`, () => {
  it("reads a date from every example — a gate over nothing passes nothing (§5b)", () => {
    expect(recorded.length).toBe(MOMENTS.length * 3 + FUEL_ASKS.length + LIVE_EXAMPLES.length);
    expect(recorded.length).toBeGreaterThan(50);
  });

  it("parses the Stand as Berlin time, never younger than it is", () => {
    expect(asOfInstant("16.10.2026, 21:13").toISOString()).toBe("2026-10-16T19:13:00.000Z");
    expect(() => asOfInstant("2026-10-16")).toThrow();
  });

  for (const [what, asOf] of recorded) {
    it(`${what}: asked ${asOf}`, () => {
      const age = Date.now() - asOfInstant(asOf).getTime();
      expect(age, `${what} was asked in the future (${asOf})`).toBeGreaterThan(-60 * 60_000);
      expect(age / 86_400_000, `${what} is ${(age / 86_400_000).toFixed(1)} days old (${asOf}): re-ask production`).toBeLessThanOrEqual(MAX_AGE_DAYS);
    });
  }
});
