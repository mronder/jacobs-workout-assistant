# Jacob's Workout Assistant — Improvement Session  
### March 7, 2026

---

## Panel Introductions

### **Marcus Chen** — Senior UI/UX Designer, Peloton  
**Title:** Principal Product Designer  
**Experience:** 11 years in fitness/wellness product design. Led the redesign of Peloton's in-ride metrics experience, Apple Watch integration, and post-workout summary flows. Previously at Nike Running and Strava.  
> "I obsess over the micro-interactions that make people *want* to pick up the app. A rest timer shouldn't feel like homework — it should feel like your coach is right there counting you down."

### **Jordan Reeves** — Senior Full Stack Engineer  
**Title:** Staff Software Engineer  
**Experience:** 9 years building production apps across React, TypeScript, Cloudflare Workers, and D1/SQLite. Shipped real-time collaboration features at Figma and high-throughput data pipelines at Stripe.  
> "Data loss is the one thing users never forgive. If someone enters their reps and the app eats it — that's it, trust is gone. We fix the persistence layer first."

### **Priya Vasquez** — Edge Case Removal Engineer  
**Title:** Senior Reliability Engineer  
**Experience:** 8 years focused on defensive UX, data integrity, and failure-mode analysis. Former QA lead at Garmin and reliability engineer at Calm. Specializes in finding and eliminating the 2% of scenarios that cause 80% of user frustration.  
> "The superset label showing on a single exercise? That's a classic case of the AI generating data the UI blindly trusts. We need guardrails at both the generation and display layers."

### **Derek "Coach D" Williams** — Personal Trainer  
**Title:** Certified Strength & Conditioning Specialist (CSCS), NASM-CPT  
**Experience:** 14 years training clients from beginners to competitive athletes. Runs a 200+ member gym in Austin, TX. Former D1 football strength coach.  
> "Rest periods are *everything* for hypertrophy. If I tell a client 90 seconds, I need them resting 90 seconds — not guessing. And notes? My best clients all keep workout journals. That's where the real gains happen."

### **Sam Kowalski** — Daily App User  
**Title:** Hobbyist Lifter & Software QA Tester  
**Experience:** Been using Jacob's Workout Assistant daily for 4 months. Intermediate lifter, 5-day bro split, focused on hypertrophy. Tests the app in real gym conditions (sweaty hands, phone in pocket, distractions).  
> "I love this app. But I've lost workout data three times now by accidentally tapping the X instead of 'Finish Workout.' That has to stop. Also — I keep my rest times in my head right now, which means I'm always on my phone checking the clock."

---

## Problem Discussion

### Problem 1: Rest Period Timer

**Sam:** "Right now I look at the exercise card, see '90s rest,' and then pull up my phone's clock app. That means leaving the workout screen, which is risky — I might accidentally close the workout."

**Coach D:** "Rest periods are programmed into the plan for a reason. A 60-second rest produces different hormonal and metabolic responses than a 3-minute rest. Having a built-in timer that *knows* the prescribed rest for each exercise is a game-changer. The user shouldn't have to think about it."

**Marcus:** "I'd put the timer right inside the exercise card, not on a separate tab. Context matters — you're logging your set, you hit 'Start Rest,' a countdown appears right there, and it auto-stops with a subtle vibration or sound. No 'stop' button needed. It should auto-dismiss after it hits zero and maybe flash the card or pulse the color."

**Jordan:** "Implementation-wise, each exercise already has a `rest` field (like `'90s'` or `'2-3 min'`). We parse that into seconds, run a `setInterval`, and display the countdown. We store timer state in component state — no server round-trip needed. If the user scrolls away, the timer keeps running. When it hits zero, visual + optional audio feedback."

**Priya:** "Edge cases to handle: What if the rest field says '2-3 min'? We pick the lower bound (120s) as default. What if the user starts a timer and then starts another set before it finishes? Auto-cancel the old timer. What about phone lock during rest? The timer should resume correctly using elapsed time calculation, not just interval ticks."

**Marcus:** "The button should say 'Start Rest' and transform into a countdown. Big, thumb-friendly. Orange theme. When it hits zero, the button could say 'Rest Complete — GO!' for a second before resetting."

### Problem 2: Superset Display Issue

**Sam:** "Sometimes an exercise card says 'Superset' below it, but there's only one exercise listed. Superset with what? It's confusing."

**Coach D:** "A superset means two exercises performed back-to-back with no rest. If the AI is labeling something as a superset, it needs to clearly say *which* exercises are paired. Otherwise the trainee just ignores it or gets confused."

**Priya:** "I looked at the plan generation prompt — there's no explicit instruction to the AI about how to handle supersets. The AI sometimes puts 'Superset' in the description or rest field of an exercise without properly pairing it. The fix is two-fold: (1) Update the generation prompt to either explicitly pair supersets or avoid the term, and (2) Add a UI guard that detects orphaned superset labels and either pairs them properly or strips the label."

**Jordan:** "In the current schema, exercises are individual items in an array. There's no `supersetWith` field or grouping mechanism. The simplest fix is: if the AI mentions 'superset' in the rest field or description of an exercise, we check if the *next* exercise also mentions it. If not, we strip the superset label. Longer term we could add superset grouping, but for now let's just clean up the display."

**Marcus:** "Agreed — for now, just removing confusing orphaned labels is the right call. We can design proper superset UI with grouping brackets in a future iteration."

### Problem 3: Data Loss When Exiting Workout

**Sam:** "This is my biggest frustration. I'm mid-workout, I've logged 4 exercises, and I want to check what tomorrow's workout looks like. I tap the X to close the active workout, and when I come back — everything's gone. All my logged sets, weights, reps. Gone."

**Jordan:** "Currently, `onCancel` does `localStorage.removeItem(STORAGE_KEYS.activeSession)` and sets `activeWorkout` to null. That's the problem — the cancel button is *deleting* the saved session. We need to change the behavior: closing a workout should NOT delete the data. The data should persist in localStorage and also be auto-saved to the server. Only 'Finish Workout' should mark it as complete."

**Priya:** "And we should auto-save to the server on every input change, not just on visibility change. Every time the user enters a weight or reps value, we debounce-save to the server (e.g., 2 seconds after last keystroke). That way even if the app crashes, localStorage corrupts, or they open on a different device — the data is there."

**Marcus:** "The X button should become a 'back' arrow. And when you tap it, it should save and go back to the dashboard — NOT ask 'are you sure you want to cancel?' It's not canceling. It's pausing. You can come back later."

**Coach D:** "This mirrors real gym behavior. People step away — they get water, talk to someone, check their phone. The app should handle that gracefully."

### Problem 4: Notes Sections

**Coach D:** "Every serious lifter keeps a training journal. Notes are essential. Under each exercise: 'Left shoulder felt tight on set 3.' Under each day: 'Energy was low today, didn't sleep well.' Under each week: 'Increased bench volume this week, feeling good.' These are optional but incredibly valuable for long-term progress tracking."

**Sam:** "I'd use exercise notes to track things like 'used the cable machine in the corner, not the main one' or 'this weight was too easy, go up next time.' Day notes for overall feel. Week notes for bigger-picture reflections."

**Marcus:** "Keep it minimal and non-intrusive. A small text area icon or 'Add note' link under each exercise, collapsible. For the day, a note section at the top or bottom of the active workout. For the week, a note area on the dashboard under each week tab. All optional — never blocking the user's flow."

**Jordan:** "Implementation: We add `note` fields to `TrackedExercise` and `TrackedWorkout` types. For weekly notes, we can add a new `workout_notes` table or a `weekly_notes` field. Notes save with the same auto-save mechanism as the rest of the workout data."

**Priya:** "Make sure notes don't interfere with the auto-complete logic. An empty note field should never prevent a set from being marked complete. And notes should persist across the save/cancel/resume flow just like weights and reps."

---

## Action Items / Todo List

### 🔧 REST PERIOD TIMER
1. **Parse rest time from exercise data** — Create a utility function `parseRestSeconds(rest: string): number` that handles formats like `'60s'`, `'90s'`, `'2 min'`, `'2-3 min'` (use lower bound), `'60-90s'` (use lower bound).
2. **Add timer state to ActiveWorkout** — Add `activeTimer: { exIndex: number; secondsLeft: number; totalSeconds: number } | null` state.
3. **Create "Start Rest" button** — Place it below each set tracking grid inside the expanded exercise card. Large, thumb-friendly, orange-themed.
4. **Implement countdown logic** — Use `setInterval` with elapsed-time calculation (not just decrement) to survive phone sleep. Auto-stop at zero.
5. **Visual feedback at zero** — Flash the button green, show "REST COMPLETE — GO!", optional pulse animation. Auto-reset after 2 seconds.
6. **Handle edge cases** — Starting a new timer cancels any running timer. Collapsing/expanding exercises doesn't kill the timer. Timer shows even if scrolled to a different exercise (persistent mini-bar at top or bottom).

### 🔗 SUPERSET DISPLAY FIX
7. **Audit AI generation prompt** — Review `generate-plan.ts` prompts for superset instructions. Add explicit guidance: "Do NOT use the word 'superset' unless pairing two specific exercises back-to-back."
8. **Add UI sanitization** — In `ActiveWorkout.tsx`, when rendering exercise cards, detect if rest/description contains 'superset' for a lone exercise. Strip the label or show it only if the adjacent exercise is also marked as a superset partner.
9. **Test with existing plans** — Check currently generated plans for orphaned superset labels and ensure the fix handles them.

### 💾 AUTO-SAVE & DATA PERSISTENCE
10. **Remove data deletion from cancel/exit** — Change `onCancel` in `App.tsx` to NOT remove `jw_active_session` from localStorage. Instead, just navigate back to dashboard while preserving the session data.
11. **Restore active session on app load** — Already partially implemented (reads from localStorage on mount). Ensure it also checks the server for the latest incomplete workout if localStorage is empty.
12. **Debounced server auto-save** — Add a 2-second debounce on `trackedData` changes that triggers `onAutoSave`. This means every weight/rep input auto-saves to the server after a brief pause.
13. **Preserve session across tab switches** — When switching to History tab and back, the active workout session should still be there. Ensure `setActiveWorkout(null)` is only called on "Finish Workout", never on navigation.
14. **Add "Resume Workout" UI on Dashboard** — If there's an in-progress session (localStorage or server), show a prominent "Resume Workout" banner on the Dashboard instead of overwriting it.

### 📝 NOTES SECTIONS
15. **Update TypeScript types** — Add `note?: string` field to `TrackedExercise` and `TrackedWorkout`. Add a new type or field for weekly notes.
16. **Update database schema** — Add `note TEXT` column to `tracked_sets` (per-exercise on the workout) or better: add `note TEXT` to a new junction or directly on `tracked_workouts` for day-level notes. Add `weekly_notes` table with `(user_id, plan_id, week_number, note)`.
17. **Add exercise-level note input** — Small collapsible text area under each exercise's set grid in ActiveWorkout. Placeholder: "Add a note about this exercise..."
18. **Add day-level note input** — Text area at the bottom of the active workout (above Finish button) for overall workout notes. Placeholder: "How did today's workout feel?"
19. **Add week-level note input** — On the Dashboard, under each week tab, add an expandable note section. Placeholder: "Weekly reflection..."
20. **Wire notes into auto-save** — Exercise and day notes should be included in the `TrackedExercise` and `TrackedWorkout` data that gets auto-saved to localStorage and the server.
21. **Update backend tracking API** — Modify `POST /api/tracking` to accept and store exercise-level and day-level notes. Create new endpoint or extend existing for weekly notes.
22. **Display saved notes on review** — When reviewing a completed workout, show any saved notes (read-only or editable).

### 🧪 TESTING & VERIFICATION
23. **Test timer with real workout** — Run through a full workout with the timer. Verify it auto-stops, handles phone lock, and doesn't interfere with set logging.
24. **Test data persistence** — Start a workout, log data, close the app, reopen. Verify all data is preserved. Test both localStorage and server recovery.
25. **Test notes across full flow** — Add notes at exercise, day, and week levels. Complete a workout. Verify notes persist in history and on review.
26. **Test superset cleanup** — Generate a new plan with AI. Check that no orphaned superset labels appear. Verify existing plans are handled.

---

## Priority Order

| Priority | Issue | Rationale |
|----------|-------|-----------|
| **P0** | Auto-save & data persistence (items 10-14) | Data loss is a trust-breaking bug. Fix first. |
| **P1** | Rest period timer (items 1-6) | High-impact UX feature, directly requested. |
| **P2** | Superset display fix (items 7-9) | Confusing but not blocking. Clean it up. |
| **P3** | Notes sections (items 15-22) | New feature, additive value. Build last. |

---

*Session concluded. All panelists agree this is a strong improvement roadmap. Let's build it.*
