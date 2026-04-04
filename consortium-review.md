# Consortium Review — Jacob's Workout Assistant

_A full-stack code review, gap analysis, and implementation roadmap by five senior engineers._

---

## Meet the Consortium

### 1. Elena Vasquez — Lead UI/UX Engineer
**Title:** Principal UI/UX Designer & Design Systems Lead  
**Experience:** 14 years designing mobile-first fitness, health-tech, and consumer SaaS products. Led design at Peloton Interactive and Fitbod. Specialist in motion design, accessibility, and conversion-optimized onboarding flows.

### 2. Marcus Chen — Senior Full-Stack Engineer
**Title:** Staff Full-Stack Engineer  
**Experience:** 12 years across React/TypeScript frontends and serverless backends. Former tech lead at Strava's web team. Deep expertise in Cloudflare Workers, D1, and edge-compute architectures. Obsessive about data integrity and offline resilience.

### 3. Devin Okafor — Senior Backend Engineer
**Title:** Principal Backend Engineer & Data Architect  
**Experience:** 15 years building APIs, database schemas, and distributed systems. Led backend at WHOOP and MyFitnessPal. Specialist in SQLite/D1 query optimization, schema migrations, and HIPAA-adjacent data handling.

### 4. Priya Sharma — Senior Web App Designer
**Title:** Director of Product Design  
**Experience:** 11 years shipping consumer fitness apps from zero to millions of users. Former design director at Nike Training Club. Focuses on progressive disclosure, behavioral nudges that keep athletes coming back, and workout UX that doesn't get in the way mid-set.

### 5. Tomás Rodríguez — Senior Web App Designer
**Title:** Lead Design Engineer  
**Experience:** 10 years bridging design and engineering. Formerly at Apple Fitness+ web team. Specialist in performance-sensitive UI, Tailwind design systems, animation budgets on low-end devices, and responsive layouts that feel native on every phone.

---

## File-by-File Audit Summary

We have read every file in this repository. Below is a one-line summary of each:

| File | Summary |
|------|---------|
| `index.html` | Root HTML shell; sets viewport, theme-color, mobile web-app meta tags, mounts `#root`. |
| `jacob_feedback.md` | User feedback organized by severity (red/yellow/green/white) with priority notes. |
| `metadata.json` | AI Studio app metadata — name, description, permissions. |
| `package.json` | Project manifest: Vite + React 19 + TailwindCSS 4, Cloudflare Workers types, motion library. |
| `README.md` | Onboarding instructions for local dev (npm install, set API key, npm run dev). |
| `tsconfig.json` | TypeScript config: ES2022 target, bundler resolution, react-jsx, path aliases. |
| `vite.config.ts` | Vite dev config: React + Tailwind plugins, `@` alias, proxy `/api` to Wrangler at :8788. |
| `wrangler.toml` | Cloudflare Pages config: project name, D1 database binding (`workout-db`). |
| `d1/schema.sql` | Full D1/SQLite schema: users, sessions, workout_plans, plan_days, plan_exercises, exercise_alternatives, tracked_workouts, tracked_sets, weekly_notes. |
| `functions/api/generate-plan.ts` | POST endpoint: calls OpenAI GPT-4.1-mini in parallel (per-day + metadata), applies superset rules, builds 4-week progressive plan with exercise rotation and volume ramping. |
| `functions/api/tracking.ts` | GET/POST: loads & saves tracked workouts + sets for a plan. Uses batch inserts. |
| `functions/api/weekly-notes.ts` | GET/POST: loads & saves weekly reflection notes per plan per week. |
| `functions/api/_shared/crypto.ts` | PBKDF2 password hashing/verification using Web Crypto API (Workers-compatible). |
| `functions/api/_shared/session.ts` | Session helpers: create/validate/delete sessions via HTTP-only cookies in D1. |
| `functions/api/_shared/types.ts` | Shared `Env` and `AuthData` interfaces for all Pages Functions. |
| `functions/api/auth/login.ts` | POST: authenticates user with email/password, creates session, sets cookie. |
| `functions/api/auth/logout.ts` | POST: deletes session from D1, clears cookie. |
| `functions/api/auth/me.ts` | GET: returns current user from session cookie (or null). |
| `functions/api/auth/signup.ts` | POST: creates user account with email validation and password hashing, sets session cookie. |
| `functions/api/history/exercise.ts` | GET: returns full set-by-set history for a specific exercise across all plans. |
| `functions/api/history/exercises.ts` | GET: returns distinct exercise names the user has logged, with session counts. |
| `functions/api/history/pr.ts` | GET: returns personal records (max weight, max volume) for an exercise. |
| `functions/api/history/progression.ts` | GET: returns max weight per session date for charting progression. |
| `functions/api/plans/deactivate.ts` | POST: sets `is_active = 0` on a plan. |
| `functions/api/plans/history.ts` | GET: returns all plans for a user (active + inactive) ordered by creation date. |
| `functions/api/plans/index.ts` | GET: loads active plan with all days/exercises/alternatives. POST: saves new plan, deactivates old ones, batch-inserts days/exercises/alternatives. |
| `src/App.tsx` | Root component: orchestrates auth, setup, plan generation, active workout, dashboard, and history views. Manages localStorage caching + server sync. |
| `src/index.css` | Global styles: Space Grotesk + IBM Plex Mono fonts, custom Tailwind theme tokens, dark background gradients, scrollbar/input styling. |
| `src/main.tsx` | React entry point: renders `<App>` inside `<AuthProvider>` in StrictMode. |
| `src/types.ts` | Shared TypeScript interfaces: Alternative, Exercise, WorkoutDay, WorkoutWeek, WorkoutPlan, TrackedSet, TrackedExercise, TrackedWorkout, WeeklyNote. |
| `src/vite-env.d.ts` | Vite type references + `__DEV_API_KEY__` global declaration. |
| `src/components/ActiveWorkout.tsx` | Full workout execution screen: set tracking inputs, rest timer, superset paired cards, exercise swapping, custom exercises, auto-save to localStorage & server, celebration overlay on finish. |
| `src/components/Auth.tsx` | Login/signup form with validation, password visibility toggle, branded hero card. |
| `src/components/BottomNav.tsx` | Fixed bottom tab bar: Workouts and History tabs. |
| `src/components/Dashboard.tsx` | Plan overview: progress ring, week selector, day cards with exercise previews, weekly notes, resume in-progress session banner. |
| `src/components/History.tsx` | Exercise history browser: searchable exercise list, per-exercise detail view with PR banner, progression chart, session-by-session set log. |
| `src/components/ProgressChart.tsx` | Custom SVG line chart for weight progression over time. Zero dependencies. |
| `src/components/Setup.tsx` | Multi-step onboarding wizard: days/week, goal, secondary goal, level, superset toggle. |
| `src/services/history.ts` | Fetch wrappers for history API endpoints (exercises list, exercise detail, PR, progression). |
| `src/services/openai.ts` | Client-side fetch wrapper for `/api/generate-plan` endpoint. |
| `src/services/plans.ts` | Fetch wrappers for plan CRUD (save, load active, load all, deactivate). |
| `src/services/tracking.ts` | Fetch wrappers for tracking + weekly notes API endpoints. |

---

## Current State Assessment

### What's Working Well
- **Solid architecture.** Cloudflare Pages + D1 is a good serverless stack. The API key stays server-side. Sessions use HTTP-only cookies with PBKDF2. No OWASP red flags.
- **Good developer ergonomics.** Vite + React + Tailwind v4.1, proxy config for local dev, TypeScript throughout.
- **Plan generation is clever.** Parallel OpenAI calls per day, structured JSON output, progressive weekly variation (exercise rotation, volume ramping, deload in week 4).
- **Superset handling.** Complex but functional: pair detection, level-gated superset limits, fallback stripping of orphaned superset text.
- **Active workout UX.** Auto-save to localStorage (survives phone lock), debounced server sync, rest timer with sticky banner, exercise swapping, custom exercise addition.
- **The UI is sharp.** Custom design tokens, motion animations, dark theme feels intentional — not generic.

### What's Broken (Red Items from Feedback)

1. **Custom exercises don't persist if the app closes before "Finish Workout."**
   - **Root cause:** Custom exercises ARE saved to localStorage in `jw_active_session`. They're also auto-saved to the server via `onAutoSave`. BUT: when loading from `existingWorkout` (server data), the restoration logic in `ActiveWorkout.tsx` only validates against `workoutDay.exercises` — the plan exercises. Custom exercises (those beyond `planLen`) are appended correctly from localStorage, but if the user closes the app and the session is resumed from *server data* (not localStorage), there's a race condition: if localStorage is cleared (e.g., different device, cache clear), server data is the only source, and the server DOES save custom exercises (they're in the tracked sets). However, when reloading from `existingWorkout`, the exercises beyond `planLen` are preserved. The real issue is that if the session is NOT completed and the user navigates away, the `activeWorkout` state is cleared (`setActiveWorkout(null)`), but `localStorage` still has the incomplete session. On return, the Dashboard shows the "Resume" banner. The bug likely manifests when: the in-progress session has custom exercises → user force-closes the app → re-opens → the `existingWorkout` from the server has the in-progress data → custom exercises are there. **Need to verify:** the server auto-save path actually includes custom exercises in the `exercises` array. Looking at `handleAutoSave`, it sends the full `trackedData` array (which includes custom exercises). The server `tracking.ts` saves all exercises by name. On reload, `loadTrackedWorkouts` returns them. The restoration code in `ActiveWorkout` does `existingWorkout.exercises.slice(planLen)` for custom exercises. This should work. **Likely actual bug:** timing issue — the auto-save may fire before the custom exercise is fully added, or the 2-second debounce means the last custom exercise isn't saved if the app closes within 2 seconds. The `visibilitychange` handler should catch this, but on force-close it won't fire.

2. **Custom exercises don't carry forward to future weeks.**
   - **Root cause:** Each week/day combination creates a fresh `TrackedWorkout`. Custom exercises are only stored in the tracked data, not in the plan itself. When the user starts Week 2 Day 1, the initialization logic creates fresh tracked data from `workoutDay.exercises` (the plan template). Custom exercises from Week 1 Day 1 are not carried over because there's no mechanism to do so. The plan's exercises are stored in `plan_exercises` and don't include custom ones.

3. **Push/Pull/Legs only available for 3 days/week.**
   - **Root cause:** `getSplitConfig()` in `generate-plan.ts` hard-codes split names per frequency: 3 → PPL, 4 → Bro Split, 5 → Classic Bro, 6 → Arnold. PPL for 6 days (PPL × 2) is not offered. The Setup wizard doesn't let users choose a split — it's auto-assigned by day count.

---

## Implementation Plan

The consortium has analyzed all feedback items, cross-referenced them against the codebase, and organized fixes into an optimized execution order. Tasks are grouped into phases that minimize rework, avoid introducing regressions, and address dependencies in the correct sequence.

### Phase 1: Schema & Data Layer Foundations
_These changes touch the database and backend first, because UI features in later phases depend on them._

### Phase 2: Bug Fixes (Red Items)
_Fix the broken behavior that makes the app feel unreliable._

### Phase 3: Core Feature Gaps (Yellow Items)
_Complete the product promises._

### Phase 4: High-Value Additions (Green Items)  
_Real training features that make the app good._

### Phase 5: Polish & Hardening
_Edge cases, performance, and quality-of-life improvements surfaced during review._

---

## Master Task List

> **Reading guide:** Tasks are ordered for execution — each task's dependencies are satisfied by prior tasks. Tasks within the same sub-group can be parallelized. Severity tags: 🔴 Bug, 🟡 Gap, 🟢 Addition, ⚙️ Infrastructure.

---

### PHASE 1 — Schema & Data Layer Foundations

- [ ] **1.1** ⚙️ **Add `split_type` column to `workout_plans` table.** Add `ALTER TABLE workout_plans ADD COLUMN split_type TEXT;` to schema. This column stores the user's chosen split (PPL, Arnold, Bro, Upper/Lower, Full Body) independently from `days_per_week`, enabling PPL at 6 days. Update the `POST /api/plans` handler to accept and store `splitType`.

- [ ] **1.2** ⚙️ **Add `custom_exercises` table to D1 schema.** Create a table that links custom exercises to a plan + day, so they persist across weeks:
  ```sql
  CREATE TABLE IF NOT EXISTS custom_exercises (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    sets INTEGER NOT NULL DEFAULT 3,
    position INTEGER NOT NULL DEFAULT 99,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
  This table allows custom exercises to carry forward to all weeks for their respective day.

- [ ] **1.3** ⚙️ **Add `body_weights` table to D1 schema.** For bodyweight tracking:
  ```sql
  CREATE TABLE IF NOT EXISTS body_weights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight REAL NOT NULL,
    weight_unit TEXT NOT NULL DEFAULT 'lbs' CHECK (weight_unit IN ('kg', 'lbs')),
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_body_weights_user ON body_weights(user_id, recorded_at);
  ```

- [ ] **1.4** ⚙️ **Add `user_preferences` table to D1 schema.** Stores expanded onboarding data (mobility goals, stretching preferences, default weight unit, etc.):
  ```sql
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_weight_unit TEXT NOT NULL DEFAULT 'lbs',
    mobility_focus TEXT,
    stretching_goals TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```

- [ ] **1.5** ⚙️ **Create migration script.** Write a `d1/migrations/001_add_tables.sql` that applies 1.1–1.4 non-destructively to an existing database. Test with `wrangler d1 execute`.

---

### PHASE 2 — Bug Fixes (Red Items)

- [ ] **2.1** 🔴 **Fix custom exercises not persisting on app close.** In `ActiveWorkout.tsx`, flush the auto-save immediately (bypass the 2s debounce) when adding or removing a custom exercise. Also add a `beforeunload` event listener as a safety net alongside the existing `visibilitychange` handler. Ensure the `onAutoSave` callback fires synchronously on custom exercise add/remove.

- [ ] **2.2** 🔴 **Build CRUD API for custom exercises.** Create `functions/api/custom-exercises.ts`:
  - `GET /api/custom-exercises?planId=xxx&dayNumber=yyy` — returns custom exercises for a plan day.
  - `POST /api/custom-exercises` — adds a custom exercise to a plan day.
  - `DELETE /api/custom-exercises` — removes a custom exercise.
  These persist custom exercises at the *plan* level (not just tracked workout level).

- [ ] **2.3** 🔴 **Carry custom exercises forward to future weeks.** When `ActiveWorkout` initializes, fetch custom exercises for the current `planId + dayNumber` from the new API. Merge them into the initial `trackedData` state alongside the plan's built-in exercises. When the user adds a custom exercise mid-workout, also POST it to the custom exercises API so it appears on future weeks.

- [ ] **2.4** 🔴 **Allow split selection independent of day count.** Refactor `getSplitConfig()` in `generate-plan.ts` to support multiple split options per day count:
  - 3 days: PPL, Full Body, Upper/Lower+Full
  - 4 days: Upper/Lower (×2), Bro Split, PPL+Full
  - 5 days: Bro Split, Upper/Lower+PPL, PHAT
  - 6 days: PPL (×2), Arnold, Push/Pull/Legs+Upper/Lower
  
  Expose a new `splitType` parameter in the API. Default to the current behavior if not specified (backwards-compatible).

- [ ] **2.5** 🔴 **Add split selection step to Setup wizard.** In `Setup.tsx`, insert a new step between "Days" and "Goal" that shows available splits for the selected day count. The user picks their preferred split. Pass `splitType` through to `generateWorkoutPlan()`. Update `onGenerate` signature and all call sites.

---

### PHASE 3 — Core Feature Gaps (Yellow Items)

- [ ] **3.1** 🟡 **AI-suggested rep/set ranges for custom exercises.** When a user adds a custom exercise, make an API call to a new endpoint `POST /api/suggest-exercise` that sends the exercise name + user's goal/level to OpenAI and returns suggested sets, reps, rest, and expert advice. Pre-fill the custom exercise with these suggestions. Fall back to sensible defaults (3×10) if the API call fails.

- [ ] **3.2** 🟡 **Create new endpoint `POST /api/suggest-exercise`.** In `functions/api/suggest-exercise.ts`, call OpenAI with the exercise name, user goal, and level. Return `{ sets, reps, rest, expertAdvice }`. Use a small, fast model call (gpt-4.1-mini, ~200 tokens, structured output).

- [ ] **3.3** 🟡 **Build a fully custom workout builder.** Add a new "Build from Scratch" option on the Setup screen. This flow lets the user:
  1. Choose days/week and split type.
  2. For each day, set the focus/muscle group.
  3. For each day, add exercises manually (with auto-suggest for rep/set ranges via 3.2).
  4. Save the custom plan through the existing `POST /api/plans` endpoint (same schema, just user-composed data instead of AI-generated).
  Add a new component `CustomPlanBuilder.tsx` for this flow.

- [ ] **3.4** 🟡 **Define program continuity past Week 4.** Currently the plan has exactly 4 weeks and stops. Implement a "Program Continuity" system:
  - When Week 4 is completed, show a "Program Complete" modal with three options:
    1. **Loop** — Restart from Week 1 with the same plan (reset tracked workouts, keep history).
    2. **Progress** — Generate a new plan seeded with the current plan's exercises but with progressive overload applied (5-10% weight increase suggestions, potential exercise rotations).
    3. **New Plan** — Go back to Setup for a completely new program.
  - Add a `cycle_number` column to `tracked_workouts` or add a plan-level metadata field.
  - In the Dashboard, update the week selector to handle cycles (Cycle 1: Weeks 1-4, Cycle 2: Weeks 5-8, etc.).

- [ ] **3.5** 🟡 **Build "Program Complete" modal component.** Create `ProgramComplete.tsx` that shows when all 4 weeks × all days are completed. Offers Loop / Progress / New Plan options. Wired into `Dashboard.tsx`.

- [ ] **3.6** 🟡 **Build "Progress" plan generation.** Create a new endpoint or extend `POST /api/generate-plan` to accept an `existingPlan` parameter. When provided, the prompt instructs GPT to build upon the previous plan: keep ~60% of exercises, rotate ~40%, bump suggested weights by 5-10%.

---

### PHASE 4 — High-Value Additions (Green Items)

- [ ] **4.1** 🟢 **Progressive overload suggestions.** In the `ActiveWorkout` screen, when the user expands an exercise, show a small banner above the set inputs: "Last session: 135 lbs × 8. Try 140 lbs × 8 today." Pull this from the most recent tracked set for the same exercise. Use the existing `history/exercise` API on the client side (cache the result for the session). Add a helper function `getLastSessionData(exerciseName)` to `services/history.ts` that returns the last completed sets.

- [ ] **4.2** 🟢 **Display progressive overload data in ActiveWorkout.** Modify `ActiveWorkout.tsx`:
  - On mount, fetch last session data for all exercises in the current day (single batch or parallel calls).
  - For each exercise, show a "Previous" row above the set inputs displaying last session's weight × reps.
  - Optionally pre-fill the weight input with last session's weight (user can override).

- [ ] **4.3** 🟢 **Auto-insert deload weeks.** Modify the plan progression logic:
  - After every 3 cycles (12 weeks), or if the user manually triggers it, generate a deload week: reduce volume by ~40% (fewer sets, same exercises, same weight or lighter).
  - Add a "Deload Week" button in the Dashboard that generates a modified Week with reduced volume.
  - In the auto-generated progressive plan (3.6), every 4th cycle should be a deload.

- [ ] **4.4** 🟢 **Build bodyweight tracking feature.** Create:
  - `POST /api/body-weight` — Save a weight entry.
  - `GET /api/body-weight` — Get weight history.
  - New component `BodyWeightTracker.tsx`: simple input card + line chart showing bodyweight over time.
  - Add a "Body" tab to `BottomNav` or embed the tracker in the Dashboard as a collapsible card.

- [ ] **4.5** 🟢 **Expand onboarding questions.** In `Setup.tsx`, add optional steps after Level:
  - **Mobility focus:** Do you want mobility/stretching exercises included? (Yes/No)
  - **Specific mobility areas:** Shoulders, hips, ankles, thoracic spine (multi-select)
  - Pass these preferences to `generate-plan.ts` to include warm-up/cool-down mobility work.
  - Save preferences to the `user_preferences` table (1.4).

- [ ] **4.6** 🟢 **Update plan generation prompt for mobility.** Modify `buildDayPrompt()` to include mobility/stretching instructions when user preferences indicate it. E.g., "Include 1-2 mobility exercises as a warm-up targeting [hip flexors, thoracic spine]."

---

### PHASE 5 — Polish & Hardening

- [ ] **5.1** ⚙️ **Prevent data loss on force-close.** Supplement the current `visibilitychange` and debounced save with:
  - `navigator.sendBeacon()` on `visibilitychange` to reliably POST data even when the tab is being killed.
  - Service Worker `beforeinstallprompt` or `pagehide` event for additional coverage.

- [ ] **5.2** ⚙️ **Harden the split config for edge cases.** The current `getSplitConfig` returns 1-2 day configs as "Full Body." Ensure these configs generate valid plans. Add validation: `daysPerWeek` must be 1-7, and split configs must exist for all values.

- [ ] **5.3** ⚙️ **Add proper error boundaries.** Wrap the main app sections in React error boundaries so one crashed component (e.g., chart rendering) doesn't blank-screen the whole app. Add a `ErrorBoundary.tsx` component.

- [ ] **5.4** ⚙️ **Add loading/error states for plan history.** The `History` tab loads data but has minimal error handling. Add retry buttons on failure, empty states for partial data, and skeleton loaders that match the design system.

- [ ] **5.5** ⚙️ **Optimize D1 queries in tracking.ts.** The current `handleGet` does `IN (${placeholders})` which can break at ~999 parameters (SQLite limit). Add pagination or batch the query for large workout histories. Not urgent now but will matter at scale.

- [ ] **5.6** ⚙️ **Add weight unit consistency.** The history endpoints currently hardcode "lbs" in the display. Respect the user's `weightUnit` preference from the tracked sets. Pass it through to `History.tsx` and `ProgressChart.tsx`.

- [ ] **5.7** ⚙️ **Session expiry cleanup cron.** Expired sessions are only cleaned up lazily (on validate). Add a Cloudflare Cron Trigger that runs daily to `DELETE FROM sessions WHERE expires_at < datetime('now')`.

- [ ] **5.8** ⚙️ **Rate limit auth endpoints.** Currently no rate limiting on `/api/auth/login` and `/api/auth/signup`. Add basic Cloudflare rate limiting rules or in-app throttling to prevent brute-force attacks.

- [ ] **5.9** ⚙️ **Add PWA manifest and service worker.** The app sets `mobile-web-app-capable` meta tags but lacks a `manifest.json` and service worker. Add these for proper "Add to Home Screen" support and offline caching of the app shell.

- [ ] **5.10** ⚙️ **Unify localStorage key management.** The app uses `jw_plan`, `jw_tracked`, `jw_active_session` scattered across files. Centralize these in `App.tsx`'s `STORAGE_KEYS` and ensure all reads/writes go through that single source of truth.

---

## Execution Priority Matrix

| Priority | Phase | Tasks | Rationale |
|----------|-------|-------|-----------|
| **P0 — Now** | Phase 1 | 1.1, 1.2, 1.5 | Schema must exist before any feature work. |
| **P0 — Now** | Phase 2 | 2.1, 2.2, 2.3 | Custom exercise bugs are the most visible user pain. |
| **P1 — Next** | Phase 2 | 2.4, 2.5 | Split selection is a UX gap users hit in onboarding. |
| **P1 — Next** | Phase 1 | 1.3, 1.4 | Schema for bodyweight and preferences (needed by Phase 4). |
| **P2 — Soon** | Phase 3 | 3.1, 3.2, 3.3 | Core feature gaps that complete the product promise. |
| **P2 — Soon** | Phase 3 | 3.4, 3.5, 3.6 | Program continuity is the biggest missing piece for retention. |
| **P3 — After** | Phase 4 | 4.1, 4.2 | Progressive overload is the #1 feature that makes users feel the app is "coaching" them. |
| **P3 — After** | Phase 4 | 4.3, 4.4, 4.5, 4.6 | Deload, bodyweight, mobility — real training features. |
| **P4 — Ongoing** | Phase 5 | 5.1–5.10 | Hardening. Do alongside or after feature work. |

---

## Dependencies Graph

```
1.1 (split_type column) ──→ 2.4 (split config) ──→ 2.5 (split picker UI)
1.2 (custom_exercises table) ──→ 2.2 (custom exercises API) ──→ 2.3 (carry forward)
                                                              ──→ 2.1 (persist fix)
                                                              ──→ 3.1 (AI suggestions) ──→ 3.2 (suggest endpoint)
1.3 (body_weights table) ──→ 4.4 (bodyweight tracker)
1.4 (user_preferences table) ──→ 4.5 (expanded onboarding) ──→ 4.6 (mobility prompts)
3.4 (continuity design) ──→ 3.5 (modal) ──→ 3.6 (progress generation)
                                          ──→ 4.3 (deload weeks)
4.1 (overload data) ──→ 4.2 (overload UI)
```

---

## Notes from Each Consortium Member

**Elena (UI/UX):** "The design system is surprisingly cohesive for what looks like a solo build. My main concern is the Setup wizard — it needs the split selection step badly. Secondary: the ActiveWorkout screen is dense; progressive overload hints will make it feel like a coach, not just a tracker."

**Marcus (Full-Stack):** "The auto-save architecture is solid but has a 2-second blind spot on force-close. `sendBeacon` fixes that. The bigger concern is the custom exercises table — right now custom exercises live in tracked_sets which means they're ephemeral. The new table makes them first-class citizens."

**Devin (Backend):** "The D1 schema is clean. My additions (custom_exercises, body_weights, user_preferences) follow the same patterns. The big schema concern is program continuity — we'll need either a cycle counter or a plan-versioning system. I'm recommending a simple `cycle_number` on tracked_workouts for now."

**Priya (Product Design):** "The app's biggest retention gap is what happens after Week 4. Users will open the app, see '100% complete' and have nowhere to go. The Program Complete modal with Loop/Progress/New is essential. Also: progressive overload suggestions are table stakes for any serious lifting app."

**Tomás (Design Engineering):** "Performance is good — the motion library is lightweight and the SVG chart has zero dependencies. I'd flag the ActiveWorkout component at ~1200 lines as a candidate for extraction once features stabilize. For now, focus on features, refactor after."

---

_Review completed by the consortium. All five members have read every file, cross-referenced the feedback, and agreed on this plan._
