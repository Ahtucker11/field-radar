# Midwest Events — Design Doc

**Status:** Draft for implementation
**Date:** 2026-05-11
**Owner:** Adam Tucker
**Working name:** `midwest-events` (open to rename: `field-radar`, `ecosystem-radar`, etc.)

## Purpose

A shared, lightly-living calendar of high-leverage Midwest startup / AI / B2B events for Adam and Jake. Replaces the per-device localStorage artifact (`scrappy-hat-living-calendar.html`) with a real shared surface. The calendar is visibility-only: events are not tied to anyone's personal calendar, and "going / not going" is not modeled. Copying to a personal calendar is an explicit later step.

A weekly scout finds new events automatically; manual edits remain first-class.

## Non-goals

- Multi-user accounts, RSVPs, attendance tracking
- Notifications or push digests
- Copy-to-Google-Calendar (planned later; `gws` is already wired)
- Mobile-native app (web-only)
- Replacing `content/calendar.md` (different artifact, different purpose)
- Cross-querying with Intel Engine prospect data (could be added later if a real use case emerges)
- A custom domain in v1 — default Vercel URL is sufficient

## Architecture

**Stack**
- Next.js 16 (App Router) on Vercel, default URL (`midwest-events.vercel.app` or whatever Vercel assigns)
- Tailwind v4 inline-theme, scrappy-website tokens
- Supabase Postgres in a new project `scrappyhat-events`
- agent-runner script invoking Claude Sonnet 4.6 with `web_search` server-side tool
- Paperclip routine for weekly cadence

**Access model**
- Public read (Supabase anon key, browser).
- Admin writes (Server Actions / API routes) gated by `ADMIN_KEY` env var. UI prompts for the key once, caches in sessionStorage. Scout sends it as `Authorization: Bearer`.
- No login, no auth UI, no per-user state.

**Repo: `Ahtucker11/midwest-events`**

```
midwest-events/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── events/
│       │   ├── route.ts           # GET (public), POST (admin)
│       │   ├── bulk/route.ts      # POST batch (admin) — used by scout
│       │   └── [id]/route.ts      # PATCH, DELETE (admin)
│       └── scout/
│           └── trigger/route.ts   # POST (admin) — ad-hoc scout trigger
├── components/
│   ├── Calendar.tsx
│   ├── EventModal.tsx
│   ├── FilterBar.tsx
│   ├── TodayBanner.tsx
│   └── AdminPanel.tsx
├── lib/
│   ├── supabase.ts                # anon + service-role clients
│   ├── events.ts                  # CRUD + dedup
│   ├── types.ts                   # Zod schemas
│   └── admin.ts                   # ADMIN_KEY check helper
├── scripts/
│   └── seed.mjs                   # one-shot seed with 13 artifact events
├── supabase/
│   └── migrations/
│       └── 20260511000000_init.sql
├── docs/superpowers/specs/        # this doc
└── README.md
```

**Scout location (not in this repo)**

`~/projects/agent-runner/scripts/run-event-scout.mjs` — lives alongside `run-vault-synthesis.mjs` and `linear-bridge.mjs`. Reuses the existing agent-runner trace and vault-log conventions.

**Vault hook**

- `~/vaults/ScrappyHat/projects/midwest-events.md` — project context (status, summary, links). Linked from `_system/_index.md`.
- `~/vaults/ScrappyHat/execution-logs/event-scout-YYYY-MM-DD.md` per scout run.

## Data model

Single table for v1.

```sql
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
```

**Field rationale**

- `source` + `confirmed`: drive the scout-found badge. `source='manual'` defaults to `confirmed=true`; `source='scout'` defaults to `confirmed=false`. Click "confirm" → `confirmed=true`, badge disappears.
- `dismissed_at`: soft-delete. Lets future scout runs see "we rejected this before, don't re-add."
- `scout_run_id`: groups events from the same run for audit/rollback.
- Deliberately absent: `tags`, `attendees`, `cost`, `RSVPed`, `who's going`, `priority_owner`. All YAGNI for v1.

**Dedup key**

`(normalized_name, start_date)` where `normalized_name` lowercases, strips punctuation, and collapses whitespace. App-level fuzzy match (Levenshtein distance ≤ 3 on normalized names sharing the same `start_date`) is the soft check. No unique constraint at the DB level — too brittle to name variations.

**Row-level security**

- `SELECT`: anon role can read where `dismissed_at is null`.
- `INSERT` / `UPDATE` / `DELETE`: blocked at the RLS layer. All writes go through Next.js server routes with the service-role key, gated by `ADMIN_KEY` env var.

**Migration flow**

PR-only. Supabase GH integration applies `supabase/migrations/*.sql` on merge to `main`. No `supabase db push` from CLI.

**Seed**

The 13 events from the original artifact, loaded via `scripts/seed.mjs`. `source='manual'`, `confirmed=true`. Idempotent — skips inserts on duplicate `(name, start_date)`.

## The scout

**Script:** `~/projects/agent-runner/scripts/run-event-scout.mjs`

**Per-run flow:**

1. **Load current state.** `GET /api/events?include_dismissed=1` — returns active events + dismissed events. Builds the dedup set.
2. **Call Claude.** One request to `claude-sonnet-4-6` with native `web_search` server-side tool enabled. Prompt includes:
   - Role and ICP context (pre-seed to Series A B2B, AI-native, applied AI)
   - Target cities: Chicago, Cincinnati, Columbus, Indianapolis
   - Time window: today through today + 120 days
   - Source domain hints: cintrifuse.com, 1819innovationhub.com, techpoint.org, ohiox.org, gotechchicago.com, drivecapital.com, *.aitinkerers.org, cincyaiweek.com, chicagoaiweek.org, columbusaiweek.com, mhubchicago.com, lu.ma, eventbrite.com
   - Existing events JSON (so it doesn't duplicate)
   - Dismissed events JSON (so it doesn't re-add rejected items)
   - Tiering rubric (T1/T2/T3 definitions matching the artifact's strategic frame)
   - Required output: JSON array conforming to the event schema + `confidence` (0–1) + `reasoning` per item
3. **Validate.** Zod schema on the response. Drop items with `confidence < 0.55`.
4. **Dedup.** App-level fuzzy match (normalized name + start_date) against the current+dismissed set.
5. **Bulk POST.** `POST /api/events/bulk` with `Authorization: Bearer $ADMIN_KEY`. Server inserts with `source='scout'`, `confirmed=false`, `scout_run_id=<run uuid>`.
6. **Trace.** JSONL trace at `~/.scrappyhat/traces/`. Vault log at `~/vaults/ScrappyHat/execution-logs/event-scout-YYYY-MM-DD.md` summarizing the run.

**Cadence:** Paperclip routine, Sunday 6am weekly. Same wiring as the inbox processor.

**Ad-hoc triggers:**
- `npm run event-scout` from anywhere on WorkBox
- `POST /api/scout/trigger` (admin-gated) — invoked by a "🔍 Scan now" button in the web UI's admin panel. The route shells out to the same script via a child process and streams logs back

**Cost note:** ~$0.10–0.30 per run with Sonnet + web search. Real API spend (Max sub doesn't cover the API tier). ~$1.20/month at weekly cadence. Deliberate choice — accepted.

**Failure modes:**
- Web search returns nothing → exit clean, no writes, run still recorded
- Malformed JSON from Claude → Zod failure logged, offending item dropped, rest proceed
- API endpoint unreachable → 3 retries with exponential backoff, then non-zero exit so Paperclip surfaces it
- Duplicate slips past dedup → Adam dismisses once; the dismissal feeds the next run

## UI

Carries over from the artifact, retrofitted to scrappy-website tokens.

**Brand tokens (replace artifact's Field Guide palette)**

| Role | Artifact | scrappy-website (target) |
|---|---|---|
| Page bg | `#faf8f3` | `#ede8dd` (`var(--bg)`) |
| Primary structural | `#1a1a1a` black | `#1e4532` deep green (`var(--green)`) |
| Today highlight | `#c97b3c` rust | `#c45a0e` orange (`var(--orange)`) |
| T1 tier | black | `#2a5740` green-light |
| T2 tier | rust | `#c45a0e` orange |
| T3 tier | gray-warm | `#8a8170` (unchanged-ish) |
| Bg texture | radial dots | dot-grid SVG + paper-grain ghost |

Fonts unchanged: Playfair Display / Manrope / JetBrains Mono. The 4px box-shadow brutalist treatment stays — it already matches scrappy-website cards.

**New UI elements**

1. **Scout badge.** Scout-found-unconfirmed events get a `~` prefix on the pill and a dashed left border. Click → modal shows "Scout found this — confirm or dismiss." Two buttons. Confirm: `confirmed=true`. Dismiss: soft-delete.
2. **Admin panel.** Top-right collapsible. Visible only when `ADMIN_KEY` is in sessionStorage. Contains "🔍 Scan now" button, "Export JSON," "Clear admin key."
3. **Admin gate.** First time a user tries to add/edit/delete, modal prompts for the admin key. Cached in sessionStorage until tab close. No password screens, no real auth flow.
4. **Source filter row.** Manual / Scout toggle pills, in addition to existing Tier / Location / Time rows. Both on by default.
5. **Scout banner state.** Today banner gets a second line when applicable: "Last scout: <date>, N new events to review" — orange-loud if N ≥ 5, muted if N = 0.

**Removed from the artifact**

- localStorage persistence (replaced by Supabase)
- "How to keep this calendar living" disclosure note (the scout makes it actually live)

**Mobile**

Existing breakpoints retained. Admin panel collapses into a kebab menu under 800px.

**Accessibility**

- Keyboard nav in modal, focus rings, ESC to close
- Green-on-cream meets WCAG AA contrast; rust-orange today border meets AA-Large
- Color is never the only signal — tier abbreviation + location abbreviation are in the summary row

## Error handling

- Read failure (Supabase down): show last good snapshot from Next.js 5-minute `cacheLife` cache, banner "Couldn't refresh — showing cached events."
- Write failure: modal stays open, inline error under action button. No optimistic UI — wait for server response.
- Bad/missing admin key: 401 with no body details. Wrong key returns the same 401.
- Bulk endpoint Zod failure: per-event errors logged, valid items still insert. Response: `{ inserted: n, skipped: [...] }`.

## Testing

Minimum that protects production behavior.

- **Unit (Vitest):** `lib/events.ts` — dedup fuzzy match, validation, source/confirmed defaulting
- **Unit (Vitest):** scout's Zod validator + dedup logic. Claude call is mocked.
- **Integration:** boot the API, seed fixture, POST bulk, assert state. Supabase test-DB pattern (separate test project or local Supabase).
- **Smoke:** GH Action on PR hits `GET /api/events` against a Vercel preview, asserts 200 + array.
- **No** Playwright / visual regression for v1.

## Observability

- Scout JSONL trace: `~/.scrappyhat/traces/traces-YYYY-MM.jsonl`. Fields: `run_id`, sources cited, events found, events accepted post-dedup, nominal cost.
- Vault log: `~/vaults/ScrappyHat/execution-logs/event-scout-YYYY-MM-DD.md` — markdown summary per run.
- Vercel runtime logs: standard. Inspect via `vercel logs`.
- No Phoenix / LiteLLM integration in v1 — scout calls Anthropic directly, not via the gateway. Could be moved behind LiteLLM later if cross-app observability becomes valuable.

## Security

- `ADMIN_KEY`: 32-char random string. Set in Vercel env (production + preview) and `~/.scrappyhat/env/event-scout.env` on WorkBox. Rotate by replacing both.
- Service-role Supabase key: server-only env, used in API routes only. Never reaches browser.
- No PII anywhere — events are public information. RLS is defense-in-depth: anon role gets SELECT-only on undismissed rows.
- Rate limit on `POST /api/events/bulk`: 10 req/min per IP via Vercel Edge Middleware.
- CORS: `GET /api/events` open. All other routes same-origin only.
- HTTPS-only via Vercel default.

## Out of scope for v1 (recorded explicitly)

- Copy-to-Google-Calendar (later; `gws` wired)
- Multi-user accounts, RSVPs
- Notifications / digests
- Cities beyond the four (schema parameterizable, no UI to add)
- Phoenix tracing
- Custom domain (`calendar.scrappyhat.com` or similar — later)
- Cross-queries with Intel Engine data
- Auto-tier override learning ("Adam dismissed 3 T1s from this source, downgrade future ones") — interesting, not v1

## Open questions resolved in brainstorming

- **Working name:** `midwest-events` for file paths; can rename before deployment if a better name emerges
- **Access:** public read, admin write via `ADMIN_KEY`
- **Lifecycle:** scout-found events auto-publish with badge; manual confirm/dismiss actions
- **Scout method:** Claude + native `web_search`, not custom scrapers
- **Database:** new Supabase project, not shared with Intel Engine
- **Cadence:** weekly Sunday 6am via Paperclip routine, plus ad-hoc trigger
- **Brand:** retrofit to scrappy-website tokens
- **Repo:** standalone `Ahtucker11/midwest-events`, Vercel default URL
