import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin";
import { bulkInsert } from "@/lib/events";
import { EventCreateSchema } from "@/lib/types";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const BulkBodySchema = z.object({
  scout_run_id: z.string().uuid().optional(),
  events: z.array(EventCreateSchema),
});

export async function POST(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = BulkBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const runId = parsed.data.scout_run_id ?? randomUUID();
  const { inserted, skipped } = await bulkInsert(parsed.data.events, runId);
  return NextResponse.json(
    { scout_run_id: runId, inserted: inserted.length, skipped },
    { status: 201 },
  );
}
