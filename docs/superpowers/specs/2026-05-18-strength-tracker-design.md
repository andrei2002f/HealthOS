# Strength Tracker — Design Spec

**Date:** 2026-05-18  
**Week:** 4  
**Status:** Approved

---

## Decisions made during brainstorming

| Question | Decision | Rationale |
|---|---|---|
| Session persistence | Local state, save at End Session | Single user, PWA keeps tab alive, much simpler than incremental saves |
| Exercise seed | Auto-seed on first `/strength` visit | Zero friction, works on Vercel without CLI access |
| Exercise detail page | In scope this week | PRD Week 4 includes it |
| New session UX | Dedicated route `/strength/new` (Client Component) | Best UX for gym context; modal approach is harder to debug |

---

## Routes

| Route | Type | Description |
|---|---|---|
| `/strength` | Server Component | Paginated session list (20/page), "New session" sticky button |
| `/strength/new` | Client Component | Interactive session builder |
| `/strength/[sessionId]` | Server Component | Sets grouped by exercise, PRs achieved, Whoop link (strain + HR) if present |
| `/strength/exercises/[exerciseId]` | Server + Client chart | e1RM graph, last 10 sessions, all-time PR |

---

## Data layer

### New file: `lib/db/queries/strength.ts`

- `getExercises(userId)` — all active exercises, sorted alphabetically
- `seedExercises(userId)` — insert 28 exercises from PRD Appendix A (on conflict do nothing)
- `getStrengthSessions(userId, limit, offset)` — paginated, with set count per session
- `getStrengthSession(userId, sessionId)` — session with all sets + exercises
- `getExerciseHistory(userId, exerciseId)` — e1RM per session (last 90 days)
- `saveStrengthSession(userId, data)` — inserts session + sets + detects PRs, returns `{ sessionId, newPRs[] }`

### New file: `app/(app)/strength/actions.ts`

- `saveSession(payload)` — calls `saveStrengthSession`, returns `{ sessionId, newPRs }`
- `addExercise(data)` — inserts a new exercise (from quick-add in search sheet)

---

## New session flow (`/strength/new`)

**Client state shape:**
```ts
type SessionState = {
  performedAt: Date
  notes: string
  entries: Array<{
    exercise: Exercise
    sets: Array<{
      setIndex: number
      reps: number
      weightKg: number
      rpe: number | null
      isWarmup: boolean
    }>
  }>
}
```

**UI elements:**
- Header: editable date (defaults to today), optional notes field
- Per exercise card: exercise name, muscle group badge, list of sets
- Per set row: reps field with −/+ (increment 1), weight field with −/+ (increment 2.5 kg), optional RPE, warmup toggle, delete button
- "Same as last set" button — duplicates the last set in that exercise; disabled if no set exists yet for that exercise
- "Add exercise" — opens `ExerciseSearchSheet` (searchable by name, filterable by muscle group); includes "Create new" option
- Sticky bottom bar: "End session" button

**"End session" flow:**
1. Client calls `saveSession` Server Action with full payload
2. Server inserts `strength_sessions` row → gets `sessionId`
3. Bulk inserts all `strength_sets`
4. Auto-links Whoop: queries `whoop_workouts` for a `weightlifting` workout on the same local date (Europe/Bucharest); if found, updates `whoop_workout_id`
5. Runs PR detection (see below)
6. Returns `{ sessionId, newPRs }`
7. Client redirects to `/strength` and shows one toast per new PR

**Validation (Zod, server-side):**
- `reps`: integer ≥ 1
- `weightKg`: number ≥ 0
- `rpe`: number between 6.0–10.0 or null
- At least one entry with at least one non-warmup set required to save

---

## PR detection

**Formula:** e1RM (Epley) = `weight_kg * (1 + reps / 30)`

**Record types detected:** `e1rm` and `top_set`. (`volume_session` is in the schema but omitted from MVP.)

**Algorithm (runs inside `saveStrengthSession` transaction):**

```
for each distinct exercise in session:
  non_warmup_sets = sets where is_warmup = false
  if non_warmup_sets is empty → skip

  e1rm_current = max(weight * (1 + reps/30)) across non_warmup_sets
  e1rm_previous = SELECT value FROM personal_records
                  WHERE user_id=? AND exercise_id=? AND record_type='e1rm'
                  ORDER BY value DESC LIMIT 1
  if e1rm_current > e1rm_previous (or no previous record):
    INSERT personal_records (record_type='e1rm', value=e1rm_current, set_id=winning set)
    → add to newPRs[]

  top_set_current = non_warmup set with highest weight_kg (ties: first one)
  top_set_previous = SELECT value FROM personal_records
                     WHERE user_id=? AND exercise_id=? AND record_type='top_set'
                     ORDER BY value DESC LIMIT 1
  if top_set_current.weight_kg > top_set_previous (or no previous):
    INSERT personal_records (record_type='top_set', value=weight_kg, reps=reps)
    → add to newPRs[]
```

**Toast format:** `"🎉 PR — Bench Press: e1RM 112.5 kg"` — one toast per exercise with a new record.

---

## Exercise detail page (`/strength/exercises/[exerciseId]`)

**Header:** exercise name, primary muscle, equipment. "Edit" button opens an inline form to update metadata.

**PR all-time card:** "Best e1RM: 112.5 kg (100 kg × 5, 14 May 2026)"

**e1RM chart** (Client Component, Recharts `LineChart`):
- X axis: session date, Y axis: e1RM in kg
- Last 90 days (or all sessions if fewer)
- Hover tooltip: date + e1RM + the concrete set (weight × reps)
- All-time PR dot highlighted in red

**Last 10 sessions table** (Server Component):
- Columns: date, top set (weight × reps), e1RM, total sets

---

## Component structure

```
components/strength/
  SessionCard.tsx          — card in /strength list
  SessionBuilder.tsx       — Client Component, full builder for /strength/new
  ExerciseSearchSheet.tsx  — search/filter drawer for adding exercises
  SetRow.tsx               — single set row with +/- buttons
  E1rmChart.tsx            — Recharts wrapper (use client)
  PRBadge.tsx              — "PR" badge shown in set lists
```

---

## Out of scope for this week

- `volume_session` PR type
- Mesocycle planner
- Infinite scroll on session list (use simple pagination for now)
- Edit or delete a past session (read-only for MVP)
