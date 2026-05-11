import type { EventDb, EventCreate } from "@/lib/types";
import { supabaseAnon, supabaseAdmin } from "@/lib/supabase";
import { EventCreateSchema } from "@/lib/types";

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

export function isDuplicate(
  candidate: { name: string; start_date: string },
  existing: Pick<EventDb, "name" | "start_date">[],
): boolean {
  const cName = normalizeName(candidate.name);
  return existing.some((e) => {
    if (e.start_date !== candidate.start_date) return false;
    const eName = normalizeName(e.name);
    if (eName === cName) return true;
    return levenshtein(eName, cName) <= 3;
  });
}

export async function listActiveEvents(): Promise<EventDb[]> {
  const { data, error } = await supabaseAnon
    .from("events")
    .select("*")
    .is("dismissed_at", null)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data as EventDb[];
}

export async function listAllEventsAdmin(): Promise<EventDb[]> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("*")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data as EventDb[];
}

export async function createEvent(input: EventCreate): Promise<EventDb> {
  const parsed = EventCreateSchema.parse(input);
  const source = parsed.source ?? "manual";
  const confirmed = parsed.confirmed ?? source === "manual";
  const { data, error } = await supabaseAdmin()
    .from("events")
    .insert({ ...parsed, source, confirmed })
    .select("*")
    .single();
  if (error) throw error;
  return data as EventDb;
}

export async function updateEvent(id: string, patch: Partial<EventCreate>): Promise<EventDb> {
  const { data, error } = await supabaseAdmin()
    .from("events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as EventDb;
}

export async function dismissEvent(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("events")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function confirmEvent(id: string): Promise<EventDb> {
  return updateEvent(id, { confirmed: true });
}

export async function bulkInsert(
  events: EventCreate[],
  scoutRunId: string,
): Promise<{ inserted: EventDb[]; skipped: { input: EventCreate; reason: string }[] }> {
  const existing = await listAllEventsAdmin();
  const inserted: EventDb[] = [];
  const skipped: { input: EventCreate; reason: string }[] = [];

  for (const ev of events) {
    if (isDuplicate(ev, existing)) {
      skipped.push({ input: ev, reason: "duplicate" });
      continue;
    }
    const parsed = EventCreateSchema.safeParse(ev);
    if (!parsed.success) {
      skipped.push({ input: ev, reason: parsed.error.message });
      continue;
    }
    try {
      const row = await createEvent({
        ...parsed.data,
        source: "scout",
        confirmed: false,
        scout_run_id: scoutRunId,
      });
      inserted.push(row);
      existing.push(row);
    } catch (e) {
      skipped.push({ input: ev, reason: e instanceof Error ? e.message : "insert error" });
    }
  }

  return { inserted, skipped };
}
