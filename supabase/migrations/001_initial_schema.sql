-- =============================================================
-- Jacob's Workout Assistant — Initial Schema
-- =============================================================

-- -----------------------------------------------
-- 1. profiles
-- -----------------------------------------------
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 2. workout_plans
-- -----------------------------------------------
CREATE TABLE public.workout_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name         text NOT NULL,
  split_description text,
  motivational_quote text,
  quote_author      text,
  days_per_week     smallint NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  goal              text NOT NULL,
  level             text NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 3. plan_days
-- -----------------------------------------------
CREATE TABLE public.plan_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  day_number  smallint NOT NULL,
  focus       text NOT NULL
);

-- -----------------------------------------------
-- 4. plan_exercises
-- -----------------------------------------------
CREATE TABLE public.plan_exercises (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id       uuid NOT NULL REFERENCES public.plan_days(id) ON DELETE CASCADE,
  position          smallint NOT NULL,
  name              text NOT NULL,
  sets              smallint NOT NULL,
  reps              text NOT NULL,
  rest              text NOT NULL,
  expert_advice     text,
  video_search_query text
);

-- -----------------------------------------------
-- 5. exercise_alternatives
-- -----------------------------------------------
CREATE TABLE public.exercise_alternatives (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id       uuid NOT NULL REFERENCES public.plan_exercises(id) ON DELETE CASCADE,
  name              text NOT NULL,
  expert_advice     text,
  video_search_query text
);

-- -----------------------------------------------
-- 6. tracked_workouts
-- -----------------------------------------------
CREATE TABLE public.tracked_workouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id       uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  week_number   smallint NOT NULL,
  day_number    smallint NOT NULL,
  completed     boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 7. tracked_sets
-- -----------------------------------------------
CREATE TABLE public.tracked_sets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_workout_id  uuid NOT NULL REFERENCES public.tracked_workouts(id) ON DELETE CASCADE,
  exercise_name       text NOT NULL,
  set_number          smallint NOT NULL,
  weight              real NOT NULL DEFAULT 0,
  reps                smallint NOT NULL DEFAULT 0,
  completed           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX idx_workout_plans_user       ON public.workout_plans (user_id);
CREATE INDEX idx_tracked_workouts_user    ON public.tracked_workouts (user_id, plan_id);
CREATE INDEX idx_tracked_sets_exercise    ON public.tracked_sets (exercise_name, created_at);
CREATE INDEX idx_tracked_sets_workout     ON public.tracked_sets (tracked_workout_id);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

-- ---- profiles ------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Insert is handled by the trigger, but allow it for safety
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ---- workout_plans -------------------------------------------
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plans"
  ON public.workout_plans FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own plans"
  ON public.workout_plans FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own plans"
  ON public.workout_plans FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own plans"
  ON public.workout_plans FOR DELETE
  USING (user_id = auth.uid());

-- ---- plan_days -----------------------------------------------
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plan days"
  ON public.plan_days FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workout_plans
    WHERE workout_plans.id = plan_days.plan_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own plan days"
  ON public.plan_days FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_plans
    WHERE workout_plans.id = plan_days.plan_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own plan days"
  ON public.plan_days FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.workout_plans
    WHERE workout_plans.id = plan_days.plan_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own plan days"
  ON public.plan_days FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.workout_plans
    WHERE workout_plans.id = plan_days.plan_id
      AND workout_plans.user_id = auth.uid()
  ));

-- ---- plan_exercises ------------------------------------------
ALTER TABLE public.plan_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plan exercises"
  ON public.plan_exercises FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.plan_days
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_days.id = plan_exercises.plan_day_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own plan exercises"
  ON public.plan_exercises FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.plan_days
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_days.id = plan_exercises.plan_day_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own plan exercises"
  ON public.plan_exercises FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.plan_days
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_days.id = plan_exercises.plan_day_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own plan exercises"
  ON public.plan_exercises FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.plan_days
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_days.id = plan_exercises.plan_day_id
      AND workout_plans.user_id = auth.uid()
  ));

-- ---- exercise_alternatives -----------------------------------
ALTER TABLE public.exercise_alternatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exercise alternatives"
  ON public.exercise_alternatives FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.plan_exercises
    JOIN public.plan_days ON plan_days.id = plan_exercises.plan_day_id
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_exercises.id = exercise_alternatives.exercise_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own exercise alternatives"
  ON public.exercise_alternatives FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.plan_exercises
    JOIN public.plan_days ON plan_days.id = plan_exercises.plan_day_id
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_exercises.id = exercise_alternatives.exercise_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own exercise alternatives"
  ON public.exercise_alternatives FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.plan_exercises
    JOIN public.plan_days ON plan_days.id = plan_exercises.plan_day_id
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_exercises.id = exercise_alternatives.exercise_id
      AND workout_plans.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own exercise alternatives"
  ON public.exercise_alternatives FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.plan_exercises
    JOIN public.plan_days ON plan_days.id = plan_exercises.plan_day_id
    JOIN public.workout_plans ON workout_plans.id = plan_days.plan_id
    WHERE plan_exercises.id = exercise_alternatives.exercise_id
      AND workout_plans.user_id = auth.uid()
  ));

-- ---- tracked_workouts ----------------------------------------
ALTER TABLE public.tracked_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tracked workouts"
  ON public.tracked_workouts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tracked workouts"
  ON public.tracked_workouts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tracked workouts"
  ON public.tracked_workouts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tracked workouts"
  ON public.tracked_workouts FOR DELETE
  USING (user_id = auth.uid());

-- ---- tracked_sets --------------------------------------------
ALTER TABLE public.tracked_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tracked sets"
  ON public.tracked_sets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tracked_workouts
    WHERE tracked_workouts.id = tracked_sets.tracked_workout_id
      AND tracked_workouts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own tracked sets"
  ON public.tracked_sets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tracked_workouts
    WHERE tracked_workouts.id = tracked_sets.tracked_workout_id
      AND tracked_workouts.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own tracked sets"
  ON public.tracked_sets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.tracked_workouts
    WHERE tracked_workouts.id = tracked_sets.tracked_workout_id
      AND tracked_workouts.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own tracked sets"
  ON public.tracked_sets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.tracked_workouts
    WHERE tracked_workouts.id = tracked_sets.tracked_workout_id
      AND tracked_workouts.user_id = auth.uid()
  ));

-- =============================================================
-- TRIGGER: Auto-create profile on user sign-up
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
