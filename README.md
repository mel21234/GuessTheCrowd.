# Guess the Crowd

A daily world poll guessing game. Every day there is one yes/no question for the whole world.
You don't answer it for points — you **guess what percentage of players said “yes”**, in three tries.

- **Guess yesterday's question** (closed, with a real final result) → the scored game.
- **Vote on today's question** → it becomes tomorrow's puzzle. Nobody sees today's result until 00:00 UTC.

Languages at launch: English (`/en`), Eesti (`/et`), Español (`/es`). Everyone plays the same question;
votes in all languages count toward one global result.

**Stack:** Next.js (App Router) · TypeScript · React 19 · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Zod · Vercel.

---

## 1. What you need to set up (accounts & keys)

| Where | What | Paste into |
|---|---|---|
| [supabase.com](https://supabase.com) → New project | Project URL, `anon` key, `service_role` key (Project Settings → API) | `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Your terminal: `openssl rand -hex 32` (twice) | Two random secrets | `IP_HASH_SECRET`, `CRON_SECRET` |
| [vercel.com](https://vercel.com) → Import the repo | Project → Settings → Environment Variables | everything from `.env.example` |
| *(optional)* Cloudflare → Turnstile → Add site | Site key + secret key | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |

Copy `.env.example` to `.env.local` for local development and fill it in.
**Never** put the `service_role` key in a `NEXT_PUBLIC_` variable.

## 2. Local setup

```bash
npm install
cp .env.example .env.local            # fill in the values
npx supabase init                     # once: creates supabase/config.toml (keeps migrations)
npx supabase start                    # local Postgres + Auth (needs Docker)
npx supabase db reset                 # applies supabase/migrations + supabase/seed.sql
npm run dev                           # http://localhost:3000
```

For a hosted project instead: `npx supabase link --project-ref <ref>` then `npx supabase db push`,
and run `supabase/seed.sql` once in the SQL editor.

**Want to click through a game locally right away?** The seed questions are unreviewed and nothing is
scheduled, so the first screen is the launch screen. To see the full game on your own machine:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/dev/local-demo.sql
```

It marks the seed translations reviewed, schedules three weeks and generates **synthetic** votes.
It refuses to run on a database that already has votes, so it can never pollute real data.
**Never run it in production.**

### Create your admin account

1. Supabase dashboard → Authentication → Users → *Add user* (email + password).
2. SQL editor: `insert into admins (user_id, email) values ('<that user's UUID>', 'you@example.com');`
3. Open `/en/admin` and sign in.

### Set the launch date

Puzzle #1 is the question scheduled on the launch date (default: the day you ran the migration).

```sql
update app_config set value = '"2026-11-01"' where key = 'launch_date';
```

## 3. How a day works

```
00:00 UTC ──► yesterday's question closes, result stored ──► becomes today's puzzle
              today's question opens for votes (no counts are ever sent to browsers)
```

- **Closing** happens in `close_due()` (SQL). It runs from the Vercel Cron at 00:00 UTC
  (`vercel.json` → `/api/cron/close`) **and lazily on every read**, so a late cron
  (Vercel Hobby crons may fire any time within the hour) never shows a stale puzzle.
  Alternative: Supabase `pg_cron` → `select cron.schedule('close', '0 0 * * *', 'select public.run_daily_close()');`
- **Minimum votes**: a question is playable only with ≥ `min_votes` (default 100, editable per question).
  Otherwise the most recent qualifying puzzle is shown with a plain explanation and the real vote count.
- **Launch day**: no puzzle yet → launch screen: vote, come back tomorrow.
  Optionally seed puzzle #0 from a **real, cited** public survey (never invented numbers):
  `select seed_launch_puzzle(<question_id>, <yes_count>, <no_count>, 'https://source…');`
- **Puzzle number** = `scheduled_date − launch_date + 1` (UTC) — identical for everyone on Earth.

## 4. Scheduling questions (admin)

`/<lang>/admin` → **Questions**: edit each question's text per language and tick **Reviewed**.
A question can only be scheduled when *every active language* has a reviewed translation
(enforced in SQL, not just the UI). All 103 seed questions start unreviewed on purpose.

**Schedule**: calendar by UTC date. Click a day to assign a ready question, move one
(moving onto another scheduled day swaps them), unschedule, void, or see live stats.
A warning appears when fewer than 14 of the next days have a question.
**Moderation**: community suggestions → approve as draft (then translate & review) or reject.

Live and closed questions can't be reworded — **void** them instead (voting stops; they never become puzzles).

## 5. Adding a language

1. Copy `locales/en.json` to `locales/<code>.json` and translate it (`npm test` checks that every key and placeholder exists).
2. Register it in `src/i18n/config.ts` (`locales`, `localeNames`, `intlLocale`) and `src/i18n/messages.ts`.
3. `insert into app_locales (code, name, sort) values ('<code>', '<Endonym>', 3);`
4. Translate & review questions in the admin. Until a question has a reviewed translation in the new
   language it can't be scheduled — set `active = false` on the locale while you catch up.
5. `npm run assets` to generate the new Open Graph image (add the code to the loop in `scripts/build-assets.mjs`).

## 6. Security & privacy model

- Browsers never query the database. All reads/writes go through Next.js route handlers →
  `SECURITY DEFINER` SQL functions callable **only by `service_role`**.
- RLS is enabled on every table with no policies for `anon`/`authenticated`, and their grants are revoked.
  Even a leaked anon key reads nothing.
- Today's result never leaves the server: `get_today` returns text only; `submit_guess` refuses
  open questions; the real answer is returned **only after the player's last guess**.
- One vote per player per question: `unique (question_id, player_id)` + server checks.
- Rate limits per **salted, daily-rotating HMAC of the IP** (raw IPs are never stored; hashes are purged after 2 days).
  Turnstile is only shown when a network exceeds the challenge threshold (`app_config`).
- No accounts, no cookies, no third-party analytics. The game uses `localStorage` only.
  Add cookie-free analytics (e.g. Plausible) if you want, and update the privacy page.

## 7. Tests

```bash
npm test                    # unit: scoring, tiles, UTC days, puzzle numbers, streaks, share text, i18n
npm run test:db             # 198 SQL assertions: day cycle, voting, guessing, RLS, admin rules
npm run test:integration    # route handlers + real SQL: duplicate votes, no answer leaks, midnight close
```

DB and integration tests need `psql` and `TEST_DATABASE_URL` pointing at a **local** Postgres
(e.g. `supabase start` → `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
They create a throwaway database, run, and drop it. They refuse to run against `*.supabase.co`.

## 8. Deploy (Vercel)

1. Push to GitHub → Vercel → *Add New Project* → import.
2. Add all environment variables (Production + Preview).
3. Deploy. The cron in `vercel.json` is picked up automatically; Vercel sends `CRON_SECRET` as a bearer token.
4. Set `NEXT_PUBLIC_SITE_URL` to your real domain (used in share text, OG tags, sitemap).

## 9. Project map

```
supabase/migrations/   schema + RLS, game functions, admin functions
supabase/seed.sql      103 questions (generated from data/questions.seed.json by `npm run seed:build`)
supabase/dev/          local-only demo data
locales/               en.json, et.json, es.json — every UI string
src/app/               pages ([locale]/…), API routes (api/…), metadata, sitemap
src/server/            route handler logic, Zod schemas, IP hashing, Turnstile
src/components/        game, admin, modals, header
src/lib/               scoring, time, stats/streaks, share text, storage, API client
tests/                 unit / db (SQL) / integration
scripts/               seed builder, test runner, icon & OG image generator
```
