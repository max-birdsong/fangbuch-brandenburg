-- Fangbuch Brandenburg: database schema for Supabase (Postgres).
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
--
-- Data model
--   profiles  one row per angler (auth user): background info asked once at onboarding
--   trips     one row per fishing day ("Angeltag"), including days without a catch (effort data)
--   catches   one row per catch entry, belongs to a trip
--   survey_responses  optional baseline survey, one row per angler (answers as JSON)
--
-- Privacy by design: no raw GPS coordinates are stored. A trip stores the chosen water body id
-- and how it was chosen (gps / recent / search / manual). Home location is a postcode only.
-- Row Level Security: anglers can only read and write their own rows. Researchers export via the
-- Supabase dashboard (SQL editor / table editor), which uses the service role and bypasses RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  lang              text not null default 'de' check (lang in ('de', 'en', 'pl')),
  years_fishing     smallint check (years_fishing between 0 and 90),
  home_country      text check (home_country in ('DE', 'PL', 'other')),
  home_postcode     text check (home_postcode ~ '^[0-9A-Za-z -]{2,10}$'),
  club_status       text check (club_status in ('active', 'passive', 'none')),
  club_name         text check (char_length(club_name) <= 200),
  has_fishing_exam  boolean,                  -- Fischereischein / Fischerprüfung
  licenses          text[] not null default '{}',
  licenses_other    text check (char_length(licenses_other) <= 200),
  consent_version   text not null,
  consent_at        timestamptz not null
);

-- ---------------------------------------------------------------- trips
create table if not exists public.trips (
  id                uuid primary key,          -- generated on the device (offline-first)
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  water_id          text,                      -- id from the app's waters list (waters.json)
  water_name        text not null,             -- name at time of logging, kept for readability
  water_other       text check (char_length(water_other) <= 200), -- free text if "other water"
  water_choice      text check (water_choice in ('gps', 'recent', 'search', 'manual', 'other')),
  water_gps_distance_m integer,                -- distance to the suggested water when chosen via GPS (no coordinates)
  logged_live       boolean not null default true,  -- false = entered afterwards ("nachgetragen")
  started_at        timestamptz not null,
  ended_at          timestamptz,
  method            text,
  platform          text check (platform in ('shore', 'boat', 'wading')),
  targets           text[] not null default '{}',
  satisfaction      smallint check (satisfaction between 1 and 5),
  deleted           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists trips_user_idx on public.trips (user_id);
create index if not exists trips_water_idx on public.trips (water_id);
create index if not exists trips_started_idx on public.trips (started_at);

-- ---------------------------------------------------------------- catches
create table if not exists public.catches (
  id                uuid primary key,          -- generated on the device
  trip_id           uuid not null references public.trips (id) on delete cascade,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  species           text not null,             -- species code, see src/data/species.ts
  count             smallint not null default 1 check (count between 1 and 999),
  length_cm         numeric(5, 1) check (length_cm > 0 and length_cm < 400),  -- null = not measured
  kept              boolean not null,          -- true = entnommen, false = zurückgesetzt
  caught_at         timestamptz,
  deleted           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists catches_trip_idx on public.catches (trip_id);
create index if not exists catches_user_idx on public.catches (user_id);
create index if not exists catches_species_idx on public.catches (species);

-- ---------------------------------------------------------------- survey responses
-- One row per angler and survey. Answers are stored as JSON {item_id: value}; item ids and
-- scales are defined in src/data/survey.ts. Numeric scale answers are 1..5 (not reverse-coded).
create table if not exists public.survey_responses (
  id                uuid primary key,          -- generated on the device
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  survey_id         text not null,
  survey_version    integer not null,
  answers           jsonb not null default '{}'::jsonb,
  started_at        timestamptz not null,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, survey_id)
);

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.trips    enable row level security;
alter table public.catches  enable row level security;
alter table public.survey_responses enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own trips" on public.trips;
create policy "own trips" on public.trips
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own catches" on public.catches;
create policy "own catches" on public.catches
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

drop policy if exists "own survey responses" on public.survey_responses;
create policy "own survey responses" on public.survey_responses
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- research admins
-- Accounts listed here can read ALL anglers' data (for the in-app dashboard at #/admin).
-- Add yourself after securing your account with email in the app:
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.org';
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists "admins read trips" on public.trips;
create policy "admins read trips" on public.trips for select to authenticated using (public.is_admin());
drop policy if exists "admins read catches" on public.catches;
create policy "admins read catches" on public.catches for select to authenticated using (public.is_admin());
drop policy if exists "admins read survey responses" on public.survey_responses;
create policy "admins read survey responses" on public.survey_responses for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists trips_touch on public.trips;
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();
drop trigger if exists catches_touch on public.catches;
create trigger catches_touch before update on public.catches
  for each row execute function public.touch_updated_at();
drop trigger if exists survey_touch on public.survey_responses;
create trigger survey_touch before update on public.survey_responses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- self-service account deletion
-- Lets an angler delete their own account and all their data from inside the app (DSGVO Art. 17).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();   -- cascades to profiles, trips, catches
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- research export views
-- Not exposed to the app (no grants to anon/authenticated). Query in the dashboard SQL editor,
-- then use "Download CSV". user_id is the pseudonymous auth id; no names or emails are joined.
create or replace view public.export_trips with (security_invoker = true) as
select
  t.id as trip_id, t.user_id, t.water_id, t.water_name, t.water_other, t.water_choice,
  t.water_gps_distance_m, t.logged_live, t.started_at, t.ended_at,
  round(extract(epoch from (t.ended_at - t.started_at)) / 3600.0, 2) as hours_fished,
  t.method, t.platform, t.targets, t.satisfaction,
  coalesce(c.n_fish, 0) as n_fish, coalesce(c.n_kept, 0) as n_kept,
  p.years_fishing, p.home_country, p.home_postcode, p.club_status, p.club_name,
  p.has_fishing_exam, p.licenses
from public.trips t
left join (
  select trip_id, sum(count) as n_fish, sum(case when kept then count else 0 end) as n_kept
  from public.catches where not deleted group by trip_id
) c on c.trip_id = t.id
left join public.profiles p on p.id = t.user_id
where not t.deleted;

create or replace view public.export_catches with (security_invoker = true) as
select
  c.id as catch_id, c.trip_id, c.user_id, c.species, c.count, c.length_cm, c.kept, c.caught_at,
  t.water_id, t.water_name, t.started_at as trip_started_at, t.method, t.platform
from public.catches c
join public.trips t on t.id = c.trip_id
where not c.deleted and not t.deleted;

-- Survey answers in long format (one row per angler x item). Pivot to wide in R/Python, e.g.
-- tidyr::pivot_wider(names_from = item, values_from = value).
create or replace view public.export_survey_long with (security_invoker = true) as
select r.user_id, r.survey_id, r.survey_version, r.started_at, r.completed_at,
       a.key as item, a.value #>> '{}' as value
from public.survey_responses r
cross join lateral jsonb_each(r.answers) a;

revoke all on public.export_trips, public.export_catches, public.export_survey_long from anon, authenticated;

-- =============================================================== Oder pilot (Nov 2026)
-- Safe to run on an existing database: only adds columns, tables and functions.

-- ---------------------------------------------------------------- contact opt-ins, last seen
-- What the angler agreed to be emailed about (codes from CONTACT_OPTINS in src/data/catalog.ts).
alter table public.profiles add column if not exists contact_optins text[] not null default '{}';
-- Updated by the app about once a day; used to find inactive accounts for automatic deletion.
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- ---------------------------------------------------------------- settings
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
-- Years without activity after which an account is deleted automatically. Placeholder (3) until
-- the data protection officer decides; keep RETENTION_YEARS in src/config.ts the same (privacy text).
insert into public.app_settings (key, value) values ('retention_years', '3') on conflict (key) do nothing;

-- ---------------------------------------------------------------- anonymous archive
-- When an account is deleted for inactivity, its fishing data is kept here without any link to
-- the person: a new random archive_id instead of the account id, and no email, postcode or club
-- name. (When anglers delete their account themselves, everything is deleted, nothing archived.)
create table if not exists public.archive_profiles (
  archive_id       uuid primary key,
  archived_at      timestamptz not null default now(),
  lang             text,
  years_fishing    smallint,
  home_country     text,
  club_status      text,
  has_fishing_exam boolean,
  licenses         text[]
);
create table if not exists public.archive_trips (
  id uuid primary key, archive_id uuid not null, water_id text, water_name text not null, water_choice text,
  logged_live boolean, started_at timestamptz not null, ended_at timestamptz, method text, platform text,
  targets text[], satisfaction smallint
);
create table if not exists public.archive_catches (
  id uuid primary key, trip_id uuid not null, archive_id uuid not null, species text not null,
  count smallint not null, length_cm numeric(5, 1), kept boolean not null
);
create table if not exists public.archive_survey_responses (
  id uuid primary key, archive_id uuid not null, survey_id text not null, survey_version integer not null,
  answers jsonb not null, started_at timestamptz, completed_at timestamptz
);
alter table public.archive_profiles enable row level security;
alter table public.archive_trips enable row level security;
alter table public.archive_catches enable row level security;
alter table public.archive_survey_responses enable row level security;
revoke all on public.archive_profiles, public.archive_trips, public.archive_catches, public.archive_survey_responses from anon, authenticated;
drop policy if exists "admins read archive profiles" on public.archive_profiles;
create policy "admins read archive profiles" on public.archive_profiles for select to authenticated using (public.is_admin());
drop policy if exists "admins read archive trips" on public.archive_trips;
create policy "admins read archive trips" on public.archive_trips for select to authenticated using (public.is_admin());
drop policy if exists "admins read archive catches" on public.archive_catches;
create policy "admins read archive catches" on public.archive_catches for select to authenticated using (public.is_admin());
drop policy if exists "admins read archive survey" on public.archive_survey_responses;
create policy "admins read archive survey" on public.archive_survey_responses for select to authenticated using (public.is_admin());
grant select on public.archive_profiles, public.archive_trips, public.archive_catches, public.archive_survey_responses to authenticated;

-- Copies an account's fishing data into the archive (anonymously) and deletes the account.
create or replace function public.anonymise_account(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid := gen_random_uuid();
begin
  insert into public.archive_profiles (archive_id, lang, years_fishing, home_country, club_status, has_fishing_exam, licenses)
    select aid, lang, years_fishing, home_country, club_status, has_fishing_exam, licenses from public.profiles where id = uid;
  insert into public.archive_trips
    select id, aid, water_id, water_name, water_choice, logged_live, started_at, ended_at, method, platform, targets, satisfaction
    from public.trips where user_id = uid and not deleted;
  insert into public.archive_catches
    select c.id, c.trip_id, aid, c.species, c.count, c.length_cm, c.kept
    from public.catches c join public.trips t on t.id = c.trip_id
    where c.user_id = uid and not c.deleted and not t.deleted;
  insert into public.archive_survey_responses
    select id, aid, survey_id, survey_version, answers, started_at, completed_at from public.survey_responses where user_id = uid;
  delete from auth.users where id = uid;   -- cascades to profile, trips, catches, survey
end $$;
revoke all on function public.anonymise_account(uuid) from public, anon, authenticated;

-- Deletes (anonymises) every account inactive for longer than retention_years. Admin accounts are
-- skipped. Returns the number of accounts processed. Runs daily via pg_cron (below).
create or replace function public.purge_inactive_accounts() returns integer
language plpgsql security definer set search_path = public as $$
declare
  years int := coalesce((select value::int from public.app_settings where key = 'retention_years'), 3);
  n int := 0;
  u record;
begin
  for u in
    select au.id from auth.users au
    left join public.profiles p on p.id = au.id
    where au.id not in (select user_id from public.admins)
      and greatest(
            au.created_at,
            au.last_sign_in_at,
            p.last_seen_at,
            p.updated_at,
            (select max(t.updated_at) from public.trips t where t.user_id = au.id)
          ) < now() - make_interval(years => years)
  loop
    perform public.anonymise_account(u.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.purge_inactive_accounts() from public, anon, authenticated;

-- Daily at 03:30 server time. Needs the pg_cron extension (Supabase: Database > Extensions >
-- pg_cron; included in self-hosted Supabase). Without it, run the function by hand now and then.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-inactive-accounts', '30 3 * * *', 'select public.purge_inactive_accounts()');
  end if;
end $$;

-- ---------------------------------------------------------------- contact list for admins
-- Email addresses of anglers who opted in, for sending study results or invitations.
create or replace function public.admin_contact_list()
returns table (email text, lang text, contact_optins text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select au.email::text, p.lang, p.contact_optins
    from public.profiles p join auth.users au on au.id = p.id
    where cardinality(p.contact_optins) > 0 and au.email is not null
    order by au.email;
end $$;
revoke all on function public.admin_contact_list() from public, anon;
grant execute on function public.admin_contact_list() to authenticated;

-- ---------------------------------------------------------------- exports including the archive
create or replace view public.export_trips_all with (security_invoker = true) as
select 'active' as source, trip_id, user_id as person_id, water_id, water_name, water_choice, logged_live,
       started_at, ended_at, hours_fished, method, platform, targets, satisfaction, n_fish, n_kept,
       years_fishing, home_country, club_status, has_fishing_exam, licenses
from public.export_trips
union all
select 'archived', t.id, t.archive_id, t.water_id, t.water_name, t.water_choice, t.logged_live,
       t.started_at, t.ended_at, round(extract(epoch from (t.ended_at - t.started_at)) / 3600.0, 2),
       t.method, t.platform, t.targets, t.satisfaction,
       coalesce(c.n_fish, 0), coalesce(c.n_kept, 0),
       p.years_fishing, p.home_country, p.club_status, p.has_fishing_exam, p.licenses
from public.archive_trips t
left join (select trip_id, sum(count) as n_fish, sum(case when kept then count else 0 end) as n_kept
           from public.archive_catches group by trip_id) c on c.trip_id = t.id
left join public.archive_profiles p on p.archive_id = t.archive_id;

create or replace view public.export_catches_all with (security_invoker = true) as
select 'active' as source, catch_id, trip_id, user_id as person_id, species, count, length_cm, kept,
       water_id, water_name, trip_started_at, method, platform
from public.export_catches
union all
select 'archived', c.id, c.trip_id, c.archive_id, c.species, c.count, c.length_cm, c.kept,
       t.water_id, t.water_name, t.started_at, t.method, t.platform
from public.archive_catches c join public.archive_trips t on t.id = c.trip_id;

revoke all on public.export_trips_all, public.export_catches_all from anon, authenticated;
