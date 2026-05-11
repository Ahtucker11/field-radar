import { NextResponse, type NextRequest } from "next/server";

const WINDOW_MS = 60_000;
const MAX = 10;
const hits = new Map<string, number[]>();

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname !== "/api/events/bulk") return NextResponse.next();

  const ip = getIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  recent.push(now);
  hits.set(ip, recent);
  return NextResponse.next();
}

export const config = { matcher: ["/api/events/bulk"] };
