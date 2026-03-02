-- Add weight_unit column to tracked_sets for per-exercise kg/lbs tracking
ALTER TABLE public.tracked_sets
  ADD COLUMN weight_unit text NOT NULL DEFAULT 'lbs'
  CHECK (weight_unit IN ('kg', 'lbs'));
