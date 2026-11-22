-- pgTAP Test Suite 01: Schema, RLS Enforcement, Authoritative Menu Catalog & Core RPCs
BEGIN;

SELECT plan(24);

-- 1. Core tables exist
SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_table('public', 'orders', 'orders table exists');
SELECT has_table('public', 'bookings', 'bookings table exists');
SELECT has_table('public', 'menu_catalog', 'authoritative menu_catalog table exists');
SELECT has_table('public', 'menu_sauce_addons', 'authoritative menu_sauce_addons table exists');
SELECT has_table('public', 'operational_audit_log', 'operational_audit_log table exists');
SELECT has_table('public', 'restaurant_tables', 'restaurant_tables table exists');
SELECT has_table('public', 'group_orders', 'group_orders table exists');
SELECT has_table('public', 'loyalty_ledger', 'loyalty_ledger table exists');
SELECT has_table('public', 'food_reviews', 'food_reviews table exists');
SELECT has_table('public', 'private_dining_feedback', 'private_dining_feedback table exists');

-- 2. Authoritative Namibian menu catalog populated
SELECT ok(
  (SELECT count(*) FROM public.menu_catalog) >= 200,
  'menu_catalog contains full Namibian menu (>= 200 items)'
);
SELECT ok(
  (SELECT count(*) FROM public.menu_sauce_addons) = 14,
  'menu_sauce_addons contains all 14 official PDF steak sauces'
);

-- 3. Every security-sensitive public table has RLS enabled
SELECT is(
  (SELECT count(*)::integer FROM pg_tables t
   JOIN pg_class c ON c.relname = t.tablename
   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
   WHERE t.schemaname = 'public'
     AND t.tablename IN (
       'profiles', 'orders', 'bookings', 'user_roles', 'user_notifications',
       'food_reviews', 'loyalty_ledger', 'reward_redemptions',
       'restaurant_tables', 'table_sessions', 'service_requests',
       'group_orders', 'group_participants', 'group_order_items',
       'bill_allocations', 'bill_settlements', 'private_dining_feedback',
       'operational_audit_log', 'menu_catalog', 'menu_sauce_addons'
     )
     AND c.relrowsecurity = false),
  0,
  'All 20 security-sensitive public tables have Row Level Security enabled'
);

-- 4. Core RPCs exist and are executable
SELECT has_function('public', 'booked_table_times', ARRAY['text'], 'booked_table_times RPC exists');
SELECT has_function('public', 'active_bookings_count', ARRAY['text'], 'active_bookings_count RPC exists');
SELECT has_function('public', 'ensure_restaurant_chat_for_me', ARRAY[]::text[], 'ensure_restaurant_chat_for_me RPC exists');
SELECT has_function('public', 'join_waitlist', ARRAY['integer', 'text', 'text', 'text'], 'join_waitlist RPC exists');
SELECT has_function('public', 'submit_order', ARRAY['jsonb', 'text', 'text', 'text', 'uuid', 'text', 'text', 'jsonb'], 'submit_order authoritative pricing RPC exists');
SELECT has_function('public', 'transition_order_status', ARRAY['uuid', 'text', 'integer', 'text'], 'transition_order_status RPC exists');
SELECT has_function('public', 'mark_order_payment_status', ARRAY['uuid', 'text'], 'mark_order_payment_status RPC exists');
SELECT has_function('public', 'get_guest_order_status', ARRAY['uuid', 'text'], 'get_guest_order_status RPC exists');
SELECT has_function('public', 'resolve_table_qr', ARRAY['text'], 'resolve_table_qr RPC exists');
SELECT has_function('public', 'redeem_loyalty_reward', ARRAY['uuid', 'text'], 'redeem_loyalty_reward RPC exists');

SELECT * FROM finish();
ROLLBACK;
