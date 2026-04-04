-- D1 Schema for Jacob's Workout Assistant
-- Replaces Supabase Postgres — all tables in SQLite

-- 1. users (replaces Supabase auth.users + profiles)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. sessions
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 3. workout_plans
CREATE TABLE IF NOT EXISTS workout_plans (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name          TEXT NOT NULL,
  split_description  TEXT,
  motivational_quote TEXT,
  quote_author       TEXT,
  days_per_week      INTEGER NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  goal               TEXT NOT NULL,
  level              TEXT NOT NULL,
  secondary_goal     TEXT,
  split_type         TEXT,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON workout_plans(user_id);

-- 4. plan_days
CREATE TABLE IF NOT EXISTS plan_days (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  plan_id    TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  focus      TEXT NOT NULL
);

-- 5. plan_exercises
CREATE TABLE IF NOT EXISTS plan_exercises (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  plan_day_id        TEXT NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
  position           INTEGER NOT NULL,
  name               TEXT NOT NULL,
  sets               INTEGER NOT NULL,
  reps               TEXT NOT NULL,
  rest               TEXT NOT NULL,
  expert_advice      TEXT,
  video_search_query TEXT
);

-- 6. exercise_alternatives
CREATE TABLE IF NOT EXISTS exercise_alternatives (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  exercise_id        TEXT NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  expert_advice      TEXT,
  video_search_query TEXT
);

-- 7. tracked_workouts
CREATE TABLE IF NOT EXISTS tracked_workouts (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id      TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL,
  day_number   INTEGER NOT NULL,
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tracked_user ON tracked_workouts(user_id, plan_id);

-- 8. tracked_sets
CREATE TABLE IF NOT EXISTS tracked_sets (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tracked_workout_id  TEXT NOT NULL REFERENCES tracked_workouts(id) ON DELETE CASCADE,
  exercise_name       TEXT NOT NULL,
  set_number          INTEGER NOT NULL,
  weight              REAL NOT NULL DEFAULT 0,
  reps                INTEGER NOT NULL DEFAULT 0,
  completed           INTEGER NOT NULL DEFAULT 0,
  weight_unit         TEXT NOT NULL DEFAULT 'lbs' CHECK (weight_unit IN ('kg', 'lbs')),
  note                TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sets_workout ON tracked_sets(tracked_workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON tracked_sets(exercise_name, created_at);

-- 9. weekly_notes
CREATE TABLE IF NOT EXISTS weekly_notes (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id     TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, plan_id, week_number)
);
CREATE INDEX IF NOT EXISTS idx_weekly_notes_user ON weekly_notes(user_id, plan_id);

-- 10. custom_exercises (user-added exercises that carry across weeks for a plan day)
CREATE TABLE IF NOT EXISTS custom_exercises (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id       TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number    INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  sets          INTEGER NOT NULL DEFAULT 3,
  position      INTEGER NOT NULL DEFAULT 99,
  target_reps   TEXT,
  rest_period   TEXT,
  expert_advice TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_plan ON custom_exercises(user_id, plan_id, day_number);

-- 11. body_weights (bodyweight tracking entries)
CREATE TABLE IF NOT EXISTS body_weights (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight      REAL NOT NULL,
  weight_unit TEXT NOT NULL DEFAULT 'lbs' CHECK (weight_unit IN ('kg', 'lbs')),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_body_weights_user ON body_weights(user_id, recorded_at);

-- 12. user_preferences (expanded onboarding + settings)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
  mobility_focus     TEXT,
  stretching_goals   TEXT,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
