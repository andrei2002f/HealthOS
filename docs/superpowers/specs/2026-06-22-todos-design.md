# Todo list — design spec

**Date:** 2026-06-22
**Status:** Approved (design phase)

## Goal

Broaden the app beyond fitness with a simple, always-at-hand todo list. First
non-fitness feature. Accessible from a dedicated `/todos` tab plus a card on the
Home dashboard. Synced across devices (PWA on phone + desktop) via the existing
Postgres backend.

## Scope (v1)

A task has: a title, an optional due date, and a priority (low / medium / high).
Checking a task off marks it done — it stays visible, struck through and greyed,
at the bottom of the list, deleted manually when the user wants.

Out of scope for v1 (YAGNI; add later if asked): notes/description field,
categories/projects, subtasks, manual drag reorder, recurring tasks, reminders /
push notifications, auto-archiving of completed tasks.

## Architecture

Persistence is a new Drizzle/Postgres table, consistent with the rest of the app
(RLS backstop, server-side `user_id` filtering, UI reads from Postgres, mutations
via Server Actions). Rejected alternatives: `localStorage` (no cross-device sync,
breaks the "UI reads from Postgres" convention) and reusing an existing table
(none fit).

### Data model — new table `todos`

```
todos
  id            uuid pk, defaultRandom
  user_id       uuid not null -> auth.users (onDelete cascade)
  title         text not null
  due_date      date null
  priority      text not null default 'medium'   // 'low' | 'medium' | 'high'
  completed_at  timestamptz null                  // null = active, set = done
  created_at    timestamptz (timestamps helper)
  updated_at    timestamptz (timestamps helper)
  index on (user_id)
  ownerPolicy("todos")   // RLS: auth.uid() = user_id
```

`completed_at` (not a boolean `done`) records *when* a task was completed at no
real cost, and leaves room for a future "stays today, archives tomorrow" mode.

`priority` is stored as text with a default of `'medium'`. Allowed values are
validated by Zod on the server (`'low' | 'medium' | 'high'`).

### Sorting

Computed in a pure comparator `lib/todos/sort.ts` (not stored):

1. Active tasks (`completed_at IS NULL`) before completed.
2. Within active: overdue first, then priority (high → medium → low), then
   `due_date` ascending (nulls last), then `created_at` ascending.
3. Completed tasks at the bottom (most recently completed first).

"Overdue" = `due_date < today` in `Europe/Bucharest`, using `date-fns-tz`
consistent with the rest of the codebase. The comparator gets a small Vitest
unit test; nothing else is tested just for coverage.

### Queries — `lib/db/queries/todos.ts`

- `listTodos(userId)` — all todos for the user, ordered by the comparator (or
  raw-ordered in SQL then finalized by the comparator).
- `createTodo(userId, input)`
- `setTodoCompleted(userId, id, completed)`
- `updateTodo(userId, id, input)`
- `deleteTodo(userId, id)`

Every query filters by `user_id` (defense in depth alongside RLS).

### Server Actions — `app/(app)/todos/actions.ts`

- `createTodoAction` — Zod-validated (title required, priority enum, optional
  date), inserts, `revalidatePath("/todos")` + `revalidatePath("/")`.
- `toggleTodoAction` — flips `completed_at`.
- `updateTodoAction` — edit title / due date / priority.
- `deleteTodoAction` — removes the row.

Errors thrown from query functions are translated at the action boundary into a
friendly message; no stack traces or secrets surface to the UI.

### UI

**`/todos`** — `app/(app)/todos/page.tsx`, Server Component reading `listTodos`:

- Top: native `<form>` "add task" — text input (title), optional
  `<input type="date">` (due date), `<select>` priority. Submits to
  `createTodoAction`.
- List rows: checkbox (toggles via `toggleTodoAction`), title, due-date badge
  (red when overdue), priority indicator (coloured dot), delete button. Completed
  tasks render at the bottom, struck through and greyed.
- Server-first: toggle/delete go through `<form>` + Server Actions, no
  `useEffect` data fetching. A small client component for optimistic toggle is
  allowed only if plain forms feel laggy; default to plain forms.

**Home widget** — `TodoWidget` card on the dashboard showing overdue + due-today
+ a few active tasks, with a "View all →" link to `/todos`. Reads the same query.

### Navigation

Add `{ href: "/todos", label: "Todos", icon: ListTodo }` to `NAV_ITEMS` in
`components/shared/MainNav.tsx` — becomes the 6th tab (bottom bar on mobile,
inline on desktop). At 375px six tabs are slightly tight but fit. If it looks too
cramped, fallback (decide during implementation): move "Coach" out of the bottom
bar up next to Settings. Does not block the design.

## Error handling

User-facing errors are friendly, no secrets. Query functions throw typed errors;
actions catch and translate. No silent null/empty returns.

## Testing

- `lib/todos/sort.ts` comparator — Vitest unit test (overdue / priority / due /
  completed ordering).
- No other tests added solely for coverage.

## Implementation workflow

1. Edit `lib/db/schema.ts` (add `todos`).
2. `pnpm db:generate` → review migration → `pnpm db:migrate`.
3. `lib/db/queries/todos.ts`, `lib/todos/sort.ts` (+ test).
4. `app/(app)/todos/actions.ts`.
5. `app/(app)/todos/page.tsx` + row/form components, `TodoWidget` on Home.
6. Add nav item.
7. `pnpm typecheck && pnpm lint && pnpm build`; manual test at 375px and desktop.
