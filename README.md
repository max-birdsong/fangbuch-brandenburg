# Fangbuch Brandenburg

A catch log app for recreational anglers in Brandenburg, built for the Institut für Binnenfischerei e.V. (IfB) Potsdam-Sacrow. Anglers get a personal logbook (fishing days, catches, own stats); IfB gets effort and catch data for research, including days without a catch.

Status: **proof of concept / pilot**. Licensed to IfB, all rights reserved.

## What it does

- Installable web app (PWA): works on any phone from the browser, can be added to the home screen, **works offline** at the water and syncs later.
- No login needed to start. Anglers can later secure their log with an email address (6-digit code, no password), which also lets them restore it on a new phone and enter the prize draw.
- One-time profile: years fishing, home postcode (no address), club membership and club name, Fischereischein, licenses.
- Fishing day ("Angeltag"): water body, method, shore/boat/wading, target species. Log live, or add a past day afterwards.
- Catches: species, number, length (or "not measured"), kept or released.
- Satisfaction (1 to 5) at the end of each day.
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
5. Copy `.env.example` to `.env` and fill in Project URL and anon key (Project Settings > API).
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
```

Then "Download CSV". `user_id` is a pseudonymous ID; names and emails are never part of the exports. Deleted entries are excluded.

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
- **GitHub Pages**: the included workflow `.github/workflows/deploy.yml` builds and publishes on every push to `main` (public repo, or a paid plan for private ones). Add the two variables under Settings > Secrets and variables > Actions > Variables, and set Pages source to "GitHub Actions".

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
- Minimum age and consent for under-16s (DSB).
- Spatial units for the Oder and other large rivers.
- Hosting long term (Supabase vs. IfB server) and domain.
