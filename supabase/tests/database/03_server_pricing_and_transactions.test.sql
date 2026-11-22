-- pgTAP Test Suite 03: Server-Calculated Pricing, Idempotency, Disabled Items,
-- Status State Machine, Audit Logging & Guest Token Tracking
BEGIN;

SELECT plan(13);

-- ── 1. Server-calculated pricing ignores tampered browser prices ──
SET LOCAL role TO authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Submit Rib Eye (N$ 335) + Mushroom sauce (N$ 55) = N$ 390, tampering client price to N$ 1
SELECT is(
  (
    public.submit_order(
      '[{"id":"cc-ribeye","name":"Fake Cheap Steak","qty":2,"price":1,"weight":"350g","doneness":"Medium Rare","side":"Chips","sauces":["Mushroom"]}]'::jsonb,
      'pickup',
      'idem-test-price-check-001',
      NULL, NULL, NULL, NULL, NULL
    )->>'total'
  )::numeric,
  780.00::numeric,
  'submit_order ignores tampered client price (N$ 1) and computes authoritative N$ 780.00 (2 x (335 + 55))'
);

-- ── 2. Idempotency key prevents duplicate kitchen tickets ──
SELECT is(
  (
    public.submit_order(
      '[{"id":"cc-ribeye","qty":2,"price":1,"weight":"350g","sauces":["Mushroom"]}]'::jsonb,
      'pickup',
      'idem-test-price-check-001',
      NULL, NULL, NULL, NULL, NULL
    )->>'deduplicated'
  )::boolean,
  true,
  'Replaying submit_order with same idempotency key returns deduplicated=true without creating a second order'
);

SELECT is(
  (SELECT count(*)::integer FROM public.orders WHERE idempotency_key = 'idem-test-price-check-001'),
  1,
  'Exactly one order row exists for repeated idempotency key'
);

-- ── 3. Rejects kitchen-disabled menu items server-side ──
RESET role;
INSERT INTO public.menu_item_disabled (menu_item_id) VALUES ('cc-rump') ON CONFLICT DO NOTHING;

SET LOCAL role TO authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222201', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT throws_ok(
  $$SELECT public.submit_order('[{"id":"cc-rump","qty":1}]'::jsonb, 'pickup', 'idem-disabled-item')$$,
  'P0001',
  NULL,
  'submit_order rejects kitchen-disabled menu items'
);

-- ── 4. Rejects unknown/injected menu IDs ──
SELECT throws_ok(
  $$SELECT public.submit_order('[{"id":"fake-hacked-item","qty":1,"price":0}]'::jsonb, 'pickup', 'idem-unknown-item')$$,
  '22023',
  NULL,
  'submit_order rejects unknown menu item IDs'
);

-- ── 5. Guest order tracking requires valid SHA-256 access token ──
RESET role;
SET LOCAL role TO anon;

SELECT set_config(
  'test.guest_order_id',
  public.submit_order(
    '[{"id":"cc-ribeye","qty":1}]'::jsonb,
    'pickup',
    'idem-guest-token-001',
    NULL, NULL, NULL,
    encode(extensions.digest(convert_to('secret-guest-token-1234567890', 'UTF8'), 'sha256'), 'hex'),
    NULL
  )->>'id',
  true
);

SELECT is(
  public.get_guest_order_status(current_setting('test.guest_order_id')::uuid, 'wrong-token-000000000000000') IS NULL,
  true,
  'get_guest_order_status returns NULL for wrong guest token'
);

SELECT is(
  (public.get_guest_order_status(current_setting('test.guest_order_id')::uuid, 'secret-guest-token-1234567890')->>'total')::numeric,
  335.00::numeric,
  'get_guest_order_status returns server-verified order payload for valid guest token'
);

-- ── 6. QR Table Session + Group Order server-side pricing ──
SELECT ok(
  (public.resolve_table_qr('BB-T01-DEV001')->>'session_token') IS NOT NULL,
  'resolve_table_qr resolves active table and mints session token (extensions.gen_random_bytes works)'
);

-- ── 7. Direct client mutation on orders.total / orders.status / orders.payment_status blocked ──
RESET role;
SET LOCAL role TO authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111101', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT throws_ok(
  $$UPDATE public.orders SET total = 0 WHERE id = '33333333-3333-4333-8333-333333333302'::uuid$$,
  '42501',
  NULL,
  'Direct UPDATE mutating orders.total is rejected even for authenticated staff'
);

SELECT throws_ok(
  $$UPDATE public.orders SET status = 'completed' WHERE id = '33333333-3333-4333-8333-333333333302'::uuid$$,
  '42501',
  NULL,
  'Direct UPDATE bypassing transition_order_status is rejected'
);

-- ── 8. Status machine rejects invalid backward transition & writes operational audit log on valid change ──
SELECT throws_ok(
  $$SELECT public.transition_order_status('33333333-3333-4333-8333-333333333301'::uuid, 'pending', NULL, 'backward')$$,
  '22023',
  NULL,
  'transition_order_status rejects invalid transition from completed back to pending'
);

SELECT lives_ok(
  $$SELECT public.mark_order_payment_status('33333333-3333-4333-8333-333333333302'::uuid, 'paid')$$,
  'mark_order_payment_status succeeds for authorized staff'
);

SELECT ok(
  (SELECT count(*)::integer FROM public.operational_audit_log
   WHERE entity_type = 'order'
     AND entity_id = '33333333-3333-4333-8333-333333333302'
     AND action = 'payment_status_change') >= 1,
  'Payment status change is recorded in operational_audit_log'
);

SELECT * FROM finish();
ROLLBACK;
