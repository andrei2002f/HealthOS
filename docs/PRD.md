# PRD — Personal Health OS

**Owner:** Andrei
**Last updated:** 2026-05-16
**Status:** Ready for implementation
**Target completion (MVP):** 6 weeks at 10h+/week

---

## 1. Vision & Goal

A personal "health OS" — a single web app (also installable as PWA on mobile) that consolidates Whoop biometric data with manually tracked information that Whoop does NOT provide: strength training details (sets/reps/weight), basketball game stats, supplement intake, and subjective daily check-ins. The unique value is **correlation between these data sources**, surfaced via charts and an AI coach powered by Claude.

**Primary user:** the developer himself (single-user app for now).
**Non-goal:** This is not a competitor to MyFitnessPal, Strong, or Whoop's own app. It's a thin layer that adds the missing pieces and connects them.

**Success criteria:**
- Whoop data syncs automatically every day without manual intervention
- Logging a strength set takes under 5 seconds on mobile
- Daily check-in takes under 15 seconds
- AI coach can answer questions referencing both Whoop data and manual logs
- App opens in under 2 seconds on mobile (PWA)

---

## 2. Tech Stack (mandatory)

- **Framework:** Next.js 15 (App Router, TypeScript, Server Actions)
- **UI:** Tailwind CSS + shadcn/ui components
- **Charts:** Recharts
- **DB + Auth:** Supabase (Postgres + Auth)
- **ORM:** Drizzle ORM (preferred) or Prisma
- **Hosting:** Vercel
- **Cron jobs:** Vercel Cron
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`), model `claude-sonnet-4-6`. The chat coach should connect to a Whoop MCP server when calling the API.
- **PWA:** `@ducanh2912/next-pwa` (or equivalent maintained package)
- **Validation:** Zod
- **Date utils:** `date-fns`
- **Linting/format:** ESLint + Prettier

Package manager: `pnpm`.

---

## 3. Architecture Overview

```
[Whoop API] ──OAuth──> [Next.js Route Handler] ──> [Supabase Postgres]
                              ▲
                              │ (Vercel Cron daily 06:00 UTC)
                              │
[User Browser/PWA] ──> [Next.js Pages + Server Actions] ──> [Supabase]
                              │
                              └──> [Anthropic API + Whoop MCP] (for AI coach + weekly review)
```

Key principles:
- Whoop data is **sync'd to Postgres**, not fetched live per request. UI reads from Postgres.
- The MCP layer is used ONLY by the AI coach feature for live Q&A, not for primary data display.
- All Whoop tokens are encrypted at rest in Supabase using `pgcrypto` (or stored in Supabase Vault).
- Single user but use Supabase Auth from day 1; lock the app to one email in middleware.

---

## 4. Whoop API Integration Details

- **Base URL:** `https://api.prod.whoop.com`
- **API version:** v2 (v1 deprecated)
- **OAuth endpoints:**
  - Authorize: `${WHOOP_API_HOSTNAME}/oauth/oauth2/auth`
  - Token: `${WHOOP_API_HOSTNAME}/oauth/oauth2/token`
- **Required scopes:** `offline`, `read:profile`, `read:recovery`, `read:sleep`, `read:workout`, `read:cycles`, `read:body_measurement`
- **Token refresh:** access tokens expire every hour; the `offline` scope yields a refresh token. Refresh proactively (e.g., when <10 min remaining).
- **Endpoints to sync:**
  - `GET /v2/cycle` — paginated cycles
  - `GET /v2/recovery` — paginated recovery
  - `GET /v2/activity/sleep` — paginated sleep
  - `GET /v2/activity/workout` — paginated workouts (includes weightlifting and basketball as `sport`)
  - `GET /v2/user/profile/basic`
  - `GET /v2/user/measurement/body`
- **Auth setup:** Whoop Developer Dashboard → create App → redirect URI = `https://<your-domain>/api/whoop/callback` (and a localhost variant for dev). Store `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET` as env vars on Vercel.
- **Pagination:** v2 uses `nextToken` (UUID-based). Loop until empty.
- **Rate limits:** be conservative; backoff on 429.
- **Webhooks (optional, v2 only):** can be added later for near-realtime updates. Not in MVP.

---

## 5. Data Model (Supabase / Postgres)

> All tables include `created_at timestamptz default now()` and `updated_at timestamptz default now()` with a trigger. All `id` columns are `uuid default gen_random_uuid()` unless otherwise noted.

### Auth & Whoop credentials
```sql
-- Encrypted Whoop tokens for the single user
whoop_credentials (
  user_id uuid primary key references auth.users(id),
  access_token_encrypted bytea not null,
  refresh_token_encrypted bytea not null,
  expires_at timestamptz not null,
  scopes text[] not null
)
```

### Whoop data (synced)
```sql
whoop_cycles (
  id uuid primary key,           -- Whoop v2 UUID
  user_id uuid references auth.users(id),
  start_at timestamptz not null,
  end_at timestamptz,
  strain numeric,                -- 0-21 scale
  kilojoules numeric,
  average_heart_rate int,
  max_heart_rate int,
  raw jsonb                      -- keep raw response for future fields
)
create index on whoop_cycles (user_id, start_at desc);

whoop_recovery (
  id uuid primary key,
  user_id uuid references auth.users(id),
  cycle_id uuid references whoop_cycles(id),
  sleep_id uuid,
  recovery_score int,            -- 0-100
  hrv_rmssd_ms numeric,
  resting_heart_rate int,
  spo2_percent numeric,
  skin_temp_celsius numeric,
  scored_at timestamptz,
  raw jsonb
)
create index on whoop_recovery (user_id, scored_at desc);

whoop_sleep (
  id uuid primary key,
  user_id uuid references auth.users(id),
  cycle_id uuid references whoop_cycles(id),
  start_at timestamptz,
  end_at timestamptz,
  is_nap boolean,
  total_in_bed_seconds int,
  total_awake_seconds int,
  total_light_seconds int,
  total_sws_seconds int,         -- deep
  total_rem_seconds int,
  sleep_performance_percent int,
  sleep_efficiency_percent numeric,
  respiratory_rate numeric,
  raw jsonb
)
create index on whoop_sleep (user_id, start_at desc);

whoop_workouts (
  id uuid primary key,
  user_id uuid references auth.users(id),
  sport_name text,               -- e.g. "weightlifting", "basketball", "running"
  start_at timestamptz,
  end_at timestamptz,
  strain numeric,
  average_heart_rate int,
  max_heart_rate int,
  kilojoules numeric,
  distance_meters numeric,
  altitude_gain_meters numeric,
  hr_zone_durations_seconds jsonb, -- {z1,z2,z3,z4,z5,z6}
  raw jsonb
)
create index on whoop_workouts (user_id, start_at desc);
create index on whoop_workouts (sport_name);
```

### Strength training (manual)
```sql
exercises (
  id uuid primary key,
  user_id uuid references auth.users(id),
  name text not null,
  primary_muscle text,           -- 'chest','back','quads','hamstrings','glutes','shoulders','biceps','triceps','core','calves','forearms'
  secondary_muscles text[],
  equipment text,                -- 'barbell','dumbbell','machine','cable','bodyweight','kettlebell'
  notes text,
  archived boolean default false,
  unique (user_id, name)
)

strength_sessions (
  id uuid primary key,
  user_id uuid references auth.users(id),
  performed_at timestamptz not null default now(),
  whoop_workout_id uuid references whoop_workouts(id), -- optional link
  notes text
)
create index on strength_sessions (user_id, performed_at desc);

strength_sets (
  id uuid primary key,
  session_id uuid references strength_sessions(id) on delete cascade,
  exercise_id uuid references exercises(id),
  set_index int not null,        -- 1,2,3 within session
  reps int,
  weight_kg numeric,
  rpe numeric,                   -- 6.0-10.0, optional
  is_warmup boolean default false,
  notes text
)
create index on strength_sets (session_id);

personal_records (
  id uuid primary key,
  user_id uuid references auth.users(id),
  exercise_id uuid references exercises(id),
  record_type text,              -- 'e1rm', 'top_set', 'volume_session'
  value numeric,
  reps int,                      -- for top_set
  achieved_at timestamptz,
  set_id uuid references strength_sets(id)
)
```

### Basketball (manual + linked)
```sql
basketball_sessions (
  id uuid primary key,
  user_id uuid references auth.users(id),
  played_at timestamptz not null,
  whoop_workout_id uuid references whoop_workouts(id),
  session_type text,             -- 'pickup','league','training','3v3','5v5'
  location text,
  surface text,                  -- 'parquet','outdoor_concrete','synthetic'
  team_score int,
  opponent_score int,
  points int,
  assists int,
  rebounds int,
  steals int,
  blocks int,
  turnovers int,
  minutes_played int,
  effort_rating int,             -- 1-10 self-rated
  notes text
)
create index on basketball_sessions (user_id, played_at desc);
```

### Supplements
```sql
supplements (
  id uuid primary key,
  user_id uuid references auth.users(id),
  name text not null,
  default_dose numeric,
  dose_unit text,                -- 'mg','g','iu','ml','capsule'
  category text,                 -- 'vitamin','mineral','protein','adaptogen','nootropic','other'
  cost_per_serving_ron numeric,
  notes text,
  archived boolean default false
)

supplement_schedules (
  id uuid primary key,
  supplement_id uuid references supplements(id) on delete cascade,
  time_of_day time,              -- e.g. 08:00
  days_of_week int[],            -- 0-6 (Sun-Sat), null = every day
  active boolean default true
)

supplement_intakes (
  id uuid primary key,
  user_id uuid references auth.users(id),
  supplement_id uuid references supplements(id),
  taken_at timestamptz not null default now(),
  dose numeric,
  skipped boolean default false,
  notes text
)
create index on supplement_intakes (user_id, taken_at desc);

supplement_experiments (
  id uuid primary key,
  user_id uuid references auth.users(id),
  supplement_id uuid references supplements(id),
  start_date date,
  end_date date,
  hypothesis text,
  conclusion text                -- filled in later
)
```

### Daily check-in
```sql
daily_checkins (
  id uuid primary key,
  user_id uuid references auth.users(id),
  check_date date not null,
  mood int,                      -- 1-5
  energy int,                    -- 1-5
  soreness int,                  -- 1-5
  stress int,                    -- 1-5
  pain_areas text[],             -- e.g. ['knee_left','lower_back']
  notes text,
  unique (user_id, check_date)
)
```

### AI artifacts (cache)
```sql
weekly_reviews (
  id uuid primary key,
  user_id uuid references auth.users(id),
  week_start date not null,      -- ISO week Monday
  content_md text not null,
  generated_at timestamptz default now(),
  unique (user_id, week_start)
)

ai_insights (
  id uuid primary key,
  user_id uuid references auth.users(id),
  insight_type text,             -- 'correlation','warning','pr_celebration'
  title text,
  body_md text,
  data jsonb,                    -- structured backing data
  surfaced_at timestamptz,
  dismissed_at timestamptz
)
```

### Row-Level Security
Enable RLS on every table. Policy: `auth.uid() = user_id`. For tables without a `user_id` directly (e.g. `strength_sets`), join on the parent session.

---

## 6. Features (MVP scope)

### F1 — Auth + onboarding
- Supabase email magic-link auth
- Middleware locks the app to the developer's email (read from `ALLOWED_EMAIL` env var)
- Onboarding flow: connect Whoop (OAuth) → optional seed of starter exercises and supplements

### F2 — Whoop sync
- "Connect Whoop" button → OAuth flow → store encrypted tokens
- Manual "Sync now" button on settings page (shows last sync time + result)
- Cron job at `0 6 * * *` (UTC) pulls all 4 endpoints since `last_synced_at`
- Token refresh: scheduled job at 30-min interval or on-demand before any API call
- All Whoop responses store `raw jsonb` so we never lose data when Whoop adds fields

### F3 — Dashboard (`/`)
- "Today" card: recovery score (with color: green ≥67, yellow 34-66, red <34), last night's sleep performance, yesterday's strain
- "This week" mini-charts (last 7 days): recovery, sleep duration, strain
- "Latest workout" card (from Whoop)
- "Quick actions" buttons: log strength session, daily check-in, log supplement intake
- 1-2 AI insights rendered at top if available

### F4 — Strength tracker (`/strength`)
- Page: list past sessions (paginated, infinite scroll), button "New session"
- New session screen: pick exercises one by one from a searchable list (with quick-add for new exercises), add sets with reps/weight/optional RPE
- UI optimized for mobile: large +/- buttons on reps and weight, "Same as last set" button, swipe to delete set, "End session" sticky bottom button
- Auto-detect PRs: on save, compute e1RM (Epley: `weight * (1 + reps/30)`) and top-set per exercise; insert into `personal_records` if beats previous best. Show toast "🎉 PR on bench press: 100kg x 5"
- Auto-link to today's Whoop "weightlifting" workout (if any) when session is saved
- Exercise detail page: graph of e1RM over time, last 10 sessions, all-time PR

### F5 — Basketball (`/basketball`)
- List view: all sessions sorted by date, shows score, points, location
- "New session" form: prefills from Whoop "basketball" workout if found today (duration, strain), user adds the rest
- Aggregate stats page: avg points, total games, win rate, points per minute, etc.

### F6 — Supplements (`/supplements`)
- List of active supplements with today's intake status (taken / not yet / skipped)
- One-tap "Mark as taken" per supplement
- Schedule view (calendar grid: rows = supplements, columns = days, cells = taken/skipped)
- New supplement form
- **Experiments tab:** start/stop an experiment, then view a comparison chart (avg recovery, HRV, sleep) during vs outside the experiment window
- Browser notifications for scheduled times (PWA push)

### F7 — Daily check-in (`/checkin`)
- Single-screen form, 4 sliders (mood/energy/soreness/stress), pain area chips, notes textarea
- Can only submit once per day (upsert)
- Quick access from dashboard

### F8 — AI Coach (`/coach`)
- Chat interface (input + message history persisted in DB)
- On each user message, server route calls Anthropic API with:
  - System prompt explaining what data the user has and the coach's persona
  - Recent context (last 7 days of all data, summarized) injected as text
  - MCP server config pointing to the chosen Whoop MCP for live, deeper queries
- Streaming responses (SSE) to UI
- Conversation is one rolling thread for simplicity

### F9 — Weekly review
- Cron job Sunday 20:00 (Europe/Bucharest)
- Pulls the past week's data, sends to Anthropic with a structured prompt asking for: highlights, concerns, correlations noticed, suggestions for next week
- Saves markdown to `weekly_reviews`
- Renders at `/reviews` with list and detail pages
- Sends a browser notification when ready

### F10 — Settings
- Whoop connection status + re-auth + last sync
- Profile (read-only Whoop body measurements)
- Data export: download all tables as JSON
- Theme toggle (light/dark)

---

## 7. Out of scope for MVP (parking lot)

- Multi-user (will require expanded RLS and tenant logic)
- Nutrition/macros tracking
- Native mobile app (Expo / React Native)
- Webhook-based realtime Whoop updates
- Integration with other wearables (Garmin, Apple Watch, Oura)
- Social features
- Workout planner/programming
- Custom dashboards / widget reordering
- Localization (UI will be in English; user can input notes in Romanian freely)

---

## 8. Non-functional requirements

- **Performance:** First Contentful Paint <1.5s on 4G mobile. All Postgres queries indexed.
- **Security:** All Whoop tokens encrypted at rest. RLS enforced on every table. Secrets only in Vercel env vars.
- **Reliability:** Sync job is idempotent (upsert by Whoop UUID). On API error, log and retry next cycle.
- **Observability:** Log every sync run (start, count, errors) to a `sync_logs` table. Basic Vercel + Supabase logs are enough; no Sentry for MVP.
- **PWA:** Installable on iOS Safari and Android Chrome. Offline shell for cached pages. Service worker auto-update.
- **Mobile-first:** All screens designed for 375px width first.

---

## 9. UI guidelines (functional > frumos, but clean)

- shadcn/ui components, default neutral palette
- Tailwind, no custom CSS files
- Recovery color codes are the only "branded" colors: green-500 (high), yellow-500 (medium), red-500 (low)
- One column layout on mobile, max-w-7xl with 2-3 column grid on desktop
- Sticky bottom tab bar on mobile: Home / Strength / Basketball / Supplements / Coach
- Top app bar on desktop with same nav as horizontal links
- All forms: native HTML elements styled with Tailwind, server actions for submission
- No animations beyond Tailwind transitions
- Dark mode supported via Tailwind `dark:` classes

---

## 10. Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                       # Supabase Postgres direct connection

# Whoop
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=                 # e.g. https://yourapp.vercel.app/api/whoop/callback
WHOOP_API_HOSTNAME=https://api.prod.whoop.com

# Anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6

# Whoop MCP (for AI coach)
WHOOP_MCP_URL=
WHOOP_MCP_AUTH_TOKEN=

# App
ALLOWED_EMAIL=                      # restricts auth to one email
NEXT_PUBLIC_APP_URL=
ENCRYPTION_KEY=                     # for pgcrypto / token encryption
TZ=Europe/Bucharest
```

---

## 11. Folder structure

```
/app
  /(auth)/login
  /(app)
    /page.tsx                       # dashboard
    /strength
      /page.tsx
      /new
      /[sessionId]
      /exercises/[exerciseId]
    /basketball
    /supplements
    /checkin
    /coach
    /reviews
    /settings
  /api
    /whoop
      /authorize/route.ts           # initiates OAuth
      /callback/route.ts            # OAuth callback
      /sync/route.ts                # cron-triggered + manual
    /coach/route.ts                 # streaming chat endpoint
    /reviews/generate/route.ts      # cron-triggered weekly review
    /cron/refresh-tokens/route.ts
/components
  /ui                               # shadcn primitives
  /charts                           # Recharts wrappers
  /strength
  /basketball
  /supplements
  /shared
/lib
  /whoop
    client.ts                       # API wrapper
    sync.ts                         # sync logic
    oauth.ts
    types.ts
  /supabase
    server.ts
    client.ts
    middleware.ts
  /anthropic
    coach.ts
    weekly-review.ts
    context.ts                      # builds user-data summary for prompts
  /crypto.ts                        # encrypt/decrypt tokens
  /db
    schema.ts                       # Drizzle schema
    queries/*.ts
/drizzle                            # migrations
/middleware.ts                      # auth + email allowlist
/vercel.json                        # cron config
```

---

## 12. `vercel.json` cron schedule

```json
{
  "crons": [
    { "path": "/api/whoop/sync", "schedule": "0 6 * * *" },
    { "path": "/api/cron/refresh-tokens", "schedule": "*/30 * * * *" },
    { "path": "/api/reviews/generate", "schedule": "0 18 * * 0" }
  ]
}
```
Note: Vercel Cron uses UTC. Sunday 18:00 UTC = 20:00 Europe/Bucharest (in winter) or 21:00 (DST). Acceptable for MVP.

---

## 13. AI Coach prompt design

**System prompt (sketch):**
```
You are a personal fitness and recovery coach for {user_name}.
You have access to their Whoop recovery, sleep, strain, and workout data,
their manually logged strength training sessions, basketball games,
supplement intakes, and daily subjective check-ins.

Be concise, direct, and pragmatic. Avoid medical advice — for symptoms or pain
that persist, recommend consulting a professional.

When asked about their data, use the Whoop MCP tools when live or detailed
data is needed beyond what's in the provided context.

Speak the language the user writes in (Romanian or English).
```

Each message includes a **context block** prepared server-side:
- Last 7 days of recovery/sleep/strain (daily averages + today's values)
- Active supplements
- Last 3 strength sessions (top sets per exercise)
- Last 3 basketball sessions
- Last 3 daily check-ins
- Current active experiments

---

## 14. Build order (week by week)

**Week 1 — Foundation**
- `pnpm create next-app`, Tailwind, shadcn/ui, Drizzle, Supabase project
- Auth + email allowlist middleware
- DB schema migrated
- Deploy to Vercel
- PWA manifest + service worker

**Week 2 — Whoop sync**
- Whoop developer app + OAuth flow (`/api/whoop/authorize`, `/api/whoop/callback`)
- Token encryption + refresh logic
- Sync function for all 4 endpoints, idempotent upsert
- Cron config
- Settings page with Whoop status

**Week 3 — Dashboard + check-in**
- Dashboard `today` card + 7-day mini charts
- Daily check-in page

**Week 4 — Strength tracker**
- Exercises CRUD with seeded list (see Appendix A)
- New session flow optimized for mobile
- PR detection
- Exercise detail with e1RM graph

**Week 5 — Basketball + Supplements**
- Basketball session form with Whoop auto-link
- Supplements CRUD + scheduling + intake logging
- Experiment comparison view

**Week 6 — AI layer**
- Coach chat with streaming + MCP
- Weekly review cron + page
- AI insights surfacing on dashboard
- Polish, bug fixes, export feature

---

## 15. Acceptance tests for MVP

- [ ] Connect Whoop, see today's recovery score on dashboard within 2 minutes
- [ ] Trigger manual sync; new workouts appear in DB
- [ ] Log a strength session of 5 exercises with 3 sets each in under 3 minutes on mobile
- [ ] Hit a new e1RM on bench press; toast appears and `personal_records` row created
- [ ] Submit daily check-in; resubmitting same day updates instead of inserting
- [ ] Open AI coach, ask "cum a fost recovery-ul săptămâna asta?" in Romanian; get a contextual answer
- [ ] Sunday evening: weekly review row appears, visible at `/reviews`
- [ ] Install app to iPhone home screen; opens in standalone mode
- [ ] Sign out and try to access `/`: redirected to login

---

## Appendix A — Seed data for `exercises`

Squat (Back), Front Squat, Deadlift (Conventional), Romanian Deadlift, Bench Press, Incline Dumbbell Press, Overhead Press, Pull-Up, Lat Pulldown, Barbell Row, Dumbbell Row, Seated Cable Row, Hip Thrust, Bulgarian Split Squat, Leg Press, Leg Curl, Leg Extension, Calf Raise, Dumbbell Curl, Barbell Curl, Hammer Curl, Triceps Pushdown, Skullcrusher, Lateral Raise, Face Pull, Plank, Hanging Leg Raise, Cable Crunch.

(Mark `primary_muscle` and `equipment` for each.)

## Appendix B — Useful Whoop MCP servers (pick one)

- `jonnyhaynes/whoop-mcp-server` — Node, OAuth, token refresh
- `shashankswe2020-ux/whoop-mcp` — Node, published on MCP Registry
- `nissand/whoop-mcp-server-claude` — TypeScript, v2 API

Install in Claude Desktop first to verify it works; then use the same auth credentials when configuring the API call from the app.

## Appendix C — Notes on Whoop "weightlifting" workouts

Whoop labels strength-training workouts as `weightlifting` (sport name). They include strain, HR zones, and duration — but NOT exercises/sets/weights. The app's strength tracker fills that gap; the `strength_sessions.whoop_workout_id` foreign key links them.

## Appendix D — Whoop sport names (commonly used)

`weightlifting`, `basketball`, `running`, `cycling`, `walking`, `hiit`, `functional_fitness`, `yoga`, `stretching`, `meditation`, `other`. Full sport list available in Whoop API docs.

---

## End of PRD
