# Focus Group Review — Titan AI Trainer
**Date:** 2025 · **Panel:** 12 physical therapists, personal trainers, exercise scientists, motivational experts, and daily users

---

## Panel Introductions

### 1. Dr. Sarah Chen, DPT — Physical Therapist (15 years)
> *"I run a sports rehab clinic in Boston. I've seen every injury in the book. I'm here to evaluate how this app handles limitations and recovery."*

### 2. Marcus Williams — NASM-CPT, Personal Trainer (10 years)
> *"I train clients from weekend warriors to competitive athletes. I want to see if this AI can match what I program for real people."*

### 3. Dr. Elena Rossi — Exercise Scientist, PhD Kinesiology
> *"I research periodization models at UC Davis. I'll be evaluating the scientific validity of the programming."*

### 4. James "Big Jim" Hartley — Strength & Conditioning Coach (20 years)
> *"I've trained NFL linemen and D1 athletes. If this app gives me a plan with one bicep curl on a training day, I'm flipping the table."*

### 5. Priya Sharma — Certified Yoga Instructor & Mobility Specialist
> *"I focus on the recovery side — cooldowns, mobility, flexibility. Most apps completely phone it in on recovery days."*

### 6. Coach Tommy Lee — CrossFit L3, Functional Fitness Expert
> *"High intensity, varied movements, proper scaling. I want to see if this AI understands how to program REAL workouts."*

### 7. Dr. Michael Oduya — Sports Psychologist & Motivational Expert
> *"The best program is the one people actually follow. I'm looking at the UX, the language, and the motivational hooks."*

### 8. Rachel Nguyen — Daily User, Intermediate Lifter (3 years training)
> *"I'm the target audience. I've used Hevy, JEFIT, and Strong. I want to see if this actually gives me something useful."*

### 9. David Morales — Daily User, Beginner (3 months training)
> *"I don't know what 'RPE' means. I need an app that tells me exactly what to do without making me feel stupid."*

### 10. Dr. Lisa Johansson — Physical Therapist & Post-Rehab Specialist
> *"I work with people coming back from surgery. The injuries section is critical for me."*

### 11. Kofi Mensah — CSCS, Athletic Performance Coach
> *"Progressive overload, deload weeks, periodization phases — I need to see real science in these plans."*

### 12. Alex Rivera — Daily User, Advanced Powerlifter (8 years)
> *"I run conjugate periodization and wave loading. If this app gives me '3 sets of 10' for everything, it's dead to me."*

---

## The Discussion

**Big Jim:** Alright, I generated a 4-week plan. I'm a 35-year-old male, 6'2", 230 lbs, advanced, build muscle, 5 days a week. Let me see what Titan cooked up... *scrolls through* ...okay, some of these training days only have 3-4 exercises. For a 45-minute session? I can do that in 15 minutes. Where's the volume?

**Coach Tommy:** I noticed the same thing. I changed my goal from "build muscle" to "endurance" and expected a completely different plan. The exercises barely changed. Are the inputs actually doing anything?

**Dr. Rossi:** I ran it twice — once as a beginner and once as advanced. The exercise selection was almost identical. A beginner should be getting compound movements with machine alternatives. An advanced lifter should see chains, bands, tempo work. The differentiation is too weak.

**Rachel:** As a regular user, the rest days are pathetic. It literally says "Rest Day" with one exercise: "Light walking." That's not a rest day program, that's a fortune cookie.

**David:** I'm confused by the whole thing. It says "Active Recovery" but there's like one foam rolling exercise. When I used Nike Training Club, rest days had full 15-minute mobility routines.

**Dr. Chen:** The injury handling is... okay? I typed "bad left knee" and it did avoid heavy squats, but it still included lunges. Lunges with a bad knee? That's lawsuit territory.

**Dr. Johansson:** Agreed. The injury system needs to be more aggressive. If someone says "rotator cuff," ALL overhead pressing should be eliminated, not just "modified."

**Priya:** The warmups are generic. "Arm circles, leg swings, hip circles" for every single day regardless of what muscles you're working. The cooldowns are worse — same 2 stretches every day.

**Kofi:** Where's the progressive overload? Week 1 and Week 3 have the same sets, reps, and weight prescriptions. Real periodization means Week 1 is 3×10 at RPE 7, Week 2 is 3×8 at RPE 8, Week 3 is 4×6 at RPE 8.5. This is just copy-paste.

**Alex:** For an advanced lifter, I expected percentages, or at least RPE targets per exercise. Instead I get "3 sets of 8-10 reps" which is what you'd give to someone who walked into a gym for the first time.

**Dr. Oduya:** From a motivation standpoint, the app doesn't tell me WHY it chose these exercises for ME. It says generic notes like "great for chest development." How about "Because your goal is strength and you're advanced, we're using close-grip bench to target your weak lockout"?

**Big Jim:** Bottom line — this feels like it generates one generic template and slaps different labels on it. The INPUTS need to MATTER. Every field the user filled out should visibly change the output.

**Rachel:** Also, where's the summary? When I finish generating, I want to see "This plan was designed for YOUR goal of fat loss, with YOUR 4-day schedule, avoiding YOUR knee injury." Make me feel like it was made for me.

**Everyone in unison:** This is child's play. We're not convinced.

---

## Comprehensive TODO List

### CRITICAL — Make Inputs Actually Matter

| # | Issue | Fix |
|---|-------|-----|
| 1 | Exercise count too low on training days | Enforce minimum: 4 exercises for 30min, 5-6 for 45min, 7-8 for 60min+ sessions |
| 2 | Goal doesn't meaningfully change exercises | Add goal-specific prompt sections: lose_weight → supersets/circuits/HIIT finishers; strength → heavy compounds/low reps/long rest; endurance → high rep/short rest/cardio blocks |
| 3 | Experience level barely changes output | Beginner: machines + guided movements only; Intermediate: free weights + some advanced; Advanced: tempo work, RPE targets, chains/bands, wave loading |
| 4 | Periodization is flat (same volume each week) | Explicitly tell AI: Week 1 = base, Week 2 = +volume, Week 3 = peak, Week 4 = deload. Include specific set/rep changes |
| 5 | Warmups are generic | Warmups must be specific to the day's muscle groups. Leg day → hip openers, ankle mobility, glute activation. NOT arm circles. |
| 6 | Cooldowns are minimal | Cooldowns must target the worked muscles. After chest day → pec stretch, thoracic rotation, NOT generic hamstring stretch |
| 7 | Rest days are empty | Rest days need 3-5 activities: foam rolling routine, mobility flow, light cardio options, mental wellness note |
| 8 | Injury handling too lax | Add a BANNED exercises list in prompt for common injuries (bad knee = no lunges/jump squats/deep squats) |
| 9 | No RPE/intensity per exercise | Each exercise should show target RPE or percentage for advanced users |
| 10 | Alternatives are weak | Alternatives should be categorized: "Easier" alternative and "Harder" alternative, not just random swaps |

### HIGH — UX & Personalization

| # | Issue | Fix |
|---|-------|-----|
| 11 | No personalization summary on plan page | Add a "Designed For You" card showing: goal, body type, experience, injuries, days/week |
| 12 | No motivational language in plan | Add a motivational quote or tip per week that relates to the user's goal |
| 13 | Notes are generic | Notes should reference the user's specific goal and body type |

### MEDIUM — Polish

| # | Issue | Fix |
|---|-------|-----|
| 14 | No indication of plan intensity progression across weeks | Add a visual indicator per week (e.g., "Base Phase", "Build Phase", "Peak", "Deload") |

---

*Signed: The Focus Group Panel*
*"Fix this, or we're going to your competitor."*
