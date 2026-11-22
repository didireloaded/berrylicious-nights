# Butcher Block Steakhouse — Backend Hardening, Security & CI Reference

This document summarizes the foundational backend, security, and CI architecture delivered under **Prompts 01, 02, and 03** without modifying the approved customer UI or adding unapproved features.

---

## 1. Authoritative Backend Architecture (Prompt 02)

Migration [`20261124010000_backend_hardening_catalog_and_rpcs.sql`](../supabase/migrations/20261124010000_backend_hardening_catalog_and_rpcs.sql) establishes Supabase PostgreSQL as the single authoritative source of truth for restaurant operations:

- **Server-Calculated Menu Pricing (`public.menu_catalog`, `public.menu_sauce_addons`, `public.resolve_menu_item_price_cents`)**:
  - Synced 1:1 from `src/data/menu.ts` via `scripts/generate-menu-catalog-sql.mjs` (all 232 Namibian menu items + 14 PDF steak sauces).
  - Both `public.submit_order` and `public.add_group_order_item` recompute exact `N$` prices server-side and reject tampered client prices, seasonal-quote (`S.Q.`) self-pricing, unknown IDs, and kitchen-disabled (`public.menu_item_disabled`) items.
- **Atomic, Idempotent Order Submission (`public.submit_order`)**:
  - Uses transactional advisory locks + unique `orders.idempotency_key` index so dropped connections and double taps never create duplicate kitchen tickets.
  - Validates QR `table_session_id` + `table_session_token` server-side for dine-in table orders and stores SHA-256 `guest_access_token_hash` for secure guest tracking.
- **Enforced Kitchen State Machine & Operational Audit Trail (`public.operational_audit_log`)**:
  - `BEFORE UPDATE` trigger (`guard_orders_direct_mutation`) blocks direct browser tampering with `orders.total`, `orders.status`, and `orders.payment_status` outside trusted `SECURITY DEFINER` RPCs.
  - `transition_order_status` and `mark_order_payment_status` record actor, role, before/after state, and timestamp in `public.operational_audit_log` (readable by managers/admins only).
- **Controlled Schema Compatibility**:
  - Both `src/pages/AdminPage.tsx` and `src/lib/supabaseArrivalInsert.ts` default to strict mode (`VITE_ALLOW_LEGACY_SCHEMA_FALLBACK` unset / `"false"`), refusing to silently bypass status-transition RPCs or strip order/booking metadata columns.
- **PWA Cache Isolation (`vite.config.ts`)**:
  - Manifest updated to **Butcher Block Steakhouse**.
  - Explicit Workbox `NetworkOnly` rules prevent private Supabase Auth, REST, Storage, Realtime, and Edge Function responses from entering shared service-worker caches.
- **Restored Baseline RPCs & `pgcrypto` Fix**:
  - Restores `booked_table_times`, `active_bookings_count`, `ensure_restaurant_chat_for_me`, and `join_waitlist` in migrations for complete local parity.
  - Fixes `search_path = public, extensions` on 7 existing Phase 3 / 4 / 6 RPCs calling `gen_random_bytes(...)`.

---

## 2. Database Security Tests (pgTAP)

Located in `supabase/tests/database/`:

- `01_schema_and_rpcs.test.sql` — verifies core tables, full 232-item catalog + 14 sauces, RLS enabled on all 20 security-sensitive tables, and all required RPC signatures.
- `02_rls_isolation.test.sql` — proves `anon` cannot read private orders/bookings/profiles/audit logs, Customer A cannot read Customer B's data or call staff RPCs, and authorized staff can execute valid transitions.
- `03_server_pricing_and_transactions.test.sql` — proves tampered browser prices (`N$ 1`) are overridden by server pricing (`N$ 780`), duplicate idempotency keys deduplicate cleanly, disabled/unknown items are rejected, guest-token tracking validates SHA-256 hashes, QR resolution works, direct `orders` mutations are blocked, invalid backward transitions are rejected, and audit log entries are recorded.

---

## 3. Enforced CI & Security Pipeline (Prompt 03)

- **`.github/workflows/ci.yml`** (`permissions: contents: read`, zero production secrets on PRs):
  1. `quality-and-build`: `npm ci`, secret-leak scan (`npm run security:secrets`), `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — all strictly enforced (no `continue-on-error`).
  2. `database-verify`: isolated Docker + Supabase CLI (`supabase start`, `supabase db reset --local`, `supabase test db --local`, `scripts/db-healthcheck.mjs`).
  3. `playwright-smoke`: builds preview server and runs `tests/e2e/smoke.spec.ts` across onboarding, guest cart, auth validation, open-redirect blocking, and mobile/desktop viewports.
  4. `dependency-audit`: `npm audit --omit=dev --audit-level=high`.
- **`.github/workflows/codeql.yml`**: JavaScript/TypeScript CodeQL security-extended static analysis on push to `main`, PRs, and weekly schedule.
- **`.github/dependabot.yml`**: Automated weekly npm and GitHub Actions security & version updates.

### Recommended GitHub Branch Protection Rules (`main`)

In **GitHub → Settings → Branches → Branch protection rules (`main`)**, require:
- Pull request before merging (minimum 1 approval).
- Status checks to pass before merging:
  - `TypeScript, ESLint, Unit Tests & Production Build`
  - `Local Supabase Migrations & pgTAP Security Tests`
  - `Playwright Customer & Auth Smoke Suite`
  - `Dependency Vulnerability Audit`
  - `Analyze JavaScript / TypeScript` (CodeQL)
- Disallow force-pushes and branch deletions.

---

## 4. Next Integration Sequence (Deferred Until Approved / Ready)

Follow the blueprint order strictly after `feat/backend-security-ci` passes CI:
1. **Prompt 04 — Sentry** (error monitoring with strict PII scrubbing)
2. **Prompt 05 — Cloudflare Turnstile** (server-verified anti-bot on signup, guest order/booking/waitlist/feedback)
3. **Prompt 06 — Resend** (transactional emails via Supabase Edge Functions)
4. **Prompt 07 — Native Web Push or OneSignal** (single push architecture)
5. **Prompts 08–13** (PostHog, CDN/WAF headers, PayToday/SELCOM, POS, WhatsApp, AI assistant audit) — only once restaurant operational decisions are confirmed.
