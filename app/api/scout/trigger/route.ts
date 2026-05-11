import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // In Vercel: trigger the scout via a webhook to WorkBox (the scout runs there).
  // In local dev: spawn the script directly.
  const localPath = path.join(os.homedir(), "projects", "agent-runner", "scripts", "run-field-radar-scout.mjs");
  const isLocal = process.env.VERCEL !== "1";

  if (isLocal) {
    // Fire-and-forget so the HTTP call returns quickly.
    const child = spawn("node", [localPath], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();
    return NextResponse.json({ triggered: true, mode: "local-spawn" });
  }

  // Production: ping a WorkBox webhook to kick off the scout there.
  const hook = process.env.SCOUT_WEBHOOK_URL;
  if (!hook) {
    return NextResponse.json(
      { error: "SCOUT_WEBHOOK_URL not configured in production; scout runs via Paperclip routine only" },
      { status: 503 },
    );
  }
  const res = await fetch(hook, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SCOUT_WEBHOOK_SECRET ?? ""}` },
  });
  return NextResponse.json({ triggered: res.ok, status: res.status });
}
