-- pgTAP Test Suite 02: Row-Level Security Isolation & Staff Authorization Enforcement
BEGIN;

SELECT plan(12);

-- Seeded synthetic UUIDs from supabase/seed.sql:
-- Admin:      11111111-1111-4111-8111-111111111101
-- Customer A: 22222222-2222-4222-8222-222222222201 (Order: 33333333-3333-4333-8333-333333333301)
-- Customer B: 22222222-2222-4222-8222-222222222202 (Order: 33333333-3333-4333-8333-333333333302)

-- ── 1. Anonymous user cannot read private orders, bookings, profiles, or audit logs ──
SET LOCAL role TO anon;

SELECT is((SELECT count(*)::integer FROM public.orders), 0, 'anon cannot SELECT any orders directly');
SELECT is((SELECT count(*)::integer FROM public.bookings), 0, 'anon cannot SELECT any bookings directly');
SELECT is((SELECT count(*)::integer FROM public.profiles), 0, 'anon cannot SELECT any profiles directly');
SELECT is((SELECT count(*)::integer FROM public.operational_audit_log), 0, 'anon cannot SELECT operational_audit_log');

-- ── 2. Authenticated Customer A sees ONLY own records, never Customer B's ──
RESET role;
SET LOCAL role TO authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE id = '33333333-3333-4333-8333-333333333301'),
  1,
  'Customer A can read their own order'
);
SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE id = '33333333-3333-4333-8333-333333333302'),
  0,
  'Customer A cannot read Customer B order'
);
SELECT is(
  (SELECT count(*)::integer FROM public.bookings WHERE user_id = '22222222-2222-4222-8222-222222222202'),
  0,
  'Customer A cannot read Customer B bookings'
);
SELECT is(
  (SELECT count(*)::integer FROM public.operational_audit_log),
  0,
  'Customer A cannot read staff operational_audit_log'
);

-- ── 3. Customer A cannot invoke staff-only RPCs or directly tamper with order payment/status ──
SELECT throws_ok(
  $$SELECT public.transition_order_status('33333333-3333-4333-8333-333333333302'::uuid, 'preparing', 20, 'unauthorized')$$,
  '42501',
  NULL,
  'Customer A cannot call transition_order_status'
);

SELECT throws_ok(
  $$SELECT public.mark_order_payment_status('33333333-3333-4333-8333-333333333302'::uuid, 'paid')$$,
  '42501',
  NULL,
  'Customer A cannot mark an order as paid'
);

-- ── 4. Admin CAN read all orders and operational audit logs ──
RESET role;
SET LOCAL role TO authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT ok(
  (SELECT count(*)::integer FROM public.orders) >= 2,
  'Admin can view all restaurant orders'
);

-- Waiter / Kitchen staff separation check: Admin can call transition_order_status
SELECT lives_ok(
  $$SELECT public.transition_order_status('33333333-3333-4333-8333-333333333302'::uuid, 'confirmed', 25, 'Verified by test admin')$$,
  'Authorized admin can transition pending order to confirmed'
);

SELECT * FROM finish();
ROLLBACK;
