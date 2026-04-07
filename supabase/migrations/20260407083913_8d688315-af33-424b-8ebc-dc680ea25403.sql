
CREATE TABLE IF NOT EXISTS public.menu_item_disabled (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_disabled ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view disabled items"
  ON public.menu_item_disabled FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert disabled items"
  ON public.menu_item_disabled FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete disabled items"
  ON public.menu_item_disabled FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_item_disabled;
