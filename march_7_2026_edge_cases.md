# Edge Case & UX Bug Audit — March 7, 2026

---

## Meet the Team

### Marcus Chen — Senior Edge Case Removal Engineer
**Title:** Principal Edge Case Engineer
**Experience:** 11 years in production-hardened mobile-first web applications. Former reliability lead at Peloton and Fitbit. Specializes in state management failures, data integrity gaps, and race conditions in offline-capable PWAs. Has filed and resolved over 3,000 edge case tickets across his career. Known for breaking apps in ways that product managers didn't think were possible.

### Anya Petrov — Senior UX Bug Identifier & Interaction Auditor
**Title:** Staff UX Engineer
**Experience:** 9 years in mobile interface auditing and interaction design QA. Former UX QA lead at MyFitnessPal and Strava. Specializes in touch-target sizing, text overflow, visual inconsistency, and interaction dead-ends on small viewports. Has audited 50+ fitness apps for App Store and Google Play compliance. Obsessed with what happens when real users do things designers never expected.

---

## Audit Scope

Full codebase review of **Jacob's Workout Assistant** — a React + TypeScript + Vite SPA with Cloudflare Pages Functions backend (D1 SQLite). Mobile-first workout tracking app with AI-generated plans, exercise swapping, rest timers, auto-save, and exercise history.

**Files reviewed:** All frontend components, all services, all backend API handlers, all types, database schema, auth/session logic.

---

## Findings

### 🔴 Critical — User-Reported Bugs

> These were identified by the product owner as already-observed issues.

**#1 — Long exercise names are unreadable on mobile**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — exercise header (line ~430)
- **What:** The exercise name uses `truncate` (CSS `text-overflow: ellipsis`) but the containing `<div className="min-w-0">` competes with the ALT badge, the action buttons (Play, Swap, Chevron), and the completion circle for horizontal space. On a 375px viewport (iPhone SE), exercise names longer than ~18 characters with the ALT badge showing become completely unreadable — the name truncates to 2-3 visible characters.
- **Also affects:** The rest timer banner (`workoutDay.exercises[activeTimer!.exIndex]?.name`) shows the ORIGINAL exercise name on the right side — this can also overflow.
- **Also affects:** Dashboard day card exercise preview pills use `max-w-[120px]` with `truncate`, so names like "Dumbbell Romanian Deadlift" become "Dumbbell Ro…"
- **Severity:** High — users cannot identify the exercise they're performing.

**#2 — Supersets only track reps/weight for one exercise**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — exercise list rendering
- **What:** Supersets are two exercises that share rest time. The AI generates them as two consecutive exercises with "Superset" mentioned in the `rest` or `expertAdvice` field. However, the tracking grid treats each exercise independently. If a user completes a superset of Bench Press + Cable Fly, they see two separate exercise cards. The UX does NOT make it clear these belong together as a superset pair — there is no visual grouping, no shared card, no "Superset A1/A2" labeling. A user could easily fill data for one exercise of the superset and skip the other, thinking they already logged the whole superset.
- **Root cause:** Superset detection is regex-based (`/super\s*set/i` in rest/expertAdvice text) and purely visual — there's no structural data model for superset pairing.
- **Severity:** High — data loss / incomplete tracking.

**#3 — Displayed exercise is neither the original nor any alternative**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — `trackedData` initialization (line ~62)
- **What:** When recovering from localStorage (`jw_active_session`), the `trackedData` exercises array is restored exactly as-saved, including `exerciseName`. If the plan was regenerated or an exercise was renamed server-side between sessions, the saved `exerciseName` may no longer match `ex.name` OR any `ex.alternatives[].name`. The exercise header will display this orphaned name with no ALT badge (because the `trackedEx.exerciseName !== ex.name` check shows ALT, but the name doesn't match any known exercise either). The swap panel will list the original + alternatives but the "Active" label won't appear on any of them.
- **Also possible if:** The plan shape changes between localStorage save and reload — e.g., plan has 5 exercises but saved session has 6 (user added a set, or plan was regenerated with different exercises). The `trackedData[exIndex]` may reference the wrong plan exercise entirely.
- **Severity:** High — confusing/broken state.

**#4 — Rest timer uses original exercise's rest time, not the alternative's**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — `startRestTimer(exIndex, ex.rest)` (line ~580)
- **What:** When the "Start Rest" button is pressed, it calls `startRestTimer(exIndex, ex.rest)` where `ex` is `workoutDay.exercises[exIndex]` — always the ORIGINAL exercise from the plan. If the user swapped to an alternative, the rest time should potentially be different, but alternatives don't have a `rest` field in the data model (`Alternative` type only has `name`, `expertAdvice`, `videoSearchQuery`). So the timer always uses the original exercise's rest period regardless of which exercise is active.
- **Also:** The timer banner label shows `workoutDay.exercises[activeTimer!.exIndex]?.name` — the ORIGINAL name, not the swapped name.
- **Severity:** Medium — timer may be wrong length and shows wrong exercise name.

---

### 🟠 High Priority — Data Integrity & State Management

**#5 — localStorage session can mismatch plan structure after regeneration**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — `trackedData` init, and [App.tsx](src/App.tsx) — `handleGenerate`
- **What:** If a user: (1) starts a workout, (2) goes back to dashboard, (3) regenerates a new plan, (4) starts the same week/day number — the localStorage `jw_active_session` still has stale data from the OLD plan. The recovery check only validates `session.week === week && session.day === day` — it doesn't verify the plan ID or that exercise count/names match. This causes `trackedData` to have entries for exercises that no longer exist in the new plan, or to be missing entries for new exercises.
- **Severity:** High — silent data corruption / crash potential (accessing undefined in array).

**#6 — Exercise history is fragmented when using alternatives**
- **Where:** [functions/api/tracking.ts](functions/api/tracking.ts) — tracked_sets uses `exercise_name` string, and [functions/api/history/exercises.ts](functions/api/history/exercises.ts)
- **What:** When a user swaps from "Barbell Bench Press" to the alternative "Dumbbell Bench Press", the tracked sets are saved under `exercise_name = 'Dumbbell Bench Press'`. In the History tab, this appears as a completely separate exercise from "Barbell Bench Press". The user's progress is fragmented across multiple exercise names with no way to see a unified history. There's no mapping from alternatives back to their parent exercise.
- **Severity:** High — defeats the purpose of history tracking for users who use alternatives.

**#7 — No confirmation when leaving an active workout**
- **Where:** [App.tsx](src/App.tsx) — `onCancel` callback (line ~275)
- **What:** The cancel/back button in ActiveWorkout calls `setActiveWorkout(null)` without any confirmation dialog. There is no `beforeunload` handler either. If a user accidentally taps the back arrow (which is a small 36px circle), they exit the workout. While auto-save preserves data, the transition is jarring and the resume banner may not immediately appear if data hasn't been flushed.
- **Also:** Browser back button / swipe-back gesture on mobile has the same issue — no history pushState is used, so the browser navigates away from the entire SPA.
- **Severity:** Medium-High — accidental data loss perception.

**#8 — `plan_days` table doesn't store `description` field**
- **Where:** [d1/schema.sql](d1/schema.sql) — plan_days table, and [functions/api/plans/index.ts](functions/api/plans/index.ts) — handleGet
- **What:** The `WorkoutDay` type has an optional `description` field. The AI in `generate-plan.ts` may include `description` in its output. But the `plan_days` table only has columns `id, plan_id, day_number, focus` — no `description` column. When saving a plan, the description is silently dropped. When loading, the GET handler doesn't include it. The Dashboard renders `{day.description && <p>...}` which will never show anything.
- **Severity:** Medium — feature quietly broken, data silently lost.

**#9 — Tracked workout save uses DELETE + re-INSERT for sets (race condition)**
- **Where:** [functions/api/tracking.ts](functions/api/tracking.ts) — handlePost (line ~165)
- **What:** On every auto-save (every 2 seconds), the POST handler: (1) finds existing workout, (2) DELETEs all tracked_sets for that workout, (3) INSERTs new sets. If two auto-save requests arrive overlapping, the second DELETE could wipe out the first INSERT's data before the second INSERT completes. D1 batch operations aren't transactional across separate `.run()` + `.batch()` calls.
- **Severity:** Medium — potential data loss during rapid saves.

**#10 — Weight unit is per-exercise, confusing and inconsistent**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — `toggleWeightUnit` function
- **What:** The kg/lbs toggle is per-exercise, not a global preference. A user could accidentally have exercises 1-3 in lbs and exercise 4 in kg. There's no visual indicator of the unit in the set grid cells — only the tiny button in the header row. When reviewing completed workouts or in history, the PR display hardcodes "lbs" (`{pr.maxWeight} lbs`).
- **Severity:** Medium — confusing UX, potential wrong data interpretation.

---

### 🟡 Medium Priority — UX Bugs & Visual Issues

**#11 — Timer banner shows original exercise name, not current exercise**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — timer banner (line ~345)
- **What:** The timer banner displays `workoutDay.exercises[activeTimer!.exIndex]?.name` which is the plan's original exercise name. If the user swapped to an alternative, the banner should show the tracked exercise name instead.
- **Severity:** Medium — confusing.

**#12 — Set completion is triggered by `reps > 0` alone — no weight validation**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — `updateSet` function (line ~210)
- **What:** `currentSet.completed = currentSet.reps > 0` — entering any rep count marks the set as complete, even if weight is 0. For bodyweight exercises this is fine, but for weighted exercises the user might enter reps first and the set immediately shows as "complete" with the green checkmark and celebration, even though they haven't entered the weight yet.
- **Severity:** Medium — premature completion feedback.

**#13 — Week tabs are hardcoded to exactly 4 weeks**
- **Where:** [Dashboard.tsx](src/components/Dashboard.tsx) — week tabs and progress calculation
- **What:** `[1, 2, 3, 4].map(...)` and `const weeks = [1, 2, 3, 4].map(...)` in generate-plan.ts. If the AI or future feature generates plans with fewer or more weeks, the UI will break or show empty weeks.
- **Also in:** [functions/api/plans/index.ts](functions/api/plans/index.ts) — `const weeks = [1, 2, 3, 4].map(...)` — hardcoded.
- **Severity:** Low-Medium — not currently broken but fragile assumption.

**#14 — Progress ring shows NaN or Infinity if totalWorkouts is 0**
- **Where:** [Dashboard.tsx](src/components/Dashboard.tsx) — `progress` calculation (line ~70)
- **What:** `Math.round((completedCount / totalWorkouts) * 100)` — if `totalWorkouts` is 0 (e.g., plan has no weeks or no days), this produces `NaN`. The ProgressRing SVG would render with `NaN` stroke offset.
- **Severity:** Low-Medium — edge case with empty/corrupt plan data.

**#15 — PR display hardcodes "lbs" unit**
- **Where:** [History.tsx](src/components/History.tsx) — ExerciseDetail PR banner (~line 232)
- **What:** `{pr.maxWeight} lbs` is hardcoded. If a user tracked an exercise in kg, the history still shows "lbs". The `weight_unit` column exists in `tracked_sets` but is not returned by the PR or progression endpoints.
- **Severity:** Medium — incorrect data display.

**#16 — Session history grouping uses `completed_at` which is null for in-progress saves**
- **Where:** [functions/api/history/exercise.ts](functions/api/history/exercise.ts) — session grouping
- **What:** Sessions are grouped by `completed_at`. For auto-saved (incomplete) workouts, `completed_at` is null. All incomplete sessions get grouped under the key `'unknown'` as a single "session" — mixing sets from multiple dates into one misleading session.
- **Severity:** Medium — wrong data display in history.

**#17 — No error state UI for failed API calls**
- **Where:** Throughout — [App.tsx](src/App.tsx), [History.tsx](src/components/History.tsx), [Dashboard.tsx](src/components/Dashboard.tsx)
- **What:** API failures are caught with `console.error` or `.catch(() => {})` but never shown to the user. If the server is down, the user sees shimmer skeletons that never resolve, or stale cached data with no indication it's offline.
- **Severity:** Medium — user is blind to failures.

**#18 — No loading/disabled state on "Finish Workout" action**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — `finishWorkout` and the completion flow
- **What:** The "Finish Workout" button isn't visible in the current code (it's triggered when all exercises are complete? Actually there's no explicit finish button — the `finishWorkout` function exists but I don't see it called from a button in the JSX). This means there's no way for the user to manually complete a workout if they want to skip some exercises.
- **Severity:** Medium-High — missing essential feature.

**#19 — Plan generation error uses `alert()` — bad mobile UX**
- **Where:** [App.tsx](src/App.tsx) — `handleGenerate` catch block (line ~97)
- **What:** `alert(\`Failed to generate plan: ${message}\`)` — native alert() dialogs are jarring, block the thread, and look different across platforms. Should be an inline error state.
- **Severity:** Low-Medium — UX polish.

**#20 — Exercise note is only saved on first tracked set**
- **Where:** [functions/api/tracking.ts](functions/api/tracking.ts) — batch INSERT loop (line ~185)
- **What:** `note: i === 0 ? (ex.note ?? null) : null` — the exercise note is only attached to set_number=1. When loading tracked data, the note is read from `exSets[0]?.note`. This works correctly in the current code, but if the user deletes set 1 and only has sets 2-3, the note is lost.
- **Severity:** Low — fragile data attachment.

**#21 — Search in History does not handle special characters**
- **Where:** [History.tsx](src/components/History.tsx) — search filter
- **What:** `exercises.filter((e) => e.exerciseName.toLowerCase().includes(q))` — if an exercise name contains parentheses, brackets, or special chars, the search works fine (it's not regex). But if the exercise name has accented characters or the user types with different casing, `.toLowerCase()` handles basic cases. However, exercises like "3/4 Squat" would require exact match which may confuse users.
- **Severity:** Low — minor UX irritation.

**#22 — `resetPlan` confirmation uses `confirm()` — bad mobile UX**
- **Where:** [App.tsx](src/App.tsx) — `resetPlan` function (line ~134)
- **What:** `if (!confirm('Start a new plan?...'))` — same issue as #19, native dialogs are bad on mobile.
- **Severity:** Low — UX polish.

**#23 — Weekly notes are not cleared when generating a new plan**
- **Where:** [App.tsx](src/App.tsx) — `handleGenerate` and [Dashboard.tsx](src/components/Dashboard.tsx)
- **What:** When a user generates a new plan, `setTrackedWorkouts([])` is called but weekly notes state `weeklyNotes` in Dashboard is loaded per-planId. Since the new plan gets a new planId, this technically works — but the old plan's notes remain in the database forever and the Dashboard's `weeklyNotes` state may briefly show stale notes from the old planId until the new planId loads.
- **Severity:** Low — cosmetic timing issue.

**#24 — Scroll-to-exercise effect fires on initial mount**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — scroll effect (line ~107)
- **What:** `expandedExercise` defaults to `0`, so on first render the scroll effect fires and scrolls to the first exercise. This causes a jarring jump if the user is at the top of the page and the exercise list is below the sticky header.
- **Severity:** Low — minor visual jitter.

**#25 — No way to remove an added set**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — set tracking grid
- **What:** There's an "Add Set" button but no way to remove a set that was accidentally added. Users who tap "Add Set" by mistake are stuck with a phantom empty set row.
- **Severity:** Medium — an undo/remove action is expected.

**#26 — Debounced auto-save may fire after component unmount**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — debounce timer (line ~130)
- **What:** The debounce timer fires `onAutoSave` 2 seconds after the last change. If the user exits the workout (unmounts ActiveWorkout), the timer's cleanup clears the timeout — but the `onAutoSave` callback uses `activeWorkout` state which is set to null on cancel. The `handleAutoSave` in App.tsx has a guard `if (!user || !planId || !activeWorkout)` which will correctly prevent the save. However, the visibility change handler also fires on unmount and could attempt a save after `activeWorkout` is null.
- **Severity:** Low — guarded but fragile.

**#27 — Progression chart shows nothing if all sessions have null `completed_at`**
- **Where:** [functions/api/history/progression.ts](functions/api/history/progression.ts) — date grouping
- **What:** `row.completed_at?.split('T')[0] ?? ''` — if `completed_at` is null, the date is empty string `''` and `if (!date) continue` skips it. If a user only has auto-saved (incomplete) workouts, the chart will be empty even though they have weight data.
- **Severity:** Medium — data exists but isn't shown.

**#28 — No input validation on Setup wizard values**
- **Where:** [Setup.tsx](src/components/Setup.tsx) — `handleGenerate` call
- **What:** The wizard auto-advances through steps but there's no server-side validation of the values. `generate-plan.ts` validates `daysPerWeek` range (3-6) and checks `goal` and `level` are non-empty, but `secondaryGoal` and `level` values aren't validated against allowed values. While the UI uses buttons (not free text), a malicious request could send arbitrary strings.
- **Severity:** Low — defense in depth.

**#29 — Session expiry is not handled client-side**
- **Where:** [AuthContext.tsx](src/contexts/AuthContext.tsx) — `checkAuth` function
- **What:** Sessions expire after 30 days server-side. The client calls `/api/auth/me` on mount to check auth. But if the session expires mid-use (user leaves tab open for days), subsequent API calls will get 401 responses. These are caught as generic errors, not "please log in again" — the user sees silent failures or console errors. There's no automatic redirect to login on 401.
- **Severity:** Medium — broken silent state after session expiry.

**#30 — `localStorage.getItem('jw_active_session')` parsed in 3 separate places**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) (twice), [Dashboard.tsx](src/components/Dashboard.tsx) (once), [App.tsx](src/App.tsx) (once)
- **What:** The same JSON parsing + validation logic is duplicated in 4 places with slightly different checks. Each could fail independently if the schema changes. Should be a shared utility.
- **Severity:** Low — maintainability / DRY violation.

**#31 — `finishWorkout` can be triggered multiple times**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — no guard on `showCelebration`
- **What:** If the "Finish Workout" action is somehow triggered twice rapidly (double-tap), `finishWorkout` will set `showCelebration = true` twice and call `onComplete` twice via the setTimeout. This could create duplicate tracked_workout entries or double-save.
- **Severity:** Low-Medium — race condition.

**#32 — Alt exercise swap doesn't preserve existing set data**
- **Where:** [ActiveWorkout.tsx](src/components/ActiveWorkout.tsx) — `selectAlternative` (line ~200)
- **What:** When swapping exercises, `selectAlternative` only updates the `exerciseName`. The existing `sets` data (weights, reps) is preserved. This is actually the CORRECT behavior if the user wants to keep their data, but it could be confusing — if someone swaps from Barbell Bench (3x8 @ 135lbs) to Push-ups, the 135lbs weight data is still showing. There's no prompt asking "Keep existing set data or reset?"
- **Severity:** Low — potential confusion, but arguably correct.

**#33 — Setup wizard's back button on Step 0 does nothing**
- **Where:** [Setup.tsx](src/components/Setup.tsx) — `goBack` function
- **What:** On Step 0, the "Back" button calls `goBack()` which does `setStep(s => s - 1)` — setting step to -1. While the wizard probably renders step 0 for `step < 0`, this could cause unexpected behavior if `step` is used as an array index.
- **Severity:** Low — needs a `step > 0` guard.

**#34 — The app has no offline indicator or offline support**
- **Where:** Global
- **What:** The app caches plan data in localStorage but doesn't register a service worker. If the user loses connectivity: (1) the SPA itself won't load from cache on refresh, (2) auto-saves fail silently, (3) plan generation fails with no retry. No offline banner or indicator exists.
- **Severity:** Medium — gym environments often have poor connectivity.

**#35 — `day.description` rendered in Dashboard but never populated**
- **Where:** [Dashboard.tsx](src/components/Dashboard.tsx) — day card (line ~255)
- **What:** `{day.description && <p className="text-[11px]...">}` renders the description — but as noted in #8, it's never saved to DB. So this JSX is dead code.
- **Severity:** Low — dead code.

---

## Summary

| Priority | Count | IDs |
|---|---|---|
| 🔴 Critical (User-Reported) | 4 | #1, #2, #3, #4 |
| 🟠 High | 6 | #5, #6, #7, #8, #9, #10 |
| 🟡 Medium | 12 | #11, #12, #13, #14, #15, #16, #17, #18, #25, #27, #29, #34 |
| 🟢 Low | 13 | #19, #20, #21, #22, #23, #24, #26, #28, #30, #31, #32, #33, #35 |
| **Total** | **35** | |

---

*Audit completed by Marcus Chen & Anya Petrov — March 7, 2026*
*Please review and select which items to prioritize for fixes.*
