# Hosting plan for the pilot (launch 1 May)

Decision: a rented server from a German hosting company, running the open-source version of
Supabase (the same software the app uses today), plus the app itself. The data stays in Germany
and on a server IfB controls. No app stores: the app is a website that anglers add to their home
screen.

## What to rent

| Item | Example | Cost (check current prices) |
|---|---|---|
| Virtual server, 4 GB RAM, 2 CPUs, ~80 GB disk, location Germany | Hetzner Cloud (Nuremberg/Falkenstein) | about €5 to €10 per month |
| Server backups (daily snapshots) | Hetzner "Backups" option | +20% of server price |
| Off-site copy of the nightly database dump | Hetzner Storage Box, or IfB's own storage | about €4 per month, or free on IfB storage |
| Web address | subdomain of the IfB site, e.g. `<name>.ifb-potsdam.de` | free (Hendrik adds one DNS record) |
| Email sending (sign-in links, results) | IfB mail server, or Brevo free plan (300 emails/day) | free |

Sign the provider's data processing agreement (Hetzner offers one online) and add it to IfB's
records for the data protection officer.

## Why email sending matters now

Anglers now sign up with their email address, so every new angler and every new phone needs a
sign-in email. The built-in sender of a fresh Supabase installation is only for testing. Set up a
real mail sender (SMTP) before the first anglers are invited.

## Setup steps (about one day for someone comfortable with Linux)

1. **Server:** create the server (Ubuntu LTS), add an SSH key, enable the firewall (ports 22, 80, 443 only).
2. **Supabase:** install Docker, then follow Supabase's self-hosting guide (Docker Compose). Set
   strong secrets (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, database password), the site URL
   (`SITE_URL` = the app's address) and the SMTP settings. Keep the admin dashboard (Studio)
   behind a password and only reachable for IfB.
3. **Database:** in Studio, SQL Editor: run `supabase/schema.sql`. Enable the `pg_cron` extension first
   so the daily automatic deletion of inactive accounts is scheduled (the script does it if pg_cron
   is on). Set the number of years in `app_settings` once the data protection officer decides, and
   change `RETENTION_YEARS` in `src/config.ts` to match (it appears in the privacy text).
4. **Auth settings:** email sign-in on, anonymous sign-ins off, "Confirm email" on. Email
   templates in German (and Polish), with the IfB sender name.
5. **App:** build with the new address and key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in
   `.env.production`, `BASE_PATH=/`), and serve the `dist/` folder over HTTPS from the same server
   (e.g. Caddy, which gets the certificate automatically). The GitHub Pages copy can stay as a demo.
6. **Backups:** nightly `pg_dump` of the database, copied off the server (Storage Box or IfB). Test a
   restore once before launch.
7. **Admins:** sign up in the app with your IfB email, then in the SQL Editor:
   `insert into public.admins (user_id) select id from auth.users where email = 'you@ifb-potsdam.de';`
8. **Move existing test data?** Not needed: the pilot starts empty. Old test accounts stay on the
   current Supabase project, which can be deleted after launch.

## Timeline to 1 May

| When | What | Who |
|---|---|---|
| December | Pick the name; request the subdomain; order the server; ask Julia for the Interreg logo files | Team, Hendrik, Julia |
| December | Privacy text and retention period to the data protection officer (Erik) | Max |
| January | Server set up (steps 1 to 7), mail sender working, app running at the new address | Max or contractor, Hendrik |
| January | Polish texts checked by a native speaker (Ania); species list and size limits checked by a fish biologist | Ania, Thilo |
| February | Internal test with IfB staff and 5 to 10 friendly anglers on both sides of the Oder | Team |
| March | Fixes from the test; recruitment material (flyer with QR code) in German and Polish; Polish partners (UPWr, PZW) lined up | Team, Julia, Krzysztof |
| April | Final check, backups tested, recruitment starts | Team |
| 1 May | Launch | |
