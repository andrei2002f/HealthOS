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
The `instrumentation.ts` call restores fail-fast: a misconfigured container
exits immediately and loudly. Under Kubernetes that surfaces as an obvious
`CrashLoopBackOff` at rollout instead of an app that starts healthy and serves
errors, which is the behaviour worth having.

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
