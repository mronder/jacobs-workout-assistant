-- Migration 002: Add AI guidance columns to custom_exercises
-- These store the AI-suggested reps, rest period, and expert advice
-- so users see guidance for their custom exercises.

ALTER TABLE custom_exercises ADD COLUMN target_reps TEXT;
ALTER TABLE custom_exercises ADD COLUMN rest_period TEXT;
ALTER TABLE custom_exercises ADD COLUMN expert_advice TEXT;
