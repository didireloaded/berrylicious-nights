-- ============================================================================
-- Phase 7: My Usual Order, Dietary Preferences, Booking Occasions &
--          Private Dining Feedback
-- Butcher Block Steakhouse (Windhoek, Namibia)
-- ============================================================================

-- 1. Customer Dining Preferences & Saved "My Usual Order"
CREATE TABLE IF NOT EXISTS public.user_dining_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dietary_preferences text[] NOT NULL DEFAULT ARRAY[]::text[],
  preferred_doneness text DEFAULT NULL,
  preferred_side text DEFAULT NULL,
  usual_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_dining_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own dining preferences" ON public.user_dining_preferences;
CREATE POLICY "Users manage own dining preferences"
  ON public.user_dining_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Structured Special Occasion Column on Bookings (Birthday / Anniversary / Celebration)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS occasion text DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_valid_occasion_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_valid_occasion_check
      CHECK (occasion IS NULL OR occasion IN ('birthday', 'anniversary', 'celebration', 'date_night', 'business'));
  END IF;
END $$;

-- 3. Private Dining Feedback (Compliments, Service/Food Issues, Manager Requests — NEVER Public)
CREATE TABLE IF NOT EXISTS public.private_dining_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid DEFAULT NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  table_session_id uuid DEFAULT NULL REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  table_label text DEFAULT NULL,
  guest_name text DEFAULT NULL,
  guest_phone text DEFAULT NULL,
  category text NOT NULL CHECK (category IN ('compliment', 'service_issue', 'food_issue', 'manager_request', 'other')),
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 5 AND 1500),
  wants_manager_visit boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  staff_note text DEFAULT NULL CHECK (staff_note IS NULL OR char_length(staff_note) <= 1000),
  handled_by uuid DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_feedback_status_created
  ON public.private_dining_feedback (status, created_at DESC);

ALTER TABLE public.private_dining_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_dining_feedback REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Guests and customers can submit private feedback" ON public.private_dining_feedback;
CREATE POLICY "Guests and customers can submit private feedback"
  ON public.private_dining_feedback FOR INSERT
  TO public
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own private feedback" ON public.private_dining_feedback;
CREATE POLICY "Users can view own private feedback"
  ON public.private_dining_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- Staff-only acknowledgment / resolution RPC with customer notification
CREATE OR REPLACE FUNCTION public.update_private_feedback_status(
  p_feedback_id uuid,
  p_next_status text,
  p_staff_note text DEFAULT NULL
)
RETURNS public.private_dining_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.private_dining_feedback%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_staff(v_actor) THEN
    RAISE EXCEPTION 'Unauthorized: staff required' USING ERRCODE = '42501';
  END IF;
  IF p_next_status NOT IN ('acknowledged', 'resolved') THEN
    RAISE EXCEPTION 'Invalid feedback status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.private_dining_feedback
  SET
    status = p_next_status,
    staff_note = COALESCE(NULLIF(trim(COALESCE(p_staff_note, '')), ''), staff_note),
    handled_by = v_actor,
    handled_at = now()
  WHERE id = p_feedback_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback record not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.user_id IS NOT NULL THEN
    PERFORM public.create_notification_idempotent(
      v_row.user_id,
      'feedback:' || v_row.id::text || ':' || p_next_status,
      'service_' || p_next_status,
      CASE WHEN p_next_status = 'acknowledged' THEN 'Management Received Your Note' ELSE 'Feedback Followed Up' END,
      CASE WHEN p_next_status = 'acknowledged'
        THEN 'A Butcher Block manager has seen your private message and is attending to it.'
        ELSE 'Thank you for sharing private feedback with Butcher Block management.'
      END,
      '/profile',
      v_row.order_id,
      jsonb_build_object('feedback_id', v_row.id, 'category', v_row.category)
    );
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_private_feedback_status(uuid, text, text) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.private_dining_feedback;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
