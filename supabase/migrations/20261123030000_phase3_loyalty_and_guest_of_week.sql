-- ============================================================================
-- Phase 3: Butcher Block Rewards (Auditable Ledger) & Guest of the Week
-- Butcher Block Steakhouse (Windhoek, Namibia)
-- ============================================================================

-- 1. Configurable Loyalty Rules (singleton managed by restaurant management)
CREATE TABLE IF NOT EXISTS public.loyalty_rules (
  id integer PRIMARY KEY CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  points_per_nad numeric(8,4) NOT NULL DEFAULT 0.1000 CHECK (points_per_nad >= 0 AND points_per_nad <= 10),
  min_qualifying_nad numeric(10,2) NOT NULL DEFAULT 100.00 CHECK (min_qualifying_nad >= 0),
  excluded_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  excluded_item_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  award_on_reservation_arrival boolean NOT NULL DEFAULT false,
  reservation_bonus_points integer NOT NULL DEFAULT 0 CHECK (reservation_bonus_points >= 0 AND reservation_bonus_points <= 500),
  points_expiry_days integer DEFAULT 365 CHECK (points_expiry_days IS NULL OR points_expiry_days >= 30),
  updated_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.loyalty_rules (id, enabled) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read loyalty rules" ON public.loyalty_rules;
CREATE POLICY "Anyone can read loyalty rules"
  ON public.loyalty_rules FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Management can update loyalty rules" ON public.loyalty_rules;
CREATE POLICY "Management can update loyalty rules"
  ON public.loyalty_rules FOR UPDATE
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- 2. Restaurant-Managed Rewards Catalog (no hardcoded/unapproved discounts)
CREATE TABLE IF NOT EXISTS public.rewards_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 120),
  description text DEFAULT NULL CHECK (description IS NULL OR char_length(description) <= 500),
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('dessert', 'side', 'drink', 'discount', 'birthday', 'general')),
  points_cost integer NOT NULL CHECK (points_cost > 0 AND points_cost <= 100000),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz DEFAULT NULL,
  terms text DEFAULT NULL,
  created_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active rewards catalog" ON public.rewards_catalog;
CREATE POLICY "Public can read active rewards catalog"
  ON public.rewards_catalog FOR SELECT
  TO public
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "Management manages rewards catalog" ON public.rewards_catalog;
CREATE POLICY "Management manages rewards catalog"
  ON public.rewards_catalog FOR ALL
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- 3. Reward Redemptions
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE RESTRICT,
  points_spent integer NOT NULL CHECK (points_spent >= 0),
  redemption_code text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'loyalty_points' CHECK (source IN ('loyalty_points', 'guest_of_the_week')),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'used', 'cancelled', 'expired')),
  idempotency_key text NOT NULL UNIQUE,
  used_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON public.reward_redemptions (user_id, created_at DESC);

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own reward redemptions" ON public.reward_redemptions;
CREATE POLICY "Users read own reward redemptions"
  ON public.reward_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 4. Append-Only Auditable Loyalty Points Ledger (zero direct client writes!)
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid DEFAULT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  redemption_id uuid DEFAULT NULL REFERENCES public.reward_redemptions(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('earn', 'redeem', 'reverse', 'bonus', 'expire')),
  points integer NOT NULL CHECK (points <> 0),
  idempotency_key text NOT NULL UNIQUE,
  note text DEFAULT NULL,
  expires_at timestamptz DEFAULT NULL,
  created_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_user_created ON public.loyalty_ledger (user_id, created_at DESC);

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own loyalty ledger" ON public.loyalty_ledger;
CREATE POLICY "Users read own loyalty ledger"
  ON public.loyalty_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_manager_or_admin(auth.uid()));

-- Compute reliable unexpired balance from ledger
CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    0,
    COALESCE(
      SUM(
        CASE
          WHEN points > 0 AND expires_at IS NOT NULL AND expires_at <= now() THEN 0
          ELSE points
        END
      ),
      0
    )::integer
  )
  FROM public.loyalty_ledger
  WHERE user_id = p_user_id
$$;

GRANT EXECUTE ON FUNCTION public.get_loyalty_balance(uuid) TO authenticated;

-- 5. Server-side Loyalty Earning & Reversal Functions (ONLY completed + paid orders)
CREATE OR REPLACE FUNCTION public.award_order_loyalty_points(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_rules public.loyalty_rules%ROWTYPE;
  v_item jsonb;
  v_eligible_nad numeric := 0;
  v_points integer := 0;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.user_id IS NULL THEN
    RETURN 0;
  END IF;
  IF v_order.status <> 'completed' OR v_order.payment_status <> 'paid' THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_rules FROM public.loyalty_rules WHERE id = 1;
  IF NOT FOUND OR NOT v_rules.enabled OR v_rules.points_per_nad <= 0 THEN
    RETURN 0;
  END IF;

  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
    LOOP
      IF COALESCE(v_item->>'id', '') = ANY(v_rules.excluded_item_ids) THEN
        CONTINUE;
      END IF;
      IF COALESCE(v_item->>'category', '') = ANY(v_rules.excluded_categories) THEN
        CONTINUE;
      END IF;
      v_eligible_nad := v_eligible_nad + GREATEST(0, COALESCE((v_item->>'price')::numeric, 0) * GREATEST(1, COALESCE((v_item->>'qty')::numeric, 1)));
    END LOOP;
  END IF;

  v_eligible_nad := LEAST(v_eligible_nad, COALESCE(v_order.total, 0));
  IF v_eligible_nad < v_rules.min_qualifying_nad THEN
    RETURN 0;
  END IF;

  v_points := floor(v_eligible_nad * v_rules.points_per_nad)::integer;
  IF v_points <= 0 THEN
    RETURN 0;
  END IF;

  v_expires := CASE WHEN v_rules.points_expiry_days IS NOT NULL
    THEN now() + make_interval(days => v_rules.points_expiry_days)
    ELSE NULL
  END;

  INSERT INTO public.loyalty_ledger (
    user_id, order_id, entry_type, points, idempotency_key, note, expires_at
  )
  VALUES (
    v_order.user_id,
    v_order.id,
    'earn',
    v_points,
    'earn:order:' || v_order.id::text,
    'Earned on paid completed order #BB-' || upper(left(v_order.id::text, 6)),
    v_expires
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF FOUND THEN
    PERFORM public.create_notification_idempotent(
      v_order.user_id,
      'loyalty:earn:' || v_order.id::text,
      'loyalty_points_earned',
      'Butcher Block Rewards',
      'You earned ' || v_points::text || ' points on order #BB-' || upper(left(v_order.id::text, 6)) || '.',
      '/profile#rewards',
      v_order.id,
      jsonb_build_object('points', v_points)
    );
    RETURN v_points;
  END IF;

  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.award_order_loyalty_points(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reverse_order_loyalty_points(p_order_id uuid, p_reason text DEFAULT 'Order refunded or cancelled')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned public.loyalty_ledger%ROWTYPE;
BEGIN
  SELECT * INTO v_earned
  FROM public.loyalty_ledger
  WHERE idempotency_key = 'earn:order:' || p_order_id::text;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  INSERT INTO public.loyalty_ledger (
    user_id, order_id, entry_type, points, idempotency_key, note, created_by
  )
  VALUES (
    v_earned.user_id,
    p_order_id,
    'reverse',
    -ABS(v_earned.points),
    'reverse:order:' || p_order_id::text,
    p_reason,
    auth.uid()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF FOUND THEN
    RETURN ABS(v_earned.points);
  END IF;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_order_loyalty_points(uuid, text) FROM PUBLIC;

-- Trigger on orders UPDATE: automatically award on completed+paid, reverse on refunded/cancelled
CREATE OR REPLACE FUNCTION public.handle_order_loyalty_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.payment_status = 'paid' THEN
    PERFORM public.award_order_loyalty_points(NEW.id);
  ELSIF NEW.status = 'cancelled' OR NEW.payment_status = 'refunded' THEN
    PERFORM public.reverse_order_loyalty_points(NEW.id, 'Order ' || CASE WHEN NEW.payment_status = 'refunded' THEN 'refunded' ELSE 'cancelled' END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_loyalty_sync ON public.orders;
CREATE TRIGGER trg_order_loyalty_sync
  AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_loyalty_sync();

-- 6. Atomic Reward Redemption RPC (advisory transaction lock prevents double-spend!)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_reward_id uuid,
  p_idempotency_key text
)
RETURNS public.reward_redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reward public.rewards_catalog%ROWTYPE;
  v_existing public.reward_redemptions%ROWTYPE;
  v_balance integer;
  v_code text;
  v_redemption public.reward_redemptions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required to redeem rewards' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize all redemptions for this customer to prevent concurrent double-spend
  PERFORM pg_advisory_xact_lock(hashtext('loyalty:' || v_uid::text));

  SELECT * INTO v_existing
  FROM public.reward_redemptions
  WHERE idempotency_key = p_idempotency_key AND user_id = v_uid;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_reward
  FROM public.rewards_catalog
  WHERE id = p_reward_id
    AND active = true
    AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward is not currently available' USING ERRCODE = 'P0002';
  END IF;

  v_balance := public.get_loyalty_balance(v_uid);
  IF v_balance < v_reward.points_cost THEN
    RAISE EXCEPTION 'Insufficient points balance (% available, % required)', v_balance, v_reward.points_cost
      USING ERRCODE = '22023';
  END IF;

  v_code := 'BBR-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO public.reward_redemptions (
    user_id, reward_id, points_spent, redemption_code, source, status, idempotency_key
  )
  VALUES (
    v_uid, v_reward.id, v_reward.points_cost, v_code, 'loyalty_points', 'issued', p_idempotency_key
  )
  RETURNING * INTO v_redemption;

  INSERT INTO public.loyalty_ledger (
    user_id, redemption_id, entry_type, points, idempotency_key, note
  )
  VALUES (
    v_uid,
    v_redemption.id,
    'redeem',
    -v_reward.points_cost,
    'redeem:' || v_redemption.id::text,
    'Redeemed: ' || v_reward.title
  );

  PERFORM public.create_notification_idempotent(
    v_uid,
    'reward:redeemed:' || v_redemption.id::text,
    'reward_redeemed',
    'Reward Voucher Issued',
    'Show voucher ' || v_code || ' to your Butcher Block waiter for: ' || v_reward.title,
    '/profile#rewards',
    NULL,
    jsonb_build_object('redemption_code', v_code, 'reward_title', v_reward.title)
  );

  RETURN v_redemption;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(uuid, text) TO authenticated;

-- Staff marks a redeemed reward voucher as used at the table/POS
CREATE OR REPLACE FUNCTION public.mark_redemption_used(p_redemption_id uuid)
RETURNS public.reward_redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.reward_redemptions%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: staff required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.reward_redemptions
  SET status = 'used', used_by = v_actor, used_at = now()
  WHERE id = p_redemption_id AND status = 'issued'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher not found or already used' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_redemption_used(uuid) TO authenticated;

-- 7. Guest of the Week (Management-approved, Customer-consent-gated)
CREATE TABLE IF NOT EXISTS public.guest_of_the_week (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_display_name text NOT NULL,
  approved_photo_url text DEFAULT NULL,
  recognition_message text NOT NULL CHECK (char_length(trim(recognition_message)) BETWEEN 5 AND 500),
  status text NOT NULL DEFAULT 'approved_pending_consent'
    CHECK (status IN ('shortlisted', 'approved_pending_consent', 'accepted_published', 'declined', 'withdrawn')),
  photo_consent boolean NOT NULL DEFAULT false,
  social_consent boolean NOT NULL DEFAULT false,
  reward_id uuid DEFAULT NULL REFERENCES public.rewards_catalog(id) ON DELETE SET NULL,
  reward_redemption_id uuid DEFAULT NULL UNIQUE REFERENCES public.reward_redemptions(id) ON DELETE SET NULL,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  consented_at timestamptz DEFAULT NULL,
  withdrawn_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_of_the_week ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own guest of week invitation" ON public.guest_of_the_week;
CREATE POLICY "Users see own guest of week invitation"
  ON public.guest_of_the_week FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_manager_or_admin(auth.uid()));

-- Public safe view ONLY shows accepted & published recognition (zero PII, photo gated on photo_consent)
CREATE OR REPLACE VIEW public.public_guest_of_the_week AS
SELECT
  g.id,
  g.week_start,
  g.approved_display_name,
  CASE WHEN g.photo_consent THEN g.approved_photo_url ELSE NULL END AS approved_photo_url,
  g.recognition_message,
  r.title AS reward_title,
  g.consented_at
FROM public.guest_of_the_week g
LEFT JOIN public.rewards_catalog r ON r.id = g.reward_id
WHERE g.status = 'accepted_published'
ORDER BY g.week_start DESC;

GRANT SELECT ON public.public_guest_of_the_week TO anon, authenticated;

-- Fair non-spend-only shortlist computation (management only)
CREATE OR REPLACE FUNCTION public.compute_guest_of_week_shortlist(p_days integer DEFAULT 30)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  completed_orders integer,
  verified_reviews integer,
  loyalty_events integer,
  community_score integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent_orders AS (
    SELECT o.user_id, COUNT(*)::integer AS order_count
    FROM public.orders o
    WHERE o.user_id IS NOT NULL
      AND o.status = 'completed'
      AND o.created_at >= now() - make_interval(days => GREATEST(7, LEAST(p_days, 180)))
    GROUP BY o.user_id
  ),
  recent_reviews AS (
    SELECT fr.user_id, COUNT(*)::integer AS review_count
    FROM public.food_reviews fr
    WHERE fr.status = 'published'
      AND fr.created_at >= now() - make_interval(days => GREATEST(7, LEAST(p_days, 180)))
    GROUP BY fr.user_id
  ),
  recent_loyalty AS (
    SELECT ll.user_id, COUNT(*)::integer AS loyalty_count
    FROM public.loyalty_ledger ll
    WHERE ll.entry_type IN ('earn', 'bonus')
      AND ll.created_at >= now() - make_interval(days => GREATEST(7, LEAST(p_days, 180)))
    GROUP BY ll.user_id
  )
  SELECT
    p.user_id,
    COALESCE(NULLIF(trim(p.display_name), ''), 'Butcher Block Guest') AS display_name,
    COALESCE(ro.order_count, 0) AS completed_orders,
    COALESCE(rr.review_count, 0) AS verified_reviews,
    COALESCE(rl.loyalty_count, 0) AS loyalty_events,
    (
      LEAST(COALESCE(ro.order_count, 0), 5) * 15
      + LEAST(COALESCE(rr.review_count, 0), 5) * 20
      + LEAST(COALESCE(rl.loyalty_count, 0), 5) * 10
      + LEAST(COALESCE(p.total_visits, 0), 10) * 5
    )::integer AS community_score
  FROM public.profiles p
  LEFT JOIN recent_orders ro ON ro.user_id = p.user_id
  LEFT JOIN recent_reviews rr ON rr.user_id = p.user_id
  LEFT JOIN recent_loyalty rl ON rl.user_id = p.user_id
  WHERE public.is_manager_or_admin(auth.uid())
    AND (COALESCE(ro.order_count, 0) > 0 OR COALESCE(rr.review_count, 0) > 0)
  ORDER BY community_score DESC, verified_reviews DESC
  LIMIT 10
$$;

GRANT EXECUTE ON FUNCTION public.compute_guest_of_week_shortlist(integer) TO authenticated;

-- Management approves candidate -> sends consent invitation (NEVER auto-publishes!)
CREATE OR REPLACE FUNCTION public.nominate_guest_of_week(
  p_week_start date,
  p_user_id uuid,
  p_display_name text,
  p_recognition_message text,
  p_reward_id uuid DEFAULT NULL,
  p_score_breakdown jsonb DEFAULT '{}'::jsonb
)
RETURNS public.guest_of_the_week
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.guest_of_the_week%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_manager_or_admin(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: management approval required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.guest_of_the_week (
    week_start, user_id, approved_display_name, recognition_message,
    status, reward_id, score_breakdown, approved_by
  )
  VALUES (
    p_week_start, p_user_id, trim(p_display_name), trim(p_recognition_message),
    'approved_pending_consent', p_reward_id, COALESCE(p_score_breakdown, '{}'::jsonb), v_actor
  )
  ON CONFLICT (week_start) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    approved_display_name = EXCLUDED.approved_display_name,
    recognition_message = EXCLUDED.recognition_message,
    status = 'approved_pending_consent',
    photo_consent = false,
    social_consent = false,
    reward_id = EXCLUDED.reward_id,
    score_breakdown = EXCLUDED.score_breakdown,
    approved_by = v_actor,
    consented_at = NULL,
    withdrawn_at = NULL,
    updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.create_notification_idempotent(
    p_user_id,
    'gotw:invite:' || v_row.id::text || ':' || p_user_id::text,
    'gotw_invitation',
    'Guest of the Week Invitation',
    'Butcher Block would love to celebrate you as Guest of the Week. Review and choose whether to accept.',
    '/profile#rewards',
    NULL,
    jsonb_build_object('gotw_id', v_row.id, 'week_start', p_week_start)
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.nominate_guest_of_week(date, uuid, text, text, uuid, jsonb) TO authenticated;

-- Nominated customer explicitly accepts (with separate photo/social consents) or declines
CREATE OR REPLACE FUNCTION public.respond_guest_of_week_consent(
  p_gotw_id uuid,
  p_accept boolean,
  p_display_name text DEFAULT NULL,
  p_photo_consent boolean DEFAULT false,
  p_social_consent boolean DEFAULT false,
  p_photo_url text DEFAULT NULL
)
RETURNS public.guest_of_the_week
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.guest_of_the_week%ROWTYPE;
  v_redemption_id uuid := NULL;
  v_code text;
  v_row public.guest_of_the_week%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.guest_of_the_week WHERE id = p_gotw_id FOR UPDATE;
  IF NOT FOUND OR v_existing.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Invitation not found or unauthorized' USING ERRCODE = '42501';
  END IF;
  IF v_existing.status <> 'approved_pending_consent' THEN
    RAISE EXCEPTION 'This invitation has already been answered' USING ERRCODE = '22023';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.guest_of_the_week
    SET status = 'declined', updated_at = now()
    WHERE id = p_gotw_id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  -- Issue assigned award once via secure reward_redemptions ledger
  v_redemption_id := v_existing.reward_redemption_id;
  IF v_existing.reward_id IS NOT NULL AND v_redemption_id IS NULL THEN
    v_code := 'GOTW-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    INSERT INTO public.reward_redemptions (
      user_id, reward_id, points_spent, redemption_code, source, status, idempotency_key
    )
    VALUES (
      v_uid, v_existing.reward_id, 0, v_code, 'guest_of_the_week', 'issued', 'gotw:award:' || v_existing.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_redemption_id;
  END IF;

  UPDATE public.guest_of_the_week
  SET
    status = 'accepted_published',
    approved_display_name = COALESCE(NULLIF(trim(p_display_name), ''), approved_display_name),
    photo_consent = COALESCE(p_photo_consent, false),
    social_consent = COALESCE(p_social_consent, false),
    approved_photo_url = CASE WHEN COALESCE(p_photo_consent, false) THEN NULLIF(trim(COALESCE(p_photo_url, '')), '') ELSE NULL END,
    reward_redemption_id = COALESCE(v_redemption_id, reward_redemption_id),
    consented_at = now(),
    updated_at = now()
  WHERE id = p_gotw_id
  RETURNING * INTO v_row;

  PERFORM public.create_notification_idempotent(
    v_uid,
    'gotw:published:' || v_row.id::text,
    'gotw_published',
    'Welcome, Guest of the Week',
    'Your recognition is now live in Butcher Block Rewards. You can withdraw anytime from your profile.',
    '/profile#rewards',
    NULL,
    jsonb_build_object('gotw_id', v_row.id)
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_guest_of_week_consent(uuid, boolean, text, boolean, boolean, text) TO authenticated;

-- Customer or management withdraws public recognition immediately
CREATE OR REPLACE FUNCTION public.withdraw_guest_of_week(p_gotw_id uuid)
RETURNS public.guest_of_the_week
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.guest_of_the_week%ROWTYPE;
  v_row public.guest_of_the_week%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.guest_of_the_week WHERE id = p_gotw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Record not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_existing.user_id IS DISTINCT FROM v_uid AND NOT public.is_manager_or_admin(v_uid) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.guest_of_the_week
  SET status = 'withdrawn', photo_consent = false, social_consent = false, approved_photo_url = NULL, withdrawn_at = now(), updated_at = now()
  WHERE id = p_gotw_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_guest_of_week(uuid) TO authenticated;
