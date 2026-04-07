
-- 1. Orders: new columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS arrival_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS arrival_verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS eta_minutes integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS eta_set_at timestamptz DEFAULT NULL;

-- 2. Bookings: new columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS arrival_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS arrival_verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assigned_table_code text DEFAULT NULL;

-- 3. Updates: new columns
ALTER TABLE public.updates
  ADD COLUMN IF NOT EXISTS event_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS event_time text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS available_slots text[] DEFAULT NULL;

-- 4. Restaurant chats
CREATE TABLE IF NOT EXISTS public.restaurant_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chats"
  ON public.restaurant_chats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat"
  ON public.restaurant_chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all chats"
  ON public.restaurant_chats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Restaurant chat messages
CREATE TABLE IF NOT EXISTS public.restaurant_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.restaurant_chats(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  from_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages"
  ON public.restaurant_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_chats c
      WHERE c.id = chat_id AND c.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Chat participants can send messages"
  ON public.restaurant_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurant_chats c
      WHERE c.id = chat_id AND c.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 6. Waitlist entries
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT NULL,
  party_size integer NOT NULL DEFAULT 2,
  preferred_date text NOT NULL,
  guest_name text DEFAULT NULL,
  guest_phone text DEFAULT NULL,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create waitlist entry"
  ON public.waitlist_entries FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can view all waitlist"
  ON public.waitlist_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update waitlist"
  ON public.waitlist_entries FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist_entries;

-- 8. Update trigger for restaurant_chats.updated_at
CREATE OR REPLACE FUNCTION public.update_restaurant_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.restaurant_chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_chat_msg_update_chat
  AFTER INSERT ON public.restaurant_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurant_chat_updated_at();
