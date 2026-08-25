# Architecture decisions

Short ADRs for the production-infrastructure work on Health OS. Each records
what was chosen, what was rejected, and why — in enough detail to be defended
under questioning rather than merely recognised.

---

## ADR-0001 — Why containerise an app that deploys to Vercel

**Status:** accepted · Phase 1

### Context

Health OS is a single-user personal health tracker. It runs on Vercel, its
database is managed (Supabase), and it has exactly one user. Nothing about its
production reality requires a container, a Kubernetes manifest, or a deployment
pipeline more elaborate than `git push`.

### Decision

Containerise it anyway, and say plainly why.

The purpose of this work is not to improve how Health OS is served. It is to
build, on a codebase I fully control and can be questioned about in depth, the
deployment path I would use on a team: a reproducible image, a real test suite,
declarative orchestration, and a pipeline that proves all of it on every push.

### Consequences

The honest framing matters more than the artefacts. A Kubernetes setup for a
single-user app with a managed database *is* over-engineered relative to the
problem, and an interviewer who notices that before I mention it will read it as
resume-driven design. Named first, it reads as deliberate practice on a
controlled substrate — which is what it is.

Concretely, this means:

- The Vercel deployment remains the real one. The container path is parallel,
  not a replacement, and nothing in the repo claims otherwise.
- Where a choice would be different at production scale, the ADR says so
  instead of pretending the small case generalises.

### Rejected

- **Building a throwaway demo app instead.** A toy has no awkward constraints —
  no Serwist service worker interacting with `output: "standalone"`, no schema
  welded to Supabase Auth, no build that wants secrets. Those frictions are the
  parts worth being able to discuss.
- **Claiming production necessity.** Indefensible under one follow-up question.

---

## ADR-0002 — Base image: `node:22-bookworm-slim`

**Status:** accepted · Phase 1

### Context

The runtime stage needs a Node 22 runtime (matching `.nvmrc`) and as little else
as possible. Three candidates were considered: `node:22-alpine`,
`node:22-bookworm-slim`, and `gcr.io/distroless/nodejs22`.

### Decision

`node:22-bookworm-slim` for both the build and the runtime stage.

### Rationale

Alpine is roughly 40 MB smaller, and that is its entire advantage here. Against
it: Alpine links against musl rather than glibc, and prebuilt native binaries
are usually published for glibc. This project ships `sharp` in its dependency
tree (via Next's image optimisation) with native bindings, and `sharp` is listed
in `ignoredBuiltDependencies` — meaning it is *not* rebuilt from source at
install time and relies on whatever prebuilt binary matches the platform. That
is precisely the situation where musl bites. Trading 40 MB, on an image whose
application payload is around 60 MB regardless, for the elimination of an entire
class of native-module failure is a straightforward trade.

Distroless is genuinely the most secure of the three — no shell, no package
manager, non-root by default, smallest attack surface. It was rejected for a
reason specific to what comes next: Phase 3 includes deliberately breaking a pod
and debugging it from `CrashLoopBackOff`. `kubectl exec -it -- sh` does not work
on a distroless image. Losing the ability to open a shell in a running container
is a real operational cost, and paying it to protect a single-user app is the
wrong side of the trade. On a public-facing service handling other people's
data, this decision would likely go the other way.

### Consequences

- Final image: **280 MB**. Of that, roughly 60 MB is the application payload
  (56 MB `.next/standalone`, 2.3 MB `.next/static`, 49 KB `public`) and the
  remainder is the Node 22 Debian base. Alpine would land near 240 MB.
- `apt`, `sh`, and standard debugging tools are present in the running
  container — useful in Phase 3, and additional attack surface if this were
  ever exposed publicly.
- Debian security updates apply; the image should be rebuilt periodically
  rather than pinned forever.

### Rejected

- **`node:22-alpine`** — musl/glibc risk for `sharp`, for 40 MB.
- **`gcr.io/distroless/nodejs22`** — no shell, which conflicts directly with
  the Phase 3 debugging exercise.

---

## ADR-0003 — No secrets at build time

**Status:** accepted · Phase 1

### Context

`lib/env.ts` validated the entire environment with Zod at module import and
threw on failure. That module is imported transitively by the database client,
the crypto helpers, the Whoop client, and several route handlers.

`next build` loads every route module in order to prerender and to collect build
traces. A parse-at-import therefore ran during the build, which meant the build
demanded a real `DATABASE_URL`, a real Anthropic key, a real Whoop client
secret, and a real encryption key. Locally this went unnoticed because
`.env.local` is loaded automatically; in a clean container it would have failed
outright.

The available options were: inject placeholder values in the builder stage,
short-circuit validation behind a `SKIP_ENV_VALIDATION` flag, or defer
validation until the value is actually read.

### Decision

Make validation lazy and memoized. `lib/env.ts` exports a `Proxy` whose first
property read parses and caches `process.env`; `loadEnv()` is exported for
callers that want to force it.

`instrumentation.ts` calls `loadEnv()` in Next's `register()` hook, guarded on
`NEXT_RUNTIME === "nodejs"`.

### Rationale

The build no longer has any reason to hold a secret, so it does not get one.
That is a stronger property than "the secrets it holds are fake": there is no
placeholder list to keep in sync with the Zod schema, and no flag that could
leak into a runtime environment and silently disable validation altogether.

Laziness alone would trade one problem for another — a missing variable would
surface as a 500 on whichever request first touched it, rather than at startup.
The `instrumentation.ts` call moves the failure back to boot.

**Correction, made after observing it in Phase 3.** This originally claimed the
container "exits immediately and loudly". It does not. When `register()`
throws, Next logs `Failed to prepare server` and an `unhandledRejection` — and
then keeps running, answering **every** request with a 500. The process stays
alive:

```
✓ Ready in 0ms
Failed to prepare server Error: An error occurred while loading instrumentation
hook: Invalid environment variables:
  - ENCRYPTION_KEY: Invalid input
```

So the guarantee is weaker than stated, and the distinction matters. Under
Kubernetes the outcome is still correct, but the mechanism is the startup
probe, not the process: the probe gets a 500, the kubelet restarts the
container, and the pod ends up in `CrashLoopBackOff` without ever joining the
Service's endpoints. Verified by injecting an empty `ENCRYPTION_KEY` into a
running deployment — the broken pod never became ready, and the healthy pods
kept serving throughout.

Outside Kubernetes there is no such backstop. On Vercel, or under plain
`docker run`, a container started with invalid configuration stays up and
serves 500s indefinitely rather than exiting. Genuine process-level fail-fast
would need an explicit `process.exit(1)` in the instrumentation hook.

A second, less obvious property falls out of reading `process.env` as a whole
object rather than by named property: Next does not inline it. The same image
can therefore run against different environments.

### The exception, stated explicitly

`NEXT_PUBLIC_*` is **not** a runtime variable. Next substitutes it textually
into the bundles during the build. `lib/supabase/client.ts` runs in the browser
and reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so
those two values are baked into the image and must be supplied as build
arguments.

This is acceptable — both are public by definition; the anon key is protected by
row-level security, not by secrecy — but it has a real consequence: **an image
is tied to one Supabase project and cannot be repointed at another without a
rebuild.** The build/runtime boundary is therefore "no secrets at build time,"
not "no configuration at build time."

### Rejected

- **Placeholder `ENV` values in the builder stage.** Zero app changes, but the
  dummy values must satisfy the schema (`.url()`, `.email()`), so they are a
  second copy of the schema's constraints that drifts silently. Also invites the
  obvious question of why a Dockerfile contains credential-shaped strings.
- **`SKIP_ENV_VALIDATION=1`.** Widely used (the t3-env convention) and a
  three-line change, but it is an explicit bypass of validation. If it ever
  reaches a runtime environment, fail-fast is gone entirely and nothing warns.

---

## ADR-0004 — What stays outside the container

**Status:** accepted · Phase 1

### Decision

The image contains the Next.js server and nothing else. Outside it:

| Component | Why it stays out |
| --- | --- |
| Supabase Postgres | Stateful. Data outlives any container; storage, backup, and PITR are not concerns the app process should own. |
| Supabase Auth (GoTrue) | Managed identity provider. Every table foreign-keys `auth.users(id)`, so auth and data must share one database. |
| Whoop API | Third-party. |
| Anthropic API | Third-party. |

### Rationale

The result is a container that holds no state at all: no database, no session
store, no uploaded files, no local cache that matters. That is not tidiness for
its own sake — it is the precondition for everything in Phase 3. Replicas are
interchangeable, a rolling update can kill a pod mid-flight, and a liveness
probe can restart one, all without coordination, *because* there is nothing in
the container worth preserving. Bundling Postgres into the image would break
each of those properties at once.

The general principle: containerise the stateless compute, and let stateful
components be managed by something built to manage state.

### Consequence for local development

`docker-compose.yml` includes a `postgres:17` service, but the `app` service
does **not** point at it. The app authenticates against the hosted Supabase
project, and every table foreign-keys `auth.users` — so running the app against
a local database while its Auth lived remotely would split identity and data
across two databases and fail on insert. The local Postgres exists to run
migrations against and, from Phase 2, to host integration tests.

---

## ADR-0005 — `node` as PID 1, with no init shim

**Status:** accepted · Phase 1

### Context

A container's main process runs as PID 1, which the kernel treats specially: it
receives **no default signal dispositions**. For an ordinary process an
unhandled `SIGTERM` terminates it; for PID 1 an unhandled `SIGTERM` is simply
ignored. A container whose entrypoint ignores `SIGTERM` runs until the grace
period expires and is then `SIGKILL`ed — 10 seconds on `docker stop`, 30 on a
default Kubernetes pod eviction, with in-flight requests dropped.

### Decision

`CMD ["node", "server.js"]`. Node is PID 1; no `tini`, no `dumb-init`, no
`--init`.

### Rationale

This is only safe because Next's standalone server registers its own `SIGTERM`
and `SIGINT` handlers — verified in `next/dist/server/lib/start-server.js` and,
more importantly, confirmed empirically: `docker stop` returned in **0.27 s**
against a 10 s grace period, with exit code **143** (128 + SIGTERM). Had the
signal been ignored, the command would have taken the full 10 s and the exit
code would have been 137 (128 + SIGKILL). Those two numbers are the whole
argument.

The other job an init process does is reaping orphaned zombie processes. This
container runs a single Node process and spawns no children, so there is nothing
to reap. Adding `tini` would solve a problem this workload does not have.

`docker --init` / `init: true` in Compose was rejected for a different reason:
it is a property of the *runtime*, not of the image. Kubernetes has no
equivalent, so the shutdown behaviour would differ between local Compose and
Phase 3's cluster — exactly the local/production divergence worth avoiding.

### Consequence

This decision depends on an upstream implementation detail. If a future Next
version stopped registering the handler, shutdowns would silently regress from
"clean" to "killed after the grace period" with no error anywhere. The check is
cheap — time a `docker stop` — and belongs in the checklist whenever Next is
upgraded.

### Rejected

- **`tini` as `ENTRYPOINT`** — ~1 MB, guarantees forwarding and reaping, but
  reaping is unnecessary here and forwarding is already handled.
- **`init: true` in Compose** — no Kubernetes equivalent; creates divergence
  between local and cluster behaviour.

---

## ADR-0006 — Bootstrapping Supabase's schema into a plain Postgres

**Status:** accepted · Phase 1 · revisited in Phase 2

### Context

`lib/db/schema.ts` imports `authUsers` from `drizzle-orm/supabase`. Every table
has a foreign key to `auth.users(id)`, row-level security enabled, and a policy
written against `auth.uid()` granted to the `authenticated` role.

A stock `postgres:17` image has no `auth` schema, no `auth.uid()`, and no
`authenticated` role, so migration `0000` fails on its first statement. Any
local or CI database therefore needs bootstrapping before migrations can run.

### Decision

`docker/postgres-init/00-auth-shim.sql`, mounted into
`/docker-entrypoint-initdb.d/`, creates a minimal `auth` schema: an
`auth.users` table with the columns this schema actually references, an
`auth.uid()` that reads `request.jwt.claim.sub`, and the `anon`,
`authenticated`, and `service_role` roles.

### Rationale

It is roughly 25 lines, has no image-pull cost, and lets the migrations run
unchanged — which is the property that matters, since the tests must exercise
the same DDL that production runs.

Verified: with the shim in place, `0000_easy_tyrannus.sql` applies cleanly to a
stock `postgres:17` — 18 tables, their RLS policies, and the foreign keys to
`auth.users`.

### What this uncovered: the migration chain does not replay

Applying the full chain to an empty database fails on migration `0001`:

```
ERROR: foreign key constraint
       "basketball_sessions_whoop_workout_id_whoop_workouts_id_fk"
       cannot be implemented
STATEMENT: ALTER TABLE "basketball_sessions"
           ALTER COLUMN "whoop_workout_id" SET DATA TYPE text;
```

`0001` converts the Whoop identifiers from `uuid` to `text` (Whoop v2 returns
integers, not UUIDs). It alters the child columns first and the referenced
parent columns last, so between statement 1 and statement 9 the two sides of
each foreign key disagree on type, and Postgres rejects the intermediate state.
The correct shape is: drop the affected foreign keys, alter every column, then
re-add them. Confirmed by doing exactly that — dropping the three foreign keys
referencing `whoop_cycles`, `whoop_sleep` and `whoop_workouts` makes `0001`
apply without modification.

This is a **latent defect dating from Week 2**, not something containerisation
introduced. Production is in the correct end state because that state was
reached by another route (`drizzle-kit push`, or a manual apply), so the flaw
stayed invisible for as long as nobody rebuilt the schema from scratch.

It is left unfixed here on purpose. Repairing it means editing migration
history that production records as applied, which is a decision with real
consequences and belongs with the person who owns the database. It is the first
thing Phase 2 must resolve, because integration tests are worthless if they run
against a schema built by a different path than production's.

### Known limits

### Known limits

This reproduces the *shape* of Supabase Auth, not its behaviour. Real
`auth.users` has around thirty columns and is written by GoTrue; here it is a
primary key and an email that tests populate directly. `auth.uid()` reads the
same request-local setting Supabase uses, but nothing sets that setting unless a
test does so deliberately.

Related and worth stating: **the application bypasses RLS entirely.** It
connects via `DATABASE_URL` as the database owner, so policies are never
evaluated on that path. Every query filters by `user_id` in code, and that is
the actual access control. RLS is a backstop for the anon/authenticated key path
(supabase-js, PostgREST), which this app does not use for data access. A test
suite running as the owner therefore does not exercise the policies at all — a
gap to name in Phase 2 rather than paper over.

### Rejected

- **The `supabase/postgres` image.** Higher fidelity — real `auth` schema, real
  extensions — at the cost of a much larger image pull, which is paid on every
  CI run and counts against Phase 4's runtime budget. Reconsidered in Phase 2 if
  the shim proves insufficient.
- **Stripping RLS and the `auth.users` foreign keys from the schema** so it
  applies to any Postgres. Rejected outright: the tests would then run against
  different DDL than production, which defeats the purpose of testing against a
  real database.

---

## ADR-0007 — Repairing migration 0001 rather than working around it

**Status:** accepted · Phase 2

### Context

ADR-0006 recorded that the migration chain could not be replayed onto an empty
database. Three ways forward were considered: repair `0001` in place, squash the
history into a single baseline migration, or leave it broken and build test
schemas with `drizzle-kit push`.

### Decision

Repair `0001` in place. It now drops the four affected foreign keys, performs
the nine `ALTER COLUMN` statements, and recreates the keys with identical
definitions.

### Why editing an applied migration is safe here

This is the part that had to be established before touching the file, since
production records `0001` as applied. Reading drizzle's migrator settles it:

```js
// drizzle-orm/pg-core/dialect.js
select id, hash, created_at from drizzle.__drizzle_migrations
  order by created_at desc limit 1
...
if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis)
```

It fetches only the **newest** applied row and compares its `created_at` against
each journal entry's `when`. The stored `hash` is written on insert and never
read back for comparison. A migration older than the newest applied one is
therefore skipped regardless of its content.

Confirmed empirically rather than inferred: a local database was migrated to the
end state, the recorded hash for `0001` was overwritten with the pre-repair
file's hash to reproduce production exactly, and `drizzle-kit migrate` was run
again. It exited 0, applied nothing (4 migrations before, 4 after), left the
stale hash in place, and changed no tables.

A side effect worth knowing: because the hash is never verified, drizzle will
not warn if a migration file is altered after being applied. That is convenient
here and a hazard in general.

### Consequences

- The chain replays from empty: 20 tables, 20 policies, 4 recorded migrations.
- Production is untouched and will stay untouched.
- The whole migrator loop runs in **one transaction**, so a failure anywhere
  rolls back everything — which is why the original failure left a completely
  empty database rather than a half-applied one.

### Rejected

- **Squash to a baseline migration.** Cleanest end state, but it discards the
  schema's history and requires hand-inserting a row into production's
  `__drizzle_migrations` so the baseline is not re-run. Manual synchronisation
  against a live database, to fix a problem that has a mechanical fix.
- **Leave it broken; build test schemas with `drizzle-kit push`.** Zero risk and
  fastest to start, but the tests would then verify a schema built by a path
  production never takes. That is precisely the gap that let this defect survive
  five months.

---

## ADR-0008 — Vitest, split into two suites, against a real Postgres

**Status:** accepted · Phase 2

### Decision

Keep Vitest. Split the run into a `unit` project and an `integration` project.
Integration tests connect to the `postgres:17` service already defined in
`docker-compose.yml`.

### Rationale

Vitest was already in the repo with 33 passing tests, runs TypeScript and ESM
through esbuild with no Babel configuration, and needs no separate transform
step for the `@/` alias — Vite resolves `tsconfig` paths natively. Jest would
have meant a transform pipeline to configure and nothing gained.

The split exists because the two suites have incompatible costs. The unit suite
runs in ~1.2 s and can run on every save; the integration suite needs a live
database and runs serially. Keeping them separate means CI can fail on the cheap
one before paying for the expensive one.

**No mocked database.** A mocked Drizzle asserts that the query builder was
called with certain arguments, which restates the implementation rather than
testing it. Every property worth checking here — `ON CONFLICT` resolution,
`ON DELETE cascade`, a `LEFT JOIN` preventing duplicates — is behaviour that
lives in Postgres and cannot be observed anywhere else.

**Schema built from the migration chain, not from `drizzle-kit push`.** The
global setup applies `drizzle/` to an empty database on every run. This is what
makes the suite meaningful: production's schema comes from those files, so the
tests must use the same DDL. It also turns "the migrations replay" into a check
that runs on every CI push — the check whose absence let ADR-0007's defect live
for five months.

### Details worth defending

- **The connection string is read from `TEST_DATABASE_URL`**, deliberately a
  different variable from `DATABASE_URL`, and a guard rejects any host that is
  not local or that contains "supabase". The suite truncates every table between
  tests; a misconfigured environment variable would otherwise destroy real data.
- **The auth shim is applied by the test setup**, not left to Postgres's
  `docker-entrypoint-initdb.d`, so the suite works against any empty database —
  including a GitHub Actions service container, which cannot mount init scripts.
  This matters for Phase 4.
- **Isolation is truncate-per-test**, not transaction-rollback-per-test. Rollback
  is faster but breaks as soon as the code under test opens its own transaction,
  which the sync path does.
- **The tests use the application's own `db` instance**, redirected by setting
  `DATABASE_URL` before the first import. That works only because Phase 1 made
  the connection pool lazy — an unplanned dividend of ADR-0003.

### Rejected

- **testcontainers-node.** Better isolation and no manual setup step, at the
  cost of a heavy dependency, 5–15 s of container startup per run, and
  Docker-in-Docker in CI, which would eat into Phase 4's runtime budget.
- **`pg-mem` or another in-process fake.** Instant and dependency-free, but it
  implements neither RLS nor the DDL this schema uses, so the migrations would
  not apply — losing exactly the test that matters most.

---

## ADR-0009 — Extracting the Whoop payload mappers

**Status:** accepted · Phase 2

### Context

`lib/db/queries/whoop.ts` held roughly 370 lines in which payload
transformation and database writes were interleaved. Each upsert also spelled
every transformation **twice**: once in `values` and again in
`onConflictDoUpdate.set`.

### Decision

Move the transformations into `lib/whoop/mappers.ts` as pure functions, and
derive the conflict update from the mapped row via `updateSetFor(row, immutable)`.

### Rationale

Two separate wins, and the second is the more important one.

The transformations are where the interesting failures live — `score: null` on
an unscored record, a missing `zone_zero_milli`, an unknown `sport_id`, a null
distance that must not become `"0"`. Pure functions make those cases trivial to
cover; through a database they would be slow to write and slower to run.

More significantly, the duplicated conflict set was an active defect generator.
`sport_name` was once missing from it, so when `SPORT_ID_MAP` was corrected
(Basketball was 35, should have been 17), re-syncing never relabelled the
existing rows. Two copies of an expression drift, and nothing forces them back
together. Deriving the update from the inserted row removes the second copy, and
"which columns are immutable" becomes an explicit, named list instead of an
omission nobody notices.

### Consequence

`sportName` is deliberately **not** in `WORKOUT_IMMUTABLE`, precisely so a
corrected sport map can heal existing rows. There is a test for that.

---

## ADR-0010 — Where to mock a non-deterministic dependency

**Status:** accepted · Phase 2

### Decision

The coach tests mock `getAnthropic()` — our own function, which returns the SDK
client. Not `fetch`, and not `streamCoachReply` itself.

### The principle

**Mock at the narrowest seam you own, immediately below the code under test.**

Below `getAnthropic()` is Anthropic's code. Mocking lower, at `fetch`, would
mean hand-writing their SSE wire format inside the test — a reimplementation of
someone else's protocol. Such a test keeps passing when they change the wire
format and the real integration breaks, and it fails on an SDK upgrade that
changed nothing we depend on. A test that fails for reasons unrelated to your
code is a test people learn to ignore.

Mocking higher, at `streamCoachReply`, would leave nothing under test at all.

### What that leaves worth testing

Only what we wrote: that the context block and the capped history are assembled
into the request, that the model id comes from the environment rather than a
hardcoded string, and that the model's token stream is translated into
well-formed SSE — including the case that actually hurts, where the upstream
connection drops mid-reply and the stream must emit an error frame and close
rather than leaving the browser holding an open socket and half a sentence.

The quality of what the model says is not a property a test can assert, and none
of these try.

---

## ADR-0011 — What is deliberately not tested

**Status:** accepted · Phase 2

Coverage was not a target. These are the gaps, stated so they are not mistaken
for oversights.

**React components and end-to-end page rendering.** Would require Playwright and
a browser — a different order of investment, and not where this application
breaks. Its failures have been in data transformation, sync scheduling, and
migrations.

**The Whoop OAuth flow against the real authorisation server.** Cannot be
exercised without live credentials and a browser redirect. Token *refresh* logic
is covered with `fetch` mocked, which is the part with branching behaviour.

**Row-level security policies.** The most important omission. The application
connects as the database owner, so RLS is never evaluated on the Drizzle path —
the `user_id` filter in each query is the real access control, and that *is*
tested. Writing tests that assume the `authenticated` role would verify a code
path production does not take. The honest statement is that RLS is currently a
backstop for a path this app does not use, not an enforced boundary.

**Multi-user isolation beyond query scoping.** One test pins a genuine
limitation instead: `whoop_workouts` is keyed on the Whoop id alone rather than
on `(user_id, id)`, so the same Whoop id arriving for two accounts would produce
one row owned by the first user carrying the second user's data. Harmless while
this is a single-user application; it would need a composite primary key before
a second real user existed.

**The `syncWhoop` orchestration function end to end.** Its pieces are covered
(client, mappers, upserts) but the loop that joins them is not. It is
mostly sequencing, and covering it would mean mocking four paginated endpoints
for little information gained.

---

## ADR-0012 — Liveness and readiness are different questions

**Status:** accepted · Phase 3

### The distinction

They are not two strengths of the same check. They answer different questions
and have different remedies:

| | Question | Remedy on failure |
| --- | --- | --- |
| **liveness** | Is this process wedged? | Kill and restart the container |
| **readiness** | Can this pod serve a request right now? | Remove it from the Service's endpoints |

Because the only remedy for a failed liveness check is a restart, **anything
liveness depends on becomes something that can restart every pod at once.**

### Decision

`/api/health/live` touches nothing outside the process — no database, no
Supabase Auth, no third party. It returns 200 and the process uptime.

`/api/health/ready` runs `select 1` against Postgres with a 2 s timeout and a
5 s result cache, returning 503 when it fails.

### The failure this prevents

Had liveness checked the database, a 30-second Supabase blip would fail the
probe on every pod simultaneously. Kubernetes would restart them all. The
database would still be unreachable when they came back, so they would fail
again — a `CrashLoopBackOff` caused entirely by the probe, turning a transient
third-party degradation into a self-inflicted outage. The same check in
readiness merely takes the pods out of rotation until Postgres returns, with no
restarts and no lost process state.

### A subtler version of the same mistake

`proxy.ts` excludes `/api/health` in its matcher, rather than merely
allowlisting it as a public path. `updateSession` calls
`supabase.auth.getUser()`, which is a network round-trip to Supabase Auth **on
every request**. Leaving the probes inside the matcher would have made the
liveness check depend on a third party after all — through middleware, not
through the route handler. Worth stating because it is exactly the kind of
dependency that hides.

### The accepted cost of gating readiness on the database

With few replicas, all pods failing readiness at once means the Ingress returns
503 for everything — including `/login`, the PWA shell, and static assets, none
of which need a database. A clear "this is not serving" was preferred over a
half-working site, but the trade is real and would deserve revisiting on an app
whose logged-out pages carried value.

### Caching and timeout

Without the 5 s cache, readiness alone would open a Postgres connection several
times a minute per pod, forever, to learn something that changes rarely. The
2 s timeout matters because a probe that *hangs* is worse than one that fails:
Kubernetes would wait out `timeoutSeconds` before acting, delaying the removal
of the pod from service.

### Startup probe

A third probe exists so the other two cannot fire during boot: 30 attempts at
1 s intervals against the liveness endpoint. The app starts in about a second,
so this is generous — but the cost of generosity is zero and the cost of being
wrong is a boot loop.

It also turned out to be the component that actually enforces fail-fast on bad
configuration, since the process itself does not exit. See the correction in
ADR-0003.

---

## ADR-0013 — Resource requests measured; no CPU limit

**Status:** accepted · Phase 3

### Memory, measured against the real image

| State | Usage |
| --- | --- |
| Idle after boot | 63 MiB |
| Sustained load (~340 req/s) | 93 MiB |
| Peak after burst, then stable | 122 MiB |

Node retains heap rather than returning it to the OS, so the post-burst figure
is the number that matters.

- `requests.memory: 160Mi` — above the observed steady state. The request is
  what the scheduler reserves; under-requesting gets pods placed on nodes that
  cannot really host them.
- `limits.memory: 512Mi` — roughly 4x the observed peak. Exceeding it means the
  kernel OOM-kills the container (exit 137) and the kubelet restarts it. Too
  low and legitimate traffic kills healthy pods; too high and a real leak grows
  until it destabilises the node instead of failing one pod loudly.
- `NODE_OPTIONS=--max-old-space-size=384` — Node sizes its heap from the cgroup
  limit, but the default ceiling can sit close enough that the kernel kills the
  process before V8 runs a serious GC. Capping the heap below the container
  limit turns "OOMKilled, no explanation" into GC pressure and, at worst, a JS
  heap error with a stack trace.

### CPU: request only, no limit

`requests.cpu: 100m`, no `limits.cpu`.

`limits.cpu` is enforced by CFS quota: on reaching the quota the kernel stops
the process until the next 100 ms period. For a bursty SSR workload that shows
up directly as latency spikes, and it happens even when average utilisation is
far below the limit. The request still guarantees a scheduling floor and a
proportional share under contention, which is what actually protects the pod.

The cost, stated plainly: nothing hard-caps this container's CPU, so a runaway
loop could starve co-located pods. That is mitigated by correct requests across
the cluster rather than by quotas.

**Honest caveat on the CPU number.** `docker stats` reported 0.00% CPU while
the container was demonstrably serving thousands of requests — CPU accounting
is unreliable on the WSL2 backend. The 100m request is therefore reasoned, not
measured: the app is idle almost all the time with brief render bursts, and a
request is a floor rather than a cap. Validating it with `kubectl top` against
metrics-server is outstanding work, and the number should be treated as
provisional.

---

## ADR-0014 — Cluster topology: three nodes, two replicas

**Status:** accepted · Phase 3

A single-node cluster would run this application perfectly well, and one
replica would carry the load of its one user. Three nodes and two replicas were
chosen so the mechanisms are **observable**: pods land on different nodes via
`podAntiAffinity`, and a rolling update visibly creates, gates, and drains pods
rather than being an implementation detail.

The anti-affinity rule is `preferred`, not `required`. A hard rule would leave
the second pod `Pending` forever on a one-node cluster, which is a worse
failure than co-location.

Stated plainly for the record: two replicas are not a capacity decision here.
They exist to make the deployment behave like a real one.

Cost, measured: cluster creation 73 s, image side-load 39 s. Both are paid on
every CI run in Phase 4 and count against its budget. The image is side-loaded
with `kind load docker-image` rather than pulled from a registry, which is both
faster and a guarantee that the artefact under test is the one just built.

---

## ADR-0015 — No TLS locally, and what a public deployment would add

**Status:** accepted · Phase 3

### Decision

The Ingress serves plain HTTP. No cert-manager, no self-signed certificates.

### Why

A self-signed certificate for a made-up hostname on a laptop demonstrates
nothing that reading the manifest would not. Every client has to be told to
ignore it, so the security property being modelled — a client verifying a chain
of trust — is precisely the part that does not happen. It would be ceremony.

### What a public deployment needs

1. **cert-manager** with a `ClusterIssuer` for Let's Encrypt (ACME), using the
   HTTP-01 challenge for a single host or DNS-01 for wildcards. The Ingress
   gains a `tls:` block and a `cert-manager.io/cluster-issuer` annotation;
   certificates are then issued and renewed with no human involvement.
2. **HTTP to HTTPS redirect** at the Ingress
   (`nginx.ingress.kubernetes.io/ssl-redirect: "true"`, on by default once a
   TLS block exists).
3. **HSTS**, deliberately, and only once HTTPS is known to work — the header is
   sticky, and a mistake locks clients out of the site.
4. **A real hostname and DNS**, which is the actual prerequisite: ACME proves
   control of a domain, so there is nothing to issue against on `localhost`.

Two of those four steps are DNS and domain ownership. That is the honest reason
this is omitted rather than simulated.

### Also absent, and worth naming

No `NetworkPolicy`. Pods in this namespace can reach anything and be reached by
anything in the cluster. On a shared cluster, a default-deny policy with
explicit egress to Supabase and Anthropic would be the baseline. It is omitted
here because a single-tenant local cluster gives it nothing to defend against.

---

## ADR-0016 — Rolling updates, image tags, and rollback

**Status:** accepted · Phase 3

### Strategy

`maxSurge: 1`, `maxUnavailable: 0`.

`maxUnavailable: 0` makes the rollout strictly additive: a new pod is created,
must pass its readiness probe, and only then is an old pod terminated. **That
readiness gate is the entire mechanism behind a zero-downtime deploy** — with
`maxUnavailable: 1` the old pod could be killed first, leaving the remaining
replica to absorb all traffic while the new one boots.

The cost is capacity: the cluster must have room for `replicas + 1` during a
rollout, and the rollout will not start if it does not.

Observed: a rollout of two replicas completed in 4.1 s.

A related property was confirmed by accident while breaking things
deliberately: a deployment whose new pods never pass their probes does not take
the service down. The broken ReplicaSet stalls at one unready pod while the old
pods keep serving, because `maxUnavailable: 0` forbids removing a healthy
replica for one that has not proven itself.

### Tag by commit SHA, never `:latest`

`:latest` is a mutable pointer. Three consequences follow, and any one of them
is disqualifying:

1. **You cannot tell what is running.** `kubectl describe pod` reports
   `healthos-app:latest`, which identifies nothing. A SHA names the exact
   commit.
2. **You cannot roll back.** Rollback means running the previous image; if both
   the old and the new are called `latest`, there is no previous image to name.
3. **Replicas can silently diverge.** With `imagePullPolicy: Always` and a
   moved tag, a pod rescheduled after the tag moved pulls different code than
   its siblings — one Deployment running two versions, with nothing reporting
   it.

A SHA tag is immutable, so the image is a fact about a commit rather than a
name that happens to point somewhere today.

### Rollback

Kubernetes keeps previous ReplicaSets scaled to zero, which is what makes
`kubectl rollout undo deploy/healthos` possible: it scales the previous
ReplicaSet back up and the current one down, using the same additive strategy.
Verified end to end — rolled forward to a new tag, rolled back, and confirmed
the Deployment's image returned to the prior SHA.

For this to remain possible, `revisionHistoryLimit` must not be trimmed to zero
and old images must remain pullable — in Phase 4 that means not garbage
collecting GHCR tags that are still deployable.

### Zero-downtime, measured — and the gap that measurement found

Traffic was run continuously through the Ingress during rollouts.

| Run | Result |
| --- | --- |
| Rollback, no `preStop` | 488 OK, **1 connection refused** |
| Two rollouts, with `preStop` | 681 OK, **1 connection refused** |
| Control: same traffic, no rollout | **735 OK, 0 failures** |

The control run establishes that the failures are rollout-related rather than
ambient.

The cause is a race that `maxUnavailable: 0` does not close. When a pod is
deleted, the kubelet sends SIGTERM **and** the endpoints controller removes it
from the EndpointSlice — concurrently, with no ordering between them. The
ingress controller learns of the removal only once that propagates, so a
process that shuts down promptly can stop accepting connections while nginx is
still routing to it. Next's fast SIGTERM handling (ADR-0005) makes this *more*
likely, not less.

The mitigation is a `preStop` hook sleeping 5 s. It runs **before** SIGTERM, so
the old pod keeps serving while the endpoint removal propagates.
`terminationGracePeriodSeconds` must exceed it, hence 15. (`sleep` exists in
the image because the base is Debian — a concrete cost of distroless, per
ADR-0002.)

**It reduced the failure rate but did not eliminate it:** one failure across two
rollouts, rather than one across a single rollout. Whether the residual failure
comes from pod termination or from Docker Desktop's host port-forwarding under
connection churn was not determined — the in-cluster comparison that would have
isolated it was not run. The honest claim is therefore "roughly 99.8% of
requests succeed during a rollout, cause of the remainder unconfirmed", not
"zero downtime".

---

## ADR-0017 — ConfigMap and Secret must not overlap

**Status:** accepted · Phase 3

### The bug this avoids

The container takes its environment from two sources:

```yaml
envFrom:
  - configMapRef: { name: healthos-config }
  - secretRef:    { name: healthos-secrets }
```

**Later entries win.** The Secret was first created with
`kubectl create secret generic --from-env-file=.env.local`, which copied
*everything* in that file — including `TZ`, `ANTHROPIC_MODEL`,
`WHOOP_API_HOSTNAME`, `WHOOP_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL`, all of
which the ConfigMap also defines. The Secret's values silently overrode the
ConfigMap's, making the ConfigMap decorative: editing it would have changed
nothing, with no error and no warning.

The Secret is now built from a filtered key list so the two sets are disjoint,
and the split is verified by listing the keys of each.

### The dividing line

Not "what feels sensitive" but "what would matter if it were printed in a log
or committed to this repository". `ANTHROPIC_MODEL` is configuration.
`ANTHROPIC_API_KEY` is not.

### What a Kubernetes Secret actually is

base64, not encryption. Anyone who can read the object, or read etcd, reads the
credential. A real cluster would additionally enable encryption at rest for
secrets and restrict `get`/`list` via RBAC — neither of which makes the value
secret from a cluster administrator.

### Getting secrets into a cluster without touching Git

Locally: `kubectl create secret --from-env-file=.env.local`, where `.env.local`
is gitignored. `k8s/secret.example.yaml` is a committed template with
placeholder values and is never applied.

That is fine for a laptop and does not scale — it is manual, unaudited, and
invisible to anyone reviewing the deployment. In production, one of:

1. **External Secrets Operator** — a committed `ExternalSecret` names which
   keys to pull from Vault, AWS Secrets Manager, or GCP Secret Manager, and the
   cluster reconciles the Secret into existence. Git holds a reference, never a
   value; rotation happens at the source with no deploy. Preferred.
2. **Sealed Secrets** — encrypted with the cluster controller's public key, so
   the sealed file is safe to commit and only that cluster can decrypt it.
   GitOps-friendly; rotation means re-sealing, and losing the controller's key
   loses every sealed value.
3. **SOPS with age or KMS** — files encrypted in place, decrypted at apply
   time. Simple and tool-agnostic; the weak point is distributing the key to
   whatever runs `apply`.

What all three share, and the actual point: the plaintext never exists in the
repository, and access to it is auditable independently of who can read the
repo.

---

## ADR-0018 — The CrashLoopBackOff debugging loop

**Status:** accepted · Phase 3

Recorded because the exercise produced a finding, not just a demonstration.

### The break

An empty `ENCRYPTION_KEY` was injected into the running Deployment. Explicit
`env` entries take precedence over `envFrom`, so this overrode the Secret
without touching it — realistic, and reversible by removing one patch.

### The loop

1. **`kubectl get pods`** — *what* is the state? `0/1 Running`, restart count
   climbing. Not `CrashLoopBackOff` yet, which was itself informative: the
   container was starting successfully and failing something else.
2. **`kubectl describe pod`** — *why*? The `Events` block at the bottom is
   where the answer usually is:
   `Startup probe failed: HTTP probe failed with statuscode: 500`, followed by
   `Container app failed startup probe, will be restarted`. `Last State:
   Terminated, Exit Code: 143` — SIGTERM, meaning the kubelet killed it
   gracefully rather than the process crashing.
3. **`kubectl logs <pod> --previous`** — the *crashed* instance, not the one
   currently running. This is the flag people forget, and without it you read
   the logs of a container that has not failed yet:
   `Invalid environment variables: - ENCRYPTION_KEY: Invalid input`.

Three commands from symptom to root cause.

### What it revealed

The pod was `0/1 Running`, not crashing, because **Next does not exit when the
instrumentation hook throws** — it logs the failure and serves 500s. The
restart loop is driven entirely by the startup probe. This contradicted a claim
made in ADR-0003, which has been corrected there.

### Reading the states

- `0/1 Running` — the container is up; a probe is failing. Look at probes.
- `CrashLoopBackOff` — the container keeps exiting. Look at
  `logs --previous` and the exit code. The kubelet backs off exponentially up
  to five minutes, so a pod in this state can look "stuck" while it is merely
  waiting.
- `CreateContainerConfigError` — a referenced ConfigMap or Secret key does not
  exist. The container never starts, so there are no logs at all.
- `ImagePullBackOff` — the tag does not exist or credentials are missing. In
  kind, usually a forgotten `kind load docker-image`.
- Exit code 137 — SIGKILL, almost always the OOM killer: check
  `limits.memory`. Exit code 143 — SIGTERM, something asked it to stop.
