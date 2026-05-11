import { z } from "zod";

export const TierEnum = z.enum(["tier-1", "tier-2", "tier-3"]);
export type Tier = z.infer<typeof TierEnum>;

export const LocationEnum = z.enum(["loc-chi", "loc-cin", "loc-cmh", "loc-ind", "loc-rec"]);
export type Location = z.infer<typeof LocationEnum>;

export const SourceEnum = z.enum(["manual", "scout"]);
export type Source = z.infer<typeof SourceEnum>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const EventCreateSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  start_date: isoDate,
  end_date: isoDate.optional().nullable(),
  tier: TierEnum,
  location: LocationEnum,
  notes: z.string().optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal("")),
  source: SourceEnum.optional(),
  scout_run_id: z.string().uuid().optional().nullable(),
  confirmed: z.boolean().optional(),
});
export type EventCreate = z.infer<typeof EventCreateSchema>;

export const EventDbSchema = EventCreateSchema.extend({
  id: z.string().uuid(),
  source: SourceEnum,
  confirmed: z.boolean(),
  dismissed_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type EventDb = z.infer<typeof EventDbSchema>;

export const ScoutEventSchema = EventCreateSchema.extend({
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});
export type ScoutEvent = z.infer<typeof ScoutEventSchema>;
