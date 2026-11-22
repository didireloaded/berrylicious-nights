-- ============================================================================
-- Butcher Block Steakhouse — Backend Hardening, Server-Side Menu Catalog,
-- Atomic Order Pricing RPCs, Missing Baseline RPCs & Operational Audit Log
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Fix search_path on existing Phase 3 / 4 / 6 RPCs calling gen_random_bytes
--    (In Supabase Postgres, pgcrypto resides in `extensions` schema)
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.redeem_loyalty_reward(uuid, text)
  SET search_path = public, extensions;
ALTER FUNCTION public.respond_guest_of_week_consent(uuid, boolean, text, boolean, boolean, text)
  SET search_path = public, extensions;
ALTER FUNCTION public.resolve_table_qr(text)
  SET search_path = public, extensions;
ALTER FUNCTION public.create_restaurant_table(text, text, integer, text)
  SET search_path = public, extensions;
ALTER FUNCTION public.regenerate_table_qr_code(uuid)
  SET search_path = public, extensions;
ALTER FUNCTION public.create_group_order(uuid, text, text, text)
  SET search_path = public, extensions;
ALTER FUNCTION public.submit_group_order(uuid, text, text)
  SET search_path = public, extensions;

-- ----------------------------------------------------------------------------
-- 2. Restore Baseline RPCs Required by Bookings, Waitlist, Crowd & Chat
--    so a fresh local `supabase db reset` has 100% parity with the app
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booked_table_times(p_date text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT b.time ORDER BY b.time), ARRAY[]::text[])
  FROM public.bookings b
  WHERE b.date = trim(p_date)
    AND b.status <> 'cancelled'
$$;

GRANT EXECUTE ON FUNCTION public.booked_table_times(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.active_bookings_count(p_date text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.bookings b
  WHERE b.date = trim(p_date)
    AND b.status <> 'cancelled'
$$;

GRANT EXECUTE ON FUNCTION public.active_bookings_count(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_restaurant_chat_for_me()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_chat_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to open restaurant chat' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_chat_id
  FROM public.restaurant_chats
  WHERE user_id = v_uid
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_chat_id IS NULL THEN
    INSERT INTO public.restaurant_chats (user_id)
    VALUES (v_uid)
    RETURNING id INTO v_chat_id;
  END IF;

  RETURN v_chat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_restaurant_chat_for_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_party_size integer,
  p_preferred_date text,
  p_guest_name text,
  p_guest_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_position integer;
  v_date text := trim(COALESCE(p_preferred_date, ''));
  v_name text := trim(COALESCE(p_guest_name, ''));
  v_phone text := trim(COALESCE(p_guest_phone, ''));
BEGIN
  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 20 THEN
    RAISE EXCEPTION 'Party size must be between 1 and 20' USING ERRCODE = '22023';
  END IF;
  IF v_date = '' OR char_length(v_name) < 1 OR char_length(v_phone) < 6 THEN
    RAISE EXCEPTION 'Date, guest name, and contact phone are required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.waitlist_entries (user_id, party_size, preferred_date, guest_name, guest_phone, status)
  VALUES (auth.uid(), p_party_size, v_date, left(v_name, 140), left(v_phone, 40), 'waiting')
  RETURNING id INTO v_entry_id;

  SELECT COUNT(*)::integer INTO v_position
  FROM public.waitlist_entries
  WHERE preferred_date = v_date
    AND status = 'waiting';

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'position', v_position,
    'estimated_wait_minutes', NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist(integer, text, text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Authoritative Server-Side Menu Catalog & Sauce Add-Ons (N$ Pricing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  menu_section text NOT NULL CHECK (menu_section IN ('food', 'drinks')),
  base_price numeric(10, 2) NOT NULL CHECK (base_price >= 0),
  price_label text DEFAULT NULL,
  variations jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active menu catalog" ON public.menu_catalog;
CREATE POLICY "Anyone can view active menu catalog"
  ON public.menu_catalog FOR SELECT
  TO public
  USING (active = true OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Management manages menu catalog" ON public.menu_catalog;
CREATE POLICY "Management manages menu catalog"
  ON public.menu_catalog FOR ALL
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.menu_sauce_addons (
  id text PRIMARY KEY,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.menu_sauce_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active sauce addons" ON public.menu_sauce_addons;
CREATE POLICY "Anyone can view active sauce addons"
  ON public.menu_sauce_addons FOR SELECT
  TO public
  USING (active = true OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Management manages sauce addons" ON public.menu_sauce_addons;
CREATE POLICY "Management manages sauce addons"
  ON public.menu_sauce_addons FOR ALL
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. Operational Audit Log (append-only, manager/admin read-only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text DEFAULT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_state jsonb DEFAULT NULL,
  after_state jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_audit_entity
  ON public.operational_audit_log (entity_type, entity_id, created_at DESC);

ALTER TABLE public.operational_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read operational audit log" ON public.operational_audit_log;
CREATE POLICY "Managers can read operational audit log"
  ON public.operational_audit_log FOR SELECT
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.write_operational_audit(
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT role::text INTO v_role
    FROM public.user_roles
    WHERE user_id = v_actor
    ORDER BY CASE role::text
      WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'kitchen' THEN 3 WHEN 'waiter' THEN 4 ELSE 5
    END
    LIMIT 1;
  END IF;

  INSERT INTO public.operational_audit_log (actor_id, actor_role, entity_type, entity_id, action, before_state, after_state)
  VALUES (v_actor, COALESCE(v_role, 'system'), p_entity_type, p_entity_id, p_action, p_before, p_after);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Authoritative Server-Side Pricing Function (Zero Client Price Trust)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_menu_item_price_cents(
  p_item_id text,
  p_weight text DEFAULT NULL,
  p_sauces jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  canonical_id text,
  canonical_name text,
  unit_price_cents integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_id text := split_part(trim(COALESCE(p_item_id, '')), '::', 1);
  v_item public.menu_catalog%ROWTYPE;
  v_base_price numeric(10, 2);
  v_matched_price numeric(10, 2);
  v_sauce_total numeric(10, 2) := 0;
  v_sauce_name text;
  v_sauce_price numeric(10, 2);
  v_var jsonb;
BEGIN
  IF v_base_id = '' THEN
    RAISE EXCEPTION 'Invalid menu item identifier' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.menu_item_disabled d WHERE d.menu_item_id = v_base_id) THEN
    RAISE EXCEPTION 'Menu item % is currently unavailable', v_base_id USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_item
  FROM public.menu_catalog
  WHERE id = v_base_id AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive menu item: %', v_base_id USING ERRCODE = '22023';
  END IF;

  IF v_item.price_label IS NOT NULL AND trim(v_item.price_label) <> '' THEN
    RAISE EXCEPTION 'Seasonal quote item (%) cannot be self-priced online', v_item.name USING ERRCODE = '22023';
  END IF;

  v_base_price := v_item.base_price;

  IF jsonb_typeof(v_item.variations) = 'array' AND jsonb_array_length(v_item.variations) > 0 THEN
    v_matched_price := NULL;
    IF p_weight IS NOT NULL AND trim(p_weight) <> '' THEN
      FOR v_var IN SELECT * FROM jsonb_array_elements(v_item.variations) LOOP
        IF (v_var->>'size') = trim(p_weight) THEN
          v_matched_price := (v_var->>'price')::numeric(10, 2);
          EXIT;
        END IF;
      END LOOP;
    END IF;
    IF v_matched_price IS NULL THEN
      v_matched_price := ((v_item.variations->0)->>'price')::numeric(10, 2);
    END IF;
    v_base_price := COALESCE(v_matched_price, v_item.base_price);
  END IF;

  IF v_item.menu_section = 'food'
     AND v_item.category IN ('Choice Cuts', 'Butcher''s Choice', 'Combos')
     AND p_sauces IS NOT NULL
     AND jsonb_typeof(p_sauces) = 'array'
  THEN
    FOR v_sauce_name IN SELECT DISTINCT value FROM jsonb_array_elements_text(p_sauces) LOOP
      SELECT price INTO v_sauce_price
      FROM public.menu_sauce_addons
      WHERE id = v_sauce_name AND active = true;

      IF FOUND THEN
        v_sauce_total := v_sauce_total + v_sauce_price;
      END IF;
    END LOOP;
  END IF;

  canonical_id := v_item.id;
  canonical_name := v_item.name;
  unit_price_cents := round((v_base_price + v_sauce_total) * 100)::integer;
  RETURN NEXT;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Orders Idempotency, Indexes, Direct-Tamper Guard & Authoritative RPCs
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique
  ON public.orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_date_status
  ON public.bookings (date, status);

CREATE INDEX IF NOT EXISTS idx_waitlist_preferred_date_status
  ON public.waitlist_entries (preferred_date, status, created_at ASC);

-- Guard direct client mutations on `orders` (prevents bypassing transition_order_status,
-- tampering with total, or customers marking their own orders paid).
CREATE OR REPLACE FUNCTION public.guard_orders_direct_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.trusted_order_rpc', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF auth.role() IN ('anon', 'authenticated') THEN
    IF NEW.total IS DISTINCT FROM OLD.total THEN
      RAISE EXCEPTION 'Order totals are immutable after submission' USING ERRCODE = '42501';
    END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'Use mark_order_payment_status to update payment status' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Use transition_order_status or cancel_own_pending_order to change order status' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_orders_direct_mutation ON public.orders;
CREATE TRIGGER trg_guard_orders_direct_mutation
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_orders_direct_mutation();

-- Upgrade existing order transition / payment / cancel / claim RPCs to mark trusted context & audit log
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_next_status text,
  p_eta_minutes integer DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_updated public.orders%ROWTYPE;
  v_actor uuid := auth.uid();
  v_role text;
  v_valid boolean := false;
  v_copy record;
BEGIN
  IF v_actor IS NULL OR NOT public.is_kitchen_or_admin(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: staff privileges required to change order status'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.trusted_order_rpc', '1', true);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status = p_next_status THEN
    IF p_eta_minutes IS NOT NULL AND p_eta_minutes BETWEEN 1 AND 180 THEN
      UPDATE public.orders
      SET eta_minutes = p_eta_minutes, eta_set_at = now()
      WHERE id = p_order_id
      RETURNING * INTO v_updated;
      RETURN v_updated;
    END IF;
    RETURN v_order;
  END IF;

  CASE v_order.status
    WHEN 'pending' THEN
      v_valid := p_next_status IN ('confirmed', 'preparing', 'cancelled');
    WHEN 'confirmed' THEN
      v_valid := p_next_status IN ('preparing', 'cancelled');
    WHEN 'preparing' THEN
      v_valid := p_next_status IN ('ready', 'cancelled');
    WHEN 'ready' THEN
      v_valid := p_next_status IN ('handover', 'completed', 'cancelled');
    WHEN 'handover' THEN
      v_valid := p_next_status IN ('completed', 'cancelled');
    ELSE
      v_valid := false;
  END CASE;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Invalid order status transition from % to %', v_order.status, p_next_status
      USING ERRCODE = '22023';
  END IF;

  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = v_actor
  ORDER BY CASE role::text
    WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'kitchen' THEN 3 WHEN 'waiter' THEN 4 ELSE 5
  END
  LIMIT 1;

  UPDATE public.orders
  SET
    status = p_next_status,
    eta_minutes = CASE WHEN p_eta_minutes IS NOT NULL AND p_eta_minutes BETWEEN 1 AND 180 THEN p_eta_minutes ELSE eta_minutes END,
    eta_set_at = CASE WHEN p_eta_minutes IS NOT NULL AND p_eta_minutes BETWEEN 1 AND 180 THEN now() ELSE eta_set_at END
  WHERE id = p_order_id
  RETURNING * INTO v_updated;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (p_order_id, v_order.status, p_next_status, v_actor, COALESCE(v_role, 'staff'), p_note);

  PERFORM public.write_operational_audit(
    'order',
    p_order_id::text,
    'status_transition',
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', p_next_status, 'eta_minutes', v_updated.eta_minutes, 'note', p_note)
  );

  IF v_updated.user_id IS NOT NULL THEN
    SELECT * INTO v_copy FROM public.order_stage_notification_copy(p_next_status, v_updated.order_type);
    PERFORM public.create_notification_idempotent(
      v_updated.user_id,
      'order:' || v_updated.id::text || ':' || p_next_status,
      'order_' || p_next_status,
      v_copy.title,
      v_copy.body,
      CASE WHEN p_next_status = 'completed'
        THEN '/order/' || v_updated.id::text || '?rate=1'
        ELSE '/order/' || v_updated.id::text
      END,
      v_updated.id,
      jsonb_build_object(
        'status', p_next_status,
        'order_type', COALESCE(v_updated.order_type, 'pickup'),
        'cta', CASE WHEN p_next_status = 'completed' THEN 'rate_meal' ELSE 'view_order' END
      )
    );
  END IF;

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_payment_status(
  p_order_id uuid,
  p_payment_status text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before public.orders%ROWTYPE;
  v_updated public.orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: staff privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_payment_status NOT IN ('unpaid', 'paid', 'refunded') THEN
    RAISE EXCEPTION 'Invalid payment status' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.trusted_order_rpc', '1', true);

  SELECT * INTO v_before FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.orders
  SET
    payment_status = p_payment_status,
    paid_at = CASE WHEN p_payment_status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
    paid_by = CASE WHEN p_payment_status = 'paid' THEN v_actor ELSE NULL END
  WHERE id = p_order_id
  RETURNING * INTO v_updated;

  PERFORM public.write_operational_audit(
    'order',
    p_order_id::text,
    'payment_status_change',
    jsonb_build_object('payment_status', v_before.payment_status),
    jsonb_build_object('payment_status', p_payment_status)
  );

  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_own_pending_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.trusted_order_rpc', '1', true);

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND user_id = v_uid
    AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_role, note)
    VALUES (p_order_id, 'pending', 'cancelled', v_uid, 'customer', 'Cancelled by customer while pending');
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Atomic, Idempotent, Server-Priced Order Submission RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_order(
  p_items jsonb,
  p_order_type text DEFAULT 'pickup',
  p_idempotency_key text DEFAULT NULL,
  p_table_number text DEFAULT NULL,
  p_table_session_id uuid DEFAULT NULL,
  p_table_session_token text DEFAULT NULL,
  p_guest_access_token_hash text DEFAULT NULL,
  p_order_meta jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_idem text := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
  v_existing public.orders%ROWTYPE;
  v_item jsonb;
  v_qty integer;
  v_priced record;
  v_sanitized_items jsonb := '[]'::jsonb;
  v_sanitized_line jsonb;
  v_total_cents integer := 0;
  v_validated_session_id uuid := NULL;
  v_resolved_table_number text := NULLIF(trim(COALESCE(p_table_number, '')), '');
  v_session_check jsonb;
  v_arrival_code text;
  v_order public.orders%ROWTYPE;
  v_attempt integer;
  v_clean_type text := lower(trim(COALESCE(p_order_type, 'pickup')));
BEGIN
  IF v_clean_type NOT IN ('pickup', 'preorder', 'dinein') THEN
    RAISE EXCEPTION 'Invalid order_type: %', v_clean_type USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 50 items' USING ERRCODE = '22023';
  END IF;

  -- Idempotency lock & lookup
  IF v_idem IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('submit_order:' || v_idem));
    SELECT * INTO v_existing FROM public.orders WHERE idempotency_key = v_idem;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'arrival_code', v_existing.arrival_code,
        'total', v_existing.total,
        'items', v_existing.items,
        'status', v_existing.status,
        'created_at', v_existing.created_at,
        'deduplicated', true
      );
    END IF;
  END IF;

  -- Validate QR table session server-side when supplied
  IF p_table_session_id IS NOT NULL THEN
    IF p_table_session_token IS NULL OR char_length(trim(p_table_session_token)) < 16 THEN
      RAISE EXCEPTION 'Valid table session token is required' USING ERRCODE = '42501';
    END IF;
    v_session_check := public.validate_table_session(p_table_session_id, p_table_session_token);
    IF COALESCE((v_session_check->>'valid')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Table session is expired or invalid' USING ERRCODE = '42501';
    END IF;
    v_validated_session_id := p_table_session_id;
    v_resolved_table_number := COALESCE(v_session_check->>'display_name', v_resolved_table_number);
  END IF;

  -- Authoritative server-side pricing for every cart line (ignores any client-submitted price)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'qty')::integer, (v_item->>'quantity')::integer, 0);
    IF v_qty < 1 OR v_qty > 20 THEN
      RAISE EXCEPTION 'Item quantity must be between 1 and 20' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_priced
    FROM public.resolve_menu_item_price_cents(
      COALESCE(v_item->>'baseItemId', v_item->>'id'),
      v_item->>'weight',
      COALESCE(v_item->'sauces', '[]'::jsonb)
    );

    v_total_cents := v_total_cents + (v_priced.unit_price_cents * v_qty);

    v_sanitized_line := jsonb_strip_nulls(jsonb_build_object(
      'id', v_priced.canonical_id,
      'name', v_priced.canonical_name,
      'qty', v_qty,
      'price', round(v_priced.unit_price_cents / 100.0, 2),
      'weight', NULLIF(trim(COALESCE(v_item->>'weight', '')), ''),
      'doneness', NULLIF(trim(COALESCE(v_item->>'doneness', '')), ''),
      'side', NULLIF(trim(COALESCE(v_item->>'side', '')), ''),
      'sauces', CASE
        WHEN v_item ? 'sauces' AND jsonb_typeof(v_item->'sauces') = 'array' AND jsonb_array_length(v_item->'sauces') > 0
        THEN v_item->'sauces'
        ELSE NULL
      END,
      'orderMeta', CASE
        WHEN p_order_meta IS NOT NULL AND jsonb_typeof(p_order_meta) = 'object' AND jsonb_array_length(v_sanitized_items) = 0
        THEN p_order_meta
        ELSE NULL
      END
    ));

    v_sanitized_items := v_sanitized_items || jsonb_build_array(v_sanitized_line);
  END LOOP;

  -- Generate collision-safe arrival code and insert atomically
  FOR v_attempt IN 1..10 LOOP
    v_arrival_code := 'BB-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
    BEGIN
      INSERT INTO public.orders (
        user_id,
        items,
        total,
        status,
        order_type,
        arrival_code,
        table_number,
        table_session_id,
        guest_access_token_hash,
        idempotency_key
      )
      VALUES (
        v_uid,
        v_sanitized_items,
        round(v_total_cents / 100.0, 2),
        'pending',
        v_clean_type,
        v_arrival_code,
        v_resolved_table_number,
        v_validated_session_id,
        NULLIF(trim(COALESCE(p_guest_access_token_hash, '')), ''),
        v_idem
      )
      RETURNING * INTO v_order;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_idem IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.orders WHERE idempotency_key = v_idem;
        IF FOUND THEN
          RETURN jsonb_build_object(
            'id', v_existing.id,
            'arrival_code', v_existing.arrival_code,
            'total', v_existing.total,
            'items', v_existing.items,
            'status', v_existing.status,
            'created_at', v_existing.created_at,
            'deduplicated', true
          );
        END IF;
      END IF;
      IF v_attempt = 10 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'arrival_code', v_order.arrival_code,
    'total', v_order.total,
    'items', v_order.items,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'deduplicated', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order(jsonb, text, text, text, uuid, text, text, jsonb) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. Harden Group Order Item Addition with Server-Side Price Validation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_group_order_item(
  p_group_order_id uuid,
  p_menu_item_id text,
  p_item_name text,
  p_unit_price_cents integer,
  p_quantity integer DEFAULT 1,
  p_modifiers jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL,
  p_guest_key text DEFAULT NULL
)
RETURNS public.group_order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.group_orders%ROWTYPE;
  v_me public.group_participants%ROWTYPE;
  v_priced record;
  v_row public.group_order_items%ROWTYPE;
BEGIN
  SELECT * INTO v_group FROM public.group_orders WHERE id = p_group_order_id;
  IF NOT FOUND OR v_group.status <> 'open' THEN
    RAISE EXCEPTION 'Group order is not open for adding items' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_me FROM public.find_caller_group_participant(p_group_order_id, p_guest_key);
  IF v_me.id IS NULL THEN
    RAISE EXCEPTION 'Only authorized group participants may add items' USING ERRCODE = '42501';
  END IF;

  -- Ignore client-supplied p_unit_price_cents; resolve authoritative price from menu_catalog
  SELECT * INTO v_priced
  FROM public.resolve_menu_item_price_cents(
    p_menu_item_id,
    COALESCE(p_modifiers->>'weight', NULL),
    COALESCE(p_modifiers->'sauces', '[]'::jsonb)
  );

  INSERT INTO public.group_order_items (
    group_order_id, participant_id, menu_item_id, item_name, unit_price_cents, quantity, modifiers, note
  )
  VALUES (
    p_group_order_id,
    v_me.id,
    v_priced.canonical_id,
    v_priced.canonical_name,
    v_priced.unit_price_cents,
    GREATEST(1, LEAST(p_quantity, 20)),
    COALESCE(p_modifiers, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_note, '')), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_group_order_item(uuid, text, text, integer, integer, jsonb, text, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Seed Authoritative Butcher Block Menu Catalog (from src/data/menu.ts)
-- ----------------------------------------------------------------------------
-- Auto-generated from src/data/menu.ts via scripts/generate-menu-catalog-sql.mjs
-- Total menu items: 232 | Sauce add-ons: 14

INSERT INTO public.menu_sauce_addons (id, price, active) VALUES
  ('Creamy Garlic', 45, true),
  ('Garlic & Herb Butter', 45, true),
  ('Cowboy Butter', 45, true),
  ('Jalapeño & Biltong', 55, true),
  ('Green Peppercorn', 55, true),
  ('Mushroom', 55, true),
  ('Bordelaise', 45, true),
  ('Cheese', 45, true),
  ('Roquefort', 55, true),
  ('Honey & Dijon', 45, true),
  ('Peri-Peri', 45, true),
  ('Monkeygland', 45, true),
  ('Chimichurri', 55, true),
  ('Chakalaka', 55, true)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, active = EXCLUDED.active;

INSERT INTO public.menu_catalog (id, name, category, menu_section, base_price, price_label, variations, active) VALUES
  ('1', 'Three Cheese Prawns', 'Kick Start', 'food', 120, NULL, '[]'::jsonb, true),
  ('2', 'Chicken Livers', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('3', 'Marrow Bones', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('4', 'Beef Carpaccio', 'Kick Start', 'food', 125, NULL, '[]'::jsonb, true),
  ('ks-boerewors', 'Boerewors', 'Kick Start', 'food', 80, NULL, '[]'::jsonb, true),
  ('ks-prawn-cocktail', 'Prawn Cocktail', 'Kick Start', 'food', 120, NULL, '[]'::jsonb, true),
  ('ks-mozzarella-sticks', 'Mozzarella Sticks', 'Kick Start', 'food', 80, NULL, '[]'::jsonb, true),
  ('ks-halloumi', 'Halloumi', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('ks-snails-garlic', 'Snails — Garlic + Herb', 'Kick Start', 'food', 85, NULL, '[]'::jsonb, true),
  ('ks-snails-roquefort', 'Snails — Roquefort', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('ks-oysters-fresh', 'Oysters 6''s — Fresh', 'Kick Start', 'food', 185, NULL, '[]'::jsonb, true),
  ('ks-oysters-baked', 'Oysters 6''s — Baked', 'Kick Start', 'food', 195, NULL, '[]'::jsonb, true),
  ('ks-calamari', 'Calamari Starter', 'Kick Start', 'food', 105, NULL, '[]'::jsonb, true),
  ('ks-panko-prawns', 'Panko Prawns', 'Kick Start', 'food', 125, NULL, '[]'::jsonb, true),
  ('ks-camembert', 'Camembert', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('ks-sticky-wings', 'Sticky Chicken Wings', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('ks-lamb-kidneys', 'Lamb Kidneys', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('ks-bobotjie-cigars', 'Bobotjie Cigars', 'Kick Start', 'food', 85, NULL, '[]'::jsonb, true),
  ('ks-skilpadjies', 'Skilpadjies', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('ks-chilli-poppers', 'Chilli Poppers', 'Kick Start', 'food', 75, NULL, '[]'::jsonb, true),
  ('ks-salt-pepper-calamari', 'Salt & Pepper Calamari', 'Kick Start', 'food', 95, NULL, '[]'::jsonb, true),
  ('6', 'Tomahawk Steak', 'Choice Cuts', 'food', 565, NULL, '[{"size":"800g","price":565}]'::jsonb, true),
  ('7', 'Rump', 'Choice Cuts', 'food', 225, NULL, '[{"size":"200g","price":225},{"size":"300g","price":285},{"size":"400g","price":355}]'::jsonb, true),
  ('18', 'Fillet', 'Choice Cuts', 'food', 275, NULL, '[{"size":"200g","price":275},{"size":"300g","price":335},{"size":"400g","price":405}]'::jsonb, true),
  ('cc-sirloin', 'Sirloin', 'Choice Cuts', 'food', 225, NULL, '[{"size":"200g","price":225},{"size":"300g","price":285},{"size":"400g","price":355}]'::jsonb, true),
  ('cc-ribeye', 'Rib Eye', 'Choice Cuts', 'food', 335, NULL, '[{"size":"350g","price":335}]'::jsonb, true),
  ('cc-tbone', 'T-Bone', 'Choice Cuts', 'food', 325, NULL, '[{"size":"½ kg","price":325}]'::jsonb, true),
  ('cc-pork-ribs', 'Pork Spare Ribs', 'Choice Cuts', 'food', 285, NULL, '[{"size":"½ kg","price":285},{"size":"1kg","price":515}]'::jsonb, true),
  ('cc-beef-ribs', 'Beef Spare Ribs', 'Choice Cuts', 'food', 285, NULL, '[{"size":"½ kg","price":285},{"size":"1kg","price":515}]'::jsonb, true),
  ('cc-lamb-ribs', 'Lamb Spare Ribs', 'Choice Cuts', 'food', 295, NULL, '[{"size":"600g","price":295}]'::jsonb, true),
  ('cc-lamb-chops', 'Lamb Chops', 'Choice Cuts', 'food', 305, NULL, '[]'::jsonb, true),
  ('cc-picanha', 'Picanha', 'Choice Cuts', 'food', 405, NULL, '[{"size":"400g","price":405}]'::jsonb, true),
  ('cc-shisa-nyama', 'Shisa Nyama Board', 'Choice Cuts', 'food', 305, NULL, '[]'::jsonb, true),
  ('bc-camembert-bacon', 'Camembert + Bacon', 'Butcher''s Choice', 'food', 345, NULL, '[{"size":"300g Rump","price":345},{"size":"300g Sirloin","price":345}]'::jsonb, true),
  ('bc-bbc', 'BBC', 'Butcher''s Choice', 'food', 335, NULL, '[{"size":"300g Rump","price":335},{"size":"300g Sirloin","price":335}]'::jsonb, true),
  ('bc-blue-cheese-peppadew', 'Blue Cheese + Peppadew®', 'Butcher''s Choice', 'food', 335, NULL, '[{"size":"300g Rump","price":335},{"size":"300g Sirloin","price":335}]'::jsonb, true),
  ('bc-wild-mushroom-prawns', 'Wild Mushroom & Prawns', 'Butcher''s Choice', 'food', 375, NULL, '[{"size":"300g Rump","price":375},{"size":"300g Sirloin","price":375}]'::jsonb, true),
  ('bc-surf-turf', 'Surf + Turf', 'Butcher''s Choice', 'food', 375, NULL, '[{"size":"300g Rump","price":375},{"size":"300g Sirloin","price":375}]'::jsonb, true),
  ('bc-bordelaise-marrow', 'Bordelaise + Bone Marrow', 'Butcher''s Choice', 'food', 360, NULL, '[{"size":"300g Rump","price":360},{"size":"300g Sirloin","price":360}]'::jsonb, true),
  ('bc-honey-mustard-avo', 'Honey Mustard + Avo', 'Butcher''s Choice', 'food', 335, NULL, '[{"size":"300g Rump","price":335},{"size":"300g Sirloin","price":335}]'::jsonb, true),
  ('bc-blue-cheese-jalapeno', 'Blue Cheese + Jalapeño', 'Butcher''s Choice', 'food', 335, NULL, '[{"size":"300g Rump","price":335},{"size":"300g Sirloin","price":335}]'::jsonb, true),
  ('bc-butchers-supreme', 'Butchers Supreme', 'Butcher''s Choice', 'food', 345, NULL, '[{"size":"300g Rump","price":345},{"size":"300g Sirloin","price":345}]'::jsonb, true),
  ('bc-tennessee', 'Tennessee', 'Butcher''s Choice', 'food', 345, NULL, '[{"size":"300g Rump","price":345},{"size":"300g Sirloin","price":345}]'::jsonb, true),
  ('bc-creamy-cajun-shrimp', 'Creamy Cajun Shrimp', 'Butcher''s Choice', 'food', 375, NULL, '[{"size":"300g Rump","price":375},{"size":"300g Sirloin","price":375}]'::jsonb, true),
  ('pl-schnitzel', 'Chicken Schnitzel', 'Poultry', 'food', 195, NULL, '[]'::jsonb, true),
  ('pl-steaks', 'Chicken Steaks', 'Poultry', 'food', 195, NULL, '[]'::jsonb, true),
  ('pl-wings', 'Chicken Wings', 'Poultry', 'food', 195, NULL, '[]'::jsonb, true),
  ('pl-espetada', 'Chicken Espetada', 'Poultry', 'food', 195, NULL, '[]'::jsonb, true),
  ('pl-spatchcock', 'Spatchcock', 'Poultry', 'food', 295, NULL, '[]'::jsonb, true),
  ('5', 'Chicken Caesar', 'Salads', 'food', 205, NULL, '[]'::jsonb, true),
  ('sl-prawn-papaya', 'Prawn + Papaya', 'Salads', 'food', 215, NULL, '[]'::jsonb, true),
  ('sl-greek', 'Greek', 'Salads', 'food', 135, NULL, '[]'::jsonb, true),
  ('sl-cajun-chicken', 'Cajun Chicken', 'Salads', 'food', 205, NULL, '[]'::jsonb, true),
  ('sl-mediterranean', 'Mediterranean', 'Salads', 'food', 215, NULL, '[]'::jsonb, true),
  ('sl-smoked-salmon', 'Smoked Salmon', 'Salads', 'food', 215, NULL, '[]'::jsonb, true),
  ('sl-california-steak', 'California Steak', 'Salads', 'food', 210, NULL, '[]'::jsonb, true),
  ('cb-rib-steak', 'Rib + Steak', 'Combos', 'food', 475, NULL, '[{"size":"Pork Ribs + Rump","price":475},{"size":"Pork Ribs + Sirloin","price":475},{"size":"Beef Ribs + Rump","price":475},{"size":"Beef Ribs + Sirloin","price":475}]'::jsonb, true),
  ('cb-rib-chop', 'Rib + Chop', 'Combos', 'food', 405, NULL, '[]'::jsonb, true),
  ('cb-rib-calamari', 'Rib + Calamari', 'Combos', 'food', 355, NULL, '[]'::jsonb, true),
  ('cb-rib-wing', 'Rib + Wing', 'Combos', 'food', 355, NULL, '[]'::jsonb, true),
  ('cb-rib-prawn', 'Rib + Prawn', 'Combos', 'food', 445, NULL, '[]'::jsonb, true),
  ('cb-steak-prawn', 'Steak + Prawn', 'Combos', 'food', 415, NULL, '[]'::jsonb, true),
  ('cb-steak-calamari', 'Steak + Calamari', 'Combos', 'food', 315, NULL, '[]'::jsonb, true),
  ('cb-steak-wing', 'Steak + Wing', 'Combos', 'food', 315, NULL, '[]'::jsonb, true),
  ('cb-flattie-prawn', 'Flattie + Prawn', 'Combos', 'food', 335, NULL, '[]'::jsonb, true),
  ('ls-oxtail', 'Oxtail', 'Land + Sea', 'food', 285, NULL, '[]'::jsonb, true),
  ('ls-kingklip', 'Kingklip', 'Land + Sea', 'food', 295, NULL, '[]'::jsonb, true),
  ('ls-lamb-shank', 'Pot Roast Lamb Shank', 'Land + Sea', 'food', 305, NULL, '[]'::jsonb, true),
  ('ls-eisbein', 'Eisbein', 'Land + Sea', 'food', 205, NULL, '[]'::jsonb, true),
  ('ls-pork-texan', 'Pork Texan Steak', 'Land + Sea', 'food', 205, NULL, '[]'::jsonb, true),
  ('ls-ox-liver', 'Ox Liver', 'Land + Sea', 'food', 195, NULL, '[]'::jsonb, true),
  ('ls-teriyaki-salmon', 'Teriyaki Salmon', 'Land + Sea', 'food', 305, NULL, '[]'::jsonb, true),
  ('ls-calamari', 'Calamari Main', 'Land + Sea', 'food', 195, NULL, '[]'::jsonb, true),
  ('ls-chicken-prawn-curry', 'Chicken + Prawn Curry', 'Land + Sea', 'food', 205, NULL, '[]'::jsonb, true),
  ('ls-prawns', 'Grilled Queen Prawns (6 / 8 / 12)', 'Land + Sea', 'food', 0, 'S.Q.', '[]'::jsonb, true),
  ('ls-game', 'Game [Subject to the Hunt]', 'Land + Sea', 'food', 0, 'S.Q.', '[]'::jsonb, true),
  ('8', 'Jalapeño + Biltong Burger', 'Burgers', 'food', 195, NULL, '[]'::jsonb, true),
  ('bg-butcher-block', 'Butcher Block Burger', 'Burgers', 'food', 195, NULL, '[]'::jsonb, true),
  ('bg-plain-jane', 'Plain Jane', 'Burgers', 'food', 165, NULL, '[]'::jsonb, true),
  ('bg-mushroom', 'Mushroom Burger', 'Burgers', 'food', 185, NULL, '[]'::jsonb, true),
  ('bg-pepper', 'Pepper Burger', 'Burgers', 'food', 185, NULL, '[]'::jsonb, true),
  ('bg-camembert-bacon', 'Camembert + Bacon Burger', 'Burgers', 'food', 205, NULL, '[]'::jsonb, true),
  ('bg-bbc', 'BBC Burger', 'Burgers', 'food', 205, NULL, '[]'::jsonb, true),
  ('bg-big-cheese', 'Big Cheese', 'Burgers', 'food', 185, NULL, '[]'::jsonb, true),
  ('bg-dagwood', 'Old Skool Dagwood', 'Burgers', 'food', 205, NULL, '[]'::jsonb, true),
  ('bg-avo-blue', 'Avo + Blue', 'Burgers', 'food', 195, NULL, '[]'::jsonb, true),
  ('bg-american-classic', 'American Classic', 'Burgers', 'food', 195, NULL, '[]'::jsonb, true),
  ('bg-tennessee-game', 'Tennessee Game Burger', 'Burgers', 'food', 225, NULL, '[]'::jsonb, true),
  ('9', 'Pap & Chakalaka', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('10', 'Baked Potato', 'Sides & Sauces', 'food', 40, NULL, '[]'::jsonb, true),
  ('11', 'Garlic Bread', 'Sides & Sauces', 'food', 45, NULL, '[{"size":"Classic","price":45},{"size":"Add Cheese","price":55}]'::jsonb, true),
  ('sd-fries', 'Fries [Rustic Cut]', 'Sides & Sauces', 'food', 35, NULL, '[]'::jsonb, true),
  ('sd-onion-rings', 'Battered Onion Rings', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sd-savoury-rice', 'Savoury Rice', 'Sides & Sauces', 'food', 40, NULL, '[]'::jsonb, true),
  ('sd-mashed-potato', 'Mashed Potato', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sd-pumpkin-fritters', 'Pumpkin Fritters', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('sd-creamed-spinach', 'Creamed Spinach', 'Sides & Sauces', 'food', 65, NULL, '[]'::jsonb, true),
  ('sd-pan-fried-spinach', 'Pan-Fried Spinach', 'Sides & Sauces', 'food', 60, NULL, '[]'::jsonb, true),
  ('sd-sauteed-mushrooms', 'Sautéed Mushrooms', 'Sides & Sauces', 'food', 65, NULL, '[]'::jsonb, true),
  ('sd-seasonal-veg', 'Seasonal Vegetables', 'Sides & Sauces', 'food', 65, NULL, '[]'::jsonb, true),
  ('sd-garden-salad', 'Side Garden Salad', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sd-greek-salad', 'Side Greek Salad', 'Sides & Sauces', 'food', 65, NULL, '[]'::jsonb, true),
  ('sauce-1', 'Creamy Garlic Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-2', 'Garlic & Herb Butter Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-3', 'Cowboy Butter Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-4', 'Jalapeño & Biltong Sauce', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('sauce-5', 'Green Peppercorn Sauce', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('sauce-6', 'Mushroom Sauce', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('sauce-7', 'Bordelaise Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-8', 'Cheese Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-9', 'Roquefort Sauce', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('sauce-10', 'Honey & Dijon Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-11', 'Peri-Peri Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-12', 'Monkeygland Sauce', 'Sides & Sauces', 'food', 45, NULL, '[]'::jsonb, true),
  ('sauce-13', 'Chimichurri Sauce', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('sauce-14', 'Chakalaka Sauce', 'Sides & Sauces', 'food', 55, NULL, '[]'::jsonb, true),
  ('12', 'Mississippi Mud Pie', 'Desserts', 'food', 75, NULL, '[]'::jsonb, true),
  ('13', 'Malva Pudding', 'Desserts', 'food', 85, NULL, '[]'::jsonb, true),
  ('ds-oreos', 'Deep Fried Oreos', 'Desserts', 'food', 75, NULL, '[]'::jsonb, true),
  ('ds-kahlua-crepes', 'Kahlua + Ice Cream Crêpes', 'Desserts', 'food', 85, NULL, '[]'::jsonb, true),
  ('ds-cheesecake', 'Cheese Cake', 'Desserts', 'food', 80, NULL, '[]'::jsonb, true),
  ('ds-brownies', 'Gooey Chocolate Brownies', 'Desserts', 'food', 75, NULL, '[]'::jsonb, true),
  ('ds-lemon-meringue', 'Lemon Meringue', 'Desserts', 'food', 75, NULL, '[]'::jsonb, true),
  ('ds-panna-cotta', 'Panna Cotta', 'Desserts', 'food', 85, NULL, '[]'::jsonb, true),
  ('ds-ice-cream', 'Ice Cream + Chocolate Sauce', 'Desserts', 'food', 55, NULL, '[]'::jsonb, true),
  ('14', 'Moscow Mule', 'Cocktails', 'drinks', 105, NULL, '[]'::jsonb, true),
  ('15', 'Mojito', 'Cocktails', 'drinks', 105, NULL, '[]'::jsonb, true),
  ('ck-bombay-martini', 'Bombay Martini', 'Cocktails', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('ck-cosmopolitan', 'Cosmopolitan', 'Cocktails', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('ck-strawberry-daiquiri', 'Strawberry Daiquiri', 'Cocktails', 'drinks', 110, NULL, '[]'::jsonb, true),
  ('ck-blueberry-daiquiri', 'Blueberry Daiquiri', 'Cocktails', 'drinks', 110, NULL, '[]'::jsonb, true),
  ('ck-watermelon-basil', 'Watermelon Basil Cooler', 'Cocktails', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('ck-margarita', 'Margarita (Straight Up or Frozen)', 'Cocktails', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('ck-berry-mojito', 'Berry Mojito', 'Cocktails', 'drinks', 110, NULL, '[]'::jsonb, true),
  ('ck-long-island', 'Long Island Iced Tea', 'Cocktails', 'drinks', 110, NULL, '[]'::jsonb, true),
  ('ck-pina-colada', 'Pina Colada', 'Cocktails', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('ck-caipirinha', 'Caipirinha', 'Cocktails', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('ck-tai-mai-tai', 'Tai Mai Tai', 'Cocktails', 'drinks', 110, NULL, '[]'::jsonb, true),
  ('ck-aperol-spritzer', 'Aperol Spritzer', 'Cocktails', 'drinks', 145, NULL, '[]'::jsonb, true),
  ('ck-gt', 'G&T', 'Cocktails', 'drinks', 105, NULL, '[]'::jsonb, true),
  ('ck-sex-on-the-beach', 'Sex on the Beach', 'Cocktails', 'drinks', 110, NULL, '[]'::jsonb, true),
  ('ck-cherry-cranberry-spritzer', 'Cherry & Cranberry Wine Spritzer', 'Cocktails', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('jr-pimms', 'Pimm''s Jar', 'Jars', 'drinks', 95, NULL, '[]'::jsonb, true),
  ('19', 'Springbok', 'Shooters', 'drinks', 55, NULL, '[]'::jsonb, true),
  ('sh-liquid-cocaine', 'Liquid Cocaine (Double)', 'Shooters', 'drinks', 75, NULL, '[]'::jsonb, true),
  ('sh-blow-job', 'Blow Job', 'Shooters', 'drinks', 55, NULL, '[]'::jsonb, true),
  ('sh-milk-tart', 'Milk Tart', 'Shooters', 'drinks', 55, NULL, '[]'::jsonb, true),
  ('sh-suitcase', 'Suitcase', 'Shooters', 'drinks', 65, NULL, '[]'::jsonb, true),
  ('sh-oyster-shot', 'Oyster Shot', 'Shooters', 'drinks', 55, NULL, '[]'::jsonb, true),
  ('17', 'Anthonij Rupert Cape of Good Hope Altima', 'Sauvignon Blanc', 'drinks', 395, NULL, '[{"size":"Bottle","price":395}]'::jsonb, true),
  ('wn-sb-springfield', 'Springfield Life from Stone', 'Sauvignon Blanc', 'drinks', 415, NULL, '[{"size":"Bottle","price":415}]'::jsonb, true),
  ('wn-sb-guardian-peak', 'Guardian Peak Sauvignon Blanc', 'Sauvignon Blanc', 'drinks', 265, NULL, '[{"size":"Bottle","price":265}]'::jsonb, true),
  ('wn-sb-neil-ellis-wc', 'Neil Ellis West Coast Sauvignon Blanc', 'Sauvignon Blanc', 'drinks', 265, NULL, '[{"size":"Bottle","price":265},{"size":"Glass","price":90}]'::jsonb, true),
  ('wn-sb-diemersdal-res', 'Diemersdal Reserve Sauvignon Blanc', 'Sauvignon Blanc', 'drinks', 365, NULL, '[{"size":"Bottle","price":365},{"size":"Glass","price":125}]'::jsonb, true),
  ('wn-sb-protea', 'Protea Sauvignon Blanc', 'Sauvignon Blanc', 'drinks', 235, NULL, '[{"size":"Bottle","price":235},{"size":"Glass","price":85}]'::jsonb, true),
  ('wn-sb-neil-ellis-gk', 'Neil Ellis Groenekloof Sauvignon Blanc', 'Sauvignon Blanc', 'drinks', 355, NULL, '[{"size":"Bottle","price":355},{"size":"Glass","price":125}]'::jsonb, true),
  ('wn-sb-diemersdal', 'Diemersdal Sauvignon Blanc', 'Sauvignon Blanc', 'drinks', 285, NULL, '[{"size":"Bottle","price":285}]'::jsonb, true),
  ('wn-sb-tokara', 'Tokara Sauvignon Blanc', 'Sauvignon Blanc', 'drinks', 325, NULL, '[{"size":"Bottle","price":325}]'::jsonb, true),
  ('wn-ch-de-wetshof', 'De Wetshof Finesse (Wooded)', 'Chardonnay & White', 'drinks', 425, NULL, '[{"size":"Bottle","price":425}]'::jsonb, true),
  ('wn-ch-protea', 'Protea Chardonnay', 'Chardonnay & White', 'drinks', 235, NULL, '[{"size":"Bottle","price":235},{"size":"Glass","price":85}]'::jsonb, true),
  ('wn-ch-springfield-wy', 'Springfield Wild Yeast Chardonnay (Wooded)', 'Chardonnay & White', 'drinks', 485, NULL, '[{"size":"Bottle","price":485}]'::jsonb, true),
  ('wn-ch-diemersdal', 'Diemersdal Chardonnay (Unwooded)', 'Chardonnay & White', 'drinks', 285, NULL, '[{"size":"Bottle","price":285},{"size":"Glass","price":95}]'::jsonb, true),
  ('wn-sd-ernie-els-chenin', 'Ernie Els Big Easy Chenin Blanc', 'Chardonnay & White', 'drinks', 265, NULL, '[{"size":"Bottle","price":265},{"size":"Glass","price":90}]'::jsonb, true),
  ('wn-sd-mentors-grenache', 'Mentors Grenache Blanc', 'Chardonnay & White', 'drinks', 425, NULL, '[{"size":"Bottle","price":425}]'::jsonb, true),
  ('wn-sd-endura-chenin', 'Endura Single Vineyard Chenin Blanc', 'Chardonnay & White', 'drinks', 910, NULL, '[{"size":"Bottle","price":910}]'::jsonb, true),
  ('wn-sd-altima-chenin', 'Anthonij Rupert Cape of Good Hope Riebeeksrivier Chenin Blanc', 'Chardonnay & White', 'drinks', 385, NULL, '[{"size":"Bottle","price":385}]'::jsonb, true),
  ('wn-sd-afrikaans-cc', 'Afrikaans Chenin Chardonnay', 'Chardonnay & White', 'drinks', 475, NULL, '[{"size":"Bottle","price":475}]'::jsonb, true),
  ('wn-sd-miss-lucy', 'Springfield Miss Lucy', 'Chardonnay & White', 'drinks', 455, NULL, '[{"size":"Bottle","price":455},{"size":"Glass","price":155}]'::jsonb, true),
  ('wn-rs-boschendal-bdn', 'Boschendal Blanc De Noir', 'Rosé & Semi-Sweet', 'drinks', 185, NULL, '[{"size":"Bottle","price":185}]'::jsonb, true),
  ('wn-rs-neil-ellis-wf', 'Neil Ellis Wild Flower Rosé', 'Rosé & Semi-Sweet', 'drinks', 265, NULL, '[{"size":"Bottle","price":265}]'::jsonb, true),
  ('wn-rs-delheim', 'Delheim Pinotage Rosé', 'Rosé & Semi-Sweet', 'drinks', 285, NULL, '[{"size":"Bottle","price":285},{"size":"Glass","price":95}]'::jsonb, true),
  ('wn-rs-ernie-els', 'Ernie Els Big Easy Cabernet Sauvignon Rosé', 'Rosé & Semi-Sweet', 'drinks', 255, NULL, '[{"size":"Bottle","price":255},{"size":"Glass","price":85}]'::jsonb, true),
  ('wn-ss-boschendal', 'Boschendal Le Bouquet (Semi Sweet)', 'Rosé & Semi-Sweet', 'drinks', 195, NULL, '[{"size":"Bottle","price":195},{"size":"Glass","price":65}]'::jsonb, true),
  ('16', 'Rust En Vrede Estate Vineyards Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 845, NULL, '[{"size":"Bottle","price":845}]'::jsonb, true),
  ('wn-cs-brampton', 'Brampton Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 245, NULL, '[{"size":"Bottle","price":245},{"size":"Glass","price":85}]'::jsonb, true),
  ('wn-cs-protea', 'Protea Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 245, NULL, '[{"size":"Bottle","price":245},{"size":"Glass","price":85}]'::jsonb, true),
  ('wn-cs-alto', 'Alto Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 635, NULL, '[{"size":"Bottle","price":635}]'::jsonb, true),
  ('wn-cs-ernie-els', 'Ernie Els Major Series Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 575, NULL, '[{"size":"Bottle","price":575},{"size":"Glass","price":195}]'::jsonb, true),
  ('wn-cs-anthonij-rupert', 'Anthonij Rupert Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 1645, NULL, '[{"size":"Bottle","price":1645}]'::jsonb, true),
  ('wn-cs-springfield-wb', 'Springfield Whole Berry Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 475, NULL, '[{"size":"Bottle","price":475}]'::jsonb, true),
  ('wn-cs-beyerskloof-er', 'Beyerskloof Eerste Ry Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 1625, NULL, '[{"size":"Bottle","price":1625}]'::jsonb, true),
  ('wn-cs-afrikaans-red', 'Afrikaans Red Cabernet Sauvignon', 'Cabernet Sauvignon', 'drinks', 585, NULL, '[{"size":"Bottle","price":585}]'::jsonb, true),
  ('wn-pt-beyerskloof', 'Beyerskloof Pinotage', 'Pinotage & Pinot Noir', 'drinks', 305, NULL, '[{"size":"Bottle","price":305},{"size":"Glass","price":105}]'::jsonb, true),
  ('wn-pt-brampton', 'Brampton Pinotage', 'Pinotage & Pinot Noir', 'drinks', 235, NULL, '[{"size":"Bottle","price":235}]'::jsonb, true),
  ('wn-pt-kanonkop-kadette', 'Kanonkop Kadette Pinotage', 'Pinotage & Pinot Noir', 'drinks', 365, NULL, '[{"size":"Bottle","price":365},{"size":"Glass","price":125}]'::jsonb, true),
  ('wn-pt-kanonkop-estate', 'Kanonkop Estate Pinotage', 'Pinotage & Pinot Noir', 'drinks', 1465, NULL, '[{"size":"Bottle","price":1465}]'::jsonb, true),
  ('wn-pt-diemersdal', 'Diemersdal Pinotage', 'Pinotage & Pinot Noir', 'drinks', 375, NULL, '[{"size":"Bottle","price":375}]'::jsonb, true),
  ('wn-pt-kriekbult', 'Beyerskloof Kriekbult Pinotage', 'Pinotage & Pinot Noir', 'drinks', 1395, NULL, '[{"size":"Bottle","price":1395}]'::jsonb, true),
  ('wn-pn-paul-cluver', 'Paul Cluver Village Pinot Noir', 'Pinotage & Pinot Noir', 'drinks', 335, NULL, '[{"size":"Bottle","price":335}]'::jsonb, true),
  ('wn-pn-cirrus', 'Cirrus Pinot Noir', 'Pinotage & Pinot Noir', 'drinks', 715, NULL, '[{"size":"Bottle","price":715}]'::jsonb, true),
  ('wn-ml-guardian-peak', 'Guardian Peak Merlot', 'Merlot & Shiraz', 'drinks', 265, NULL, '[{"size":"Bottle","price":265},{"size":"Glass","price":90}]'::jsonb, true),
  ('wn-ml-anthonij-rupert', 'Anthonij Rupert Merlot', 'Merlot & Shiraz', 'drinks', 1025, NULL, '[{"size":"Bottle","price":1025}]'::jsonb, true),
  ('wn-ml-diemersdal', 'Diemersdal Merlot', 'Merlot & Shiraz', 'drinks', 375, NULL, '[{"size":"Bottle","price":375},{"size":"Glass","price":125}]'::jsonb, true),
  ('wn-ml-st-reserve', 'Stellenbosch Reserve Merlot', 'Merlot & Shiraz', 'drinks', 425, NULL, '[{"size":"Bottle","price":425}]'::jsonb, true),
  ('wn-ml-ernie-els', 'Ernie Els Major Series Merlot', 'Merlot & Shiraz', 'drinks', 525, NULL, '[{"size":"Bottle","price":525}]'::jsonb, true),
  ('wn-sh-tokara', 'Tokara Shiraz', 'Merlot & Shiraz', 'drinks', 385, NULL, '[{"size":"Bottle","price":385}]'::jsonb, true),
  ('wn-sh-alto', 'Alto Shiraz', 'Merlot & Shiraz', 'drinks', 635, NULL, '[{"size":"Bottle","price":635}]'::jsonb, true),
  ('wn-sh-kevin-arnold', 'Kevin Arnold Shiraz', 'Merlot & Shiraz', 'drinks', 985, NULL, '[{"size":"Bottle","price":985}]'::jsonb, true),
  ('wn-sh-laborie', 'Laborie Shiraz', 'Merlot & Shiraz', 'drinks', 225, NULL, '[{"size":"Bottle","price":225}]'::jsonb, true),
  ('wn-sh-guardian-peak', 'Guardian Peak Shiraz', 'Merlot & Shiraz', 'drinks', 265, NULL, '[{"size":"Bottle","price":265},{"size":"Glass","price":95}]'::jsonb, true),
  ('wn-sy-rust-en-vrede', 'Rust en Vrede Estate Vineyards Syrah', 'Merlot & Shiraz', 'drinks', 845, NULL, '[{"size":"Bottle","price":845}]'::jsonb, true),
  ('wn-sy-neil-ellis', 'Neil Ellis Groenekloof Syrah', 'Merlot & Shiraz', 'drinks', 415, NULL, '[{"size":"Bottle","price":415},{"size":"Glass","price":140}]'::jsonb, true),
  ('wn-sy-anthonij-rupert', 'Anthonij Rupert Cape of Good Hope Riebeeksrivier Syrah', 'Merlot & Shiraz', 'drinks', 1035, NULL, '[{"size":"Bottle","price":1035}]'::jsonb, true),
  ('wn-sy-st-reserve', 'Stellenbosch Reserve Syrah', 'Merlot & Shiraz', 'drinks', 425, NULL, '[{"size":"Bottle","price":425}]'::jsonb, true),
  ('wn-rb-optima', 'Anthonij Rupert Optima', 'Red Blends', 'drinks', 575, NULL, '[{"size":"Bottle","price":575},{"size":"Glass","price":195}]'::jsonb, true),
  ('wn-rb-ar-blend', 'Anthonij Rupert Blend', 'Red Blends', 'drinks', 2995, NULL, '[{"size":"Bottle","price":2995}]'::jsonb, true),
  ('wn-rb-big-easy', 'Ernie Els Big Easy Red', 'Red Blends', 'drinks', 425, NULL, '[{"size":"Bottle","price":425},{"size":"Glass","price":145}]'::jsonb, true),
  ('wn-rb-signature', 'Ernie Els Signature', 'Red Blends', 'drinks', 1755, NULL, '[{"size":"Bottle","price":1755}]'::jsonb, true),
  ('wn-rb-kadette-cape', 'Kanonkop Kadette Cape Blend', 'Red Blends', 'drinks', 345, NULL, '[{"size":"Bottle","price":345},{"size":"Glass","price":120}]'::jsonb, true),
  ('wn-rb-rr-classique', 'Rupert & Rothschild Classique', 'Red Blends', 'drinks', 645, NULL, '[{"size":"Bottle","price":645}]'::jsonb, true),
  ('wn-rb-chocolate-block', 'The Chocolate Block', 'Red Blends', 'drinks', 735, NULL, '[{"size":"Bottle","price":735}]'::jsonb, true),
  ('wn-rb-rust-en-vrede', 'Rust en Vrede Estate', 'Red Blends', 'drinks', 1325, NULL, '[{"size":"Bottle","price":1325}]'::jsonb, true),
  ('wn-rb-diemersdal-pc', 'Diemersdal Private Collection', 'Red Blends', 'drinks', 525, NULL, '[{"size":"Bottle","price":525}]'::jsonb, true),
  ('wn-rb-western-slopes', 'Anthonij Rupert Cape of Good Hope Western Slopes', 'Red Blends', 'drinks', 455, NULL, '[{"size":"Bottle","price":455}]'::jsonb, true),
  ('wn-rb-work-of-time', 'Springfield Work of Time', 'Red Blends', 'drinks', 645, NULL, '[{"size":"Bottle","price":645}]'::jsonb, true),
  ('wn-rb-orchestra', 'KWV The Mentors Orchestra', 'Red Blends', 'drinks', 810, NULL, '[{"size":"Bottle","price":810}]'::jsonb, true),
  ('wn-rb-petit-verdot', 'KWV The Mentors Petit Verdot', 'Red Blends', 'drinks', 815, NULL, '[{"size":"Bottle","price":815}]'::jsonb, true),
  ('wn-rb-roodeberg-dcn', 'Roodeberg Dr Charles Niehaus', 'Red Blends', 'drinks', 825, NULL, '[{"size":"Bottle","price":825}]'::jsonb, true),
  ('wn-rb-roodeberg-res', 'Roodeberg Reserve', 'Red Blends', 'drinks', 485, NULL, '[{"size":"Bottle","price":485}]'::jsonb, true),
  ('wn-rb-endura', 'Endura Cape Blend', 'Red Blends', 'drinks', 1285, NULL, '[{"size":"Bottle","price":1285}]'::jsonb, true),
  ('wn-rb-vilafonte', 'Vilafonte Seriously Old Dirt', 'Red Blends', 'drinks', 615, NULL, '[{"size":"Bottle","price":615}]'::jsonb, true),
  ('wn-pr-martini-asti', 'Martini Asti', 'Bubbles & Dessert', 'drinks', 405, NULL, '[{"size":"Bottle","price":405}]'::jsonb, true),
  ('wn-pr-martini-rose', 'Martini Rosé', 'Bubbles & Dessert', 'drinks', 405, NULL, '[{"size":"Bottle","price":405}]'::jsonb, true),
  ('wn-pr-martini-prosecco', 'Martini Prosecco', 'Bubbles & Dessert', 'drinks', 405, NULL, '[{"size":"Bottle","price":405}]'::jsonb, true),
  ('wn-mcc-lormarins-rose', 'L''Ormarins Brut Rosé NV (MCC)', 'Bubbles & Dessert', 'drinks', 485, NULL, '[{"size":"Bottle","price":485},{"size":"Glass","price":125}]'::jsonb, true),
  ('wn-mcc-lormarins-brut', 'L''Ormarins Classique Brut NV (MCC)', 'Bubbles & Dessert', 'drinks', 485, NULL, '[{"size":"Bottle","price":485},{"size":"Glass","price":125}]'::jsonb, true),
  ('wn-chp-moet-brut', 'Moët Chandon NV Brut Imperial', 'Bubbles & Dessert', 'drinks', 1875, NULL, '[{"size":"Bottle","price":1875}]'::jsonb, true),
  ('wn-chp-moet-rose', 'Moët Chandon Rosé Imperial', 'Bubbles & Dessert', 'drinks', 2310, NULL, '[{"size":"Bottle","price":2310}]'::jsonb, true),
  ('wn-chp-moet-nectar', 'Moët Chandon Nectar Imperial', 'Bubbles & Dessert', 'drinks', 2195, NULL, '[{"size":"Bottle","price":2195}]'::jsonb, true),
  ('wn-chp-veuve-brut', 'Veuve Clicquot Brut Yellow Label', 'Bubbles & Dessert', 'drinks', 2095, NULL, '[{"size":"Bottle","price":2095}]'::jsonb, true),
  ('wn-chp-veuve-rich', 'Veuve Clicquot Rich', 'Bubbles & Dessert', 'drinks', 2815, NULL, '[{"size":"Bottle","price":2815}]'::jsonb, true),
  ('wn-ds-lormarins-lbv', 'L''Ormarins LBV (Dessert Wine)', 'Bubbles & Dessert', 'drinks', 70, NULL, '[]'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, menu_section = EXCLUDED.menu_section, base_price = EXCLUDED.base_price, price_label = EXCLUDED.price_label, variations = EXCLUDED.variations, active = EXCLUDED.active;
