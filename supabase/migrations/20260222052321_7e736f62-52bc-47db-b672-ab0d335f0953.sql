
CREATE TABLE public.simulation_estimates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  activity_id uuid NOT NULL,
  simulation_region text NOT NULL,
  region text,
  matched_factor jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  co2e_kg numeric NOT NULL DEFAULT 0,
  input_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.simulation_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to simulation_estimates"
ON public.simulation_estimates
FOR ALL
USING (true)
WITH CHECK (true);
