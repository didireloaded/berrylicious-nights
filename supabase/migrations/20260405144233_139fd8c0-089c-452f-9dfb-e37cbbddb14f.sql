
-- Allow admins to read all bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all bookings' AND tablename = 'bookings'
  ) THEN
    CREATE POLICY "Admins can read all bookings"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Allow admins to read all orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all orders' AND tablename = 'orders'
  ) THEN
    CREATE POLICY "Admins can read all orders"
    ON public.orders
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Allow admins to delete updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete updates' AND tablename = 'updates'
  ) THEN
    CREATE POLICY "Admins can delete updates"
    ON public.updates
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
