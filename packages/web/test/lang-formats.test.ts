/**
 * The shell's dates in the fifteen languages of #753: a release day and a
 * Berlin date-time, each through `Intl` with the language's tag (`TAGS`), each
 * pinned to the form a reader of that language writes ("21 de outubro de
 * 2026", "2026. gada 21. oktobris", "21. октобар 2026."). Croatian's
 * "listopada" and Serbian's Cyrillic "октобар" are the reason the tag is not
 * just the code: `sr` with no script would be right today by default only.
 */
import { describe, expect, it } from "vitest";
import { berlinDateTime, calendarDay } from "../src/lib/dates.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

const WANT: Readonly<Record<string, { readonly day: string; readonly at: string }>> = {
  fr: { day: "21 octobre 2026", at: "13 octobre 2026 à 16:58" },
  es: { day: "21 de octubre de 2026", at: "13 de octubre de 2026 a las 16:58" },
  nl: { day: "21 oktober 2026", at: "13 oktober 2026 om 16:58" },
  pl: { day: "21 października 2026", at: "13 października 2026 16:58" },
  it: { day: "21 ottobre 2026", at: "13 ottobre 2026 alle ore 16:58" },
  lt: { day: "2026 m. spalio 21 d.", at: "2026 m. spalio 13 d. 16:58" },
  cs: { day: "21. října 2026", at: "13. října 2026 v 16:58" },
  hu: { day: "2026. október 21.", at: "2026. október 13. 16:58" },
  sk: { day: "21. októbra 2026", at: "13. októbra 2026 o 16:58" },
  da: { day: "21. oktober 2026", at: "13. oktober 2026 kl. 16.58" },
  pt: { day: "21 de outubro de 2026", at: "13 de outubro de 2026 às 16:58" },
  hr: { day: "21. listopada 2026.", at: "13. listopada 2026. u 16:58" },
  sr: { day: "21. октобар 2026.", at: "13. октобар 2026. 16:58" },
  el: { day: "21 Οκτωβρίου 2026", at: "13 Οκτωβρίου 2026 στις 16:58" },
  lv: { day: "2026. gada 21. oktobris", at: "2026. gada 13. oktobris 16:58" },
};

describe("dates in the languages of #753", () => {
  it("has an expectation for each of the fifteen", () => {
    expect(Object.keys(WANT)).toHaveLength(15);
  });
  for (const lang of LIVE_LANGS.slice(7) as readonly Lang[]) {
    const l: string = lang;
    it(`${l}: a release day and a Berlin date-time (UTC stored, Berlin rendered)`, () => {
      expect(calendarDay("2026-10-21", lang)).toBe(WANT[l]?.day);
      expect(berlinDateTime(new Date("2026-10-13T14:58:00Z"), lang)).toBe(WANT[l]?.at);
    });
  }
});
