# CLAUDE.md

Instructions for Claude Code working on this repository. Read this file at the start of every session.

---

## What this project is

A personal health/fitness tracker that integrates **Whoop** (biometrics) with manually tracked data (strength training, basketball, supplements, daily check-in) and an AI coach. Single-user app, PWA, deployed on Vercel.

The complete product specification lives in **`docs/PRD.md`** — that is the source of truth for features, data model, and architecture. This file is about *how we build it*, not what we build.

---

## Tech stack (do not deviate without asking)

- **Framework:** Next.js 16 (App Router, TypeScript, Server Actions, React Server Components by default)
- **Styling:** Tailwind CSS + shadcn/ui (use the CLI to add new components, do not hand-write primitives)
- **DB:** Supabase Postgres
- **ORM:** Drizzle ORM
- **Auth:** Supabase Auth (email magic link)
- **Charts:** Recharts
- **AI:** `@anthropic-ai/sdk`, model from `ANTHROPIC_MODEL` env var
- **Validation:** Zod
- **Dates:** `date-fns` and `date-fns-tz`
- **Package manager:** `pnpm` (never use npm or yarn in this repo)
- **Node:** version pinned in `.nvmrc`

---

## Commands

```bash
pnpm dev                    # start dev server
pnpm build                  # production build (run before considering work done)
pnpm typecheck              # tsc --noEmit, must pass before any commit
pnpm lint                   # ESLint, must pass before any commit
pnpm format                 # Prettier
pnpm db:generate            # Drizzle: generate migrations from schema changes
pnpm db:migrate             # apply pending migrations
pnpm db:studio              # open Drizzle Studio
pnpm test                   # vitest (when tests exist)
```

After any non-trivial code change, run **at minimum** `pnpm typecheck` and `pnpm lint`. Do not say "done" without these passing.

---

## Working style — how I want you to behave

### Plan before you code (especially for big tasks)
For any change beyond a small fix:
1. State what you understood the task to be
2. List the files you intend to create/modify
3. Flag anything in the PRD that is ambiguous or that you'd interpret a specific way
4. Wait for confirmation, then implement

For trivial changes (one-file fixes, renaming, formatting), just do them.

### Small, focused commits
One commit per logical unit. Commit messages: `feat(strength): add PR detection on session save`, `fix(whoop): handle 401 on expired token`, `chore: bump drizzle`. No mega-commits with 30 files unless it's the initial scaffold.

### Ask, don't assume
If something in the PRD is unclear or you discover a real conflict, **stop and ask**. Don't silently pick an interpretation. Examples of when to ask:
- A new dependency would be needed that isn't in the stack
- The PRD says X but the existing code does Y
- A feature requires a design decision the PRD doesn't cover

Examples of when NOT to ask (just decide and move on):
- Variable names, file names within agreed structure
- Whether to extract a helper function
- Tailwind class ordering

### Don't be sycophantic
Skip "Great question!" and "You're absolutely right!". If I'm wrong about something technical, say so and explain why. If my idea has a flaw, point it out before implementing.

### Stay in scope
If you spot something tangential that needs fixing, note it at the end of your response as "Other things I noticed:" rather than fixing it in the same change. Avoid scope creep.

---

## Project conventions

### Folder structure
Follow the layout in `docs/PRD.md` section 11. New top-level folders require discussion.

### File naming
- Components: `PascalCase.tsx` (e.g., `RecoveryCard.tsx`)
- Utilities, hooks, lib: `kebab-case.ts` (e.g., `whoop-client.ts`, `use-recovery.ts`)
- Route segments: lowercase folder names per Next.js conventions
- Tests: co-located, `Component.test.tsx` or `utils.test.ts`

### Imports
- Use the `@/` alias for absolute imports from project root
- Order: external packages → `@/` imports → relative imports → types
- One blank line between groups

### Server vs Client components
- **Default to Server Components.** Add `"use client"` only when needed (state, effects, browser APIs, event handlers).
- Data fetching happens in Server Components or Server Actions, never in Client Components via `useEffect`.
- Server Actions for mutations. Never expose Supabase service role key to client.

### Forms
- Native HTML forms + Server Actions. No client-side form libraries (no react-hook-form) for MVP.
- Validate inputs with Zod on the server. Reject invalid input with a clear error message.

### Database access
- Always go through Drizzle. **No raw SQL** unless absolutely necessary (and discuss first).
- Queries live in `lib/db/queries/`, grouped by domain (`whoop.ts`, `strength.ts`, etc.)
- Use prepared statements / parameterized queries (Drizzle does this by default)
- Every query for a user's data must filter by `user_id`. RLS is a backstop, not the primary defense.

### API routes
- `app/api/whoop/*` — Whoop integration endpoints
- `app/api/cron/*` — Vercel Cron targets (must verify `Authorization` header with `CRON_SECRET`)
- `app/api/coach/*` — AI streaming endpoints
- All routes return JSON with consistent shape: `{ ok: true, data }` or `{ ok: false, error }`
- Use `NextResponse.json()`, never raw `Response`

### Error handling
- Never swallow errors silently. Log them with context.
- User-facing errors: friendly message, no stack traces, no secrets.
- For sync jobs: write outcome to a `sync_logs` table (or console with timestamp for now). Don't let one failed run break the next.
- Throw typed errors from lib functions; catch and translate at the route boundary.

### TypeScript
- Strict mode is on. No `any` without an inline comment explaining why.
- Prefer `type` aliases over `interface` unless extending is needed.
- Infer types where Drizzle/Zod provide them; don't duplicate.
- Avoid `as` casts. If you need one, comment why.

### Styling
- Tailwind utility classes inline. No CSS files except `globals.css`.
- Use `cn()` helper (clsx + tailwind-merge) for conditional classes.
- Mobile-first: design for 375px, then add `md:` / `lg:` breakpoints.
- Dark mode via `dark:` classes; respect system preference by default.

### shadcn/ui
- Install components via CLI: `pnpm dlx shadcn@latest add button` (or whatever the current command is — check their docs)
- Components land in `components/ui/`; don't move or rename them
- Customize by editing the file, not by wrapping

---

## Whoop integration specifics

- **API version is v2.** Do not write code against v1, it is deprecated.
- All endpoints under `https://api.prod.whoop.com/v2/...`
- OAuth tokens are short-lived (1h). Always check expiry before requests; refresh if <10 min remaining.
- Store tokens **encrypted** in `whoop_credentials` (see `lib/crypto.ts`). Never log tokens.
- Sync is **idempotent**: upsert on Whoop's UUID, never insert duplicates. Re-running a sync must be safe.
- Keep the raw response payload in a `raw jsonb` column for every Whoop record so future schema changes don't lose data.
- Respect rate limits: exponential backoff on 429, max 3 retries.
- Pagination: v2 uses `nextToken`. Loop until empty.

---

## AI / Anthropic specifics

- Model name comes from `ANTHROPIC_MODEL` env var. Don't hardcode model strings.
- All Anthropic calls go through `lib/anthropic/`. No direct SDK calls from routes.
- Context for the coach is built in `lib/anthropic/context.ts` — keep it under ~20k tokens.
- Streaming responses for chat (SSE). Non-streaming for weekly review.
- MCP server config is passed via the request `mcp_servers` field; auth token from env.
- On API errors, surface a user-friendly message; never expose error details from Anthropic to the UI.

---

## Security rules (non-negotiable)

1. **Never commit secrets.** `.env.local` is gitignored; `.env.example` shows required keys with empty values.
2. **Never log tokens, passwords, or PII** (Whoop tokens, API keys, user email).
3. **All Whoop data is private to the user** — RLS policies enforce `auth.uid() = user_id` on every table. Always also filter by `user_id` in queries (defense in depth).
4. **Service role key is server-only.** Never imported into a file with `"use client"`.
5. **Cron endpoints verify a shared secret** in the `Authorization` header (`CRON_SECRET` env var) — Vercel Cron passes this.
6. **Email allowlist middleware** rejects any user whose email isn't `ALLOWED_EMAIL`. This is the single-user gate.

---

## Anti-patterns — do NOT do these

- ❌ Fetching Whoop data live from the UI on every page load. UI reads from Postgres; sync is separate.
- ❌ `useEffect` to fetch data in a page component. Use Server Components or Server Actions.
- ❌ Adding a new dependency to "make it easier" without asking (especially state libs, form libs, date libs).
- ❌ Writing tests just to bump coverage. Test things that have logic worth verifying (PR detection, e1RM math, token refresh, sync idempotency).
- ❌ Big upfront abstractions ("let me build a generic adapter for all wearables"). Build for Whoop only.
- ❌ Reformatting unrelated files. Keep diffs minimal.
- ❌ Adding comments that just restate the code. Comment the *why*, not the *what*.
- ❌ Catching errors and silently returning null/empty. Let them propagate to a boundary that handles them.
- ❌ Hardcoding dates, timezones, or "Europe/Bucharest" in business logic. Use config + `date-fns-tz`.
- ❌ Storing computed fields that can be derived (e.g., don't store "weekly average recovery" in a column — compute it).

---

## When implementing a new feature from the PRD

Workflow:
1. Re-read the relevant PRD section
2. Identify which DB tables are involved; check `lib/db/schema.ts` for current state
3. If schema changes needed: edit `schema.ts` → `pnpm db:generate` → review migration → `pnpm db:migrate`
4. Implement queries in `lib/db/queries/`
5. Build server actions / route handlers
6. Build UI (Server Components first, add Client only where needed)
7. Verify: `pnpm typecheck && pnpm lint && pnpm build`
8. Manually test on mobile viewport (devtools 375px) and desktop
9. Summarize what changed; flag anything you noticed but didn't fix

---

## Build order reminder

We are working through `docs/PRD.md` section 14 sequentially:
- Week 1: Foundation
- Week 2: Whoop sync
- Week 3: Dashboard + check-in
- Week 4: Strength tracker
- Week 5: Basketball + Supplements
- Week 6: AI layer

At the start of each session, tell me which week we're in and what's the next planned chunk. If I jump out of order, that's fine, but confirm we're skipping something.

---

## Language

- **Code, comments, commit messages, variable names, UI strings: English.**
- **Chat with me in this repo: Romanian** (the user is Romanian and works comfortably in both).
- **User-facing text in the app: English** for UI labels, since the PRD says so; the user's own notes (in DB) can be Romanian or English freely.
- AI coach responses adapt to the language the user writes in.

---

## When in doubt

- Re-read `docs/PRD.md`
- If still unclear, ask. One short clarifying question is always better than a wrong implementation.
- Prefer the boring, obvious solution over the clever one.
- Optimize for readability and ease of change. This is a personal project that will evolve.

---

## Development progress

### ✅ Week 1 — Foundation (complete, 2026-05-17)

- Next.js 16 (App Router, TypeScript) scaffolded with pnpm
- Tailwind CSS v4 + shadcn/ui (radix-nova preset, neutral palette)
- Drizzle ORM + Supabase Postgres: 18 tables, all with RLS + `pgPolicy` owner policies
- Supabase Auth: magic-link OTP, `@supabase/ssr`, async `cookies()` (Next 16 compat)
- `proxy.ts` (Next 16 middleware replacement): auth gate + single-user email allowlist
- `lib/env.ts`: Zod env validation with `server-only` guard
- `lib/crypto.ts`: AES-256-GCM token encryption
- PWA: Serwist service worker, `next build --webpack`, disabled in dev
- Vercel deploy: `https://health-os-hud4.vercel.app`, 2 cron jobs (daily Whoop sync, weekly review)
- Production login confirmed working

### ✅ Week 2 — Whoop sync (complete, 2026-05-17)

- OAuth 2.0 flow: `/api/whoop/authorize` + `/api/whoop/callback`, CSRF state in httpOnly cookie
- Token storage (AES-256-GCM encrypted) + inline refresh when <10 min remaining
- `lib/whoop/client.ts`: `WhoopClient` with auto-refresh, `nextToken` pagination, exponential backoff on 429
- Sync function: cycles, recovery, sleep, workouts → Postgres idempotent upsert (Whoop integer IDs stored as `text`)
- `GET /api/whoop/sync` cron endpoint with `CRON_SECRET` verification (60s timeout)
- Settings page: connect/disconnect, Sync now (Server Action), last 10 sync logs
- Lesson learned: Whoop v2 data endpoints are at `/developer/v2/*`, not `/v2/*`; IDs are integers not UUIDs

### ⬜ Week 3 — Dashboard + daily check-in

- Recovery/sleep/strain cards (Recharts sparklines)
- Daily check-in form: mood, energy, soreness, notes
- Date navigation (today / previous days)
- Mobile-first layout with bottom nav

### ⬜ Week 4 — Strength tracker

- Log workout session + sets (exercise, weight, reps)
- PR detection, e1RM calculation
- Mesocycle planner (optional for MVP)
- Strength history charts

### ⬜ Week 5 — Basketball + Supplements

- Log basketball session (duration, notes, RPE)
- Supplement schedule management
- Daily supplement check-off
- Basic history/trends

### ⬜ Week 6 — AI layer

- AI coach chat (streaming SSE via `app/api/coach/`)
- Context builder (`lib/anthropic/context.ts`): last 7 days of all data, <20k tokens
- Weekly AI review generation (cron Sunday 18:00)
- Review history page
