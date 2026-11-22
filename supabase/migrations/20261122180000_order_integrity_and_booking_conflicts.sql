-- Butcher Block Steakhouse: Server-side order integrity, cancellation policy,
-- and booking conflict protection.
-- Note: Apply to the Supabase project via `supabase db push` or SQL Editor.

-- 1. Enforce valid order statuses and positive totals at the database layer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_valid_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_valid_status_check
      CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_nonnegative_total_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_nonnegative_total_check
      CHECK (total >= 0 AND jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0);
  END IF;
END $$;

-- 2. Prevent simultaneous booking conflicts on the same table slot at DB level
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_table_slot_unique
  ON public.bookings (date, time, assigned_table_code)
  WHERE status <> 'cancelled' AND assigned_table_code IS NOT NULL;

-- 3. Allow authenticated customers to cancel their own pending orders safely
CREATE OR REPLACE FUNCTION public.cancel_own_pending_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'pending';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_own_pending_order(uuid) TO authenticated;
