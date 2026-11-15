/**
 * The stored consent decision (#1185, data-steward ruling 2026-11-04, R1/R2), with a frozen clock: a refusal stands
 * 180 days, a consent 365, a new write is `decision|YYYY-MM-DD`, the pre-#1185 millisecond form is honoured until it
 * expires, and the islands read and write the key through this module only. The browser half (the bar re-asking on
 * day 180, no outgoing request carrying the value) is `e2e/consent-1185.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONSENT_DAYS,
  CONSENT_KEY,
  REFUSAL_DAYS,
  STORED_FORM,
  ageDays,
  encode,
  formatDay,
  parseStored,
  readStored,
  standing,
  stateOf,
  writeStored,
} from "../src/analytics/consent-store.js";

const DAY = 86_400_000;
/** The decision's day, 2026-01-10, at 23:30 UTC — late, so a day count by milliseconds would differ from one by days. */
const AT = Date.parse("2026-01-10T23:30:00.000Z");
const dayN = (n: number, hourUtc = 0): number => Date.parse("2026-01-10T00:00:00.000Z") + n * DAY + hourUtc * 3_600_000;
const read = (rel: string): string => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

describe("R1: a refusal stands 180 days, a consent 365", () => {
  it("the intervals are the ruling's", () => {
    expect([REFUSAL_DAYS, CONSENT_DAYS]).toEqual([180, 365]);
  });

  it("a refusal: standing on day 179, asked again from day 180 (and on 181)", () => {
    const raw = encode("denied", AT);
    expect(standing(raw, dayN(0, 23))?.decision).toBe("denied");
    expect(standing(raw, dayN(179, 23))?.decision).toBe("denied");
    expect(standing(raw, dayN(180, 0))).toBeNull();
    expect(standing(raw, dayN(181))).toBeNull();
  });

  it("a consent: standing on day 364, asked again from day 365 (and on 366)", () => {
    const raw = encode("granted", AT);
    expect(standing(raw, dayN(181))?.decision).toBe("granted");
    expect(standing(raw, dayN(364, 23))?.decision).toBe("granted");
    expect(standing(raw, dayN(365, 0))).toBeNull();
    expect(standing(raw, dayN(366))).toBeNull();
  });

  it("counts whole UTC days, not 24-hour spans", () => {
    const s = parseStored(encode("denied", AT));
    expect(s).not.toBeNull();
    if (s === null) return;
    expect(ageDays(s, dayN(1, 0))).toBe(1); // 30 minutes after a 23:30 decision is the next day
    expect(ageDays(s, dayN(0, 23))).toBe(0);
  });

  it("a decision dated in the future (a clock set back) still stands: a refusal is never re-asked early", () => {
    expect(standing(encode("denied", dayN(10)), dayN(0))?.decision).toBe("denied");
  });

  it("nothing stored, or something unreadable, is no decision — the bar asks", () => {
    for (const raw of [null, "", "granted", "maybe|2026-01-10", "granted|2026-13-40", "denied|yesterday", "granted|-5", "granted|0"]) expect(standing(raw, dayN(1)), String(raw)).toBeNull();
  });
});

describe("R2: what is stored", () => {
  it("the key, and a new write is the decision and the UTC day only", () => {
    expect(CONSENT_KEY).toBe("viafrei.consent.analytics");
    expect(STORED_FORM.source).toBe("^(granted|denied)\\|\\d{4}-\\d{2}-\\d{2}$");
    for (const d of ["granted", "denied"] as const) {
      const raw = encode(d, AT);
      expect(raw).toMatch(/^(granted|denied)\|\d{4}-\d{2}-\d{2}$/u);
      expect(raw).toBe(`${d}|2026-01-10`);
    }
    // the UTC day, never the Berlin one: 23:30 UTC on the 10th is already the 11th in Berlin
    expect(encode("denied", Date.parse("2026-01-10T23:30:00Z"))).toBe("denied|2026-01-10");
  });

  it("the pre-#1185 millisecond form is honoured until it expires, by its decision's interval", () => {
    const legacyDenied = `denied|${String(AT)}`;
    const legacyGranted = `granted|${String(AT)}`;
    expect(parseStored(legacyDenied)).toEqual({ decision: "denied", day: "2026-01-10" });
    expect(standing(legacyDenied, dayN(179))?.decision).toBe("denied");
    expect(standing(legacyDenied, dayN(180))).toBeNull();
    expect(standing(legacyGranted, dayN(364))?.decision).toBe("granted");
    expect(standing(legacyGranted, dayN(365))).toBeNull();
  });

  it("reading never rewrites: only writeStored writes, and it writes the new form", () => {
    const store = new Map<string, string>([[CONSENT_KEY, `granted|${String(AT)}`]]);
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readStored(storage)).toBe(`granted|${String(AT)}`);
    standing(readStored(storage), dayN(3));
    expect(store.get(CONSENT_KEY)).toBe(`granted|${String(AT)}`);
    writeStored(storage, "denied", dayN(3));
    expect(store.get(CONSENT_KEY)).toBe("denied|2026-01-13");
  });

  it("a blocked storage reads as nothing stored and a write is dropped, never thrown", () => {
    const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };
    expect(readStored(blocked)).toBeNull();
    expect(() => writeStored(blocked, "denied", AT)).not.toThrow();
    expect(readStored(undefined)).toBeNull();
  });

  it("the islands read and write the key through this module only — no other literal of it, no Date.now() form", () => {
    for (const f of ["src/components/Consent.svelte", "src/components/ConsentSettings.svelte", "src/components/ConsentPanel.svelte"]) {
      const s = read(f).replace(/\/\*[\s\S]*?\*\//gu, "");
      expect(s, f).not.toContain("viafrei.consent.analytics");
      expect(s, f).not.toMatch(/localStorage\.setItem|\|\$\{Date\.now\(\)\}/u);
    }
    // and the key is never handed to anything that sends: no fetch, beacon or XHR in the islands
    for (const f of ["src/components/Consent.svelte", "src/components/ConsentSettings.svelte", "src/analytics/consent-store.ts"]) expect(read(f), f).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|document\.cookie\s*=/u);
  });
});

describe("R3: the state sentence", () => {
  it("names none, a refusal or a consent with its day, and nothing once it ran out", () => {
    expect(stateOf(null, AT)).toEqual({ key: "none", day: null });
    expect(stateOf(encode("denied", AT), dayN(5))).toEqual({ key: "denied", day: "2026-01-10" });
    expect(stateOf(encode("granted", AT), dayN(5))).toEqual({ key: "granted", day: "2026-01-10" });
    expect(stateOf(encode("denied", AT), dayN(180))).toEqual({ key: "none", day: null });
  });

  it("writes the day in the page's language, and the stored day — not the day before in a western time zone", () => {
    expect(formatDay("2026-01-10", "de")).toBe("10. Januar 2026");
    expect(formatDay("2026-01-10", "en")).toBe("January 10, 2026");
    expect(formatDay("2026-01-10", "not a language tag!")).toBe("2026-01-10");
  });

  it("the catalogues carry the ruling's sentences, verbatim in German and English", () => {
    const de = JSON.parse(read("src/i18n/de.json")) as { consent: { state: Record<string, string> } };
    const en = JSON.parse(read("src/i18n/en.json")) as { consent: { state: Record<string, string> } };
    expect(de.consent.state).toEqual({ none: "Sie haben noch keine Entscheidung getroffen.", denied: "Ihre aktuelle Entscheidung: abgelehnt am {date}.", granted: "Ihre aktuelle Entscheidung: eingewilligt am {date}." });
    expect(en.consent.state).toEqual({ none: "You have not made a choice yet.", denied: "Your current choice: declined on {date}.", granted: "Your current choice: agreed on {date}." });
  });
});
