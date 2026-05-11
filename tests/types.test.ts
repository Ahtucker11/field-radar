import { describe, it, expect } from "vitest";
import { EventCreateSchema, EventDbSchema, TierEnum, LocationEnum } from "@/lib/types";

describe("EventCreateSchema", () => {
  it("accepts a minimal valid event", () => {
    const result = EventCreateSchema.safeParse({
      name: "Cincy AI Week",
      start_date: "2026-06-09",
      tier: "tier-1",
      location: "loc-cin",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown tier", () => {
    const result = EventCreateSchema.safeParse({
      name: "X",
      start_date: "2026-06-09",
      tier: "tier-4",
      location: "loc-cin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed start_date", () => {
    const result = EventCreateSchema.safeParse({
      name: "X",
      start_date: "June 9",
      tier: "tier-1",
      location: "loc-cin",
    });
    expect(result.success).toBe(false);
  });
});

describe("EventDbSchema", () => {
  it("requires source and confirmed", () => {
    const result = EventDbSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      name: "X",
      start_date: "2026-06-09",
      tier: "tier-1",
      location: "loc-cin",
      source: "manual",
      confirmed: true,
      created_at: "2026-05-11T00:00:00Z",
      updated_at: "2026-05-11T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("TierEnum", () => {
  it("contains the three tiers", () => {
    expect(TierEnum.options).toEqual(["tier-1", "tier-2", "tier-3"]);
  });
});

describe("LocationEnum", () => {
  it("contains the five locations", () => {
    expect(LocationEnum.options).toEqual([
      "loc-chi", "loc-cin", "loc-cmh", "loc-ind", "loc-rec",
    ]);
  });
});
