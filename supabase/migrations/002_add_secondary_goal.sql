-- Add optional secondary_goal column to workout_plans
ALTER TABLE public.workout_plans
  ADD COLUMN secondary_goal text DEFAULT NULL;
