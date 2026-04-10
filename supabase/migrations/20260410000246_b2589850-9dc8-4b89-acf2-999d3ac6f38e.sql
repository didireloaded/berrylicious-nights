
CREATE TABLE public.shift_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date date NOT NULL,
  report_type text NOT NULL DEFAULT 'shift-summary',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one report per date per type
ALTER TABLE public.shift_reports ADD CONSTRAINT shift_reports_date_type_unique UNIQUE (report_date, report_type);

-- Enable RLS
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins can view shift reports"
  ON public.shift_reports FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role / edge functions insert (no user insert policy needed)
CREATE POLICY "Service role can insert reports"
  ON public.shift_reports FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_reports;
