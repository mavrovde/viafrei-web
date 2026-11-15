import { describe, expect, it } from "vitest";
import { berlinDateTime, berlinTime } from "../src/lib/dates.js";

// 2026-10-25 01:00 UTC is the last hour of CEST (UTC+2 → 03:00), the switch is
// at 01:00 UTC; 02:00 UTC is already CET (UTC+1 → 03:00 again).
describe("Berlin wall time around the CEST → CET switch (#380)", () => {
  it("summer time: 00:30 UTC → 02:30", () => {
    expect(berlinTime(new Date("2026-10-25T00:30:00Z"), "de")).toBe("02:30");
    expect(berlinTime(new Date("2026-10-25T00:30:00Z"), "en")).toBe("02:30");
  });
  it("winter time: 02:30 UTC → 03:30", () => {
    expect(berlinTime(new Date("2026-10-25T02:30:00Z"), "de")).toBe("03:30");
  });
  it("a date and time in both languages, Berlin zone", () => {
    expect(berlinDateTime(new Date("2026-03-29T00:30:00Z"), "de")).toBe("29. März 2026 um 01:30");
    expect(berlinDateTime(new Date("2026-03-29T01:30:00Z"), "en")).toBe("29 March 2026 at 03:30");
  });
});
