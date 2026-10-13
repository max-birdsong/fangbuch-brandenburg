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
