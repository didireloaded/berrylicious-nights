# Butcher Block Steakhouse — Customer Experience Architecture & Operations Guide

This document describes the database schema, security model, centralized notification pipeline, staff roles, and operational decisions introduced across Phases 1–7.

---

## 1. Roles & Authorization Matrix

Roles are stored in `public.user_roles` (`public.app_role` enum) and verified via `SECURITY DEFINER` helpers (`has_any_role`, `is_staff`, `is_kitchen_or_admin`, `is_manager_or_admin`). Administrative authorization never relies on editable client metadata.

| Role | Capabilities |
| --- | --- |
| **Guest (anonymous)** | Browse menu, place orders with opaque `guest_access_token_hash`, track own order via `get_guest_order_status(id, token)`, join active table via `/table/:tableCode`, send/cancel own waiter requests, join open group orders via invite code + guest session key. Cannot read arbitrary orders, cannot submit unverified reviews, cannot settle bills. |
| **Customer (authenticated)** | All guest capabilities + persistent `user_notifications` & preferences, opt-in Web Push subscriptions, verified dish reviews for completed orders, secure guest order claiming (`claim_guest_order` / `claim_guest_order_by_arrival_code`), Butcher Block Rewards ledger & atomic redemption, voluntary Guest of the Week consent/withdrawal, and isolated personal order history. |
| **Kitchen (`kitchen`)** | Access `/admin` Kitchen Ops, transition orders through validated 6-stage lifecycle (`transition_order_status`), set genuine kitchen ETAs, view exact steak modifiers and dietary alerts. |
| **Waiter (`waiter`)** | Acknowledge & complete table service requests (`update_service_request_status`), close table sessions (`close_table_session`), verify arrival codes, view group bills, and mark settled shares (`mark_bill_allocation_settled`) or confirm POS payment (`mark_order_payment_status`). |
| **Manager / Admin (`manager`, `admin`)** | Full floor & kitchen access + review moderation & public replies (`moderate_food_review` — numerical ratings remain immutable & audited), loyalty rules & rewards catalog configuration, Guest of the Week shortlist & nomination (`nominate_guest_of_week`), table creation & QR code rotation (`regenerate_table_qr_code`). |

---

## 2. Database Migrations (Apply in Exact Sequence)

1. `supabase/migrations/20261122180000_order_integrity_and_booking_conflicts.sql` — Order constraints, booking table-slot conflict protection, customer pending-cancel RPC.
2. `supabase/migrations/20261123010000_phase1_kitchen_tracking_notifications.sql` — Staff roles, 6-stage order status machine (`pending → confirmed → preparing → ready → handover → completed` + `cancelled`), `order_status_history`, `user_notifications`, `notification_preferences`, `push_subscriptions`, `transition_order_status`, `mark_order_payment_status`, and secure guest tracking/claim RPCs.
3. `supabase/migrations/20261123020000_phase2_verified_food_reviews.sql` — `food_reviews`, `review_reports`, `review_moderation_audit`, rating-immutability trigger, safe public views (`menu_item_rating_summary`, `public_food_reviews`), and verified review RPCs.
4. `supabase/migrations/20261123030000_phase3_loyalty_and_guest_of_week.sql` — `loyalty_rules`, `loyalty_ledger`, `rewards_catalog`, `reward_redemptions`, paid-completed earning & refund-reversal triggers, advisory-locked atomic redemption (`redeem_loyalty_reward`), and consent-gated `guest_of_the_week` RPCs & public view.
5. `supabase/migrations/20261123040000_phase4_qr_tables_and_waiter.sql` — `restaurant_tables`, `table_sessions`, `service_requests` (with active deduplication index), QR resolution/validation/rotation RPCs, and race-safe waiter request updates.
6. `supabase/migrations/20261123050000_phase5_order_history_and_claim.sql` — Order history index & dual-factor guest order claim (`claim_guest_order_by_arrival_code`).
7. `supabase/migrations/20261123060000_phase6_group_orders_and_split_bills.sql` — `group_orders`, `group_participants`, `group_order_items` (integer minor units / cents), `bill_allocations`, `bill_settlements`, atomic group submit, exact-sum bill split validation, and staff-only settlement RPCs.
8. `supabase/migrations/20261123070000_phase7_dining_perks_and_feedback.sql` — `user_dining_preferences` (My Usual presets, default steak doneness/side, dietary preferences), `bookings.occasion` (birthday/anniversary/celebration/date_night/business), `private_dining_feedback` (confidential guest feedback & duty-manager requests — never public), and `update_private_feedback_status` staff RPC.

---

## 3. Centralized Notification Events

All durable notifications write through `public.create_notification_idempotent(...)` with a unique `event_key`, guaranteeing zero duplicates across retries or repeated staff clicks:

- `order:<order_id>:pending` — `"Your order has been received by Butcher Block."`
- `order:<order_id>:confirmed` — `"The kitchen has confirmed your order."`
- `order:<order_id>:preparing` — `"Your food is being prepared."`
- `order:<order_id>:ready` — `"Your order is ready."`
- `order:<order_id>:handover` — Dine-in: `"Your food is on its way to your table."` · Pickup: `"Your order is ready for collection."`
- `order:<order_id>:completed` — `"Enjoy your meal. We'd love to hear what you think."` (links to `/order/:id?rate=1`)
- `order:<order_id>:cancelled` — Cancellation notice with restaurant phone `+264 83 288 8000`
- `service:<request_id>:acknowledged` / `completed` — Waiter response notifications
- `loyalty:earn:<order_id>` / `reward:redeemed:<redemption_id>` — Butcher Block Rewards activity
- `gotw:invite:<gotw_id>:<user_id>` / `gotw:published:<gotw_id>` — Guest of the Week consent & publication
- `feedback:<feedback_id>:<status>` — Private dining feedback acknowledgment / resolution updates for signed-in guests

---

## 4. Operational Setup & Decisions Requiring Restaurant Approval

1. **Apply Migrations & Seed Tables**: Review and run migrations `20261122180000` through `20261123070000` against the production Supabase database, then create physical restaurant tables in `/admin → Tables & Floor` and print QR cards.
2. **Assign Staff Roles**: Grant `kitchen`, `waiter`, `manager`, or `admin` rows in `public.user_roles` for staff accounts.
3. **Approve Butcher Block Rewards Rules**: `loyalty_rules.enabled` defaults to `false` so no unauthorized discounts or points accrue before management configures points-per-N$, minimum spend, exclusions, and approved rewards in `/admin → Rewards`.
4. **Optional Web Push Delivery**: To deliver background push alerts while the browser is closed, generate a VAPID key pair, set `VITE_WEB_PUSH_PUBLIC_KEY` in frontend builds, and connect a Supabase Edge Function webhook on `user_notifications` INSERT using the stored `push_subscriptions` table. In-app real-time alerts work without external push infrastructure.
5. **Optional Food Review Photo Storage**: Create a public-read, authenticated-insert Supabase Storage bucket named `review-photos` (MIME restricted to `image/*`, max 4 MB) to enable guest dish photos in verified reviews.
6. **Future POS Integration**: `orders.payment_status` and `bill_settlements` are structured around integer minor units and staff-recorded references so a real Namibian POS / payment terminal integration can settle allocations via `mark_bill_allocation_settled` without changing the group-order architecture.
