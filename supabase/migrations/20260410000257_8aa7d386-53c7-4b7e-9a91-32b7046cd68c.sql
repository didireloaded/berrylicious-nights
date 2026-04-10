
DROP POLICY "Service role can insert reports" ON public.shift_reports;

CREATE POLICY "Admins can insert shift reports"
  ON public.shift_reports FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
