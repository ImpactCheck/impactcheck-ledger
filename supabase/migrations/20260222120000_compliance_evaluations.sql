-- Compliance evaluations stored per project (persistent cache)
CREATE TABLE public.compliance_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  by_region jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

CREATE INDEX idx_compliance_evaluations_project_id ON public.compliance_evaluations(project_id);

ALTER TABLE public.compliance_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to compliance_evaluations"
ON public.compliance_evaluations
FOR ALL
USING (true)
WITH CHECK (true);
