# Supabase Integration — Implementation Plan

**Author:** Daniel Reeves — Senior Full-Stack Engineer  
**Date:** February 28, 2026  
**Project:** Jacob's Workout Assistant  
**Stack:** React 19 · TypeScript · Tailwind CSS 4 · Vite · Cloudflare Pages · Supabase  

---

## About Me

Hey — I'm Daniel Reeves. I'm a Senior Full-Stack Engineer with 11 years of experience building production web applications. My focus areas are React/TypeScript frontends, serverless architectures (Cloudflare Workers, Vercel Edge, AWS Lambda), and Postgres-backed data layers. I've integrated Supabase into six production apps over the past two years, including a fitness tracking platform with ~40k monthly active users. I know the sharp edges, I know the gotchas, and I know how to get this done without burning the house down.

My title is **Senior Full-Stack Engineer / Technical Lead**, and for this project I'll be acting as the architect and primary implementor. Let's get into it.

---

## 1. Project Context & Current Architecture

### What We Have Today

Jacob's Workout Assistant is a single-page React app deployed on Cloudflare Pages. It has three screens:

1. **Setup** — User picks training days (3–6), goal (Hypertrophy, Strength, etc.), and experience level
2. **Dashboard** — Displays the AI-generated 4-week plan with progress tracking across weeks
3. **ActiveWorkout** — Accordion-style exercise tracker where users log weight, reps, and set completion

The AI plan generation happens via a Cloudflare Pages Function (`/api/generate-plan`) that calls the OpenAI API server-side. The key never touches the browser. Good.

### Where The Data Lives Today

Right now, **everything is in `localStorage`**:

- `jw_plan` — the full `WorkoutPlan` JSON blob (plan name, split, exercises, alternatives, etc.)
- `jw_tracked` — an array of `TrackedWorkout` objects (weight/reps/sets per exercise per day)

This means:
- Clear your browser? Data gone.
- Switch devices? Start over.
- Different browser on the same machine? Invisible.
- No way to look at historical performance across plans.
- Zero concept of "who" is using the app.

### What We're Building

We're going to add **Supabase** as the backend to give us:

1. **Authentication** — Email/password sign-up and login (and optionally OAuth providers later)
2. **Persistent Storage** — All workout plans and tracked workout data saved to a Postgres database
3. **Cross-Device Sync** — Log in anywhere, see your data
4. **Exercise History Page** — A brand-new second page where users can view their historical performance for each exercise (weights over time, volume trends, personal records)

---

## 2. Why Supabase

Let me be direct about why Supabase is the right call here:

- **Postgres under the hood.** We get a real relational database with full SQL support. Our data is inherently relational — users have plans, plans have weeks, weeks have days, days have exercises, exercises have tracked sets. Postgres handles this beautifully.
- **Built-in Auth.** Supabase Auth gives us email/password, magic links, and OAuth providers out of the box. We don't need to roll our own JWT handling, session management, or password hashing.
- **Row Level Security (RLS).** Every table can have policies that enforce "users can only see their own data" at the database level. Even if we write a bug in our frontend, the database itself won't leak data between users.
- **Client library is excellent.** `@supabase/supabase-js` is well-maintained, tree-shakeable, and works perfectly in browser environments.
- **Free tier is generous.** 500MB database, 50k monthly active users, 1GB file storage. We'll never come close to those limits.
- **We're already on Cloudflare.** Supabase and Cloudflare play nicely together. The Supabase client talks directly to the Supabase API from the browser — no need to proxy through our Cloudflare function.

---

## 3. Authentication Architecture

### 3.1 — Auth Flow

The authentication flow will work like this:

```
User opens app
  → Check for existing Supabase session
    → Session exists & valid → Load user data from Supabase → Dashboard
    → No session → Show Auth screen (Login / Sign Up)
      → User signs up with email/password
        → Supabase creates user → Sends confirmation email (optional, configurable)
        → Session established → Redirect to Setup (first time) or Dashboard (returning)
      → User logs in with email/password
        → Supabase validates → Session established → Load user data → Dashboard
```

### 3.2 — Session Management

Supabase handles sessions via JWTs stored in `localStorage` (managed by the Supabase client). We'll use `supabase.auth.onAuthStateChange()` to reactively update our app state when the user logs in, logs out, or their session refreshes. The Supabase client handles token refresh automatically.

### 3.3 — Auth UI Component

We'll build a new `Auth.tsx` component that handles:
- **Login form** — Email + password fields, "Log In" button
- **Sign-up form** — Email + password + confirm password, "Create Account" button
- **Toggle** — Switch between login and sign-up modes
- **Error display** — Invalid credentials, email already taken, weak password, etc.
- **Loading state** — Spinner while auth request is in flight

This keeps the auth UI consistent with the existing dark theme and doesn't require a third-party auth UI library.

### 3.4 — Where Auth Fits in the Component Tree

```
App.tsx
├── AuthProvider (context)
│   ├── Auth screen (if not logged in)
│   └── Authenticated app shell (if logged in)
│       ├── Header (now with user email + logout button)
│       ├── Navigation (Dashboard / History)
│       ├── Setup
│       ├── Dashboard
│       ├── ActiveWorkout
│       └── History (NEW)
```

We'll create an `AuthContext` that wraps the entire app. Every component can call `useAuth()` to get the current user, loading state, and sign-out function.

---

## 4. Database Schema Design

This is the most critical part of the plan. Get the schema right and everything else falls into place. Get it wrong and we're doing painful migrations later. Let's think carefully.

### 4.1 — Tables

#### `profiles`

Extended user metadata beyond what Supabase Auth stores.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PRIMARY KEY | References `auth.users(id)` — same as the Supabase user ID |
| `display_name` | `text` | Optional, for future use |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

#### `workout_plans`

Stores the AI-generated plan. One row per plan generation.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PRIMARY KEY | Default `gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL | References `profiles(id)` |
| `plan_name` | `text` NOT NULL | e.g., "Push/Pull/Legs Hypertrophy" |
| `split_description` | `text` | The paragraph describing the split |
| `motivational_quote` | `text` | |
| `quote_author` | `text` | |
| `days_per_week` | `smallint` NOT NULL | 3–6 |
| `goal` | `text` NOT NULL | "Hypertrophy", "Strength", etc. |
| `level` | `text` NOT NULL | "Beginner", "Intermediate", "Advanced" |
| `is_active` | `boolean` DEFAULT `true` | Only one active plan per user at a time |
| `created_at` | `timestamptz` | Default `now()` |

#### `plan_days`

Each day within a plan.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PRIMARY KEY | Default `gen_random_uuid()` |
| `plan_id` | `uuid` NOT NULL | References `workout_plans(id)` ON DELETE CASCADE |
| `day_number` | `smallint` NOT NULL | 1-based within the week template |
| `focus` | `text` NOT NULL | e.g., "Push Day — Chest, Shoulders, Triceps" |

#### `plan_exercises`

Each exercise within a day.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PRIMARY KEY | Default `gen_random_uuid()` |
| `plan_day_id` | `uuid` NOT NULL | References `plan_days(id)` ON DELETE CASCADE |
| `position` | `smallint` NOT NULL | Order within the day |
| `name` | `text` NOT NULL | e.g., "Barbell Bench Press" |
| `sets` | `smallint` NOT NULL | Prescribed number of sets |
| `reps` | `text` NOT NULL | e.g., "8-12" |
| `rest` | `text` NOT NULL | e.g., "90s" |
| `expert_advice` | `text` | Form cues |
| `video_search_query` | `text` | YouTube search string |

#### `exercise_alternatives`

Two alternatives per exercise.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PRIMARY KEY | Default `gen_random_uuid()` |
| `exercise_id` | `uuid` NOT NULL | References `plan_exercises(id)` ON DELETE CASCADE |
| `name` | `text` NOT NULL | |
| `expert_advice` | `text` | |
| `video_search_query` | `text` | |

#### `tracked_workouts`

A completed (or in-progress) workout session.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PRIMARY KEY | Default `gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL | References `profiles(id)` |
| `plan_id` | `uuid` NOT NULL | References `workout_plans(id)` |
| `week_number` | `smallint` NOT NULL | 1–4 |
| `day_number` | `smallint` NOT NULL | Matches `plan_days.day_number` |
| `completed` | `boolean` DEFAULT `false` | |
| `completed_at` | `timestamptz` | When the user hit "Finish Workout" |
| `created_at` | `timestamptz` | Default `now()` |

#### `tracked_sets`

Individual set data — the most granular piece. This is the gold for the history page.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PRIMARY KEY | Default `gen_random_uuid()` |
| `tracked_workout_id` | `uuid` NOT NULL | References `tracked_workouts(id)` ON DELETE CASCADE |
| `exercise_name` | `text` NOT NULL | Denormalized for easy history queries |
| `set_number` | `smallint` NOT NULL | 1-based |
| `weight` | `real` NOT NULL | In user's preferred unit (lbs or kg) |
| `reps` | `smallint` NOT NULL | Actual reps performed |
| `completed` | `boolean` DEFAULT `false` | |
| `created_at` | `timestamptz` | Default `now()` |

### 4.2 — Why Denormalize `exercise_name` in `tracked_sets`?

You might be thinking — "why not just reference `plan_exercises(id)`?" Two reasons:

1. **Exercise swaps.** When a user swaps to an alternative during a workout, the exercise they actually performed might not be the one in `plan_exercises`. We need to record what they actually did, not what was prescribed.
2. **Cross-plan history.** When the user generates a new plan, we still want to show them "you benched 185 for 8 reps last time you did Barbell Bench Press." That query is trivial with a denormalized `exercise_name` column. With a foreign key to a plan-specific exercise row, it becomes a multi-join nightmare.

The tradeoff is name inconsistency ("Bench Press" vs "Barbell Bench Press"), but since our exercises come from the AI with consistent naming, and we can add normalization later if needed, this is the right call for now.

### 4.3 — Row Level Security Policies

Every single table gets RLS enabled. The policies are simple and identical in spirit:

```sql
-- Users can only see their own data
CREATE POLICY "Users can read own data" ON table_name
  FOR SELECT USING (user_id = auth.uid());

-- Users can only insert their own data
CREATE POLICY "Users can insert own data" ON table_name
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only update their own data
CREATE POLICY "Users can update own data" ON table_name
  FOR UPDATE USING (user_id = auth.uid());

-- Users can only delete their own data
CREATE POLICY "Users can delete own data" ON table_name
  FOR DELETE USING (user_id = auth.uid());
```

For child tables (like `plan_days`, `plan_exercises`, etc.) that don't have a direct `user_id`, we'll write policies that join up to the parent to check ownership. For example:

```sql
CREATE POLICY "Users can read own plan days" ON plan_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_plans
      WHERE workout_plans.id = plan_days.plan_id
      AND workout_plans.user_id = auth.uid()
    )
  );
```

This is non-negotiable. RLS is our safety net.

### 4.4 — Indexes

At minimum, we need:

- `workout_plans(user_id)` — "get all plans for this user"
- `tracked_workouts(user_id, plan_id)` — "get all tracked workouts for this user's plan"
- `tracked_sets(tracked_workout_id)` — "get all sets for a workout" (the FK already gives us this)
- `tracked_sets(exercise_name, created_at)` — **critical for the history page** — "get all sets for Bench Press over time"

### 4.5 — Database Trigger: Auto-Create Profile

When a new user signs up through Supabase Auth, we need a row in `profiles` automatically. We'll use a Postgres trigger:

```sql
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
```

---

## 5. Supabase Client Setup

### 5.1 — Environment Variables

Two values needed — both are **public** (this is by design in Supabase):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

**These are safe to expose in the browser.** The anon key is not a secret — it's the equivalent of a public API key. It only allows operations that pass RLS policies. The actual security comes from RLS + the user's JWT. This is how Supabase is designed to work. Don't treat the anon key like a secret.

### 5.2 — Client Singleton

New file: `src/services/supabaseClient.ts`

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

This gets imported everywhere we need to talk to Supabase. One client instance, shared across the app.

### 5.3 — Type Generation

Supabase can auto-generate TypeScript types from your database schema:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
```

This gives us full type safety on every `.from('table').select()` call. We'll run this after creating the schema and re-run it whenever the schema changes.

---

## 6. Service Layer Architecture

We'll create a clean service layer that abstracts all Supabase operations. The components should never call `supabase.from(...)` directly. Instead:

### File Structure (new files)

```
src/
  services/
    supabaseClient.ts     ← Client singleton
    auth.ts               ← Sign up, log in, log out, session listener
    plans.ts              ← Save plan, load active plan, deactivate plan, load all plans
    tracking.ts           ← Save tracked workout, load tracked workouts for plan
    history.ts            ← Exercise history queries for the History page
  contexts/
    AuthContext.tsx        ← React context for auth state
  types/
    supabase.ts           ← Auto-generated DB types
```

### Why a Service Layer?

1. **Single responsibility.** Components render UI. Services talk to the database.
2. **Testability.** We can mock the service layer in tests without touching Supabase.
3. **Migration safety.** If we ever swap Supabase for something else, we change the service files. Components don't care.
4. **Error handling.** Centralized error handling and retry logic in one place.

---

## 7. Data Flow Changes

### 7.1 — Plan Generation Flow (Updated)

```
Setup.onGenerate(days, goal, level)
  → App.handleGenerate()
    → generateWorkoutPlan(days, goal, level)           [calls /api/generate-plan]
    → savePlanToSupabase(user.id, plan, days, goal, level)  [NEW — writes to DB]
    → setPlan(plan)                                     [update React state]
    → localStorage still used as a cache for instant loads
```

### 7.2 — Workout Tracking Flow (Updated)

```
ActiveWorkout.onComplete(trackedWorkout)
  → App.handleCompleteWorkout(workout)
    → saveTrackedWorkoutToSupabase(user.id, planId, workout)  [NEW — writes to DB]
    → setTrackedWorkouts(updated)                              [update React state]
    → localStorage still used as a cache
```

### 7.3 — App Startup Flow (Updated)

```
App mounts
  → AuthProvider checks Supabase session
    → Not logged in → Show Auth screen
    → Logged in →
      → loadActivePlan(user.id)           [reads from Supabase]
      → loadTrackedWorkouts(user.id, planId) [reads from Supabase]
      → Cache in localStorage for next instant load
      → Render Dashboard (or Setup if no plan)
```

### 7.4 — Offline / Cache Strategy

We're keeping `localStorage` as a **read cache** for instant page loads. The flow:

1. On mount: Read from `localStorage` immediately → render instantly
2. In background: Fetch from Supabase → update state if different
3. On write: Write to Supabase first → on success, update `localStorage` + React state

This gives us fast perceived performance while Supabase is the source of truth. If the Supabase fetch fails (offline, etc.), we still have the cached data. We're not building a full offline-first app — just being smart about UX.

---

## 8. The History Page — Design & Implementation

### 8.1 — What It Shows

The History page is where the real value of persistent data becomes visible. Users will be able to:

1. **See a list of every unique exercise they've performed** — alphabetized, searchable
2. **Tap an exercise to see its full history** — every time they did it, across all plans
3. **View per-session data** — date, sets × reps × weight, which plan it was part of
4. **See personal records** — heaviest weight, most volume (sets × reps × weight)
5. **See a simple progression chart** — max weight over time, plotted on a line chart

### 8.2 — Data Queries

The history page needs two main queries:

**Query 1: Distinct exercises for a user**

```sql
SELECT DISTINCT exercise_name
FROM tracked_sets ts
JOIN tracked_workouts tw ON tw.id = ts.tracked_workout_id
WHERE tw.user_id = $1
ORDER BY exercise_name;
```

**Query 2: All sets for a specific exercise over time**

```sql
SELECT
  ts.exercise_name,
  ts.set_number,
  ts.weight,
  ts.reps,
  ts.completed,
  ts.created_at,
  tw.week_number,
  tw.day_number,
  tw.completed_at,
  wp.plan_name
FROM tracked_sets ts
JOIN tracked_workouts tw ON tw.id = ts.tracked_workout_id
JOIN workout_plans wp ON wp.id = tw.plan_id
WHERE tw.user_id = $1
  AND ts.exercise_name = $2
ORDER BY ts.created_at DESC;
```

These are simple, fast queries — especially with the indexes we defined in section 4.4.

### 8.3 — UI Components

```
History.tsx (page)
├── ExerciseSearch          — Search/filter bar at top
├── ExerciseList            — Scrollable list of exercise names with session counts
│   └── ExerciseListItem    — Tappable row: exercise name + number of sessions
├── ExerciseDetail          — Shown when an exercise is selected
│   ├── PRBanner            — "Your PR: 225 lbs × 5 reps"
│   ├── ProgressChart       — Simple line chart (max weight over time)
│   └── SessionList         — Grouped by date
│       └── SessionCard     — Date, plan name, set-by-set breakdown
```

### 8.4 — Navigation

Today the app has no routing — it's all state-driven within `App.tsx`. We have two options:

**Option A: React Router** — Add `react-router-dom`, create `/` and `/history` routes. Proper URL-based navigation, back button works, shareable URLs.

**Option B: State-based tab navigation** — Add a bottom tab bar (Dashboard / History) and toggle between views with state. No new dependencies. Simpler. Consistent with the current architecture.

**My recommendation: Option B.** The app is small, mobile-first, and doesn't benefit from URL-based routing. A bottom tab bar is the right UX pattern here. We can always add a router later if we add more pages.

### 8.5 — Chart Library

For the progression chart, we need something lightweight. Options:

- **Recharts** — Popular, React-native components, ~45kb gzipped. A bit heavy for one chart.
- **Chart.js + react-chartjs-2** — Flexible, ~25kb gzipped. Canvas-based.
- **Lightweight custom SVG** — Zero dependencies. We only need a simple line chart. ~200 lines of code.

**My recommendation: Custom SVG line chart.** One chart, one use case. We don't need a charting library for this. I'll build a `<ProgressChart />` component that takes an array of `{ date, weight }` points and renders a clean SVG line chart with our existing orange/dark theme. No extra bundle size, no extra dependencies, full visual control.

---

## 9. Migration Path: localStorage → Supabase

For existing users who already have data in `localStorage`, we need a one-time migration:

1. User logs in for the first time (or creates account)
2. Check `localStorage` for `jw_plan` and `jw_tracked`
3. If data exists → prompt: "We found an existing workout plan. Would you like to import it into your account?"
4. If yes → write the `localStorage` data to Supabase under the new user's ID
5. Clear `localStorage` plan/tracked data (the Supabase-cached versions will repopulate)

This is a nice touch that respects existing users.

---

## 10. Security Considerations

1. **Supabase Anon Key** — Public, exposed in the browser. This is fine. It's designed this way. RLS policies are what enforce security, not the key.
2. **Row Level Security** — Enabled on ALL tables. Every policy checks `auth.uid()`. No exceptions.
3. **OpenAI API Key** — Stays server-side in the Cloudflare function. Unchanged from today.
4. **Password handling** — Supabase Auth handles hashing, salting, and storage. We never see raw passwords.
5. **CORS** — Supabase handles CORS for its own API. Our Cloudflare function already has CORS headers.
6. **Input validation** — The Cloudflare function already validates the request body. We'll add client-side validation for auth forms (email format, password length, etc.).

---

## 11. Environment & Configuration Changes

### New Environment Variables

| Variable | Where It Goes | Secret? |
|----------|---------------|---------|
| `VITE_SUPABASE_URL` | `.env` / Cloudflare env vars | No — public |
| `VITE_SUPABASE_ANON_KEY` | `.env` / Cloudflare env vars | No — public |

### Updated `.env.example`

```env
# Supabase (public — safe for client-side)
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""

# OpenAI (secret — server-side only, set in Cloudflare Dashboard)
OPENAI_API_KEY=""
```

### New Dependencies

```bash
npm install @supabase/supabase-js
```

That's the only new runtime dependency.

### Dev Dependencies

```bash
npm install -D supabase
```

For the CLI (type generation, local dev, migrations).

---

## 12. Testing Strategy

### Manual Testing Checklist

- Sign up with new email → verify profile created in Supabase Dashboard
- Log in → verify session persists across page reloads
- Log out → verify auth screen shown, no data leakage
- Generate plan while logged in → verify `workout_plans`, `plan_days`, `plan_exercises`, `exercise_alternatives` rows created
- Complete workout → verify `tracked_workouts` and `tracked_sets` rows created
- Log in from a different browser → verify all data is present
- History page → verify exercise list populated correctly
- History page → verify exercise detail shows correct sets/reps/weight over time
- RLS → Use Supabase Dashboard SQL editor as a different user → verify you can't see another user's data
- localStorage migration → Have data in localStorage, sign up → verify import prompt appears and works

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase cold starts | Slow first request after idle period | Use `localStorage` cache for instant first render; Supabase fetch happens in background |
| Schema changes | Breaking changes to the database | Use Supabase migrations (`supabase db diff`, `supabase migration new`) from the start |
| Large plan JSON | Could exceed Supabase row size limits | The plan is split into normalized tables — individual rows are small |
| Exercise name inconsistency | "Bench Press" vs "Barbell Bench Press" across plans | Accept for now; add normalization layer later if needed |
| Offline usage | Users can't log workouts without internet | `localStorage` cache allows reading. Writes require connectivity. Offline write queue is out of scope for v1. |
| Auth token expiry | User gets kicked out mid-workout | Supabase client auto-refreshes tokens. The `onAuthStateChange` listener handles re-auth. |

---

## 14. Out of Scope (For Now)

These are things we are explicitly NOT doing in this phase:

- OAuth providers (Google, Apple, GitHub login)
- Email verification enforcement
- Password reset flow
- Offline write queue / sync
- Social features (share plans, compare with friends)
- Unit/kg preference per user (everything in one unit for now)
- Plan versioning (edit an existing plan)
- Export data (CSV, JSON)
- Push notifications / reminders
- Native mobile app

We can revisit any of these in future phases.

---

## 15. Implementation TODO List

Below is the complete, ordered task list. Each task is a concrete, actionable unit of work. Tasks are grouped into phases, and phases are ordered by dependency. Do not skip phases.

---

### Phase 0 — Supabase Project Setup

- [ ] **0.1** Create a new Supabase project in the Supabase Dashboard
- [ ] **0.2** Record the project URL and anon key
- [ ] **0.3** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the local `.env` file
- [ ] **0.4** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Cloudflare Pages environment variables (Settings → Environment Variables)
- [ ] **0.5** Update `.env.example` to include the two new Supabase variables with empty values and explanatory comments
- [ ] **0.6** Install `@supabase/supabase-js` as a runtime dependency (`npm install @supabase/supabase-js`)
- [ ] **0.7** Install `supabase` as a dev dependency (`npm install -D supabase`)
- [ ] **0.8** Initialize the Supabase CLI in the project (`npx supabase init`)
- [ ] **0.9** Link the CLI to your remote project (`npx supabase link --project-ref YOUR_PROJECT_REF`)

---

### Phase 1 — Database Schema & Security

- [ ] **1.1** Create SQL migration file for the `profiles` table (columns: `id`, `display_name`, `created_at`, `updated_at`)
- [ ] **1.2** Create SQL migration file for the `workout_plans` table (columns: `id`, `user_id`, `plan_name`, `split_description`, `motivational_quote`, `quote_author`, `days_per_week`, `goal`, `level`, `is_active`, `created_at`)
- [ ] **1.3** Create SQL migration file for the `plan_days` table (columns: `id`, `plan_id`, `day_number`, `focus`)
- [ ] **1.4** Create SQL migration file for the `plan_exercises` table (columns: `id`, `plan_day_id`, `position`, `name`, `sets`, `reps`, `rest`, `expert_advice`, `video_search_query`)
- [ ] **1.5** Create SQL migration file for the `exercise_alternatives` table (columns: `id`, `exercise_id`, `name`, `expert_advice`, `video_search_query`)
- [ ] **1.6** Create SQL migration file for the `tracked_workouts` table (columns: `id`, `user_id`, `plan_id`, `week_number`, `day_number`, `completed`, `completed_at`, `created_at`)
- [ ] **1.7** Create SQL migration file for the `tracked_sets` table (columns: `id`, `tracked_workout_id`, `exercise_name`, `set_number`, `weight`, `reps`, `completed`, `created_at`)
- [ ] **1.8** Create SQL migration file for all foreign key constraints between tables
- [ ] **1.9** Create SQL migration file to add indexes: `workout_plans(user_id)`, `tracked_workouts(user_id, plan_id)`, `tracked_sets(exercise_name, created_at)`
- [ ] **1.10** Enable Row Level Security on ALL tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] **1.11** Write RLS SELECT policies for all tables (users can only read their own data)
- [ ] **1.12** Write RLS INSERT policies for all tables (users can only insert their own data)
- [ ] **1.13** Write RLS UPDATE policies for all tables (users can only update their own data)
- [ ] **1.14** Write RLS DELETE policies for all tables (users can only delete their own data)
- [ ] **1.15** Write RLS policies for child tables (`plan_days`, `plan_exercises`, `exercise_alternatives`, `tracked_sets`) that join to the parent to verify ownership
- [ ] **1.16** Create the `handle_new_user()` Postgres function that inserts a row into `profiles` when a new auth user is created
- [ ] **1.17** Create the `on_auth_user_created` trigger on `auth.users` that calls `handle_new_user()`
- [ ] **1.18** Run all migrations against the remote Supabase database (`npx supabase db push`)
- [ ] **1.19** Verify all tables, indexes, RLS policies, and the trigger exist in the Supabase Dashboard
- [ ] **1.20** Test: Create a user via SQL → verify `profiles` row is auto-created

---

### Phase 2 — Supabase Client & Auth Context

- [ ] **2.1** Create `src/services/supabaseClient.ts` — instantiate and export the Supabase client singleton
- [ ] **2.2** Add runtime validation: throw an error if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing
- [ ] **2.3** Create `src/contexts/AuthContext.tsx` with `AuthProvider` and `useAuth` hook
- [ ] **2.4** Implement `AuthProvider` logic: subscribe to `onAuthStateChange`, track `user`, `session`, and `loading` state
- [ ] **2.5** Implement `signUp(email, password)` function in AuthContext
- [ ] **2.6** Implement `signIn(email, password)` function in AuthContext
- [ ] **2.7** Implement `signOut()` function in AuthContext
- [ ] **2.8** Wrap `<App />` in `<AuthProvider>` inside `main.tsx`
- [ ] **2.9** Generate TypeScript types from the Supabase schema (`npx supabase gen types typescript`)
- [ ] **2.10** Save generated types to `src/types/supabase.ts`
- [ ] **2.11** Pass generated `Database` type to `createClient<Database>(...)` for full type safety

---

### Phase 3 — Auth UI

- [ ] **3.1** Create `src/components/Auth.tsx` component with login/sign-up form
- [ ] **3.2** Build the login form: email input, password input, "Log In" button
- [ ] **3.3** Build the sign-up form: email input, password input, confirm password input, "Create Account" button
- [ ] **3.4** Add toggle between login and sign-up modes ("Already have an account?" / "Need an account?")
- [ ] **3.5** Add client-side validation: email format, password minimum length (6+), confirm password match
- [ ] **3.6** Add error display: show Supabase auth error messages below the form
- [ ] **3.7** Add loading state: disable button and show spinner while auth request is in flight
- [ ] **3.8** Style the auth component to match the existing dark theme (zinc/orange palette, same fonts)
- [ ] **3.9** Add Framer Motion entrance/exit animations consistent with other screens
- [ ] **3.10** Update `App.tsx`: if `useAuth()` returns no user, render `<Auth />` instead of the app

---

### Phase 4 — Header & Navigation Updates

- [ ] **4.1** Update the header in `App.tsx` to display the logged-in user's email address
- [ ] **4.2** Add a "Log Out" button to the header that calls `signOut()`
- [ ] **4.3** Build a bottom tab bar component (`src/components/BottomNav.tsx`) with two tabs: "Workouts" and "History"
- [ ] **4.4** Style the tab bar: fixed bottom, dark background, orange active indicator, Lucide icons
- [ ] **4.5** Add a `currentTab` state to `App.tsx` (`'workouts' | 'history'`)
- [ ] **4.6** Conditionally render the workout flow (Setup/Dashboard/ActiveWorkout) or the History page based on `currentTab`
- [ ] **4.7** Hide the bottom tab bar when the user is on the Auth screen or in an active workout (full-screen experience)
- [ ] **4.8** Add Framer Motion tab-switch animation (slide left/right)

---

### Phase 5 — Service Layer — Plans

- [ ] **5.1** Create `src/services/plans.ts`
- [ ] **5.2** Implement `savePlan(userId, plan, daysPerWeek, goal, level)` — inserts into `workout_plans`, `plan_days`, `plan_exercises`, and `exercise_alternatives`  
- [ ] **5.3** Implement the `savePlan` function to deactivate any previously active plan (`is_active = false`) before inserting the new one
- [ ] **5.4** Implement `loadActivePlan(userId)` — fetches the user's active plan with all nested days, exercises, and alternatives
- [ ] **5.5** Transform the Supabase response back into the `WorkoutPlan` TypeScript type that the existing components expect
- [ ] **5.6** Implement `loadAllPlans(userId)` — fetches all plans (active and inactive) for the history page
- [ ] **5.7** Add error handling: throw descriptive errors if any Supabase operation fails
- [ ] **5.8** Add JSDoc comments to all public functions

---

### Phase 6 — Service Layer — Tracking

- [ ] **6.1** Create `src/services/tracking.ts`
- [ ] **6.2** Implement `saveTrackedWorkout(userId, planId, workout)` — inserts into `tracked_workouts` and `tracked_sets`
- [ ] **6.3** Handle the upsert case: if a tracked workout already exists for the same plan/week/day, update it instead of inserting a duplicate
- [ ] **6.4** Implement `loadTrackedWorkouts(userId, planId)` — fetches all tracked workouts for a plan with their sets
- [ ] **6.5** Transform the Supabase response back into the `TrackedWorkout[]` type that existing components expect
- [ ] **6.6** Add error handling and JSDoc comments

---

### Phase 7 — Service Layer — History

- [ ] **7.1** Create `src/services/history.ts`
- [ ] **7.2** Implement `getDistinctExercises(userId)` — returns an alphabetized list of unique exercise names the user has ever performed, with a count of sessions
- [ ] **7.3** Implement `getExerciseHistory(userId, exerciseName)` — returns all tracked sets for that exercise, grouped by workout date, including plan name and week/day info
- [ ] **7.4** Implement `getExercisePR(userId, exerciseName)` — returns the heaviest weight and highest volume (weight × reps) ever recorded
- [ ] **7.5** Implement `getProgressionData(userId, exerciseName)` — returns an array of `{ date, maxWeight }` points for the chart
- [ ] **7.6** Add error handling and JSDoc comments

---

### Phase 8 — Integrate Services into App Flow

- [ ] **8.1** Update `App.tsx` `handleGenerate`: after generating a plan via the API, call `savePlan()` to persist it to Supabase
- [ ] **8.2** Update `App.tsx` `handleCompleteWorkout`: call `saveTrackedWorkout()` to persist the workout to Supabase
- [ ] **8.3** Update `App.tsx` startup: call `loadActivePlan()` and `loadTrackedWorkouts()` on mount (after auth resolves)
- [ ] **8.4** Keep `localStorage` as a read-through cache: write to `localStorage` after successful Supabase writes; read from `localStorage` for instant mount, then reconcile with Supabase data
- [ ] **8.5** Update `resetPlan` to deactivate the plan in Supabase (not delete — we want history)
- [ ] **8.6** Add loading states while fetching from Supabase on initial mount
- [ ] **8.7** Add error handling UI: toast or inline error message if a Supabase write fails
- [ ] **8.8** Handle the edge case where `localStorage` has data but Supabase doesn't (first login) — trigger migration prompt

---

### Phase 9 — localStorage Migration

- [ ] **9.1** Create `src/services/migration.ts`
- [ ] **9.2** Implement `checkLocalStorageData()` — returns `true` if `jw_plan` or `jw_tracked` exist in localStorage
- [ ] **9.3** Implement `migrateLocalStorageToSupabase(userId)` — reads the localStorage data, writes it to Supabase using the plan/tracking services, and clears the old localStorage keys
- [ ] **9.4** Create a `MigrationPrompt.tsx` component — shown after first login if localStorage data exists
- [ ] **9.5** Style the migration prompt: "We found an existing workout plan on this device. Import it into your account?" with Yes/No buttons
- [ ] **9.6** Wire the migration prompt into `App.tsx`: show after auth resolves if `checkLocalStorageData()` returns true
- [ ] **9.7** On "Yes": call `migrateLocalStorageToSupabase()`, then reload data from Supabase
- [ ] **9.8** On "No": clear the localStorage data and continue with empty state

---

### Phase 10 — History Page UI

- [ ] **10.1** Create `src/components/History.tsx` — the main history page container
- [ ] **10.2** On mount, call `getDistinctExercises(userId)` to load the exercise list
- [ ] **10.3** Build the `ExerciseSearch` component — text input that filters the exercise list in real-time
- [ ] **10.4** Build the `ExerciseList` component — scrollable list of exercise names, each showing number of sessions logged
- [ ] **10.5** Build the `ExerciseListItem` component — tappable row with exercise name and session count badge
- [ ] **10.6** On exercise tap, call `getExerciseHistory()`, `getExercisePR()`, and `getProgressionData()` for that exercise
- [ ] **10.7** Build the `ExerciseDetail` component — shown when an exercise is selected (replaces or overlays the list)
- [ ] **10.8** Build the `PRBanner` component — displays the user's personal record for the selected exercise (heaviest single set)
- [ ] **10.9** Build the `ProgressChart` component — custom SVG line chart showing max weight over time
- [ ] **10.10** Implement the SVG chart: axes, data points, connecting line, hover/tap tooltips (date + weight)
- [ ] **10.11** Style the chart with the existing orange/zinc theme: orange line, zinc grid, dark background
- [ ] **10.12** Build the `SessionList` component — all workout sessions for this exercise, sorted newest first
- [ ] **10.13** Build the `SessionCard` component — date, plan name, and a set-by-set table (set #, weight, reps, completed?)
- [ ] **10.14** Add a "Back to list" button in the exercise detail view
- [ ] **10.15** Add Framer Motion animations: list entrance, detail slide-in, chart line draw animation
- [ ] **10.16** Add empty state: "No exercises tracked yet. Complete a workout to see your history here."
- [ ] **10.17** Add loading skeleton while history data is being fetched

---

### Phase 11 — Polish & Edge Cases

- [ ] **11.1** Handle auth session expiry gracefully: if a Supabase call returns a 401, redirect to the auth screen
- [ ] **11.2** Handle network errors on Supabase writes: show a retry-able error toast
- [ ] **11.3** Verify the app works correctly with no data (brand new user, no plans, no history)
- [ ] **11.4** Verify the app works correctly when a user has multiple old (inactive) plans
- [ ] **11.5** Verify the history page correctly aggregates data across multiple plans
- [ ] **11.6** Verify exercise name matching works across plans (same exercise from different plan generations)
- [ ] **11.7** Verify the bottom nav doesn't overlap content on short screens (add proper bottom padding)
- [ ] **11.8** Verify the app looks good on iPhone SE (small screen), iPhone 14/15 (medium), and tablet widths
- [ ] **11.9** Verify RLS: log in as User A, create data, then log in as User B, verify absolutely no User A data is visible via the Supabase client or in the UI
- [ ] **11.10** Check bundle size impact of `@supabase/supabase-js` — should be ~15-20kb gzipped
- [ ] **11.11** Run `npm run build` and verify no TypeScript errors
- [ ] **11.12** Run `npm run lint` and resolve any issues
- [ ] **11.13** Test the full flow end-to-end: sign up → generate plan → complete workout → view history → log out → log in → all data present
- [ ] **11.14** Test the migration flow end-to-end: have localStorage data → sign up → import prompt → import → verify data in Supabase

---

### Phase 12 — Deployment

- [ ] **12.1** Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Cloudflare Pages environment variables for **both** Production and Preview environments
- [ ] **12.2** Push to GitHub → verify Cloudflare Pages triggers a build
- [ ] **12.3** Verify the build succeeds
- [ ] **12.4** Smoke test the deployed app: sign up, generate plan, track workout, check history
- [ ] **12.5** Verify the Cloudflare function (`/api/generate-plan`) still works correctly
- [ ] **12.6** Check the Supabase Dashboard: verify rows were created by the deployed app
- [ ] **12.7** Final RLS verification on production: attempt to access data via the anon key directly (should be blocked without a valid JWT)

---

**Total tasks: 107**  
**Estimated implementation time: 3–4 focused work sessions**

Let's not rush this. We do it right, we do it once. Ready when you are, Jacob.
