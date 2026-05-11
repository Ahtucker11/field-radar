import { NextResponse } from "next/server";
import { listActiveEvents, listAllEventsAdmin, createEvent } from "@/lib/events";
import { isAdminAuthorized } from "@/lib/admin";
import { EventCreateSchema } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeDismissed = url.searchParams.get("include_dismissed") === "1";

  // include_dismissed requires admin (scout uses this for dedup)
  if (includeDismissed) {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ events: await listAllEventsAdmin() });
  }

  return NextResponse.json({ events: await listActiveEvents() });
}

export async function POST(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = EventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const event = await createEvent(parsed.data);
  return NextResponse.json({ event }, { status: 201 });
}
