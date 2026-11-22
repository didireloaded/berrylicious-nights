-- ============================================================================
-- Butcher Block Steakhouse — Sanitized Synthetic Local Development Seed
-- ============================================================================
-- STRICTLY FAKE TEST RECORDS ONLY. NEVER COPY PRODUCTION CUSTOMER DATA HERE.
-- Safe to re-run via `supabase db reset` on isolated local Docker Postgres.
-- ============================================================================

DO $$
DECLARE
  v_admin_id   uuid := '11111111-1111-4111-8111-111111111101';
  v_kitchen_id uuid := '11111111-1111-4111-8111-111111111102';
  v_waiter_id  uuid := '11111111-1111-4111-8111-111111111103';
  v_cust_a_id  uuid := '22222222-2222-4222-8222-222222222201';
  v_cust_b_id  uuid := '22222222-2222-4222-8222-222222222202';
  v_order_a_id uuid := '33333333-3333-4333-8333-333333333301';
  v_order_b_id uuid := '33333333-3333-4333-8333-333333333302';
  v_pw_hash    text := extensions.crypt('TestPassword123!', extensions.gen_salt('bf'));
BEGIN
  -- 1. Synthetic test auth users (local development password: TestPassword123!)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (v_admin_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.test@butcherblock.local',   v_pw_hash, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Test Manager"}'::jsonb, now(), now()),
    (v_kitchen_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chef.test@butcherblock.local',    v_pw_hash, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Test Grill Chef"}'::jsonb, now(), now()),
    (v_waiter_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'waiter.test@butcherblock.local',  v_pw_hash, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Test Floor Waiter"}'::jsonb, now(), now()),
    (v_cust_a_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'didi.test@butcherblock.local',    v_pw_hash, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Synthetic Diner A"}'::jsonb, now(), now()),
    (v_cust_b_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna.test@butcherblock.local',    v_pw_hash, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Synthetic Diner B"}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Ensure identities exist for Supabase GoTrue password login locally
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  VALUES
    (v_admin_id,   v_admin_id,   jsonb_build_object('sub', v_admin_id::text,   'email', 'admin.test@butcherblock.local'),  'email', v_admin_id::text,   now(), now(), now()),
    (v_kitchen_id, v_kitchen_id, jsonb_build_object('sub', v_kitchen_id::text, 'email', 'chef.test@butcherblock.local'),   'email', v_kitchen_id::text, now(), now(), now()),
    (v_waiter_id,  v_waiter_id,  jsonb_build_object('sub', v_waiter_id::text,  'email', 'waiter.test@butcherblock.local'), 'email', v_waiter_id::text,  now(), now(), now()),
    (v_cust_a_id,  v_cust_a_id,  jsonb_build_object('sub', v_cust_a_id::text,  'email', 'didi.test@butcherblock.local'),   'email', v_cust_a_id::text,  now(), now(), now()),
    (v_cust_b_id,  v_cust_b_id,  jsonb_build_object('sub', v_cust_b_id::text,  'email', 'anna.test@butcherblock.local'),   'email', v_cust_b_id::text,  now(), now(), now())
  ON CONFLICT DO NOTHING;

  -- 2. Staff roles (strict least privilege)
  INSERT INTO public.user_roles (user_id, role)
  VALUES
    (v_admin_id,   'admin'::public.app_role),
    (v_kitchen_id, 'kitchen'::public.app_role),
    (v_waiter_id,  'waiter'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Synthetic restaurant tables for QR table ordering & waiter calls
  INSERT INTO public.restaurant_tables (table_number, display_name, table_code, capacity, area, active)
  VALUES
    ('T01', 'Table 1 · Terrace',      'BB-T01-DEV001', 2, 'Terrace',     true),
    ('T02', 'Table 2 · Main Grill',   'BB-T02-DEV002', 4, 'Main Dining', true),
    ('T03', 'Table 3 · Wine Cellar',  'BB-T03-DEV003', 6, 'Cellar',      true),
    ('T04', 'Table 4 · Courtyard',    'BB-T04-DEV004', 4, 'Courtyard',   true)
  ON CONFLICT (table_number) DO NOTHING;

  -- 4. Synthetic upcoming restaurant update / event
  INSERT INTO public.updates (title, subtitle, type, active, event_date, event_time, available_slots)
  VALUES (
    'Friday Steak & Red Wine Pairing',
    'Wet-aged Namibian Choice Cuts paired with Stellenbosch cellar pours.',
    'event',
    true,
    current_date + 3,
    '19:30',
    ARRAY['18:00', '19:30', '20:30']
  )
  ON CONFLICT DO NOTHING;

  -- 5. Synthetic bookings
  INSERT INTO public.bookings (user_id, guest_name, guest_phone, date, time, guests, status, arrival_code, assigned_table_code)
  VALUES
    (v_cust_a_id, 'Synthetic Diner A', '+264 81 000 0101', (current_date + 1)::text, '19:30', 2, 'confirmed', 'BB-BK101', 'T02'),
    (v_cust_b_id, 'Synthetic Diner B', '+264 81 000 0102', (current_date + 2)::text, '20:00', 4, 'confirmed', 'BB-BK102', 'T04')
  ON CONFLICT DO NOTHING;

  -- 6. Synthetic orders (Customer A completed + paid for review/loyalty tests; Customer B pending)
  INSERT INTO public.orders (id, user_id, items, total, status, order_type, arrival_code, payment_status, paid_at, paid_by)
  VALUES
    (
      v_order_a_id,
      v_cust_a_id,
      '[{"id":"cc-ribeye","name":"Rib Eye","qty":1,"price":335,"weight":"350g","doneness":"Medium Rare","side":"Chips"}]'::jsonb,
      335,
      'completed',
      'dinein',
      'BB-OR101',
      'paid',
      now() - interval '1 day',
      v_admin_id
    ),
    (
      v_order_b_id,
      v_cust_b_id,
      '[{"id":"cc-rump","name":"Rump","qty":1,"price":225,"weight":"200g","doneness":"Medium","side":"Mashed Potato"}]'::jsonb,
      225,
      'pending',
      'pickup',
      'BB-OR102',
      'unpaid',
      NULL,
      NULL
    )
  ON CONFLICT (id) DO NOTHING;

  -- 7. Synthetic loyalty rule & reward item for local testing
  INSERT INTO public.rewards_catalog (title, description, points_cost, reward_type, active)
  VALUES (
    'Complimentary House Sauce',
    'Redeem points for any signature Butcher Block steak sauce on your next visit.',
    100,
    'free_item',
    true
  )
  ON CONFLICT DO NOTHING;
END $$;
