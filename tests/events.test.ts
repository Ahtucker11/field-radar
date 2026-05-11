import { describe, it, expect } from "vitest";
import { normalizeName, isDuplicate } from "@/lib/events";
import type { EventDb } from "@/lib/types";

describe("normalizeName", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  Cincy AI Week  ")).toBe("cincy ai week");
  });

  it("strips punctuation", () => {
    expect(normalizeName("AI + Robotics Summit @ 1819")).toBe("ai robotics summit 1819");
  });

  it("collapses whitespace", () => {
    expect(normalizeName("Data    Council\t—  Gleacher")).toBe("data council gleacher");
  });
});

const baseEvent = (overrides: Partial<EventDb> = {}): EventDb => ({
  id: "00000000-0000-0000-0000-000000000001",
  name: "Cincy AI Week",
  start_date: "2026-06-09",
  tier: "tier-1",
  location: "loc-cin",
  source: "manual",
  confirmed: true,
  created_at: "2026-05-11T00:00:00Z",
  updated_at: "2026-05-11T00:00:00Z",
  ...overrides,
});

describe("isDuplicate", () => {
  it("flags identical name and date", () => {
    const existing = [baseEvent()];
    const candidate = { name: "Cincy AI Week", start_date: "2026-06-09" };
    expect(isDuplicate(candidate, existing)).toBe(true);
  });

  it("flags near-identical name on the same date (Levenshtein <= 3)", () => {
    const existing = [baseEvent({ name: "Cincy AI Week" })];
    const candidate = { name: "Cincy AI Wek", start_date: "2026-06-09" };
    expect(isDuplicate(candidate, existing)).toBe(true);
  });

  it("does not flag same name on different date", () => {
    const existing = [baseEvent()];
    const candidate = { name: "Cincy AI Week", start_date: "2026-07-09" };
    expect(isDuplicate(candidate, existing)).toBe(false);
  });

  it("does not flag different names on same date", () => {
    const existing = [baseEvent({ name: "Cincy AI Week" })];
    const candidate = { name: "TechChicago Week", start_date: "2026-06-09" };
    expect(isDuplicate(candidate, existing)).toBe(false);
  });
});
