-- ============================================================================
-- Phase 1: Live Kitchen Order Tracking & Centralized Notification Foundation
-- Butcher Block Steakhouse (Windhoek, Namibia)
-- ============================================================================
-- Rollback notes:
--   Drop new RPCs/triggers, drop push_subscriptions, notification_preferences,
--   user_notifications, order_status_history, and revert orders check constraint.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Expand app_role enum safely for operational staff separation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'kitchen' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'kitchen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'waiter' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'waiter';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'manager';
  END IF;
END $$;

-- Helper role predicates (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin', 'manager', 'kitchen', 'waiter'])
$$;

CREATE OR REPLACE FUNCTION public.is_kitchen_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin', 'manager', 'kitchen', 'waiter'])
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin', 'manager'])
$$;

-- 2. Extend public.orders for 6-stage tracking, guest token access, and payment state
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_access_token_hash text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS table_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_by uuid DEFAULT NULL;

ALTER TABLE public.orders REPLICA IDENTITY FULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_valid_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_valid_status_check
  CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'handover', 'completed', 'cancelled'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);

-- Allow kitchen/waiter/manager staff to view & update orders (in addition to existing admin policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Staff can view all orders'
  ) THEN
    CREATE POLICY "Staff can view all orders"
      ON public.orders FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Kitchen staff can update orders'
  ) THEN
    CREATE POLICY "Kitchen staff can update orders"
      ON public.orders FOR UPDATE
      TO authenticated
      USING (public.is_kitchen_or_admin(auth.uid()));
  END IF;
END $$;

-- 3. Immutable Order Status History
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text DEFAULT NULL,
  to_status text NOT NULL,
  changed_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role text DEFAULT NULL,
  note text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history (order_id, created_at ASC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own order status history" ON public.order_status_history;
CREATE POLICY "Customers can view own order status history"
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
    OR public.is_staff(auth.uid())
  );

-- 4. Centralized Durable User Notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid DEFAULT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_url text DEFAULT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.user_notifications;
CREATE POLICY "Users can read own notifications"
  ON public.user_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.user_notifications;
CREATE POLICY "Users can mark own notifications read"
  ON public.user_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prevent users from mutating immutable notification content columns
CREATE OR REPLACE FUNCTION public.guard_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.event_key IS DISTINCT FROM OLD.event_key
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.action_url IS DISTINCT FROM OLD.action_url
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Only read_at may be updated on user_notifications';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_notification_update ON public.user_notifications;
CREATE TRIGGER trg_guard_notification_update
  BEFORE UPDATE ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_notification_update();

-- 5. Notification Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  order_updates boolean NOT NULL DEFAULT true,
  service_updates boolean NOT NULL DEFAULT true,
  rewards_updates boolean NOT NULL DEFAULT true,
  events_updates boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Web Push Subscriptions (explicit opt-in only)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text DEFAULT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON public.push_subscriptions (user_id)
  WHERE active = true;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Centralized Idempotent Notification Creator (internal SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_notification_idempotent(
  p_user_id uuid,
  p_event_key text,
  p_event_type text,
  p_title text,
  p_body text,
  p_action_url text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_prefs public.notification_preferences%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_event_key IS NULL OR length(trim(p_event_key)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = p_user_id;
  IF FOUND THEN
    IF p_event_type LIKE 'order_%' AND NOT v_prefs.order_updates THEN RETURN NULL; END IF;
    IF p_event_type LIKE 'service_%' AND NOT v_prefs.service_updates THEN RETURN NULL; END IF;
    IF (p_event_type LIKE 'loyalty_%' OR p_event_type LIKE 'reward_%' OR p_event_type LIKE 'gotw_%') AND NOT v_prefs.rewards_updates THEN RETURN NULL; END IF;
  END IF;

  INSERT INTO public.user_notifications (
    user_id, order_id, event_key, event_type, title, body, action_url, metadata
  )
  VALUES (
    p_user_id, p_order_id, p_event_key, p_event_type, p_title, p_body, p_action_url, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (event_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_idempotent(uuid, text, text, text, text, text, uuid, jsonb) FROM PUBLIC;

-- Helper returning exact Butcher Block stage notification copy
CREATE OR REPLACE FUNCTION public.order_stage_notification_copy(p_status text, p_order_type text)
RETURNS TABLE(title text, body text)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_status
    WHEN 'pending' THEN
      title := 'Order Received';
      body := 'Your order has been received by Butcher Block.';
    WHEN 'confirmed' THEN
      title := 'Kitchen Confirmed';
      body := 'The kitchen has confirmed your order.';
    WHEN 'preparing' THEN
      title := 'Preparing';
      body := 'Your food is being prepared.';
    WHEN 'ready' THEN
      title := 'Order Ready';
      body := 'Your order is ready.';
    WHEN 'handover' THEN
      IF p_order_type = 'dinein' THEN
        title := 'On Its Way';
        body := 'Your food is on its way to your table.';
      ELSE
        title := 'Ready for Collection';
        body := 'Your order is ready for collection.';
      END IF;
    WHEN 'completed' THEN
      title := 'Enjoy Your Meal';
      body := 'Enjoy your meal. We''d love to hear what you think.';
    WHEN 'cancelled' THEN
      title := 'Order Cancelled';
      body := 'Your order was cancelled. Call +264 83 288 8000 if you need assistance.';
    ELSE
      title := 'Order Update';
      body := 'Your Butcher Block order status has been updated.';
  END CASE;
  RETURN NEXT;
END;
$$;

-- Trigger on orders INSERT: record initial status history + idempotent Stage 1 notification
CREATE OR REPLACE FUNCTION public.handle_order_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copy record;
BEGIN
  INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (NEW.id, NULL, NEW.status, NEW.user_id, CASE WHEN NEW.user_id IS NULL THEN 'guest' ELSE 'customer' END, 'Order submitted');

  IF NEW.user_id IS NOT NULL THEN
    SELECT * INTO v_copy FROM public.order_stage_notification_copy(NEW.status, NEW.order_type);
    PERFORM public.create_notification_idempotent(
      NEW.user_id,
      'order:' || NEW.id::text || ':' || NEW.status,
      'order_' || NEW.status,
      v_copy.title,
      v_copy.body,
      '/order/' || NEW.id::text,
      NEW.id,
      jsonb_build_object('status', NEW.status, 'order_type', COALESCE(NEW.order_type, 'pickup'))
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_inserted_audit ON public.orders;
CREATE TRIGGER trg_order_inserted_audit
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_inserted();

-- 8. Server-Validated Order Status Transition RPC (staff only)
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

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent no-op when repeated click sends same status
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

  -- Strict valid state machine transitions
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

GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, text, integer, text) TO authenticated;

-- 9. Staff payment settlement marking (used to confirm real payment before loyalty points award)
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
  v_updated public.orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: staff privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_payment_status NOT IN ('unpaid', 'paid', 'refunded') THEN
    RAISE EXCEPTION 'Invalid payment status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET
    payment_status = p_payment_status,
    paid_at = CASE WHEN p_payment_status = 'paid' THEN COALESCE(paid_at, now()) ELSE NULL END,
    paid_by = CASE WHEN p_payment_status = 'paid' THEN v_actor ELSE NULL END
  WHERE id = p_order_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_payment_status(uuid, text) TO authenticated;

-- 10. Secure Guest Order Tracking & Account Claim RPCs (never exposes arbitrary orders by UUID)
CREATE OR REPLACE FUNCTION public.get_guest_order_status(
  p_order_id uuid,
  p_access_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_expected_hash text;
  v_history jsonb;
BEGIN
  IF p_order_id IS NULL OR p_access_token IS NULL OR length(trim(p_access_token)) < 16 THEN
    RETURN NULL;
  END IF;

  v_expected_hash := encode(extensions.digest(convert_to(p_access_token, 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND guest_access_token_hash IS NOT NULL
    AND guest_access_token_hash = v_expected_hash;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'created_at', h.created_at
      ) ORDER BY h.created_at ASC
    ),
    '[]'::jsonb
  ) INTO v_history
  FROM public.order_status_history h
  WHERE h.order_id = v_order.id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'items', v_order.items,
    'total', v_order.total,
    'status', v_order.status,
    'order_type', v_order.order_type,
    'table_number', v_order.table_number,
    'arrival_code', v_order.arrival_code,
    'eta_minutes', v_order.eta_minutes,
    'eta_set_at', v_order.eta_set_at,
    'payment_status', v_order.payment_status,
    'created_at', v_order.created_at,
    'history', v_history
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_order_status(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_guest_order(
  p_order_id uuid,
  p_access_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expected_hash text;
  v_updated integer;
BEGIN
  IF v_uid IS NULL OR p_order_id IS NULL OR p_access_token IS NULL OR length(trim(p_access_token)) < 16 THEN
    RETURN false;
  END IF;

  v_expected_hash := encode(extensions.digest(convert_to(p_access_token, 'UTF8'), 'sha256'), 'hex');

  UPDATE public.orders
  SET user_id = v_uid
  WHERE id = p_order_id
    AND user_id IS NULL
    AND guest_access_token_hash = v_expected_hash;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_guest_order(uuid, text) TO authenticated;

-- 11. Update cancel_own_pending_order so cancellation also logs history & idempotent notification
CREATE OR REPLACE FUNCTION public.cancel_own_pending_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (p_order_id, 'pending', 'cancelled', auth.uid(), 'customer', 'Cancelled by customer while pending');

  PERFORM public.create_notification_idempotent(
    auth.uid(),
    'order:' || p_order_id::text || ':cancelled',
    'order_cancelled',
    'Order Cancelled',
    'Your pending order has been cancelled.',
    '/order/' || p_order_id::text,
    p_order_id,
    jsonb_build_object('status', 'cancelled')
  );

  RETURN true;
END;
$$;

-- 12. Enable Realtime on user_notifications & order_status_history
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
