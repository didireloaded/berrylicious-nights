-- ============================================================================
-- Phase 5: Past Orders History Isolation & Secure Guest Order Claim
-- Butcher Block Steakhouse (Windhoek, Namibia)
-- ============================================================================

-- Index optimized for customer order history pagination
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created
  ON public.orders (user_id, status, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Securely claim an unclaimed guest order using BOTH order ID prefix/UUID AND matching arrival_code
-- (alternative to access-token claim when guest switches devices after ordering)
CREATE OR REPLACE FUNCTION public.claim_guest_order_by_arrival_code(
  p_order_id uuid,
  p_arrival_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_uid IS NULL OR p_order_id IS NULL OR p_arrival_code IS NULL OR char_length(trim(p_arrival_code)) < 4 THEN
    RETURN false;
  END IF;

  UPDATE public.orders
  SET user_id = v_uid
  WHERE id = p_order_id
    AND user_id IS NULL
    AND arrival_code IS NOT NULL
    AND upper(trim(arrival_code)) = upper(trim(p_arrival_code))
    AND created_at >= now() - interval '30 days';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_guest_order_by_arrival_code(uuid, text) TO authenticated;
