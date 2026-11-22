# Butcher Block Steakhouse — Local Backend Development Guide

This guide explains how to run the **completely isolated local Supabase backend** (PostgreSQL 15, Auth, PostgREST, Realtime, Storage, Edge Functions, and Inbucket email testing) using Docker and the Supabase CLI.

> **Safety Rule:** Never copy production customer records into local development, and never run `supabase db reset` against a remote/production database. Every local script runs `scripts/local-supabase-guard.mjs` first to refuse non-localhost database targets.

---

## 1. Prerequisites

1. **Docker-compatible container runtime** (Docker Desktop, OrbStack, or Colima) running locally.
2. **Supabase CLI** (`brew install supabase/tap/supabase` on macOS, or via the official Supabase CLI installer).
3. **Node.js 20+** and project dependencies installed (`npm ci`).

Verify prerequisites:

```bash
docker info --format '{{.ServerVersion}}'
supabase --version
```

---

## 2. Startup & Local Configuration

1. Start the local isolated Supabase stack (applies all migrations in `supabase/migrations/` and seeds synthetic test data from `supabase/seed.sql`):

   ```bash
   npm run db:start
   ```

2. Print local service URLs and the **local-only** `anon key`:

   ```bash
   npm run db:status
   ```

   Key local endpoints (configured in `supabase/config.toml`):
   - **API / PostgREST / Auth / Realtime:** `http://127.0.0.1:54321`
   - **PostgreSQL:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - **Supabase Studio:** `http://127.0.0.1:54323`
   - **Inbucket (local email inbox for verification & password-reset testing):** `http://127.0.0.1:54324`

3. Configure the React app for local Supabase **explicitly**:

   ```bash
   cp .env.local.example .env.local
   ```

   Paste the local `anon key` from `npm run db:status` into `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (`.env.local` is gitignored — never commit it).

4. Start the frontend dev server:

   ```bash
   npm run dev
   ```

---

## 3. Sanitized Synthetic Test Accounts (`supabase/seed.sql`)

All local seed records use synthetic `.local` addresses with password `TestPassword123!`:

| Role | Email | Notes |
| --- | --- | --- |
| Admin / Manager | `admin.test@butcherblock.local` | Full `/admin` ops access |
| Kitchen | `chef.test@butcherblock.local` | Kitchen status transitions |
| Waiter | `waiter.test@butcherblock.local` | Table sessions & waiter service requests |
| Customer A | `didi.test@butcherblock.local` | Completed paid order + booking for review/loyalty testing |
| Customer B | `anna.test@butcherblock.local` | Pending order + booking for RLS cross-user isolation tests |

Seeded QR table codes: `BB-T01-DEV001` (`T01`) through `BB-T04-DEV004` (`T04`).

---

## 4. Common Daily Commands

| Task | Command |
| --- | --- |
| Start local stack | `npm run db:start` |
| Stop local stack | `npm run db:stop` |
| Re-apply all migrations + re-seed locally (destructive to local test data only) | `npm run db:reset` |
| Run pgTAP database security & transaction tests | `npm run db:test` |
| Run local backend health check | `LOCAL_SUPABASE_ANON_KEY="<local-anon-key>" npm run db:health` |
| Regenerate TypeScript database types from local schema | `npm run db:types` |
| Serve Edge Functions locally | `npm run db:functions:serve` |
| Check secret-leak scanner | `npm run security:secrets` |

---

## 5. Testing Auth Emails Locally (Inbucket)

Because `supabase/config.toml` enables `auth.email.enable_confirmations = true` and routes emails to Inbucket:

1. Sign up or request a password reset at `http://localhost:8080/auth/sign-up` or `/auth/forgot`.
2. Open Inbucket at `http://127.0.0.1:54324`.
3. Click the confirmation or reset link — it routes cleanly back to `http://localhost:8080/auth/verify` or `/auth/reset`.

---

## 6. Syncing Canonical Menu Prices to the Database

Server-side order pricing (`public.submit_order`) validates every dish, weight variation, and steak sauce against `public.menu_catalog` and `public.menu_sauce_addons`. Whenever `src/data/menu.ts` changes, regenerate the catalog sync SQL via:

```bash
node scripts/generate-menu-catalog-sql.mjs
```
