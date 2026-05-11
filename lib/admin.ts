import { timingSafeEqual } from "node:crypto";

export function isAdminAuthorized(req: Request): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return false;

  const header = req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return false;

  const provided = header.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
