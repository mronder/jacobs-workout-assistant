-- Migration 001: Add split_type, custom_exercises, body_weights, user_preferences
-- Applies non-destructively to an existing workout-db D1 database.
-- Safe to re-run: all statements use IF NOT EXISTS / try-add semantics.

-- 1. Add split_type column to workout_plans (SQLite ignores if column exists via try/catch in wrangler)
ALTER TABLE workout_plans ADD COLUMN split_type TEXT;

-- 2. custom_exercises — user-added exercises that persist across weeks for a plan day
CREATE TABLE IF NOT EXISTS custom_exercises (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id       TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number    INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  sets          INTEGER NOT NULL DEFAULT 3,
  position      INTEGER NOT NULL DEFAULT 99,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_plan ON custom_exercises(user_id, plan_id, day_number);

-- 3. body_weights — bodyweight tracking entries
CREATE TABLE IF NOT EXISTS body_weights (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight      REAL NOT NULL,
  weight_unit TEXT NOT NULL DEFAULT 'lbs' CHECK (weight_unit IN ('kg', 'lbs')),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_body_weights_user ON body_weights(user_id, recorded_at);

-- 4. user_preferences — expanded onboarding and user settings
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
  mobility_focus     TEXT,
  stretching_goals   TEXT,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
