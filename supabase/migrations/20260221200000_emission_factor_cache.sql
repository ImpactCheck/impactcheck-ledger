-- Emission factor cache for mapping job (7-day TTL)
CREATE TABLE IF NOT EXISTS public.emission_factor_cache (
  cache_key TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  factor_name TEXT,
  factor_source TEXT,
  factor_year INTEGER,
  factor_region TEXT,
  factor_unit TEXT,
  factor_unit_type TEXT,
  co2e_per_unit NUMERIC,
  co2e_kg NUMERIC NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  confidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emission_factor_cache_expires ON public.emission_factor_cache(expires_at);
ALTER TABLE public.emission_factor_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to emission_factor_cache" ON public.emission_factor_cache FOR ALL USING (true) WITH CHECK (true);
