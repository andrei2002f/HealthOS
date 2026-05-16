# Health OS

Personal health & fitness tracker — integrates [Whoop](https://www.whoop.com/)
biometrics with manually tracked strength training, basketball, supplements and
daily check-ins, plus an AI coach powered by Claude.

Single-user app, installable as a PWA. See [`docs/PRD.md`](docs/PRD.md) for the
full product spec and [`CLAUDE.md`](CLAUDE.md) for build conventions.

## Stack

Next.js 16 · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + Auth) ·
Drizzle ORM · Recharts · Anthropic SDK · Serwist (PWA).

## Getting started

```bash
pnpm install
cp .env.example .env.local      # fill in your keys
pnpm db:migrate                 # apply the schema to Supabase
pnpm dev
```

## Scripts

| Command            | Purpose                              |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | Dev server                           |
| `pnpm build`       | Production build                     |
| `pnpm typecheck`   | `tsc --noEmit`                       |
| `pnpm lint`        | ESLint                               |
| `pnpm format`      | Prettier                             |
| `pnpm db:generate` | Generate a migration from the schema |
| `pnpm db:migrate`  | Apply pending migrations             |
| `pnpm db:studio`   | Drizzle Studio                       |
