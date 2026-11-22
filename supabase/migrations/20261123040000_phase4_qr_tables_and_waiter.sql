-- ============================================================================
-- Phase 4: QR Table Ordering, Validated Table Sessions & Waiter Service Requests
-- Butcher Block Steakhouse (Windhoek, Namibia)
-- ============================================================================

-- 1. Restaurant Tables (opaque table_code; never expose raw internal metadata publicly)
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL UNIQUE CHECK (char_length(trim(table_number)) BETWEEN 1 AND 24),
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 60),
  table_code text NOT NULL UNIQUE,
  qr_version integer NOT NULL DEFAULT 1,
  capacity integer NOT NULL DEFAULT 4 CHECK (capacity BETWEEN 1 AND 30),
  area text NOT NULL DEFAULT 'Main Dining',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view restaurant tables" ON public.restaurant_tables;
CREATE POLICY "Staff can view restaurant tables"
  ON public.restaurant_tables FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Management manages restaurant tables" ON public.restaurant_tables;
CREATE POLICY "Management manages restaurant tables"
  ON public.restaurant_tables FOR ALL
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- 2. Time-Limited Table Sessions
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  verified_by_staff boolean NOT NULL DEFAULT false,
  opened_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours'),
  closed_at timestamptz DEFAULT NULL,
  closed_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status
  ON public.table_sessions (table_id, status, expires_at DESC);

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read and close table sessions" ON public.table_sessions;
CREATE POLICY "Staff can read and close table sessions"
  ON public.table_sessions FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Link orders optionally to a validated table session
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_session_id uuid DEFAULT NULL REFERENCES public.table_sessions(id) ON DELETE SET NULL;

-- 3. Waiter Service Requests
CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  table_session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  user_id uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_session_key text DEFAULT NULL,
  request_type text NOT NULL CHECK (request_type IN ('waiter', 'cutlery', 'water', 'condiments', 'bill', 'other')),
  note text DEFAULT NULL CHECK (note IS NULL OR char_length(note) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'cancelled')),
  acknowledged_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz DEFAULT NULL,
  completed_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz DEFAULT NULL,
  cancelled_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate active service requests of the same type for one table session
CREATE UNIQUE INDEX IF NOT EXISTS service_requests_active_dedupe_idx
  ON public.service_requests (table_session_id, request_type)
  WHERE status IN ('pending', 'acknowledged');

CREATE INDEX IF NOT EXISTS idx_service_requests_status_created
  ON public.service_requests (status, created_at ASC);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Staff can view all service requests" ON public.service_requests;
CREATE POLICY "Staff can view all service requests"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Customers can view own service requests" ON public.service_requests;
CREATE POLICY "Customers can view own service requests"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Trusted RPCs for QR Resolution, Validation, Management & Waiter Requests
CREATE OR REPLACE FUNCTION public.resolve_table_qr(p_table_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.restaurant_tables%ROWTYPE;
  v_token text;
  v_hash text;
  v_session public.table_sessions%ROWTYPE;
BEGIN
  IF p_table_code IS NULL OR char_length(trim(p_table_code)) < 4 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_table
  FROM public.restaurant_tables
  WHERE table_code = trim(p_table_code)
    AND active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.table_sessions (table_id, session_token_hash, opened_by, expires_at)
  VALUES (v_table.id, v_hash, auth.uid(), now() + interval '4 hours')
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'session_token', v_token,
    'table_id', v_table.id,
    'table_number', v_table.table_number,
    'display_name', v_table.display_name,
    'area', v_table.area,
    'expires_at', v_session.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_table_qr(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_table_session(
  p_session_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_rec record;
BEGIN
  IF p_session_id IS NULL OR p_session_token IS NULL OR char_length(p_session_token) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_token');
  END IF;

  v_hash := encode(extensions.digest(convert_to(p_session_token, 'UTF8'), 'sha256'), 'hex');

  SELECT s.id AS session_id, s.status, s.expires_at, t.id AS table_id, t.table_number, t.display_name, t.area, t.active AS table_active
  INTO v_rec
  FROM public.table_sessions s
  JOIN public.restaurant_tables t ON t.id = s.table_id
  WHERE s.id = p_session_id
    AND s.session_token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF NOT v_rec.table_active OR v_rec.status <> 'active' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'closed');
  END IF;
  IF v_rec.expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'session_id', v_rec.session_id,
    'table_id', v_rec.table_id,
    'table_number', v_rec.table_number,
    'display_name', v_rec.display_name,
    'area', v_rec.area,
    'expires_at', v_rec.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_table_session(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_service_request(
  p_session_id uuid,
  p_session_token text,
  p_request_type text,
  p_note text DEFAULT NULL,
  p_guest_key text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check jsonb;
  v_table_id uuid;
  v_existing public.service_requests%ROWTYPE;
  v_created public.service_requests%ROWTYPE;
BEGIN
  v_check := public.validate_table_session(p_session_id, p_session_token);
  IF NOT COALESCE((v_check->>'valid')::boolean, false) THEN
    RAISE EXCEPTION 'Your table session has closed or expired. Please scan the table QR code again.'
      USING ERRCODE = '42501';
  END IF;

  IF p_request_type NOT IN ('waiter', 'cutlery', 'water', 'condiments', 'bill', 'other') THEN
    RAISE EXCEPTION 'Unsupported service request type' USING ERRCODE = '22023';
  END IF;

  v_table_id := (v_check->>'table_id')::uuid;

  SELECT * INTO v_existing
  FROM public.service_requests
  WHERE table_session_id = p_session_id
    AND request_type = p_request_type
    AND status IN ('pending', 'acknowledged')
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.service_requests (
    table_id, table_session_id, user_id, guest_session_key, request_type, note
  )
  VALUES (
    v_table_id,
    p_session_id,
    auth.uid(),
    NULLIF(trim(COALESCE(p_guest_key, '')), ''),
    p_request_type,
    NULLIF(trim(COALESCE(p_note, '')), '')
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_service_request(uuid, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_session_service_requests(
  p_session_id uuid,
  p_session_token text
)
RETURNS SETOF public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check jsonb;
BEGIN
  v_check := public.validate_table_session(p_session_id, p_session_token);
  IF NOT COALESCE((v_check->>'valid')::boolean, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.service_requests
  WHERE table_session_id = p_session_id
  ORDER BY created_at DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_service_requests(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_service_request(
  p_request_id uuid,
  p_session_token text,
  p_guest_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.service_requests%ROWTYPE;
  v_check jsonb;
BEGIN
  SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.status <> 'pending' THEN
    RETURN false;
  END IF;

  v_check := public.validate_table_session(v_req.table_session_id, p_session_token);
  IF NOT COALESCE((v_check->>'valid')::boolean, false) THEN
    RETURN false;
  END IF;

  IF v_req.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM v_req.user_id THEN
    RETURN false;
  END IF;
  IF v_req.user_id IS NULL AND v_req.guest_session_key IS NOT NULL AND v_req.guest_session_key IS DISTINCT FROM p_guest_key THEN
    RETURN false;
  END IF;

  UPDATE public.service_requests
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = p_request_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_service_request(uuid, text, text) TO anon, authenticated;

-- Race-safe waiter request update (prevents two waiters colliding on one request)
CREATE OR REPLACE FUNCTION public.update_service_request_status(
  p_request_id uuid,
  p_next_status text
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_req public.service_requests%ROWTYPE;
  v_updated public.service_requests%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: staff required' USING ERRCODE = '42501';
  END IF;
  IF p_next_status NOT IN ('acknowledged', 'completed') THEN
    RAISE EXCEPTION 'Invalid service request transition' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status IN ('completed', 'cancelled') THEN
    RETURN v_req;
  END IF;
  IF v_req.status = 'acknowledged' AND p_next_status = 'acknowledged' THEN
    RETURN v_req;
  END IF;

  UPDATE public.service_requests
  SET
    status = p_next_status,
    acknowledged_by = CASE WHEN acknowledged_by IS NULL THEN v_actor ELSE acknowledged_by END,
    acknowledged_at = CASE WHEN acknowledged_at IS NULL THEN now() ELSE acknowledged_at END,
    completed_by = CASE WHEN p_next_status = 'completed' THEN v_actor ELSE completed_by END,
    completed_at = CASE WHEN p_next_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_request_id
  RETURNING * INTO v_updated;

  IF v_updated.user_id IS NOT NULL THEN
    PERFORM public.create_notification_idempotent(
      v_updated.user_id,
      'service:' || v_updated.id::text || ':' || p_next_status,
      'service_' || p_next_status,
      CASE WHEN p_next_status = 'acknowledged' THEN 'Waiter On the Way' ELSE 'Table Request Completed' END,
      CASE WHEN p_next_status = 'acknowledged'
        THEN 'A Butcher Block team member has seen your request and is heading to your table.'
        ELSE 'Your table assistance request has been completed.'
      END,
      '/menu',
      NULL,
      jsonb_build_object('service_request_id', v_updated.id, 'request_type', v_updated.request_type)
    );
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_service_request_status(uuid, text) TO authenticated;

-- Table management RPCs
CREATE OR REPLACE FUNCTION public.create_restaurant_table(
  p_table_number text,
  p_display_name text,
  p_capacity integer DEFAULT 4,
  p_area text DEFAULT 'Main Dining'
)
RETURNS public.restaurant_tables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_row public.restaurant_tables%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: management required' USING ERRCODE = '42501';
  END IF;

  v_code := 'BB-' || upper(regexp_replace(trim(p_table_number), '[^A-Za-z0-9]', '', 'g')) || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO public.restaurant_tables (table_number, display_name, table_code, capacity, area)
  VALUES (trim(p_table_number), trim(p_display_name), v_code, GREATEST(1, LEAST(p_capacity, 30)), COALESCE(NULLIF(trim(p_area), ''), 'Main Dining'))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_restaurant_table(text, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.regenerate_table_qr_code(p_table_id uuid)
RETURNS public.restaurant_tables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.restaurant_tables%ROWTYPE;
  v_new_code text;
  v_updated public.restaurant_tables%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_manager_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: management required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.restaurant_tables WHERE id = p_table_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found' USING ERRCODE = 'P0002';
  END IF;

  -- Close prior active sessions tied to the compromised QR code
  UPDATE public.table_sessions
  SET status = 'closed', closed_at = now(), closed_by = auth.uid()
  WHERE table_id = p_table_id AND status = 'active';

  v_new_code := 'BB-' || upper(regexp_replace(v_existing.table_number, '[^A-Za-z0-9]', '', 'g')) || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  UPDATE public.restaurant_tables
  SET table_code = v_new_code, qr_version = qr_version + 1, updated_at = now()
  WHERE id = p_table_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_table_qr_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_table_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: staff required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.table_sessions
  SET status = 'closed', closed_at = now(), closed_by = auth.uid()
  WHERE id = p_session_id AND status = 'active';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_table_session(uuid) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
