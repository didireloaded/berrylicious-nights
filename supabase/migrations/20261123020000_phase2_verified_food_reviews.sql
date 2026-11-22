-- ============================================================================
-- Phase 2: Verified Food Ratings, Reviews & Audited Staff Moderation
-- Butcher Block Steakhouse (Windhoek, Namibia)
-- ============================================================================

-- 1. Verified food reviews table
CREATE TABLE IF NOT EXISTS public.food_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id text NOT NULL,
  menu_item_name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL DEFAULT 'Verified Guest',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text DEFAULT NULL CHECK (comment IS NULL OR char_length(comment) <= 1200),
  photo_url text DEFAULT NULL,
  private_issue_note text DEFAULT NULL CHECK (private_issue_note IS NULL OR char_length(private_issue_note) <= 1000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged', 'removed')),
  staff_response text DEFAULT NULL CHECK (staff_response IS NULL OR char_length(staff_response) <= 1000),
  staff_responded_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_responded_at timestamptz DEFAULT NULL,
  editable_until timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, menu_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_food_reviews_item_status
  ON public.food_reviews (menu_item_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_reviews_user_created
  ON public.food_reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_reviews_order
  ON public.food_reviews (order_id);

ALTER TABLE public.food_reviews ENABLE ROW LEVEL SECURITY;

-- Public/authenticated guests can read published reviews; owners read their own; staff read all
DROP POLICY IF EXISTS "Public can read published food reviews" ON public.food_reviews;
CREATE POLICY "Public can read published food reviews"
  ON public.food_reviews FOR SELECT
  TO public
  USING (status = 'published');

DROP POLICY IF EXISTS "Users can read own reviews" ON public.food_reviews;
CREATE POLICY "Users can read own reviews"
  ON public.food_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Block direct client INSERT/UPDATE/DELETE — must pass verified SECURITY DEFINER RPCs
-- Trigger defense-in-depth: staff/admin can NEVER silently alter a customer's numerical rating
CREATE OR REPLACE FUNCTION public.guard_review_rating_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Unauthorized: staff cannot alter a customer numerical rating'
        USING ERRCODE = '42501';
    END IF;
    IF now() > OLD.editable_until THEN
      RAISE EXCEPTION 'Review edit window has closed'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_review_rating_immutability ON public.food_reviews;
CREATE TRIGGER trg_guard_review_rating_immutability
  BEFORE UPDATE ON public.food_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_review_rating_immutability();

-- 2. Review abuse / issue reports
CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.food_reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 500),
  resolved_at timestamptz DEFAULT NULL,
  resolved_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, reporter_id)
);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can report reviews" ON public.review_reports;
CREATE POLICY "Users can report reviews"
  ON public.review_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Staff can view and resolve review reports" ON public.review_reports;
CREATE POLICY "Staff can view and resolve review reports"
  ON public.review_reports FOR ALL
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- 3. Immutable Review Moderation Audit Log
CREATE TABLE IF NOT EXISTS public.review_moderation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.food_reviews(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('respond', 'hide', 'flag', 'remove', 'restore')),
  previous_status text DEFAULT NULL,
  next_status text DEFAULT NULL,
  reason text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_moderation_audit_review
  ON public.review_moderation_audit (review_id, created_at DESC);

ALTER TABLE public.review_moderation_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read review moderation audit" ON public.review_moderation_audit;
CREATE POLICY "Managers can read review moderation audit"
  ON public.review_moderation_audit FOR SELECT
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

-- 4. Public safe aggregate summary view (published reviews only, zero private notes)
CREATE OR REPLACE VIEW public.menu_item_rating_summary AS
SELECT
  menu_item_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*)::integer AS review_count
FROM public.food_reviews
WHERE status = 'published'
GROUP BY menu_item_id;

GRANT SELECT ON public.menu_item_rating_summary TO anon, authenticated;

-- Public safe reviews view (explicitly excludes private_issue_note & user_id)
CREATE OR REPLACE VIEW public.public_food_reviews AS
SELECT
  id,
  menu_item_id,
  menu_item_name,
  reviewer_name,
  rating,
  comment,
  photo_url,
  staff_response,
  staff_responded_at,
  created_at,
  updated_at
FROM public.food_reviews
WHERE status = 'published';

GRANT SELECT ON public.public_food_reviews TO anon, authenticated;

-- 5. Server-Verified Review Submission RPC
CREATE OR REPLACE FUNCTION public.submit_verified_food_review(
  p_order_id uuid,
  p_menu_item_id text,
  p_rating integer,
  p_comment text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_private_issue_note text DEFAULT NULL
)
RETURNS public.food_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_item jsonb;
  v_matched_name text := NULL;
  v_reviewer_name text;
  v_row public.food_reviews%ROWTYPE;
  v_group_eligible boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required to submit a verified dish review' USING ERRCODE = '42501';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5 stars' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed orders are eligible for verified ratings' USING ERRCODE = '42501';
  END IF;

  -- Check direct order ownership; if group_order_items exists in Phase 6, also check participant line ownership
  IF v_order.user_id IS DISTINCT FROM v_uid THEN
    IF to_regclass('public.group_order_items') IS NOT NULL AND to_regclass('public.group_orders') IS NOT NULL THEN
      EXECUTE $sql$
        SELECT EXISTS (
          SELECT 1
          FROM public.group_orders go
          JOIN public.group_participants gp ON gp.group_order_id = go.id AND gp.user_id = $1
          JOIN public.group_order_items gi ON gi.group_order_id = go.id AND gi.participant_id = gp.id
          WHERE go.submitted_order_id = $2
            AND gi.menu_item_id = $3
        )
      $sql$ INTO v_group_eligible USING v_uid, p_order_id, p_menu_item_id;
    END IF;

    IF NOT v_group_eligible THEN
      RAISE EXCEPTION 'You are not authorized to review items from this order' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Verify the item actually exists on this completed order
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
    LOOP
      IF COALESCE(v_item->>'id', '') = p_menu_item_id
         OR split_part(COALESCE(v_item->>'id', ''), '::', 1) = p_menu_item_id THEN
        v_matched_name := COALESCE(NULLIF(trim(v_item->>'name'), ''), p_menu_item_id);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_matched_name IS NULL THEN
    RAISE EXCEPTION 'This menu item was not part of the verified completed order' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(trim(display_name), ''), 'Verified Guest')
  INTO v_reviewer_name
  FROM public.profiles
  WHERE user_id = v_uid;

  INSERT INTO public.food_reviews (
    order_id,
    menu_item_id,
    menu_item_name,
    user_id,
    reviewer_name,
    rating,
    comment,
    photo_url,
    private_issue_note
  )
  VALUES (
    p_order_id,
    p_menu_item_id,
    v_matched_name,
    v_uid,
    COALESCE(v_reviewer_name, 'Verified Guest'),
    p_rating::smallint,
    NULLIF(trim(COALESCE(p_comment, '')), ''),
    NULLIF(trim(COALESCE(p_photo_url, '')), ''),
    NULLIF(trim(COALESCE(p_private_issue_note, '')), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_verified_food_review(uuid, text, integer, text, text, text) TO authenticated;

-- 6. Customer Edit Own Review Within Configured Window
CREATE OR REPLACE FUNCTION public.update_own_food_review(
  p_review_id uuid,
  p_rating integer,
  p_comment text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_private_issue_note text DEFAULT NULL
)
RETURNS public.food_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.food_reviews%ROWTYPE;
  v_updated public.food_reviews%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5 stars' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.food_reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND OR v_existing.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Review not found or unauthorized' USING ERRCODE = '42501';
  END IF;
  IF now() > v_existing.editable_until THEN
    RAISE EXCEPTION 'The editing window for this review has closed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.food_reviews
  SET
    rating = p_rating::smallint,
    comment = NULLIF(trim(COALESCE(p_comment, '')), ''),
    photo_url = COALESCE(NULLIF(trim(COALESCE(p_photo_url, '')), ''), photo_url),
    private_issue_note = NULLIF(trim(COALESCE(p_private_issue_note, '')), ''),
    updated_at = now()
  WHERE id = p_review_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_food_review(uuid, integer, text, text, text) TO authenticated;

-- 7. Audited Staff Response & Moderation RPC (never changes numerical rating)
CREATE OR REPLACE FUNCTION public.moderate_food_review(
  p_review_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_staff_response text DEFAULT NULL
)
RETURNS public.food_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_existing public.food_reviews%ROWTYPE;
  v_next_status text;
  v_updated public.food_reviews%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_manager_or_admin(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: management privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('respond', 'hide', 'flag', 'remove', 'restore') THEN
    RAISE EXCEPTION 'Invalid moderation action' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.food_reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found' USING ERRCODE = 'P0002';
  END IF;

  v_next_status := CASE p_action
    WHEN 'hide' THEN 'hidden'
    WHEN 'flag' THEN 'flagged'
    WHEN 'remove' THEN 'removed'
    WHEN 'restore' THEN 'published'
    ELSE v_existing.status
  END;

  UPDATE public.food_reviews
  SET
    status = v_next_status,
    staff_response = CASE WHEN p_action = 'respond' THEN NULLIF(trim(COALESCE(p_staff_response, '')), '') ELSE staff_response END,
    staff_responded_by = CASE WHEN p_action = 'respond' THEN v_actor ELSE staff_responded_by END,
    staff_responded_at = CASE WHEN p_action = 'respond' THEN now() ELSE staff_responded_at END,
    updated_at = now()
  WHERE id = p_review_id
  RETURNING * INTO v_updated;

  INSERT INTO public.review_moderation_audit (
    review_id, actor_id, action, previous_status, next_status, reason
  )
  VALUES (
    p_review_id, v_actor, p_action, v_existing.status, v_next_status, NULLIF(trim(COALESCE(p_reason, '')), '')
  );

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_food_review(uuid, text, text, text) TO authenticated;
