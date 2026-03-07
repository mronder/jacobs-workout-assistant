# Cloudflare-Only Architecture — Migration Plan

> **Status:** Planning · Do not execute yet  
> **Created:** March 2, 2026

---

## The Team

### Marcus Chen — Full Stack Engineer
**Title:** Senior Full-Stack Engineer  
**Experience:** 9 years building production web applications. Former lead engineer at a Series B fitness-tech startup (30K DAU). Deep expertise in React, TypeScript, serverless architectures, and database design. Has migrated three production apps off Supabase/Firebase onto self-owned stacks. Believes in owning every layer of the stack you depend on.

### Sofia Reyes — Web App Designer & Front-End Architect
**Title:** Principal UI/UX Engineer  
**Experience:** 11 years in product design and front-end architecture. Previously design lead at Peloton's digital team. Specializes in progressive web apps, offline-first patterns, and seamless auth flows. Her philosophy: if the user can tell infrastructure changed, the migration failed.

### David Park — Cloudflare Platform Engineer
**Title:** Staff Platform Engineer — Cloudflare Ecosystem  
**Experience:** 7 years focused exclusively on Cloudflare Workers, Pages, D1, KV, Durable Objects, and R2. Previously on Cloudflare's developer relations team. Has architected Cloudflare-native stacks for apps handling millions of requests/day. Wrote the internal best-practices guide for D1 schema design.

---

## Why Remove Supabase?

### The Problem

Right now this app depends on **two separate cloud platforms** for what is ultimately a simple CRUD + auth app:

| Concern | Current Owner | Problem |
|---------|--------------|---------|
| Static hosting | Cloudflare Pages | ✅ Fine |
| API (OpenAI proxy) | Cloudflare Pages Functions | ✅ Fine |
| Auth (signup, login, sessions) | Supabase Auth | ❌ Extra vendor |
| Database (plans, tracking, history) | Supabase Postgres | ❌ Extra vendor |
| Type generation | `supabase` CLI + generated types | ❌ Extra tooling |

That's **two dashboards**, **two sets of API keys**, **two billing accounts**, and **two failure domains** for an app whose data model fits in ~7 tables. Every new feature requires checking "does this need a Supabase migration?" separately from the codebase.

### The Solution

Consolidate everything onto **Cloudflare**:

| Concern | New Owner | Why |
|---------|-----------|-----|
| Static hosting | Cloudflare Pages | Already here |
| API | Cloudflare Pages Functions (Workers) | Already here |
| Auth | **Cloudflare Workers + D1** (custom JWT auth) | Simple email/password — we don't need Supabase's full auth suite |
| Database | **Cloudflare D1** (SQLite at the edge) | Relational, SQL-based, zero-config, same deploy pipeline |
| Sessions | **HTTP-only cookies + JWT** | Industry standard, simpler than Supabase's token refresh dance |

### What the user sees change

**Nothing.** Same login screen, same workout tracking, same history page. The auth tokens rotate silently. The data is the same shape. We migrate existing Supabase data into D1 as part of the cutover.

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│         Cloudflare Pages            │
│  ┌───────────┐  ┌────────────────┐  │
│  │  Static   │  │  Pages         │  │
│  │  Assets   │  │  Functions     │  │
│  │  (React)  │  │  (Workers)     │  │
│  └───────────┘  └──────┬─────────┘  │
│                        │             │
│              ┌─────────┴──────────┐  │
│              │                    │  │
│         ┌────▼────┐        ┌─────▼─┐│
│         │   D1    │        │ OpenAI ││
│         │ Database│        │  API   ││
│         └─────────┘        └───────┘│
└─────────────────────────────────────┘
```

**One platform. One deploy. One billing account. One dashboard.**

---

## D1 Database Schema

The schema mirrors what's in Supabase today but uses SQLite syntax and adds a `users` table for our own auth:

```sql
-- 1. users (replaces Supabase auth.users + profiles)
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. sessions (server-managed, replaces Supabase JWTs)
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- 3. workout_plans
CREATE TABLE workout_plans (
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
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_plans_user ON workout_plans(user_id);

-- 4. plan_days
CREATE TABLE plan_days (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  plan_id    TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  focus      TEXT NOT NULL
);

-- 5. plan_exercises
CREATE TABLE plan_exercises (
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
CREATE TABLE exercise_alternatives (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  exercise_id        TEXT NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  expert_advice      TEXT,
  video_search_query TEXT
);

-- 7. tracked_workouts
CREATE TABLE tracked_workouts (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id      TEXT NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  week_number  INTEGER NOT NULL,
  day_number   INTEGER NOT NULL,
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tracked_user ON tracked_workouts(user_id, plan_id);

-- 8. tracked_sets
CREATE TABLE tracked_sets (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tracked_workout_id  TEXT NOT NULL REFERENCES tracked_workouts(id) ON DELETE CASCADE,
  exercise_name       TEXT NOT NULL,
  set_number          INTEGER NOT NULL,
  weight              REAL NOT NULL DEFAULT 0,
  reps                INTEGER NOT NULL DEFAULT 0,
  completed           INTEGER NOT NULL DEFAULT 0,
  weight_unit         TEXT NOT NULL DEFAULT 'lbs' CHECK (weight_unit IN ('kg', 'lbs')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sets_workout ON tracked_sets(tracked_workout_id);
CREATE INDEX idx_sets_exercise ON tracked_sets(exercise_name, created_at);
```

### Key differences from Supabase schema:
- **UUIDs → hex strings** (SQLite has no native UUID type; `randomblob(16)` is equivalent)
- **Booleans → INTEGER 0/1** (SQLite convention)
- **timestamptz → TEXT** with ISO 8601 strings (D1 best practice)
- **No RLS** — auth is enforced in the Workers layer (WHERE user_id = ?) rather than at the database level

---

## API Routes (Pages Functions)

All API routes live under `functions/api/`. Each file is a Cloudflare Pages Function (Worker).

### New routes to create:

| Route | Method | Purpose | Replaces |
|-------|--------|---------|----------|
| `/api/auth/signup` | POST | Create account, hash password, return session cookie | `supabase.auth.signUp()` |
| `/api/auth/login` | POST | Verify password, return session cookie | `supabase.auth.signInWithPassword()` |
| `/api/auth/logout` | POST | Delete session, clear cookie | `supabase.auth.signOut()` |
| `/api/auth/me` | GET | Return current user from session cookie | `supabase.auth.getSession()` |
| `/api/plans` | GET | Load active plan | `loadActivePlan()` |
| `/api/plans` | POST | Save new plan | `savePlan()` |
| `/api/plans/deactivate` | POST | Deactivate plan | `deactivatePlan()` |
| `/api/plans/history` | GET | All plans for user | `loadAllPlans()` |
| `/api/tracking` | GET | Load tracked workouts | `loadTrackedWorkouts()` |
| `/api/tracking` | POST | Save tracked workout | `saveTrackedWorkout()` |
| `/api/history/exercises` | GET | Distinct exercises | `getDistinctExercises()` |
| `/api/history/exercise` | GET | Exercise history | `getExerciseHistory()` |
| `/api/history/pr` | GET | Personal records | `getExercisePR()` |
| `/api/history/progression` | GET | Progression data | `getProgressionData()` |
| `/api/generate-plan` | POST | Generate plan (already exists) | Already on CF |

### Auth Strategy — Custom JWT in HTTP-Only Cookies

**Why not use a third-party auth provider?**  
This app only needs email + password. Adding Auth0, Clerk, or keeping Supabase Auth just for login is overkill. A simple bcrypt + cookie pattern is battle-tested, has zero external dependencies, and runs entirely on Cloudflare.

**How it works:**

1. **Signup:** Hash password with `bcrypt` (via the Web Crypto API polyfill in Workers). Insert into `users`. Create `sessions` row. Set HTTP-only cookie with session ID.
2. **Login:** Verify password hash. Create session. Set cookie.
3. **Every request:** Middleware reads cookie → looks up session in D1 → injects `userId` into handler context. If expired or missing → 401.
4. **Logout:** Delete session row + clear cookie.
5. **Session expiry:** 30 days. Background cleanup via Cron Trigger (optional) or lazy deletion on read.

**Security checklist:**
- [x] Passwords never stored in plaintext (bcrypt)
- [x] Session tokens are opaque random strings (not JWTs with user data)
- [x] Cookies: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api`
- [x] No CORS issues — everything same-origin on Cloudflare Pages
- [x] Rate limiting via Cloudflare's built-in tools

---

## Front-End Changes

### Sofia's Design Philosophy

> *"The user must not know we changed anything. Same screens, same flows, same speed. The only observable difference should be that it feels slightly faster (edge-located D1 vs. centralized Supabase Postgres)."*

### Files to delete:
- `src/services/supabaseClient.ts` — The Supabase client singleton
- `src/types/supabase.ts` — Auto-generated Supabase types (420 lines of boilerplate)
- `src/services/migration.ts` — Supabase migration utility (no longer needed)
- `src/components/MigrationPrompt.tsx` — UI for the old migration flow
- `supabase/migrations/*` — All Supabase SQL migrations

### Files to rewrite:
| File | What changes |
|------|-------------|
| `src/contexts/AuthContext.tsx` | Replace Supabase auth calls with `fetch('/api/auth/...')`. Remove Supabase types. Session state comes from `/api/auth/me` on mount. |
| `src/services/plans.ts` | Replace all `supabase.from(...)` calls with `fetch('/api/plans/...')`. Much simpler — just JSON in, JSON out. |
| `src/services/tracking.ts` | Replace with `fetch('/api/tracking/...')`. Same interface, different transport. |
| `src/services/history.ts` | Replace with `fetch('/api/history/...')`. The complex Supabase joins move server-side. |
| `src/components/Auth.tsx` | Minor — just calls `signIn` / `signUp` from context (same interface). |
| `src/App.tsx` | Remove migration prompt. Remove Supabase imports. Same flow otherwise. |

### Files untouched:
- `src/components/ActiveWorkout.tsx` — No Supabase dependency
- `src/components/Dashboard.tsx` — No Supabase dependency
- `src/components/History.tsx` — Calls service layer, doesn't care about transport
- `src/components/ProgressChart.tsx` — Pure presentation
- `src/components/Setup.tsx` — Pure presentation
- `src/components/BottomNav.tsx` — Pure presentation
- `src/services/openai.ts` — Already Cloudflare-native
- `src/types.ts` — App-level types, no Supabase dependency

### New service pattern:

**Before (Supabase):**
```ts
// plans.ts
import { supabase } from './supabaseClient';
export async function loadActivePlan(userId: string) {
  const { data, error } = await supabase
    .from('workout_plans')
    .select(`id, plan_name, ..., plan_days ( ... )`)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  // ... 40 lines of data transformation
}
```

**After (Cloudflare):**
```ts
// plans.ts
export async function loadActivePlan() {
  const res = await fetch('/api/plans', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load plan');
  return res.json(); // Server returns the exact shape we need
}
```

Notice:
- **No `userId` parameter.** The server knows who you are from the cookie.
- **No client-side data transformation.** The API returns the exact `WorkoutPlan` shape.
- **No Supabase SDK import.** `fetch` is built into every browser.
- **Massively simpler.** Each service function becomes 3-5 lines.

---

## Data Migration Strategy

### One-time Supabase → D1 export

**Marcus's plan:**

1. Write a Node script (`scripts/migrate-from-supabase.ts`) that:
   - Connects to Supabase using the service role key (read-only)
   - Exports all tables as JSON: `users`, `workout_plans`, `plan_days`, `plan_exercises`, `exercise_alternatives`, `tracked_workouts`, `tracked_sets`
   - Maps Supabase UUIDs to the same hex-string format for D1
   - Re-hashes passwords? **No** — Supabase uses bcrypt, and we'll use bcrypt too, so we can copy the hashes directly

2. Write a corresponding import script that bulk-inserts into D1 via the Wrangler CLI:
   ```bash
   wrangler d1 execute workout-db --file=./migration-data.sql
   ```

3. Verify row counts match. Spot-check a few users' data.

4. **Cutover:** Deploy the new Cloudflare-only code. Point the domain. Old Supabase project can be archived.

### Rollback plan
- Keep Supabase project alive (read-only) for 30 days after cutover
- If something breaks, revert the Cloudflare Pages deployment (instant rollback via CF dashboard)

---

## Dependency Cleanup

### npm packages to remove:
```
@supabase/supabase-js    (~150KB bundled, SSR-heavy)
supabase                 (CLI dev dependency)
```

### npm packages to add:
```
(none — we only use fetch, which is built into Workers and browsers)
```

**Net effect:** The client bundle shrinks by ~150KB (gzipped: ~40KB). No new runtime dependencies. The only external package we hit at build time is `@cloudflare/workers-types` which we already have.

---

## Detailed TODO List

### Phase 0: Preparation
- [ ] **0.1** Create the D1 database via Wrangler CLI: `wrangler d1 create workout-db`
- [ ] **0.2** Add D1 binding to `wrangler.toml` (or create it — we don't have one yet since we use Pages)
- [ ] **0.3** Apply the D1 schema (create all 8 tables + indexes) via `wrangler d1 execute`
- [ ] **0.4** Add `JWT_SECRET` environment variable to Cloudflare Pages dashboard (random 64-char string for session signing)
- [ ] **0.5** Test D1 connectivity from a simple Pages Function

### Phase 1: Auth API (Server-Side)
- [ ] **1.1** Create `functions/api/auth/signup.ts` — validate email/password, hash with bcrypt, insert user, create session, set cookie
- [ ] **1.2** Create `functions/api/auth/login.ts` — verify password, create session, set cookie
- [ ] **1.3** Create `functions/api/auth/logout.ts` — delete session, clear cookie
- [ ] **1.4** Create `functions/api/auth/me.ts` — read cookie, look up session, return user JSON
- [ ] **1.5** Create `functions/_middleware.ts` — shared auth middleware that extracts `userId` from cookie for all `/api/*` routes (except auth routes and generate-plan)
- [ ] **1.6** Write integration tests for auth flow: signup → login → me → logout → me (should 401)

### Phase 2: Data API (Server-Side)
- [ ] **2.1** Create `functions/api/plans.ts` — GET (load active plan) + POST (save new plan)
- [ ] **2.2** Create `functions/api/plans/deactivate.ts` — POST to deactivate current plan
- [ ] **2.3** Create `functions/api/plans/history.ts` — GET all plans
- [ ] **2.4** Create `functions/api/tracking.ts` — GET (load tracked workouts) + POST (save/update tracked workout)
- [ ] **2.5** Create `functions/api/history/exercises.ts` — GET distinct exercises
- [ ] **2.6** Create `functions/api/history/exercise.ts` — GET full history for one exercise
- [ ] **2.7** Create `functions/api/history/pr.ts` — GET personal records
- [ ] **2.8** Create `functions/api/history/progression.ts` — GET progression chart data
- [ ] **2.9** Update `functions/api/generate-plan.ts` — add D1 binding to Env type (no logic changes needed)

### Phase 3: Front-End Rewrite
- [ ] **3.1** Rewrite `src/contexts/AuthContext.tsx` — replace Supabase calls with fetch-based auth API calls; manage session via `/api/auth/me` on mount
- [ ] **3.2** Rewrite `src/services/plans.ts` — replace all Supabase queries with `fetch('/api/plans/...')` calls; remove all data transformation (server handles it)
- [ ] **3.3** Rewrite `src/services/tracking.ts` — replace with `fetch('/api/tracking/...')` calls
- [ ] **3.4** Rewrite `src/services/history.ts` — replace with `fetch('/api/history/...')` calls
- [ ] **3.5** Update `src/App.tsx` — remove `userId`/`planId` passing to service calls (cookies handle identity); remove migration prompt imports
- [ ] **3.6** Update `src/components/Auth.tsx` — minor: ensure error handling matches new API error format
- [ ] **3.7** Remove `src/services/supabaseClient.ts`
- [ ] **3.8** Remove `src/types/supabase.ts`
- [ ] **3.9** Remove `src/services/migration.ts`
- [ ] **3.10** Remove `src/components/MigrationPrompt.tsx`
- [ ] **3.11** Remove the `supabase/` directory entirely

### Phase 4: Package Cleanup
- [ ] **4.1** `npm uninstall @supabase/supabase-js supabase`
- [ ] **4.2** Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.local` and `.env.example`
- [ ] **4.3** Update `README.md` — remove Supabase setup instructions, document D1 setup
- [ ] **4.4** Delete `SUPABASE_IMPLEMENTATION_PLAN.md` and `MIGRATION_PLAN.md` (obsolete)

### Phase 5: Data Migration
- [ ] **5.1** Write `scripts/export-supabase.ts` — connects to Supabase, exports all rows as JSON
- [ ] **5.2** Write `scripts/import-to-d1.ts` — converts JSON to D1-compatible SQL INSERT statements
- [ ] **5.3** Run export against production Supabase
- [ ] **5.4** Run import against D1 production database
- [ ] **5.5** Verify row counts: `SELECT COUNT(*) FROM` each table in both DBs

### Phase 6: Testing & Cutover
- [ ] **6.1** Full E2E test: signup → generate plan → track workout → view history → logout → login → verify data persists
- [ ] **6.2** Test auto-save (phone lock) still works with new API
- [ ] **6.3** Test kg/lbs toggle persists through save/load cycle
- [ ] **6.4** Test offline → online recovery (localStorage session restore)
- [ ] **6.5** Deploy to Cloudflare Pages (production)
- [ ] **6.6** Verify custom domain resolves correctly
- [ ] **6.7** Monitor D1 analytics for 48 hours
- [ ] **6.8** Archive Supabase project (do NOT delete for 30 days)
- [ ] **6.9** Remove Supabase env vars from Cloudflare Pages dashboard
- [ ] **6.10** Final commit: remove all migration scripts

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| D1 query performance worse than Postgres | Low | Medium | D1 is edge-located SQLite — for this data volume (< 10K rows), it will be faster |
| Password hash incompatibility | Low | High | Supabase uses bcrypt; we'll use bcrypt. Copy hashes directly. |
| Session cookie rejected on some browsers | Very Low | High | Industry-standard cookie attributes; tested on Safari, Chrome, Firefox |
| D1 row limit hit | Very Low | Low | D1 free tier: 5M rows read/day, 100K writes/day. This app does maybe 50 queries/user/session. |
| Lost data during migration | Low | Critical | Export-verify-import pattern with row count validation. Keep Supabase alive for 30 days. |

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|---------------|
| Phase 0: Preparation | 30 min |
| Phase 1: Auth API | 2-3 hours |
| Phase 2: Data API | 3-4 hours |
| Phase 3: Front-End Rewrite | 2-3 hours |
| Phase 4: Package Cleanup | 15 min |
| Phase 5: Data Migration | 1-2 hours |
| Phase 6: Testing & Cutover | 1-2 hours |
| **Total** | **~10-15 hours** |

---

## Summary

**Marcus:** *"This migration is entirely mechanical. The app's features don't change — only the plumbing underneath. We go from a 2-vendor stack to a 1-vendor stack, delete ~600 lines of Supabase boilerplate, shrink the client bundle by 40KB gzipped, and gain edge-located data. The service layer becomes trivially simple because all data shaping moves server-side."*

**Sofia:** *"From a UX perspective, the only change a user could theoretically notice is that login doesn't redirect through Supabase's auth. They'll type email and password in the same form, hit the same button, and land on the same dashboard. If anything, first paint gets faster because we're not loading the Supabase SDK."*

**David:** *"D1 is production-ready for this workload. We're well within free-tier limits. The real win is operational simplicity — one Wrangler config, one `git push`, everything deploys together. No more 'did you run the Supabase migration?' No more syncing two dashboards. One platform, one bill, one deploy pipeline."*
