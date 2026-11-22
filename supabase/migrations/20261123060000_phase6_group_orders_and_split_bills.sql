-- ============================================================================
-- Phase 6: Group Ordering & Integer Minor-Unit Split Bill Settlement
-- Butcher Block Steakhouse (Windhoek, Namibia)
-- ============================================================================

-- 1. Group Orders
CREATE TABLE IF NOT EXISTS public.group_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  table_session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE RESTRICT,
  table_display_name text NOT NULL,
  host_user_id uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  host_guest_key text DEFAULT NULL,
  invite_code text NOT NULL UNIQUE,
  invite_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'submitted', 'preparing', 'ready', 'completed', 'cancelled')),
  submitted_order_id uuid DEFAULT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  idempotency_key text DEFAULT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_orders_session ON public.group_orders (table_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_orders_status ON public.group_orders (status, created_at DESC);

ALTER TABLE public.group_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_orders REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Staff can read all group orders" ON public.group_orders;
CREATE POLICY "Staff can read all group orders"
  ON public.group_orders FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2. Group Participants (authenticated or short-lived guest_session_key)
CREATE TABLE IF NOT EXISTS public.group_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_order_id uuid NOT NULL REFERENCES public.group_orders(id) ON DELETE CASCADE,
  user_id uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_session_key text DEFAULT NULL,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 60),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
  left_at timestamptz DEFAULT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR guest_session_key IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_participants_user
  ON public.group_participants (group_order_id, user_id)
  WHERE user_id IS NOT NULL AND left_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_participants_guest
  ON public.group_participants (group_order_id, guest_session_key)
  WHERE guest_session_key IS NOT NULL AND left_at IS NULL;

ALTER TABLE public.group_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_participants REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Staff can read group participants" ON public.group_participants;
CREATE POLICY "Staff can read group participants"
  ON public.group_participants FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 3. Server-Authoritative Per-Participant Group Items (integer cents, never overwritten concurrently)
CREATE TABLE IF NOT EXISTS public.group_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_order_id uuid NOT NULL REFERENCES public.group_orders(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.group_participants(id) ON DELETE CASCADE,
  menu_item_id text NOT NULL,
  item_name text NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
  modifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text DEFAULT NULL CHECK (note IS NULL OR char_length(note) <= 240),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_order_items_group ON public.group_order_items (group_order_id, created_at ASC);

ALTER TABLE public.group_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_order_items REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Staff can read group order items" ON public.group_order_items;
CREATE POLICY "Staff can read group order items"
  ON public.group_order_items FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 4. Bill Allocations (integer minor currency units; settlement is staff-only)
CREATE TABLE IF NOT EXISTS public.bill_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_order_id uuid NOT NULL REFERENCES public.group_orders(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.group_participants(id) ON DELETE CASCADE,
  split_method text NOT NULL DEFAULT 'by_item' CHECK (split_method IN ('by_item', 'equal', 'custom')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  bill_total_cents integer NOT NULL CHECK (bill_total_cents >= 0),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'settled', 'void')),
  settled_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  settled_at timestamptz DEFAULT NULL,
  settlement_reference text DEFAULT NULL,
  note text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_order_id, participant_id)
);

ALTER TABLE public.bill_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_allocations REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Staff can read bill allocations" ON public.bill_allocations;
CREATE POLICY "Staff can read bill allocations"
  ON public.bill_allocations FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 5. Immutable Settlement Audit Records (staff/verified settlement actor only)
CREATE TABLE IF NOT EXISTS public.bill_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.bill_allocations(id) ON DELETE RESTRICT,
  group_order_id uuid NOT NULL REFERENCES public.group_orders(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reference text DEFAULT NULL,
  method text NOT NULL DEFAULT 'pos_table' CHECK (method IN ('pos_table', 'cash', 'card_terminal', 'eft', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read bill settlements" ON public.bill_settlements;
CREATE POLICY "Staff can read bill settlements"
  ON public.bill_settlements FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Helper: resolve active caller participant row for a group order
CREATE OR REPLACE FUNCTION public.find_caller_group_participant(
  p_group_order_id uuid,
  p_guest_key text DEFAULT NULL
)
RETURNS public.group_participants
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.group_participants
  WHERE group_order_id = p_group_order_id
    AND left_at IS NULL
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (p_guest_key IS NOT NULL AND guest_session_key = p_guest_key)
    )
  ORDER BY joined_at ASC
  LIMIT 1
$$;

-- 6. Create Group Order RPC (requires active validated table session)
CREATE OR REPLACE FUNCTION public.create_group_order(
  p_session_id uuid,
  p_session_token text,
  p_display_name text,
  p_guest_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check jsonb;
  v_code text;
  v_group public.group_orders%ROWTYPE;
  v_host public.group_participants%ROWTYPE;
  v_name text := COALESCE(NULLIF(trim(p_display_name), ''), 'Table Host');
BEGIN
  v_check := public.validate_table_session(p_session_id, p_session_token);
  IF NOT COALESCE((v_check->>'valid')::boolean, false) THEN
    RAISE EXCEPTION 'An active table session is required to start a group order.'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL AND (p_guest_key IS NULL OR char_length(trim(p_guest_key)) < 8) THEN
    RAISE EXCEPTION 'Guest session identity is required' USING ERRCODE = '22023';
  END IF;

  v_code := 'GRP-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

  INSERT INTO public.group_orders (
    table_id, table_session_id, table_display_name,
    host_user_id, host_guest_key, invite_code, invite_expires_at, status
  )
  VALUES (
    (v_check->>'table_id')::uuid,
    p_session_id,
    v_check->>'display_name',
    auth.uid(),
    NULLIF(trim(COALESCE(p_guest_key, '')), ''),
    v_code,
    (v_check->>'expires_at')::timestamptz,
    'open'
  )
  RETURNING * INTO v_group;

  INSERT INTO public.group_participants (
    group_order_id, user_id, guest_session_key, display_name, role
  )
  VALUES (
    v_group.id, auth.uid(), NULLIF(trim(COALESCE(p_guest_key, '')), ''), v_name, 'host'
  )
  RETURNING * INTO v_host;

  RETURN jsonb_build_object(
    'group_order_id', v_group.id,
    'invite_code', v_group.invite_code,
    'table_display_name', v_group.table_display_name,
    'participant_id', v_host.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_order(uuid, text, text, text) TO anon, authenticated;

-- 7. Join Group Order RPC (rejects expired or closed invites)
CREATE OR REPLACE FUNCTION public.join_group_order(
  p_invite_code text,
  p_display_name text,
  p_guest_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.group_orders%ROWTYPE;
  v_existing public.group_participants%ROWTYPE;
  v_created public.group_participants%ROWTYPE;
  v_name text := COALESCE(NULLIF(trim(p_display_name), ''), 'Table Guest');
BEGIN
  IF auth.uid() IS NULL AND (p_guest_key IS NULL OR char_length(trim(p_guest_key)) < 8) THEN
    RAISE EXCEPTION 'Guest identity required to join group order' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_group
  FROM public.group_orders
  WHERE invite_code = upper(trim(COALESCE(p_invite_code, '')));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group invite code not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_group.invite_expires_at <= now() THEN
    RAISE EXCEPTION 'This group order invitation has expired' USING ERRCODE = '42501';
  END IF;

  IF v_group.status = 'cancelled' THEN
    RAISE EXCEPTION 'This group order has been cancelled' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.find_caller_group_participant(v_group.id, p_guest_key);
  IF FOUND AND v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'group_order_id', v_group.id,
      'participant_id', v_existing.id,
      'role', v_existing.role
    );
  END IF;

  IF v_group.status <> 'open' THEN
    RAISE EXCEPTION 'This group order has already been submitted and is closed to new participants'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.group_participants (
    group_order_id, user_id, guest_session_key, display_name, role
  )
  VALUES (
    v_group.id, auth.uid(), NULLIF(trim(COALESCE(p_guest_key, '')), ''), v_name, 'member'
  )
  RETURNING * INTO v_created;

  RETURN jsonb_build_object(
    'group_order_id', v_group.id,
    'participant_id', v_created.id,
    'role', v_created.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_order(text, text, text) TO anon, authenticated;

-- 8. Authorized Group State Reader (participants & staff only!)
CREATE OR REPLACE FUNCTION public.get_group_order_state(
  p_invite_code text,
  p_guest_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.group_orders%ROWTYPE;
  v_me public.group_participants%ROWTYPE;
  v_is_staff boolean := public.is_staff(auth.uid());
  v_is_host boolean := false;
  v_participants jsonb;
  v_items jsonb;
  v_allocations jsonb;
BEGIN
  SELECT * INTO v_group
  FROM public.group_orders
  WHERE invite_code = upper(trim(COALESCE(p_invite_code, '')));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_me FROM public.find_caller_group_participant(v_group.id, p_guest_key);

  IF v_me.id IS NULL AND NOT v_is_staff THEN
    RETURN jsonb_build_object(
      'found', true,
      'authorized', false,
      'expired', v_group.invite_expires_at <= now(),
      'status', v_group.status,
      'table_display_name', v_group.table_display_name,
      'invite_code', v_group.invite_code
    );
  END IF;

  v_is_host := v_is_staff OR (v_me.role = 'host');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', gp.id,
    'display_name', gp.display_name,
    'role', gp.role,
    'joined_at', gp.joined_at,
    'is_me', (gp.id = v_me.id)
  ) ORDER BY gp.joined_at ASC), '[]'::jsonb)
  INTO v_participants
  FROM public.group_participants gp
  WHERE gp.group_order_id = v_group.id AND gp.left_at IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', gi.id,
    'participant_id', gi.participant_id,
    'menu_item_id', gi.menu_item_id,
    'item_name', gi.item_name,
    'unit_price_cents', gi.unit_price_cents,
    'quantity', gi.quantity,
    'modifiers', gi.modifiers,
    'note', gi.note,
    'locked', gi.locked,
    'created_at', gi.created_at
  ) ORDER BY gi.created_at ASC), '[]'::jsonb)
  INTO v_items
  FROM public.group_order_items gi
  WHERE gi.group_order_id = v_group.id;

  -- Participants see their own allocation; host & staff see full bill allocations
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ba.id,
    'participant_id', ba.participant_id,
    'split_method', ba.split_method,
    'amount_cents', ba.amount_cents,
    'bill_total_cents', ba.bill_total_cents,
    'payment_status', ba.payment_status,
    'settled_at', ba.settled_at,
    'settlement_reference', ba.settlement_reference
  ) ORDER BY ba.created_at ASC), '[]'::jsonb)
  INTO v_allocations
  FROM public.bill_allocations ba
  WHERE ba.group_order_id = v_group.id
    AND (v_is_host OR ba.participant_id = v_me.id);

  RETURN jsonb_build_object(
    'found', true,
    'authorized', true,
    'group', jsonb_build_object(
      'id', v_group.id,
      'invite_code', v_group.invite_code,
      'table_display_name', v_group.table_display_name,
      'status', v_group.status,
      'invite_expires_at', v_group.invite_expires_at,
      'submitted_order_id', v_group.submitted_order_id
    ),
    'me', CASE WHEN v_me.id IS NOT NULL THEN jsonb_build_object(
      'id', v_me.id,
      'display_name', v_me.display_name,
      'role', v_me.role
    ) ELSE NULL END,
    'participants', v_participants,
    'items', v_items,
    'allocations', v_allocations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_order_state(text, text) TO anon, authenticated;

-- 9. Concurrent Per-Participant Item CRUD (strict ownership + open/unlocked checks)
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

  INSERT INTO public.group_order_items (
    group_order_id, participant_id, menu_item_id, item_name, unit_price_cents, quantity, modifiers, note
  )
  VALUES (
    p_group_order_id,
    v_me.id,
    trim(p_menu_item_id),
    trim(p_item_name),
    GREATEST(0, p_unit_price_cents),
    GREATEST(1, LEAST(p_quantity, 20)),
    COALESCE(p_modifiers, '{}'::jsonb),
    NULLIF(trim(COALESCE(p_note, '')), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_group_order_item(uuid, text, text, integer, integer, jsonb, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_group_order_item(
  p_item_id uuid,
  p_quantity integer,
  p_guest_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.group_order_items%ROWTYPE;
  v_group public.group_orders%ROWTYPE;
  v_me public.group_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_item FROM public.group_order_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND OR v_item.locked THEN
    RAISE EXCEPTION 'Item is locked or does not exist' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_group FROM public.group_orders WHERE id = v_item.group_order_id;
  IF v_group.status <> 'open' THEN
    RAISE EXCEPTION 'Group order is locked' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_me FROM public.find_caller_group_participant(v_item.group_order_id, p_guest_key);
  IF v_me.id IS NULL OR v_me.id IS DISTINCT FROM v_item.participant_id THEN
    RAISE EXCEPTION 'You can only edit your own items' USING ERRCODE = '42501';
  END IF;

  IF p_quantity <= 0 THEN
    DELETE FROM public.group_order_items WHERE id = p_item_id;
  ELSE
    UPDATE public.group_order_items
    SET quantity = LEAST(p_quantity, 20), updated_at = now()
    WHERE id = p_item_id;
  END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_order_item(uuid, integer, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.leave_group_order(
  p_group_order_id uuid,
  p_guest_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.group_orders%ROWTYPE;
  v_me public.group_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_group FROM public.group_orders WHERE id = p_group_order_id FOR UPDATE;
  IF NOT FOUND OR v_group.status <> 'open' THEN
    RAISE EXCEPTION 'Cannot leave after the group order has been submitted' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_me FROM public.find_caller_group_participant(p_group_order_id, p_guest_key);
  IF v_me.id IS NULL OR v_me.role = 'host' THEN
    RETURN false;
  END IF;

  DELETE FROM public.group_order_items WHERE group_order_id = p_group_order_id AND participant_id = v_me.id AND locked = false;
  UPDATE public.group_participants SET left_at = now() WHERE id = v_me.id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_group_order(uuid, text) TO anon, authenticated;

-- 10. Atomic Idempotent Group Order Submission (Host Only, Locks Lines, Creates Coherent Kitchen Ticket)
CREATE OR REPLACE FUNCTION public.submit_group_order(
  p_group_order_id uuid,
  p_idempotency_key text,
  p_guest_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.group_orders%ROWTYPE;
  v_me public.group_participants%ROWTYPE;
  v_total_cents integer := 0;
  v_items_json jsonb;
  v_order_id uuid;
  v_arrival_code text;
  v_part record;
BEGIN
  SELECT * INTO v_group FROM public.group_orders WHERE id = p_group_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group order not found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent return if already submitted with same key
  IF v_group.submitted_order_id IS NOT NULL THEN
    IF v_group.idempotency_key = p_idempotency_key THEN
      RETURN jsonb_build_object('order_id', v_group.submitted_order_id, 'deduplicated', true);
    END IF;
    RAISE EXCEPTION 'Group order was already submitted. Start a new round for additional items.'
      USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_me FROM public.find_caller_group_participant(p_group_order_id, p_guest_key);
  IF v_me.id IS NULL OR v_me.role <> 'host' THEN
    RAISE EXCEPTION 'Only the table host can submit the group order' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(unit_price_cents * quantity), 0)::integer
  INTO v_total_cents
  FROM public.group_order_items
  WHERE group_order_id = p_group_order_id;

  IF v_total_cents <= 0 THEN
    RAISE EXCEPTION 'Add at least one item before submitting the group order' USING ERRCODE = '22023';
  END IF;

  -- Lock all submitted lines against further modification
  UPDATE public.group_order_items
  SET locked = true, updated_at = now()
  WHERE group_order_id = p_group_order_id;

  -- Build coherent kitchen ticket JSON with table metadata + participant attribution
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gi.menu_item_id,
      'name', gi.item_name || ' [' || gp.display_name || ']',
      'qty', gi.quantity,
      'price', ROUND((gi.unit_price_cents::numeric / 100.0), 2),
      'weight', gi.modifiers->>'weight',
      'doneness', gi.modifiers->>'doneness',
      'side', gi.modifiers->>'side',
      'participant', gp.display_name,
      'orderMeta', CASE WHEN rn = 1 THEN jsonb_build_object(
        'tableNumber', v_group.table_display_name,
        'guestName', 'Group: ' || v_me.display_name
      ) ELSE NULL END
    ) ORDER BY gi.created_at ASC
  )
  INTO v_items_json
  FROM (
    SELECT gi.*, row_number() OVER (ORDER BY gi.created_at ASC) AS rn
    FROM public.group_order_items gi
    WHERE gi.group_order_id = p_group_order_id
  ) gi
  JOIN public.group_participants gp ON gp.id = gi.participant_id;

  v_arrival_code := 'BB-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));

  INSERT INTO public.orders (
    user_id, items, total, status, order_type, table_number, table_session_id, arrival_code
  )
  VALUES (
    v_group.host_user_id,
    v_items_json,
    ROUND((v_total_cents::numeric / 100.0), 2),
    'pending',
    'dinein',
    v_group.table_display_name,
    v_group.table_session_id,
    v_arrival_code
  )
  RETURNING id INTO v_order_id;

  UPDATE public.group_orders
  SET
    status = 'submitted',
    submitted_order_id = v_order_id,
    idempotency_key = p_idempotency_key,
    updated_at = now()
  WHERE id = p_group_order_id;

  -- Seed default by_item bill allocations in exact integer cents
  FOR v_part IN
    SELECT gp.id AS participant_id, COALESCE(SUM(gi.unit_price_cents * gi.quantity), 0)::integer AS sub_cents
    FROM public.group_participants gp
    LEFT JOIN public.group_order_items gi ON gi.participant_id = gp.id AND gi.group_order_id = p_group_order_id
    WHERE gp.group_order_id = p_group_order_id AND gp.left_at IS NULL
    GROUP BY gp.id
  LOOP
    INSERT INTO public.bill_allocations (
      group_order_id, participant_id, split_method, amount_cents, bill_total_cents, payment_status
    )
    VALUES (
      p_group_order_id, v_part.participant_id, 'by_item', v_part.sub_cents, v_total_cents, 'unpaid'
    )
    ON CONFLICT (group_order_id, participant_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'arrival_code', v_arrival_code,
    'total_cents', v_total_cents,
    'deduplicated', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_group_order(uuid, text, text) TO anon, authenticated;

-- 11. Save Exact Integer-Cent Bill Allocations (Host or Staff Only; Never Marks Paid!)
CREATE OR REPLACE FUNCTION public.save_group_bill_split(
  p_group_order_id uuid,
  p_split_method text,
  p_allocations jsonb,
  p_guest_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.group_orders%ROWTYPE;
  v_me public.group_participants%ROWTYPE;
  v_total_cents integer;
  v_sum_cents integer := 0;
  v_entry jsonb;
  v_amt integer;
  v_pid uuid;
BEGIN
  IF p_split_method NOT IN ('by_item', 'equal', 'custom') THEN
    RAISE EXCEPTION 'Invalid split method' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_group FROM public.group_orders WHERE id = p_group_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_me FROM public.find_caller_group_participant(p_group_order_id, p_guest_key);
  IF NOT public.is_staff(auth.uid()) AND (v_me.id IS NULL OR v_me.role <> 'host') THEN
    RAISE EXCEPTION 'Only the group host or staff can configure bill splits' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bill_allocations WHERE group_order_id = p_group_order_id AND payment_status = 'settled'
  ) THEN
    RAISE EXCEPTION 'Cannot change bill split after a participant share has already been settled'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(unit_price_cents * quantity), 0)::integer
  INTO v_total_cents
  FROM public.group_order_items
  WHERE group_order_id = p_group_order_id;

  IF jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'At least one allocation is required' USING ERRCODE = '22023';
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_amt := (v_entry->>'amount_cents')::integer;
    IF v_amt IS NULL OR v_amt < 0 THEN
      RAISE EXCEPTION 'Allocation amounts must be non-negative integers (cents)' USING ERRCODE = '22023';
    END IF;
    v_sum_cents := v_sum_cents + v_amt;
  END LOOP;

  IF v_sum_cents <> v_total_cents THEN
    RAISE EXCEPTION 'Allocated total (% cents) must equal group bill total (% cents) exactly', v_sum_cents, v_total_cents
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.bill_allocations WHERE group_order_id = p_group_order_id AND payment_status = 'unpaid';

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    v_pid := (v_entry->>'participant_id')::uuid;
    v_amt := (v_entry->>'amount_cents')::integer;
    INSERT INTO public.bill_allocations (
      group_order_id, participant_id, split_method, amount_cents, bill_total_cents, payment_status
    )
    VALUES (
      p_group_order_id, v_pid, p_split_method, v_amt, v_total_cents, 'unpaid'
    );
  END LOOP;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_group_bill_split(uuid, text, jsonb, text) TO anon, authenticated;

-- 12. Staff-Only Bill Settlement RPC (Customers CANNOT mark their own bill paid!)
CREATE OR REPLACE FUNCTION public.mark_bill_allocation_settled(
  p_allocation_id uuid,
  p_reference text DEFAULT NULL,
  p_method text DEFAULT 'pos_table'
)
RETURNS public.bill_allocations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_alloc public.bill_allocations%ROWTYPE;
  v_updated public.bill_allocations%ROWTYPE;
  v_unsettled integer;
  v_submitted_order_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: only authorized Butcher Block staff may record bill settlement'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alloc FROM public.bill_allocations WHERE id = p_allocation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill allocation not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_alloc.payment_status = 'settled' THEN
    RETURN v_alloc;
  END IF;

  UPDATE public.bill_allocations
  SET
    payment_status = 'settled',
    settled_by = v_actor,
    settled_at = now(),
    settlement_reference = NULLIF(trim(COALESCE(p_reference, '')), ''),
    updated_at = now()
  WHERE id = p_allocation_id
  RETURNING * INTO v_updated;

  INSERT INTO public.bill_settlements (
    allocation_id, group_order_id, amount_cents, recorded_by, reference, method
  )
  VALUES (
    v_updated.id, v_updated.group_order_id, v_updated.amount_cents, v_actor,
    NULLIF(trim(COALESCE(p_reference, '')), ''), COALESCE(p_method, 'pos_table')
  );

  -- If every participant share for this group order is now settled, mark the linked order as paid
  SELECT COUNT(*)::integer INTO v_unsettled
  FROM public.bill_allocations
  WHERE group_order_id = v_updated.group_order_id
    AND amount_cents > 0
    AND payment_status <> 'settled';

  IF v_unsettled = 0 THEN
    SELECT submitted_order_id INTO v_submitted_order_id
    FROM public.group_orders
    WHERE id = v_updated.group_order_id;
    IF v_submitted_order_id IS NOT NULL THEN
      UPDATE public.orders
      SET payment_status = 'paid', paid_at = COALESCE(paid_at, now()), paid_by = v_actor
      WHERE id = v_submitted_order_id;
    END IF;
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_bill_allocation_settled(uuid, text, text) TO authenticated;

-- Enable Realtime on group ordering tables
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_participants; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_order_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_allocations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
