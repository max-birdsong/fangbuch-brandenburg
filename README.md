# Fangbuch Brandenburg

A catch log app for recreational anglers in Brandenburg, built for the Institut für Binnenfischerei e.V. (IfB) Potsdam-Sacrow. Anglers get a personal logbook (fishing days, catches, own stats); IfB gets effort and catch data for research, including days without a catch.

Status: **proof of concept / pilot**. Licensed to IfB, all rights reserved.

## What it does

- Installable web app (PWA): works on any phone from the browser, can be added to the home screen, **works offline** at the water and syncs later.
- No login needed to start. Anglers can later secure their log with an email address (6-digit code, no password), which also lets them restore it on a new phone.
- One-time profile: years fishing, home postcode (no address), club membership and club name, Fischereischein, licenses.
- One form per fishing day, filled in at the water or afterwards: water body, date and from–to time, method / shore or boat / target species (remembered from last time), catch per species as released and kept counts with optional lengths, satisfaction 1 to 5. No catch = leave the catch list empty. Tapping a past day opens the same form to edit it.
- Optional baseline survey (age, avidity, skill, centrality/attraction, motivations, catch orientation, Oder questions), offered after the first fishing day. Answers save as you go and can be resumed.
- Water picker: nearest water via GPS (computed on the phone, coordinates are never stored), recently visited, search, by region, or free text.
- German and English. Polish can be added in `src/i18n.ts`.
- Anglers can download their own data (CSV) and delete their account with all data.

## Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the printed URL. Without Supabase settings the app runs in **demo mode**: everything works, data stays in the browser.

## Connect the database (Supabase, free tier)

1. Create a project at supabase.com, region **EU (Frankfurt)**.
2. SQL Editor: paste and run `supabase/schema.sql` (tables, access rules, export views).
3. Authentication > Sign In / Providers: enable **Allow anonymous sign-ins** and **Email**.
4. Authentication > Emails > Templates: in "Magic Link" and "Change Email Address", include the code `{{ .Token }}` in the text (the app asks for the 6-digit code, not a link).
5. Put the Project URL and publishable (anon) key in `.env.production` (used by the deployed app) and, for local testing against the database, in `.env` (copy `.env.example`).
6. `npm run dev` again. The home screen shows "All entries backed up" once sync works.

Before a real pilot:

- Supabase's built-in email sender is heavily rate limited. Set up custom SMTP (IfB mail server or a free provider such as Brevo) under Authentication > Emails > SMTP.
- Turn on CAPTCHA protection for sign-ins (Authentication > Attack Protection) to stop bots creating anonymous accounts.
- Sign Supabase's data processing agreement (DPA) and have the IfB data protection officer review the privacy text in `src/i18n.ts` (marked as draft).

## Getting the data out

In the Supabase dashboard, SQL Editor:

```sql
select * from export_trips;    -- one row per fishing day, with fish counts and angler profile
select * from export_catches;  -- one row per catch entry
select * from export_survey_long;  -- survey answers, see below
```

Then "Download CSV". `user_id` is a pseudonymous ID; names and emails are never part of the exports. Deleted entries are excluded.

## Dashboard

The app has a research dashboard at `#/admin` (Profile > Auswertung): key figures, fishing days per week, fish per angler-hour by water, catch by species (kept/released), survey scale means and motivations, and CSV downloads.

- Everyone can open it, but it only shows **this device's** data unless the account is an admin.
- To see all anglers: secure your account with your email in the app (Profile > Mit E-Mail sichern), then in the Supabase SQL Editor run
  ```sql
  insert into public.admins (user_id) select id from auth.users where email = 'you@example.org';
  ```
  and sign in on the device with that email. Admins can read all data but cannot change it.

## Survey

Questions live in `src/data/survey.ts`, one plain file with DE/EN wording, scale definitions and literature references. Edit wording there; give an item a new `id` and bump `version` if you change what it measures.

The item wordings are reconstructed from the cited scales and the German versions are drafts. **Check them against the original publications before fielding.**

Export (long format, one row per angler and item):

```sql
select * from export_survey_long;
```

Scale answers are stored 1 to 5 as answered; items marked `reverse` in the survey file still need reverse-coding in analysis.

## Water bodies

`public/waters.json` currently holds a **hand-made starter list** of ~80 well-known Brandenburg waters with approximate points (good enough for testing GPS suggestions).

Replace it with the full OpenStreetMap-based list (lakes with shorelines, rivers split into ~10 km sections named after the nearest town, grouped by Landkreis):

```bash
npm run import:waters                          # lakes >= 5 ha
npm run import:waters -- --min-ha=2 --section-km=8
```

This calls the public Overpass API and takes a few minutes. Review the result before release. IfB's own spatial units (e.g. Oder sections by river km or lease areas) can replace the automatic sectioning later; the app only needs `id`, `name`, `type`, `region`, `lat`, `lon` and optionally `geom` per water.

## Deploy

Any static host works (`npm run build` produces `dist/`). Free options:

- **Cloudflare Pages / Netlify**: connect the repo, build command `npm run build`, output `dist`, set the two `VITE_SUPABASE_*` variables.
- **GitHub Pages**: the included workflow `.github/workflows/deploy.yml` builds and publishes on every push to `main` (public repo, or a paid plan for private ones), using the Supabase settings in `.env.production`. Set Pages source to "GitHub Actions".

The app must be served over HTTPS for GPS and offline mode (all of the above do this).

## Project layout

```
src/
  main.tsx            routes and app start
  i18n.ts             all texts (DE/EN), privacy draft
  data/catalog.ts     species, methods, licenses (codes stored in DB)
  lib/db.ts           local offline database (IndexedDB)
  lib/sync.ts         background sync with Supabase
  lib/auth.ts         anonymous start, email code sign-in
  lib/waters.ts       water list, nearest-water matching, search
  screens/            one file per screen
supabase/schema.sql   database schema, access rules, export views
scripts/              water import (OSM), starter list, icon generation
```

## Open questions for IfB

- Review species list, methods and license types (`src/data/catalog.ts`).
- Check survey item wording against the original scales (`src/data/survey.ts`).
- Minimum age and consent for under-16s (DSB).
- Spatial units for the Oder and other large rivers.
- Hosting long term (Supabase vs. IfB server) and domain.
