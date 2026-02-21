
-- Add search_query column for Climatiq-optimized short keyword queries
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS search_query text;

-- Add category column for activity classification
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS category text;

-- Add source_page for traceability
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS source_page text;

-- Add confidence level
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS confidence text;
