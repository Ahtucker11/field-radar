# Field Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared Midwest events calendar (Next.js + Supabase) with a weekly Claude-powered scout that auto-populates new events.

**Architecture:** Next.js 16 on Vercel reads/writes a single `events` table in a new Supabase project. Public reads via anon key; writes gated by a shared `ADMIN_KEY`. A standalone scout script in `agent-runner` calls Claude with native web_search, validates the JSON, deduplicates against current state, and POSTs to a bulk endpoint. Scheduled weekly via a Paperclip routine.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4 inline-theme, Supabase Postgres, Zod, Vitest, Anthropic SDK (in agent-runner).

**Source spec:** `docs/superpowers/specs/2026-05-11-field-radar-design.md`

---

## File Structure

```
field-radar/
├── app/
│   ├── layout.tsx                   # root layout, fonts, body bg
│   ├── page.tsx                     # server component, fetches events
│   ├── globals.css                  # scrappy-website tokens + tailwind
│   └── api/
│       ├── events/
│       │   ├── route.ts             # GET (public), POST (admin)
│       │   ├── bulk/route.ts        # POST (admin, scout)
│       │   └── [id]/route.ts        # PATCH, DELETE (admin)
│       └── scout/
│           └── trigger/route.ts     # POST (admin, ad-hoc scout)
├── components/
│   ├── Calendar.tsx                 # month grid
│   ├── EventModal.tsx               # add/edit/confirm/dismiss
│   ├── FilterBar.tsx                # tier/location/source/time pills
│   ├── TodayBanner.tsx              # today + scout summary banner
│   └── AdminPanel.tsx               # admin key modal + scan now button
├── lib/
│   ├── types.ts                     # Zod schemas + TS types
│   ├── supabase.ts                  # anon + service-role clients
│   ├── events.ts                    # CRUD + fuzzy dedup
│   └── admin.ts                     # ADMIN_KEY check helper
├── middleware.ts                    # in-memory rate limit on /api/events/bulk
├── scripts/
│   └── seed.mjs                     # seed 13 artifact events
├── supabase/
│   └── migrations/
│       └── 20260511000000_init.sql
├── tests/
│   ├── events.test.ts               # fuzzy dedup, validation
│   └── admin.test.ts                # admin key check
├── docs/superpowers/                # specs + plans (this file)
├── .env.example
├── .gitignore
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── README.md
```

**Outside this repo:**
- `~/projects/agent-runner/scripts/run-field-radar-scout.mjs` — the scout
- `~/vaults/ScrappyHat/projects/field-radar.md` — vault project file

---

## Conventions

- **Commits:** small, conventional (`feat:`, `chore:`, `test:`, `docs:`). One commit per task at minimum, more if a task has natural sub-units.
- **Tests:** Vitest. TDD on lib/ functions. No tests for thin glue (API routes that just call lib/, server components, simple components). Code coverage isn't the goal; protecting behavior is.
- **Imports:** absolute via `@/` alias (`@/lib/events`, `@/components/Calendar`).
- **Strict TS:** `strict: true` in tsconfig.

---

## Task 1: Bootstrap Next.js repo

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `README.md`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "field-radar",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "node scripts/seed.mjs"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: lockfile created, no errors.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create next.config.ts**

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: { typedRoutes: true },
};

export default config;
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.next/
.env
.env.local
*.log
.DS_Store
.vercel
next-env.d.ts
coverage/
```

- [ ] **Step 6: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_KEY=
```

- [ ] **Step 7: Create stub app/layout.tsx**

```tsx
import "./globals.css";

export const metadata = {
  title: "Field Radar — Midwest Events",
  description: "Living calendar of high-leverage Midwest startup events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create stub app/page.tsx**

```tsx
export default function HomePage() {
  return <main style={{ padding: 24 }}>Field Radar — bootstrapping</main>;
}
```

- [ ] **Step 9: Create minimal app/globals.css**

```css
@import "tailwindcss";

body { font-family: system-ui, sans-serif; }
```

- [ ] **Step 10: Create README.md stub**

```markdown
# Field Radar

Shared Midwest events calendar for Scrappy Hat (Adam + Jake). Weekly Claude-powered scout finds new events automatically; manual edits are first-class.

See `docs/superpowers/specs/2026-05-11-field-radar-design.md` for the design.

## Local dev

```bash
cp .env.example .env.local
# fill in Supabase + ADMIN_KEY
npm install
npm run dev
```
```

- [ ] **Step 11: Verify build**

Run: `npm run dev` — open `http://localhost:3000`, confirm "Field Radar — bootstrapping" renders. Stop server.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js 16 app shell"
```

---

## Task 2: Vitest setup

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `tests/smoke.test.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 2: Create tests/setup.ts**

```ts
// Future test setup hooks live here.
export {};
```

- [ ] **Step 3: Create a smoke test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure vitest"
```

---

## Task 3: Provision Supabase project

**Files:** none in repo yet — this is account setup.

- [ ] **Step 1: Create the Supabase project**

Browser action:
1. Go to https://supabase.com/dashboard
2. New project → name: `scrappyhat-radar`, region: West US (Oregon) to match existing convention, password: generate strong
3. Wait for provisioning (~2 min)

- [ ] **Step 2: Capture project credentials**

From the dashboard's Settings → API tab, copy:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

Save these into `.env.local` (do NOT commit).

- [ ] **Step 3: Generate the admin key**

Run: `openssl rand -hex 16`
Copy the output into `.env.local` as `ADMIN_KEY=<value>`. Save the value somewhere durable (1Password) — needed for Vercel later and for the scout.

- [ ] **Step 4: Connect Supabase GH integration**

Browser:
1. Push the repo to GitHub first (`gh repo create Ahtucker11/field-radar --public --source=. --push`)
2. In Supabase dashboard → Integrations → GitHub → connect → choose the `field-radar` repo
3. Enable "Apply migrations on merge to main"

Note: per the convention, never run `supabase db push` from CLI. All schema changes ship via PR merge.

- [ ] **Step 5: Commit (placeholder, no repo changes needed)**

No commit — this task only changes external state. Move to Task 4.

---

## Task 4: Initial migration

**Files:**
- Create: `supabase/migrations/20260511000000_init.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Field Radar: initial schema
create extension if not exists "pgcrypto";

create table events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  label        text,
  start_date   date not null,
  end_date     date,
  tier         text not null check (tier in ('tier-1','tier-2','tier-3')),
  location     text not null check (location in ('loc-chi','loc-cin','loc-cmh','loc-ind','loc-rec')),
  notes        text,
  url          text,
  source       text not null default 'manual' check (source in ('manual','scout')),
  scout_run_id uuid,
  confirmed    boolean not null default false,
  dismissed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index events_start_date_idx on events (start_date);
create index events_active_idx on events (dismissed_at) where dismissed_at is null;

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();

alter table events enable row level security;

create policy "anon can read active events"
  on events for select
  to anon
  using (dismissed_at is null);

create policy "service_role full access"
  on events for all
  to service_role
  using (true)
  with check (true);
```

- [ ] **Step 2: Commit and push via PR**

```bash
git checkout -b feat/initial-schema
git add supabase/
git commit -m "feat: initial events table schema"
git push -u origin feat/initial-schema
gh pr create --title "Initial events schema" --body "Adds events table, indexes, updated_at trigger, RLS policies."
```

- [ ] **Step 3: Merge the PR and verify migration applied**

After merging via `gh pr merge --merge`:
1. In Supabase dashboard → Database → Migrations, confirm `20260511000000_init.sql` shows applied.
2. In SQL Editor, run: `select count(*) from events;` → expect `0`.

- [ ] **Step 4: Sync local main and clean up branch**

```bash
git checkout main
git pull
git branch -d feat/initial-schema
```

---

## Task 5: Zod types

**Files:**
- Create: `lib/types.ts`
- Test: `tests/types.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/types.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test`
Expected: 5 failures, "Cannot find module @/lib/types".

- [ ] **Step 3: Write lib/types.ts**

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Zod types for events"
```

---

## Task 6: Supabase clients

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Write lib/supabase.ts**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");

export const supabaseAnon: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false },
});

export function supabaseAdmin(): SupabaseClient {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url!, serviceKey, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Supabase clients (anon + service-role)"
```

---

## Task 7: Admin key check

**Files:**
- Create: `lib/admin.ts`
- Test: `tests/admin.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/admin.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { isAdminAuthorized } from "@/lib/admin";

describe("isAdminAuthorized", () => {
  beforeEach(() => {
    process.env.ADMIN_KEY = "secret-key";
  });

  it("accepts the correct Bearer token", () => {
    const req = new Request("http://x", { headers: { Authorization: "Bearer secret-key" } });
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it("rejects a wrong token", () => {
    const req = new Request("http://x", { headers: { Authorization: "Bearer wrong" } });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("rejects a missing header", () => {
    const req = new Request("http://x");
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("rejects a non-Bearer scheme", () => {
    const req = new Request("http://x", { headers: { Authorization: "Basic secret-key" } });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("uses constant-time comparison", () => {
    process.env.ADMIN_KEY = "a";
    const req = new Request("http://x", { headers: { Authorization: "Bearer ab" } });
    expect(isAdminAuthorized(req)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- admin`
Expected: failures.

- [ ] **Step 3: Write lib/admin.ts**

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- admin`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: admin key check with constant-time comparison"
```

---

## Task 8: Events CRUD layer with fuzzy dedup

**Files:**
- Create: `lib/events.ts`
- Test: `tests/events.test.ts`

- [ ] **Step 1: Write failing tests for normalize + dedup**

`tests/events.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- events`
Expected: failures.

- [ ] **Step 3: Write lib/events.ts (pure helpers first)**

```ts
import type { EventDb, EventCreate } from "@/lib/types";

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
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test -- events`
Expected: all passed.

- [ ] **Step 5: Add DB-backed helpers**

Append to `lib/events.ts`:

```ts
import { supabaseAnon, supabaseAdmin } from "@/lib/supabase";
import { EventCreateSchema } from "@/lib/types";

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
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: events CRUD layer with fuzzy dedup"
```

---

## Task 9: GET /api/events (public)

**Files:**
- Create: `app/api/events/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { listActiveEvents, listAllEventsAdmin } from "@/lib/events";
import { isAdminAuthorized } from "@/lib/admin";
import { createEvent } from "@/lib/events";
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
```

- [ ] **Step 2: Manual smoke test**

With `.env.local` filled in and Supabase reachable:

```bash
npm run dev
# in another shell:
curl -s http://localhost:3000/api/events | jq
# expect: { "events": [] }
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: GET/POST /api/events"
```

---

## Task 10: POST /api/events/bulk

**Files:**
- Create: `app/api/events/bulk/route.ts`

- [ ] **Step 1: Write the route**

```ts
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
```

- [ ] **Step 2: Smoke test**

```bash
# server still running from previous task
ADMIN_KEY=$(grep ^ADMIN_KEY .env.local | cut -d= -f2)
curl -s -X POST http://localhost:3000/api/events/bulk \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"events":[{"name":"Test","start_date":"2026-09-01","tier":"tier-3","location":"loc-rec"}]}' | jq
# expect: { "scout_run_id":"...", "inserted":1, "skipped":[] }

# Re-POST same body — expect inserted:0, skipped:[{reason:"duplicate"}]
```

- [ ] **Step 3: Clean up the test row in Supabase SQL editor**

```sql
delete from events where name = 'Test';
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: POST /api/events/bulk for scout"
```

---

## Task 11: PATCH and DELETE /api/events/[id]

**Files:**
- Create: `app/api/events/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin";
import { updateEvent, dismissEvent } from "@/lib/events";
import { EventCreateSchema } from "@/lib/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = EventCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const event = await updateEvent(id, parsed.data);
  return NextResponse.json({ event });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await dismissEvent(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: PATCH/DELETE /api/events/[id]"
```

---

## Task 12: Rate-limit middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write middleware.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: rate-limit /api/events/bulk to 10/min per IP"
```

---

## Task 13: globals.css with scrappy-website tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace globals.css with brand tokens**

```css
@import "tailwindcss";

:root {
  --green: #1e4532;
  --green-light: #2a5740;
  --green-card: #356649;
  --green-pale: #e8f0eb;
  --bg: #ede8dd;
  --bg-warm: #e5e0d4;
  --bg-aged: #e2dccf;
  --cream: #f1ece1;
  --orange: #c45a0e;
  --orange-light: #e8723a;
  --text: #1a1f1a;
  --text-soft: #4a4f4a;
  --text-muted: #5f645f;
  --text-faint: #a5a9a5;
  --border: rgba(26, 31, 26, 0.08);
  --border-soft: rgba(26, 31, 26, 0.12);
  --border-strong: rgba(26, 31, 26, 0.22);

  --shadow-card: 4px 4px 0 var(--green);

  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 10px;
}

@theme inline {
  --color-bg: var(--bg);
  --color-cream: var(--cream);
  --color-green: var(--green);
  --color-green-light: var(--green-light);
  --color-green-pale: var(--green-pale);
  --color-orange: var(--orange);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-text-faint: var(--text-faint);
  --color-border: var(--border);
  --color-border-soft: var(--border-soft);
}

body {
  font-family: "Manrope", system-ui, sans-serif;
  background-color: var(--bg);
  background-image: radial-gradient(circle, rgba(26, 31, 26, 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  padding: 24px 14px 60px;
}

.display { font-family: "Playfair Display", serif; }
.mono { font-family: "JetBrains Mono", monospace; }
```

- [ ] **Step 2: Add Google Fonts to app/layout.tsx**

Replace `app/layout.tsx`:

```tsx
import "./globals.css";

export const metadata = {
  title: "Field Radar — Midwest Events",
  description: "Living calendar of high-leverage Midwest startup events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: scrappy-website brand tokens + fonts"
```

---

## Task 14: TodayBanner component

**Files:**
- Create: `components/TodayBanner.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { EventDb } from "@/lib/types";

type Props = {
  events: EventDb[];
  unconfirmedCount: number;
  lastScoutAt: string | null;
};

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLong(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function shortMD(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TodayBanner({ events, unconfirmedCount, lastScoutAt }: Props) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const todays = events.filter((e) => {
    const start = parseDate(e.start_date);
    const end = e.end_date ? parseDate(e.end_date) : start;
    return now >= start && now <= end;
  });

  const upcoming = events
    .filter((e) => parseDate(e.start_date) > now)
    .sort((a, b) => parseDate(a.start_date).getTime() - parseDate(b.start_date).getTime());

  let primary: string;
  if (todays.length) {
    primary = `Happening today: ${todays.map((e) => e.name).join(" · ")}`;
  } else if (upcoming.length) {
    const next = upcoming[0];
    const days = Math.ceil((parseDate(next.start_date).getTime() - now.getTime()) / 86_400_000);
    primary = `Next up: ${next.name} — in ${days} day${days === 1 ? "" : "s"} (${shortMD(parseDate(next.start_date))})`;
  } else {
    primary = "No upcoming events. Run the scout or add one manually.";
  }

  const scoutLine =
    unconfirmedCount > 0
      ? `🔍 ${unconfirmedCount} new event${unconfirmedCount === 1 ? "" : "s"} to review`
      : lastScoutAt
        ? `Last scout: ${shortMD(new Date(lastScoutAt))}, 0 new`
        : null;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--orange) 0%, #a14a0c 100%)",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--green)",
        boxShadow: "var(--shadow-card)",
        marginBottom: 20,
      }}
    >
      <div className="mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
        Today — {formatLong(now)}
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }}>{primary}</div>
      {scoutLine && <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95 }}>{scoutLine}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: TodayBanner component"
```

---

## Task 15: FilterBar component

**Files:**
- Create: `components/FilterBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { Tier, Location, Source } from "@/lib/types";

export type Filters = {
  tiers: Set<Tier>;
  locations: Set<Location>;
  sources: Set<Source>;
  showPast: boolean;
};

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
};

const TIERS: Tier[] = ["tier-1", "tier-2", "tier-3"];
const LOCATIONS: Location[] = ["loc-chi", "loc-cin", "loc-cmh", "loc-ind", "loc-rec"];
const SOURCES: Source[] = ["manual", "scout"];

const LOCATION_LABELS: Record<Location, string> = {
  "loc-chi": "Chicago",
  "loc-cin": "Cincinnati",
  "loc-cmh": "Columbus",
  "loc-ind": "Indianapolis",
  "loc-rec": "Recurring",
};

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 12px",
        borderRadius: 20,
        border: "1.5px solid var(--green)",
        background: active ? "var(--green)" : "#fff",
        color: active ? "var(--cream)" : "var(--text)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function FilterBar({ filters, onChange }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--green)",
        borderRadius: "var(--r-md)",
        padding: "14px 18px",
        marginBottom: 20,
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Row label="Tier">
        {TIERS.map((t) => (
          <Pill
            key={t}
            active={filters.tiers.has(t)}
            label={t.replace("tier-", "T")}
            onClick={() => onChange({ ...filters, tiers: toggle(filters.tiers, t) })}
          />
        ))}
      </Row>
      <Row label="Location">
        {LOCATIONS.map((l) => (
          <Pill
            key={l}
            active={filters.locations.has(l)}
            label={LOCATION_LABELS[l]}
            onClick={() => onChange({ ...filters, locations: toggle(filters.locations, l) })}
          />
        ))}
      </Row>
      <Row label="Source">
        {SOURCES.map((s) => (
          <Pill
            key={s}
            active={filters.sources.has(s)}
            label={s === "manual" ? "Manual" : "Scout"}
            onClick={() => onChange({ ...filters, sources: toggle(filters.sources, s) })}
          />
        ))}
      </Row>
      <Row label="Time">
        <Pill
          active={filters.showPast}
          label={filters.showPast ? "Showing past" : "Past hidden"}
          onClick={() => onChange({ ...filters, showPast: !filters.showPast })}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span
        className="mono"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--text-muted)",
          minWidth: 70,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: FilterBar component"
```

---

## Task 16: EventModal component

**Files:**
- Create: `components/EventModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { EventDb, EventCreate } from "@/lib/types";

type Props = {
  open: boolean;
  initial?: EventDb | null;
  adminKey: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const blank: EventCreate = {
  name: "",
  label: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  tier: "tier-2",
  location: "loc-cin",
  notes: "",
  url: "",
};

export function EventModal({ open, initial, adminKey, onClose, onSaved }: Props) {
  const [form, setForm] = useState<EventCreate>(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              name: initial.name,
              label: initial.label ?? "",
              start_date: initial.start_date,
              end_date: initial.end_date ?? "",
              tier: initial.tier,
              location: initial.location,
              notes: initial.notes ?? "",
              url: initial.url ?? "",
            }
          : blank,
      );
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  async function save() {
    if (!adminKey) {
      setError("Admin key required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = initial ? `/api/events/${initial.id}` : "/api/events";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEvent() {
    if (!initial || !adminKey) return;
    setBusy(true);
    try {
      await fetch(`/api/events/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ confirmed: true }),
      });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!initial || !adminKey) return;
    if (!confirm("Dismiss this event?")) return;
    setBusy(true);
    try {
      await fetch(`/api/events/${initial.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,31,26,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--cream)",
          border: "1px solid var(--green)",
          borderRadius: "var(--r-md)",
          padding: "22px 24px",
          maxWidth: 500,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "6px 6px 0 var(--green)",
        }}
      >
        <h3 className="display" style={{ fontSize: 20, marginBottom: 16 }}>
          {initial ? "Edit Event" : "Add Event"}
        </h3>

        {initial && initial.source === "scout" && !initial.confirmed && (
          <div
            style={{
              background: "var(--green-pale)",
              border: "1px dashed var(--green)",
              padding: "8px 12px",
              borderRadius: "var(--r-sm)",
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            Scout found this. Confirm if it&apos;s a real event, or dismiss to remove.
          </div>
        )}

        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <Field label="Label (calendar pill)">
          <input
            value={form.label ?? ""}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <Row>
          <Field label="Start">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="End (optional)">
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Tier">
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value as EventCreate["tier"] })}
              style={inputStyle}
            >
              <option value="tier-1">T1 — Drop everything</option>
              <option value="tier-2">T2 — Worth the time</option>
              <option value="tier-3">T3 — Awareness</option>
            </select>
          </Field>
          <Field label="Location">
            <select
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value as EventCreate["location"] })}
              style={inputStyle}
            >
              <option value="loc-chi">Chicago</option>
              <option value="loc-cin">Cincinnati</option>
              <option value="loc-cmh">Columbus</option>
              <option value="loc-ind">Indianapolis</option>
              <option value="loc-rec">Recurring / Action</option>
            </select>
          </Field>
        </Row>
        <Field label="Notes">
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ ...inputStyle, minHeight: 60 }}
          />
        </Field>
        <Field label="URL">
          <input
            type="url"
            value={form.url ?? ""}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            style={inputStyle}
          />
        </Field>

        {error && <div style={{ color: "#a51c1c", fontSize: 12, marginTop: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {initial && initial.source === "scout" && !initial.confirmed && (
            <button onClick={confirmEvent} disabled={busy} style={primaryBtnStyle}>
              Confirm
            </button>
          )}
          {initial && (
            <button onClick={dismiss} disabled={busy} style={dangerBtnStyle}>
              Dismiss
            </button>
          )}
          <button onClick={onClose} disabled={busy} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button onClick={save} disabled={busy} style={primaryBtnStyle}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--green)",
  borderRadius: "var(--r-sm)",
  fontSize: 13,
  background: "#fff",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "7px 14px",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 1,
  background: "var(--green)",
  color: "var(--cream)",
  border: "1.5px solid var(--green)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "#fff",
  color: "var(--text)",
};

const dangerBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "#fff",
  color: "#a51c1c",
  borderColor: "#a51c1c",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        className="mono"
        style={{
          display: "block",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: EventModal for add/edit/confirm/dismiss"
```

---

## Task 17: Calendar component

**Files:**
- Create: `components/Calendar.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { EventDb, Tier, Location, Source } from "@/lib/types";
import type { Filters } from "@/components/FilterBar";

const TIER_BG: Record<Tier, string> = {
  "tier-1": "var(--green-light)",
  "tier-2": "var(--orange)",
  "tier-3": "#8a8170",
};

const LOC_BORDER: Record<Location, string> = {
  "loc-chi": "#74a4d4",
  "loc-cin": "#fc8181",
  "loc-cmh": "#b794f4",
  "loc-ind": "#f6e05e",
  "loc-rec": "#9ac4a8",
};

type Props = {
  events: EventDb[];
  filters: Filters;
  onEventClick: (event: EventDb) => void;
};

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayInEvent(day: Date, ev: EventDb): boolean {
  const start = parseDate(ev.start_date);
  const end = ev.end_date ? parseDate(ev.end_date) : start;
  return day >= start && day <= end;
}

function isVisible(ev: EventDb, filters: Filters, today: Date): boolean {
  if (!filters.tiers.has(ev.tier)) return false;
  if (!filters.locations.has(ev.location)) return false;
  if (!filters.sources.has(ev.source)) return false;
  if (!filters.showPast) {
    const end = parseDate(ev.end_date ?? ev.start_date);
    if (end < today && !isSameDay(end, today)) return false;
  }
  return true;
}

export function Calendar({ events, filters, onEventClick }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (events.length === 0) {
    return <Empty>No events yet. Add one or run the scout.</Empty>;
  }

  const allDates = events.flatMap((e) => [parseDate(e.start_date), parseDate(e.end_date ?? e.start_date)]);
  allDates.push(today);
  const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const max = new Date(Math.max(...allDates.map((d) => d.getTime())));

  const months: { year: number; month: number }[] = [];
  let cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  const last = new Date(max.getFullYear(), max.getMonth(), 1);
  while (cursor <= last) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <>
      {months.map(({ year, month }) => (
        <Month
          key={`${year}-${month}`}
          year={year}
          month={month}
          events={events}
          filters={filters}
          today={today}
          onEventClick={onEventClick}
        />
      ))}
    </>
  );
}

function Month({
  year,
  month,
  events,
  filters,
  today,
  onEventClick,
}: {
  year: number;
  month: number;
  events: EventDb[];
  filters: Filters;
  today: Date;
  onEventClick: (event: EventDb) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDow = firstDay.getDay();
  const monthName = firstDay.toLocaleDateString("en-US", { month: "long" });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`e${i}`} style={{ ...dayStyle, background: "#f5f1e6" }} />);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const day = new Date(year, month, d);
    const isToday = isSameDay(day, today);
    const isPast = day < today && !isToday;
    const dayEvents = events.filter((e) => dayInEvent(day, e) && isVisible(e, filters, today));
    cells.push(
      <div
        key={d}
        style={{
          ...dayStyle,
          background: isToday ? "#fff4e6" : day.getDay() === 0 || day.getDay() === 6 ? "#fbf8f0" : "#fff",
          boxShadow: isToday ? "inset 0 0 0 3px var(--orange)" : undefined,
          opacity: isPast ? 0.55 : 1,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: isToday ? "#fff" : "var(--text-muted)",
            background: isToday ? "var(--orange)" : "transparent",
            display: "inline-block",
            padding: isToday ? "2px 6px" : 0,
            borderRadius: 3,
            fontWeight: isToday ? 700 : 400,
            marginBottom: 4,
          }}
        >
          {d}
        </div>
        {dayEvents.map((ev) => (
          <button
            key={ev.id}
            onClick={() => onEventClick(ev)}
            title={`${ev.name}${ev.notes ? "\n\n" + ev.notes : ""}`}
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 6px",
              borderRadius: 3,
              marginBottom: 2,
              color: "#fff",
              background: TIER_BG[ev.tier],
              border: "none",
              borderLeft: `3px ${ev.source === "scout" && !ev.confirmed ? "dashed" : "solid"} ${LOC_BORDER[ev.location]}`,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              lineHeight: 1.25,
            }}
          >
            {ev.source === "scout" && !ev.confirmed ? "~ " : ""}
            {ev.label ?? ev.name}
          </button>
        ))}
      </div>,
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--green)",
        borderRadius: "var(--r-md)",
        marginBottom: 24,
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="display"
        style={{
          background: "var(--green)",
          color: "var(--cream)",
          padding: "12px 18px",
          fontSize: 20,
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span>{monthName}</span>
        <span className="mono" style={{ fontSize: 11, fontWeight: 400, letterSpacing: 1, opacity: 0.7 }}>
          {year}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 1,
          background: "var(--green)",
          borderTop: "1px solid var(--green)",
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="mono"
            style={{
              background: "#ede8da",
              padding: "8px 10px",
              fontSize: 10,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-muted)",
            }}
          >
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

const dayStyle: React.CSSProperties = {
  minHeight: 100,
  padding: "6px 5px",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 30,
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: 13,
        background: "#fff",
        border: "1px solid var(--green)",
        borderRadius: "var(--r-md)",
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: Calendar component with month grid"
```

---

## Task 18: AdminPanel component

**Files:**
- Create: `components/AdminPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";

type Props = {
  adminKey: string | null;
  onSetKey: (key: string | null) => void;
  onScanNow: () => Promise<void>;
  onAddEvent: () => void;
};

export function AdminPanel({ adminKey, onSetKey, onScanNow, onAddEvent }: Props) {
  const [scanning, setScanning] = useState(false);

  async function promptForKey() {
    const next = prompt("Admin key:");
    if (next) onSetKey(next);
  }

  async function handleScan() {
    if (!adminKey) {
      promptForKey();
      return;
    }
    setScanning(true);
    try {
      await onScanNow();
    } finally {
      setScanning(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={() => (adminKey ? onAddEvent() : promptForKey())} style={btnPrimary}>
        + Add event
      </button>
      <button onClick={handleScan} disabled={scanning} style={btnSecondary}>
        {scanning ? "Scanning…" : "🔍 Scan now"}
      </button>
      {adminKey ? (
        <button onClick={() => onSetKey(null)} style={btnGhost}>
          Clear admin key
        </button>
      ) : (
        <button onClick={promptForKey} style={btnGhost}>
          Enter admin key
        </button>
      )}
    </div>
  );
}

const btnBase: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "7px 14px",
  textTransform: "uppercase",
  letterSpacing: 1,
  borderRadius: "var(--r-sm)",
  border: "1.5px solid var(--green)",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--green)",
  color: "var(--cream)",
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: "#fff",
  color: "var(--text)",
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  border: "1.5px solid transparent",
  color: "var(--text-muted)",
  textDecoration: "underline",
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: AdminPanel component"
```

---

## Task 19: Wire up app/page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import type { EventDb, Tier, Location, Source } from "@/lib/types";
import { Calendar } from "@/components/Calendar";
import { EventModal } from "@/components/EventModal";
import { FilterBar, type Filters } from "@/components/FilterBar";
import { TodayBanner } from "@/components/TodayBanner";
import { AdminPanel } from "@/components/AdminPanel";

const ADMIN_KEY_STORAGE = "field-radar-admin-key";

const ALL_TIERS: Tier[] = ["tier-1", "tier-2", "tier-3"];
const ALL_LOCATIONS: Location[] = ["loc-chi", "loc-cin", "loc-cmh", "loc-ind", "loc-rec"];
const ALL_SOURCES: Source[] = ["manual", "scout"];

export default function HomePage() {
  const [events, setEvents] = useState<EventDb[]>([]);
  const [filters, setFilters] = useState<Filters>({
    tiers: new Set(ALL_TIERS),
    locations: new Set(ALL_LOCATIONS),
    sources: new Set(ALL_SOURCES),
    showPast: true,
  });
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [modalEvent, setModalEvent] = useState<EventDb | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (stored) setAdminKey(stored);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/events", { cache: "no-store" });
    const body = await res.json();
    setEvents(body.events ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleSetKey(key: string | null) {
    if (key) {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
      setAdminKey(key);
    } else {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
      setAdminKey(null);
    }
  }

  async function scanNow() {
    if (!adminKey) return;
    const res = await fetch("/api/scout/trigger", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    if (!res.ok) {
      alert(`Scout trigger failed: ${res.status}`);
      return;
    }
    await refresh();
  }

  const unconfirmed = events.filter((e) => e.source === "scout" && !e.confirmed).length;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto" }}>
      <header
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 className="display" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.5px" }}>
            Field Radar
          </h1>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}
          >
            Midwest events // Chicago · Cincinnati · Columbus · Indianapolis
          </div>
        </div>
        <AdminPanel
          adminKey={adminKey}
          onSetKey={handleSetKey}
          onScanNow={scanNow}
          onAddEvent={() => {
            setModalEvent(null);
            setModalOpen(true);
          }}
        />
      </header>

      <TodayBanner events={events} unconfirmedCount={unconfirmed} lastScoutAt={null} />
      <FilterBar filters={filters} onChange={setFilters} />
      <Calendar
        events={events}
        filters={filters}
        onEventClick={(e) => {
          setModalEvent(e);
          setModalOpen(true);
        }}
      />

      <EventModal
        open={modalOpen}
        initial={modalEvent}
        adminKey={adminKey}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
      />
    </main>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`
Visit http://localhost:3000. Expect:
- Empty calendar (no events yet)
- Filter pills work
- "+ Add event" → prompts for admin key → opens modal
- Add a test event → it appears on the calendar

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire up calendar page"
```

---

## Task 20: Seed script

**Files:**
- Create: `scripts/seed.mjs`

- [ ] **Step 1: Write the seed script**

```js
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const SEED = [
  { name: "B2B Online Chicago", label: "B2B Online CHI", start_date: "2026-05-04", end_date: "2026-05-06", tier: "tier-2", location: "loc-chi", notes: "Enterprise B2B / SMB-adjacent buyer audience." },
  { name: "AI + Robotics Summit @ 1819", label: "AI+Robotics 1819", start_date: "2026-05-14", end_date: "2026-05-14", tier: "tier-1", location: "loc-cin", notes: "eGateway Capital + 1819. Marvin's house. Relationship play. CONFLICT: same day as Ohio Tech Summit." },
  { name: "Ohio Tech Summit", label: "Ohio Tech Summit", start_date: "2026-05-14", end_date: "2026-05-14", tier: "tier-1", location: "loc-cmh", notes: "Ohio Union, OSU. 3 tracks: Enterprise, Startups, Talent. Conflicts with 1819. Net-new Columbus buyers.", url: "https://www.ohiotechsummit.org" },
  { name: "Cincy AI Week hotel block deadline", label: "Cincy AI hotel block", start_date: "2026-05-18", end_date: "2026-05-18", tier: "tier-3", location: "loc-rec", notes: "Book by this date for group rate." },
  { name: "Submit Scrappy Hat event for TCW", label: "Submit TCW event", start_date: "2026-05-25", end_date: "2026-05-25", tier: "tier-3", location: "loc-rec", notes: "Visibility on TCW LinkedIn (~7.5K followers).", url: "https://gotechchicago.com/week/" },
  { name: "Data Council — Gleacher Center", label: "Data Council CHI", start_date: "2026-05-28", end_date: "2026-05-29", tier: "tier-2", location: "loc-chi", notes: "Practitioner-heavy. Anti-pitch tone fits Scrappy Hat voice." },
  { name: "Cincy AI Week — Union Hall, OTR", label: "Cincy AI Week", start_date: "2026-06-09", end_date: "2026-06-13", tier: "tier-1", location: "loc-cin", notes: "Conf Jun 9-11, community Jun 9-13. Claude track + hackathon. Cintrifuse Demo Day.", url: "https://www.cincyaiweek.com" },
  { name: "AI Tinkerers Cincinnati (during Cincy AI Wk)", label: "AI Tinkerers CIN", start_date: "2026-06-12", end_date: "2026-06-12", tier: "tier-2", location: "loc-cin", notes: "Builder-only. Live code demos.", url: "https://cincinnati.aitinkerers.org" },
  { name: "TechChicago Week calendar goes live", label: "TCW cal live", start_date: "2026-06-15", end_date: "2026-06-15", tier: "tier-3", location: "loc-rec", notes: "Pick events: 1871 immersion, Drive Capital dinner, Chicago:Blend kickoff.", url: "https://gotechchicago.com/week/" },
  { name: "Chicago AI Week", label: "Chicago AI Week", start_date: "2026-06-25", end_date: "2026-06-26", tier: "tier-1", location: "loc-chi", notes: "Applied AI, 1000+ attendees." },
  { name: "AI Tinkerers Cincinnati (monthly)", label: "AI Tinkerers (est)", start_date: "2026-07-10", end_date: "2026-07-10", tier: "tier-2", location: "loc-rec", notes: "Estimated date. Confirm when calendar updates.", url: "https://cincinnati.aitinkerers.org" },
  { name: "Indiana CIO Network — E-gineering", label: "Indiana CIO Network", start_date: "2026-07-14", end_date: "2026-07-14", tier: "tier-2", location: "loc-ind", notes: "Senior tech leader dinner. No-sales forum. Requires membership.", url: "https://techpoint.org/indiana-cio-network/events/" },
  { name: "TechChicago Week", label: "TechChicago Week", start_date: "2026-07-21", end_date: "2026-07-27", tier: "tier-1", location: "loc-chi", notes: "100+ events curated by P33. Highest-leverage week of the year.", url: "https://gotechchicago.com/week/" },
];

async function main() {
  const { data: existing } = await supabase.from("events").select("name, start_date");
  const existingKeys = new Set((existing ?? []).map((e) => `${e.name}::${e.start_date}`));

  let inserted = 0;
  for (const ev of SEED) {
    if (existingKeys.has(`${ev.name}::${ev.start_date}`)) {
      console.log(`skip (exists): ${ev.name}`);
      continue;
    }
    const { error } = await supabase.from("events").insert({ ...ev, source: "manual", confirmed: true });
    if (error) {
      console.error(`error inserting ${ev.name}:`, error.message);
    } else {
      inserted++;
      console.log(`inserted: ${ev.name}`);
    }
  }
  console.log(`\ndone. ${inserted}/${SEED.length} inserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed**

Run: `npm run seed`
Expected: 13 events inserted. Re-run: 13 skip (exists).

- [ ] **Step 3: Verify in browser**

`npm run dev` → http://localhost:3000 should show the calendar with 13 events.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: seed script with 13 initial events"
```

---

## Task 21: Scout script in agent-runner

**Files:**
- Create: `~/projects/agent-runner/scripts/run-field-radar-scout.mjs`
- Create: `~/projects/agent-runner/docs/specs/2026-05-11-field-radar-scout.md` (optional but recommended for parity with intel-engine)

- [ ] **Step 1: Confirm agent-runner has @anthropic-ai/sdk**

```bash
cd ~/projects/agent-runner
npm ls @anthropic-ai/sdk || npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Create the scout script**

`~/projects/agent-runner/scripts/run-field-radar-scout.mjs`:

```js
#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const API_BASE = process.env.FIELD_RADAR_URL ?? "https://field-radar.vercel.app";
const ADMIN_KEY = process.env.FIELD_RADAR_ADMIN_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const RUN_ID = randomUUID();

if (!ADMIN_KEY) {
  console.error("FIELD_RADAR_ADMIN_KEY missing");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("ANTHROPIC_API_KEY missing");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const SYSTEM = `You are scouting high-leverage Midwest startup/AI/B2B events for Scrappy Hat Solutions.

ICP context:
- Pre-seed to Series A B2B founders, AI-native applications
- Adam attends as a builder/consultant; Jake works the room for GTM
- Looking for events that put us in front of founders, VCs, or applied-AI builders

Target cities (and their location codes):
- Chicago → loc-chi
- Cincinnati → loc-cin
- Columbus → loc-cmh
- Indianapolis → loc-ind
- Use loc-rec for recurring events (e.g. monthly meetups) or action items (e.g. deadlines)

Time window: today through today + 120 days.

Source domain hints (use web_search to find new events on or referenced by these):
- cintrifuse.com, 1819innovationhub.com, techpoint.org, ohiox.org
- gotechchicago.com, drivecapital.com, mhubchicago.com
- *.aitinkerers.org, cincyaiweek.com, chicagoaiweek.org, columbusaiweek.com
- lu.ma, eventbrite.com (filter to target cities)

Tiering rubric:
- tier-1 ("Drop everything"): big visibility, target ICP density, anchor weeks (TechChicago, Cincy AI Week)
- tier-2 ("Worth the time"): solid signal-to-noise, recurring quality events
- tier-3 ("Awareness"): worth knowing about, lower priority — usually deadlines, hotel blocks, or adjacent events

Output requirements:
- Return ONLY a JSON array. No prose, no markdown fences.
- Each item: { name, label, start_date (YYYY-MM-DD), end_date?, tier, location, notes, url, confidence (0..1), reasoning }
- Skip anything outside the 120-day window
- Skip anything already in the existing events list (you'll be given it)
- Skip anything previously dismissed (you'll be given that list too)
- Set confidence < 0.55 only if you're unsure it's a real event; we'll filter those out
- 'label' should be a short 12-20 char calendar pill, distinct from the full name
- 'notes' = 1-2 sentence rationale: why this matters for Scrappy Hat`;

async function fetchExisting() {
  const res = await fetch(`${API_BASE}/api/events?include_dismissed=1`, {
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
  });
  if (!res.ok) throw new Error(`fetch existing: HTTP ${res.status}`);
  const body = await res.json();
  return body.events;
}

async function callClaude(existing) {
  const active = existing.filter((e) => !e.dismissed_at);
  const dismissed = existing.filter((e) => e.dismissed_at);

  const user = `Today is ${new Date().toISOString().slice(0, 10)}.

Existing active events (do not duplicate):
${JSON.stringify(active.map((e) => ({ name: e.name, start_date: e.start_date, location: e.location })), null, 2)}

Previously dismissed events (do not re-add):
${JSON.stringify(dismissed.map((e) => ({ name: e.name, start_date: e.start_date })), null, 2)}

Use web search to find new high-value events in the next 120 days. Return the JSON array.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
    messages: [{ role: "user", content: user }],
  });

  // Find the last text block
  const lastText = [...response.content].reverse().find((b) => b.type === "text");
  if (!lastText || lastText.type !== "text") throw new Error("no text in response");

  const match = lastText.text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("no JSON array in response");

  return { proposed: JSON.parse(match[0]), usage: response.usage };
}

async function postBulk(events) {
  const res = await fetch(`${API_BASE}/api/events/bulk`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ scout_run_id: RUN_ID, events }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`bulk: HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

function writeVaultLog(summary) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(os.homedir(), "vaults", "ScrappyHat", "execution-logs");
  if (!fs.existsSync(dir)) return;
  const file = path.join(dir, `event-scout-${date}.md`);
  fs.writeFileSync(
    file,
    `---
type: execution-log
date: ${date}
project: field-radar
summary: Scout run ${RUN_ID} — ${summary.inserted} new events, ${summary.skipped.length} skipped.
---

# Field Radar Scout — ${date}

Run ID: \`${RUN_ID}\`
Proposed: ${summary.proposed}
Above confidence threshold: ${summary.aboveThreshold}
Inserted: ${summary.inserted}
Skipped: ${summary.skipped.length}
Input tokens: ${summary.usage?.input_tokens ?? "?"}
Output tokens: ${summary.usage?.output_tokens ?? "?"}

## Skipped
${summary.skipped.map((s) => `- ${s.reason}: ${s.input.name} (${s.input.start_date})`).join("\n") || "_(none)_"}
`,
    "utf8",
  );
  console.log(`vault log: ${file}`);
}

function writeJsonlTrace(summary) {
  const dir = path.join(os.homedir(), ".scrappyhat", "traces");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const month = new Date().toISOString().slice(0, 7);
  const file = path.join(dir, `traces-${month}.jsonl`);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind: "field-radar-scout",
    run_id: RUN_ID,
    ...summary,
  });
  fs.appendFileSync(file, line + "\n", "utf8");
}

async function main() {
  console.log(`[scout ${RUN_ID}] starting`);
  const existing = await fetchExisting();
  console.log(`[scout] existing: ${existing.length}`);
  const { proposed, usage } = await callClaude(existing);
  console.log(`[scout] Claude proposed: ${proposed.length}`);
  const aboveThreshold = proposed.filter((e) => (e.confidence ?? 0) >= 0.55);
  console.log(`[scout] above threshold: ${aboveThreshold.length}`);
  // strip confidence/reasoning before POSTing (not in DB schema)
  const events = aboveThreshold.map(({ confidence: _c, reasoning: _r, ...rest }) => rest);
  const result = await postBulk(events);
  console.log(`[scout] inserted: ${result.inserted}, skipped: ${result.skipped.length}`);

  const summary = {
    proposed: proposed.length,
    aboveThreshold: aboveThreshold.length,
    inserted: result.inserted,
    skipped: result.skipped,
    usage,
  };
  writeJsonlTrace(summary);
  writeVaultLog(summary);
}

main().catch((e) => {
  console.error("[scout error]", e);
  writeJsonlTrace({ error: String(e), inserted: 0, skipped: [] });
  process.exit(1);
});
```

- [ ] **Step 3: Make it executable**

```bash
chmod +x ~/projects/agent-runner/scripts/run-field-radar-scout.mjs
```

- [ ] **Step 4: Test locally against dev server**

```bash
# In one terminal: npm run dev in field-radar/
# In another:
export FIELD_RADAR_URL=http://localhost:3000
export FIELD_RADAR_ADMIN_KEY=<your dev admin key>
export ANTHROPIC_API_KEY=<your anthropic key>
node ~/projects/agent-runner/scripts/run-field-radar-scout.mjs
```

Expected: events fetched, Claude called, some events POSTed. Check the browser — new events should appear with dashed left border.

- [ ] **Step 5: Commit (in agent-runner repo)**

```bash
cd ~/projects/agent-runner
git add scripts/run-field-radar-scout.mjs
git commit -m "feat: field-radar scout script"
```

---

## Task 22: Scout trigger API route

**Files:**
- Create: `app/api/scout/trigger/route.ts`

- [ ] **Step 1: Write the route**

```ts
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
```

Note: production webhook setup is out of scope for v1. The "Scan now" button will return 503 in production. Adam runs the scout via `npm run` on WorkBox or it triggers on the Paperclip routine. If on-demand cloud trigger becomes valuable later, wire up a Tailscale-reachable webhook on WorkBox.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: scout trigger route (local-spawn now, prod webhook TBD)"
```

---

## Task 23: Deploy to Vercel

**Files:** none in repo.

- [ ] **Step 1: Push to GitHub if not already pushed**

```bash
gh repo view Ahtucker11/field-radar &> /dev/null || gh repo create Ahtucker11/field-radar --public --source=. --push
git push
```

- [ ] **Step 2: Link to Vercel**

```bash
vercel link --yes
# accept defaults; Vercel infers Next.js
```

- [ ] **Step 3: Set production env vars**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ADMIN_KEY production
# repeat with "preview" for each so PR previews work
```

- [ ] **Step 4: Deploy**

```bash
vercel --prod
```

- [ ] **Step 5: Smoke-test the deployment**

```bash
PROD_URL=$(vercel ls field-radar --prod | grep -oE "https://[^ ]+\.vercel\.app" | head -1)
curl -s $PROD_URL/api/events | jq '.events | length'
# expect: 13
```

Visit `$PROD_URL` in a browser. Confirm the seeded 13 events render.

- [ ] **Step 6: Note the URL in README**

Update `README.md` to include the deployed URL under "## Production".

```bash
git add README.md
git commit -m "docs: production URL"
git push
```

---

## Task 24: Paperclip routine for weekly scout

**Files:** none in repo. This wires the scout into the existing Paperclip routine infrastructure on WorkBox.

- [ ] **Step 1: Inspect existing routines**

```bash
pp routines list
# look at the inbox-processor routine to mirror its shape
pp routines show vault-ops-inbox-processor
```

- [ ] **Step 2: Create the routine config**

Save the scout env to a dedicated env file:

```bash
mkdir -p ~/.scrappyhat/env
cat > ~/.scrappyhat/env/field-radar.env <<EOF
FIELD_RADAR_URL=https://<your-prod-url>
FIELD_RADAR_ADMIN_KEY=<your admin key>
ANTHROPIC_API_KEY=<your anthropic key>
EOF
chmod 600 ~/.scrappyhat/env/field-radar.env
```

- [ ] **Step 3: Register the routine**

Use the standard Paperclip routine pattern (the exact CLI / SQL command depends on your Paperclip routine schema — see `~/paperclip/companies/scrappy-hat/routines/` for examples):

Create `~/paperclip/companies/scrappy-hat/routines/field-radar-scout.json`:

```json
{
  "name": "field-radar-scout",
  "schedule": "0 6 * * 0",
  "command": "bash -c 'set -a; source ~/.scrappyhat/env/field-radar.env; set +a; node ~/projects/agent-runner/scripts/run-field-radar-scout.mjs'",
  "owner": "vault-ops",
  "description": "Weekly Field Radar event scout — Sunday 6am"
}
```

Then register (use the same `pp` CLI command other routines use; check existing routine creation pattern):

```bash
pp routines create --file ~/paperclip/companies/scrappy-hat/routines/field-radar-scout.json
```

- [ ] **Step 4: Verify the schedule shows up**

```bash
pp routines list | grep field-radar
```

- [ ] **Step 5: Manual run to confirm wiring**

```bash
pp routines trigger field-radar-scout
# check ~/.scrappyhat/traces/traces-2026-05.jsonl for the run line
# check ~/vaults/ScrappyHat/execution-logs/ for the markdown log
```

---

## Task 25: Vault project file + index

**Files:**
- Create: `~/vaults/ScrappyHat/projects/field-radar.md`
- Modify: `~/vaults/ScrappyHat/_system/_index.md`

- [ ] **Step 1: Write the vault project file**

`~/vaults/ScrappyHat/projects/field-radar.md`:

```markdown
---
type: project-context
project: field-radar
status: active
date: 2026-05-11
summary: Shared Midwest events calendar (Next.js + Supabase) with weekly Claude-powered scout. Replaces the per-device localStorage artifact. Adam + Jake see the same events.
connects_to:
  - "[[projects/scrappy-hat-ops]]"
---

# Field Radar

Shared visibility tool for high-leverage Midwest startup / AI / B2B events. Both Adam and Jake see the same calendar; weekly Claude scout adds new events automatically with a "scout-found" badge for human review.

## Surfaces

- **Web app:** https://<prod-url> (deployed to Vercel default)
- **Repo:** `Ahtucker11/field-radar`
- **Supabase project:** `scrappyhat-radar` (separate from `scrappyhat-intel`)
- **Scout:** `~/projects/agent-runner/scripts/run-field-radar-scout.mjs`
- **Paperclip routine:** `field-radar-scout` — weekly Sunday 6am

## Cities covered

Chicago, Cincinnati, Columbus, Indianapolis. Recurring/action lane for deadlines and meetups.

## Access

Public read; writes gated by `ADMIN_KEY` (in 1Password). Scout has its own copy in `~/.scrappyhat/env/field-radar.env`.

## Lifecycle

Scout-found events appear with a dashed left border and `~` prefix. Click → confirm (clears badge) or dismiss (soft-deletes; future scouts skip).

## Origin

Built 2026-05-11 from the artifact `scrappy-hat-living-calendar.html` produced in a claude.ai chat. Brainstorming + design at `~/projects/field-radar/docs/superpowers/`.

## Linear

No Linear project for v1; could add for issue tracking if the tool grows.

## Out of scope (deliberately, for v1)

- Copy-to-Google-Calendar (later via `gws`)
- Notifications / digests
- Multi-user accounts / RSVPs
- Custom domain
```

- [ ] **Step 2: Add to the system index**

Open `~/vaults/ScrappyHat/_system/_index.md` and add `field-radar` under the active projects list (follow the existing format). The exact line depends on the file's layout — find the active projects table/list and add a row like:

```
| Field Radar | `projects/field-radar.md` | Shared Midwest events calendar with weekly scout |
```

- [ ] **Step 3: No git commit (vault is Obsidian-synced, not git-tracked here)**

Save the files. Obsidian Sync handles propagation.

---

## Self-review

**Spec coverage check** (skim through `2026-05-11-field-radar-design.md` section by section):

- ✅ Architecture: Next.js + Supabase + agent-runner → Tasks 1, 3, 4, 6
- ✅ Repo layout: Tasks 1, 9–18, 20, 22
- ✅ Vault hook: Task 25
- ✅ Data model: Task 4 (migration), Task 5 (Zod types)
- ✅ RLS policies: Task 4
- ✅ Seed: Task 20
- ✅ Scout flow (load → Claude → validate → dedup → bulk POST → trace): Task 21
- ✅ Cadence (weekly Sunday 6am): Task 24
- ✅ Ad-hoc trigger (npm run + Scan now button): Task 21, Task 22
- ✅ UI: brand retrofit (Task 13), TodayBanner (14), FilterBar (15), EventModal (16), Calendar (17), AdminPanel (18), page wiring (19)
- ✅ Scout badge (dashed border, ~ prefix): Task 17 Calendar rendering
- ✅ Admin gate UX (sessionStorage prompt): Task 19
- ✅ Source filter row: Task 15
- ✅ Rate limit middleware: Task 12
- ✅ Admin key check (constant-time): Task 7
- ✅ Error handling: per-route Zod, no optimistic UI (Task 16), bulk per-event errors (Task 8/10)
- ✅ Testing: Tasks 2, 5 (types), 7 (admin), 8 (events). Smoke at Task 23.
- ✅ Observability: JSONL trace + vault log in Task 21
- ✅ Security: ADMIN_KEY env, service-role server-only, RLS, rate limit, HTTPS via Vercel

**Type / signature consistency check:**
- `isAdminAuthorized(req: Request)` — used identically across all route handlers ✅
- `EventCreate` / `EventDb` Zod types consistent across lib/, routes, scout ✅
- `Filters` type defined in `components/FilterBar.tsx` and imported into `Calendar.tsx` and `app/page.tsx` ✅
- `bulkInsert(events, scoutRunId)` returns `{ inserted, skipped }` — route in Task 10 returns same shape ✅
- Scout strips `confidence` and `reasoning` before POSTing — matches that those aren't in `EventCreateSchema` ✅

**Placeholder scan:** no TBDs, no "implement later," no "similar to Task N." Every code step has the actual code.

**Note on Task 24 step 3:** the exact `pp` routine creation CLI may differ from the JSON-import pattern I wrote — the worker should mirror the shape of `~/paperclip/companies/scrappy-hat/routines/` (or wherever existing routines live) rather than assuming the JSON-file approach. If `pp` doesn't take a `--file` flag, an executor can use the inline `pp routines create --name ... --schedule ... --command ...` form. This is the only place I'm flagging "follow local convention" because the routine config format isn't pinned in any spec I have access to.

---
