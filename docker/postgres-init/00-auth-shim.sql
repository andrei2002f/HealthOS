-- Minimal stand-in for the parts of Supabase that this schema depends on.
--
-- Every table in lib/db/schema.ts has a foreign key to auth.users(id) and an
-- RLS policy written against auth.uid() and the `authenticated` role. None of
-- that exists in a stock postgres image, so `drizzle-kit migrate` fails on the
-- very first statement of migration 0000. This file runs once, before any
-- migration, and creates just enough for them to apply.
--
-- Fidelity, stated plainly: this reproduces the SHAPE of Supabase Auth, not its
-- behaviour. Real auth.users has around thirty columns and GoTrue writes to it;
-- here it is a key and an email that tests populate themselves. auth.uid()
-- reads the same request-local setting Supabase uses, but nothing sets that
-- setting unless a test does so deliberately. Phase 2 revisits whether this is
-- enough fidelity or whether the tests should run against supabase/postgres.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase sets `request.jwt.claim.sub` on the connection after verifying the
-- caller's JWT; auth.uid() is a thin read of it. The `true` argument makes
-- current_setting return NULL instead of raising when the setting is unset.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- The roles the generated policies are granted to. CREATE ROLE has no
-- IF NOT EXISTS, hence the guard.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  -- Mirrors Supabase: the service role is exempt from row-level security.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema auth, public to anon, authenticated, service_role;
