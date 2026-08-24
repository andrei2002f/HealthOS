# syntax=docker/dockerfile:1.7

# Multi-stage build for the Next.js app. Rationale for the choices here lives in
# docs/DECISIONS.md (ADR-0002 base image, ADR-0003 build-time secrets,
# ADR-0005 signal handling).

# ------------------------------------------------------------------------------
# base — pinned runtime and package manager, shared by the stages that need pnpm
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

# corepack takes the pnpm version from `packageManager` in package.json, so the
# build uses the version this repo is pinned to rather than whatever the base
# image happens to ship.
RUN corepack enable

WORKDIR /app

# ------------------------------------------------------------------------------
# deps — install node_modules
#
# This stage copies ONLY the manifest and lockfile. That is the whole point of
# the layer ordering: the install layer is keyed on files that change rarely, so
# editing anything under app/ or lib/ reuses it. Copying the source first would
# reinstall every dependency on every commit.
# ------------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
# builder — compile the app
#
# No secret is required or accepted by this stage. Environment validation is
# lazy (lib/env.ts), so the build never touches DATABASE_URL, the Anthropic key,
# or the Whoop client secret.
# ------------------------------------------------------------------------------
FROM base AS builder

# `NEXT_PUBLIC_*` is not a runtime variable: Next substitutes it textually into
# the bundles during the build, so these must be present now and are baked into
# the image. That is acceptable because they are public by definition — the
# Supabase anon key is protected by row-level security, not by being secret.
# The consequence to be aware of: an image is tied to one Supabase project and
# cannot be repointed at another without a rebuild.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ------------------------------------------------------------------------------
# runner — the shipped image
#
# Starts from the clean base rather than from `builder`, so the source tree,
# pnpm, and the dev dependencies are all absent from the final image.
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# A numeric UID, not just a name. Kubernetes `runAsNonRoot: true` inspects the
# image's user and can only verify a numeric one — it refuses to start a pod
# whose image declares a username it cannot resolve. Running as root would also
# mean uid 0 on the host, since containers do not remap user namespaces by
# default, so a runtime escape would start out privileged.
RUN groupadd --system --gid 10001 nodejs \
 && useradd --system --uid 10001 --gid nodejs --no-create-home nextjs

# Three copies, because `output: "standalone"` emits only the server bundle:
#
#   1. the traced server and its node_modules
#   2. .next/static — the hashed JS/CSS chunks the browser fetches; omitting
#      this yields a server that runs and renders nothing but 404s for assets
#   3. public/ — taken from the BUILDER, not from the build context. Serwist
#      generates public/sw.js during `pnpm build`, so copying from the context
#      would ship the app without its service worker.
COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=builder --chown=10001:10001 /app/public ./public

USER 10001:10001

EXPOSE 3000

# node runs as PID 1. Next's standalone server registers its own SIGTERM and
# SIGINT handlers, so `docker stop` and a Kubernetes pod eviction both shut it
# down cleanly with no init shim in between. This is only safe because the
# handler genuinely exists — PID 1 gets no default signal dispositions, so an
# unhandled SIGTERM would be ignored and the process would wait out the grace
# period and be SIGKILLed. Verified by timing `docker stop`.
CMD ["node", "server.js"]
