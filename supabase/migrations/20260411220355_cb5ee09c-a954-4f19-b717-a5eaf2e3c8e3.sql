-- Fix bookings INSERT: user_id must be own ID or null
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
CREATE POLICY "Anyone can create bookings"
  ON public.bookings FOR INSERT
  TO public
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Fix orders INSERT: user_id must be own ID or null  
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Fix waitlist INSERT: user_id must be own ID or null
DROP POLICY IF EXISTS "Anyone can create waitlist entry" ON public.waitlist_entries;
CREATE POLICY "Anyone can create waitlist entry"
  ON public.waitlist_entries FOR INSERT
  TO public
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Add SELECT for waitlist users to see own entries
CREATE POLICY "Users can view their own waitlist entries"
  ON public.waitlist_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop duplicate admin SELECT policies (bookings has two identical ones)
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;