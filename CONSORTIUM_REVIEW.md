# The Consortium: Project Titan Overhaul

## Meet the Panel

---

### Personal Trainers
**1. Jillian Michaels** — Celebrity trainer, 30+ years experience, known for intense metabolic conditioning. "If it doesn't challenge you, it doesn't change you."

**2. Jeff Cavaliere (AthleanX)** — Physical therapist turned trainer. Exercise science purist. Zero tolerance for "bro-science." Everything is anatomy-first.

**3. Mark Rippetoe** — Barbell strength legend. Author of *Starting Strength*. If it doesn't have a barbell, he's suspicious.

**4. Kayla Itsines** — Creator of BBG/SWEAT. Queen of mobile-first fitness apps. Knows what 40 million users actually want on their phones.

---

### Exercise Scientists
**5. Dr. Brad Schoenfeld** — PhD, world's foremost hypertrophy researcher. Published 300+ peer-reviewed papers on muscle growth.

**6. Dr. Andy Galpin** — PhD in Human Bioenergetics. Expert on all 9 physiological adaptations. "There is no one-size-fits-all."

**7. Dr. Stacy Sims** — PhD Exercise Physiology. Pioneer in sex-based training differences. "Women are not small men."

---

### UI/UX Designers
**8. Mike Kim** — Former Lead Product Designer, Peloton. Built the experience that makes people pay $44/month for a bike screen.

**9. Rachel Chen** — Senior Design Lead, Apple Fitness+. Responsible for the "rings" that gamified 100M+ people into moving.

**10. Tobias van Schneider** — Ex-Spotify Design Lead. Now runs his own studio. Known for dark, cinematic UI that feels alive.

---

### Web App Engineers
**11. Tanner Linsley** — Creator of TanStack (React Query, React Table). Knows React architecture better than most humans alive.

**12. Theo Browne (t3dotgg)** — Full-stack TypeScript evangelist. Creator of create-t3-app. Opinionated about developer experience.

---

## The Review Session

**Mike Kim (Peloton):** Alright everyone, I've pulled up the repo. Let's start from the top. `index.html` — title says "My Google AI Studio App." That's the auto-generated boilerplate title. First impression: this was scaffolded by Google AI Studio and barely touched.

**Rachel Chen (Apple):** The `metadata.json` says "Titan AI Trainer" — at least someone renamed it there. But the HTML title, the favicon, the meta tags — none of that was updated. No OG tags, no theme-color for mobile browsers. Basic hygiene is missing.

**Theo Browne:** Looking at `package.json` — it's called `react-example`. That's the Google AI Studio template name. They have `@google/genai`, `better-sqlite3` (which isn't even used), `express` (also unused), and `dotenv` sitting in dependencies. This is dependency soup. Half of these aren't imported anywhere.

**Tanner Linsley:** The Vite config is hardcoding `process.env.GEMINI_API_KEY` into the client bundle via `define`. That means the API key is **literally embedded in the JavaScript bundle** shipped to the browser. That's a security catastrophe. You can open DevTools, search the bundle, and extract the key.

**Jillian Michaels:** I don't care about the code — show me the product. *clicks through the wizard*. OK so Step 1 asks for age, gender, height, weight. Step 2 is body type. Step 3 is days/week and duration. Step 4 is goals. Step 5 is experience. Step 6 is review. Then it generates. The *flow* is fine. The *soul* is missing. There's no personality. No motivation. No reason for me to trust this app over a free PDF I found on Reddit.

**Jeff Cavaliere:** The height is in feet/inches and weight in pounds — hardcoded. No metric option. That eliminates half the planet. Also, the body type step uses somatotypes which are — Dr. Schoenfeld, back me up here — largely debunked.

**Dr. Brad Schoenfeld:** Correct. Somatotypes (ectomorph/mesomorph/endomorph) are a 1940s classification system with no predictive validity for training response. However, *perceived* body type does correlate with user goals. I'd keep it as a UX shortcut but not label it "Body Composition" — that implies we're measuring something. Call it something like "Current Build" and use it to pre-select goals, not drive the algorithm directly.

**Dr. Andy Galpin:** The prompt engineering in `ai.ts` is... ambitious. It asks for a full multi-week periodized plan with exercise alternatives and descriptions. That's a LOT of JSON for one API call. The model will hallucinate structure. I've seen Gemini return 5-week plans when asked for 6, skip days, or duplicate exercises. There's zero validation on the response.

**Dr. Stacy Sims:** There's no consideration for biological sex in the programming. A 45-year-old perimenopausal woman and a 20-year-old male get the same algorithmic treatment. The prompt doesn't differentiate. At minimum, the system prompt should acknowledge hormonal considerations.

**Kayla Itsines:** From a mobile perspective — I just resized to 375px width. The plan display page is a disaster. The sidebar nav for days is horizontal-scrolling on mobile, the exercise cards are too tall, the swap button hover effect doesn't work on touch devices. The modal for exercise details takes up the full screen but has no swipe-to-dismiss. This was clearly designed desktop-first and squeezed down.

**Mike Kim:** The loading screen is a spinning brain icon with "Consulting the Archives..." — that's cute but it doesn't build trust. At Peloton, we learned that loading states need to feel *productive*, not idle. Show steps: "Analyzing your biometrics..." → "Selecting optimal exercises..." → "Building periodization..." Even if it's fake progress, it drastically improves perceived performance.

**Rachel Chen:** The color system is Slate + Emerald. It's clean but generic. Every "dark mode fitness app" looks like this. We need a signature visual element. At Apple, Fitness+ uses those gradient rings as identity. Peloton has the leaderboard red. This app has... nothing. It's a Tailwind template.

**Tobias van Schneider:** The animations are there — they're using Framer Motion (via `motion/react`). But they're all the same: fade + blur in, fade + blur out. No personality. No micro-interactions. The progress bar animates smoothly — that's the ONE nice touch. Everything else is paint-by-numbers.

**Tanner Linsley:** The Zustand store is fine structurally but the types are out of sync with what the components actually use. The store defines `height: number` (cm) but the components use `heightFt` and `heightIn`. The store has no `planDurationWeeks`, no `splitPreference`, no `swapExercise` — but the components reference all of these. This code doesn't compile. It was incrementally edited and never validated.

**Theo Browne:** And the big one: the API key is on the client. We need a server proxy. Even a simple Vite dev server middleware or a tiny Express endpoint would work. The key should NEVER touch the browser. This is a hard blocker.

**Mark Rippetoe:** I've been quiet because I'm reading the AI prompt. It says "If Split Preference is 'auto', choose the best one for their days/week." Good. But the exercise selection has no periodization model. It says "vary volume week-to-week" but doesn't specify a model. Linear progression? Undulating? Block? Without a model, the AI will just randomize things. That's not periodization, that's chaos.

**Jeff Cavaliere:** And there are no tempo prescriptions. No RPE targets per set. No deload protocol. This is a workout *list*, not a *program*. A program has intent behind every variable.

---

## The Verdict

**Jillian Michaels:** It's a prototype. A decent one. But it's not shippable.

**Mike Kim:** Agreed. The bones are there — wizard flow, state management, AI generation, plan display. But every layer needs work.

**Rachel Chen:** We're not patching this. We're rebuilding it. Same tech stack (React + Vite + Tailwind + Zustand), but every file gets rewritten.

**Theo Browne:** And we're switching from Gemini to GPT. OpenAI's structured output mode (`response_format: { type: "json_object" }`) is more reliable for the complex JSON we need. Plus we need a server-side proxy to protect the API key.

**Tanner Linsley:** Let's also add proper TypeScript — strict types, no `any`, proper discriminated unions for the step state.

---

## The Master TODO List

### Phase 0: Project Cleanup
- [ ] 0.1 — Rename project from "react-example" to "titan-ai-trainer" in `package.json`
- [ ] 0.2 — Update `index.html` with proper title, meta tags, theme-color, and favicon
- [ ] 0.3 — Remove unused dependencies: `@google/genai`, `better-sqlite3`, `dotenv`, `express`, `@types/express`
- [ ] 0.4 — Add `openai` npm package for GPT integration
- [ ] 0.5 — Remove Gemini-specific config from `vite.config.ts` (the `define` block with GEMINI_API_KEY)
- [ ] 0.6 — Update `metadata.json` with finalized app identity
- [ ] 0.7 — Clean up `tsconfig.json` paths and enable strict mode

### Phase 1: State Architecture
- [ ] 1.1 — Rewrite `useAppStore.ts` with COMPLETE types that match ALL component usage
- [ ] 1.2 — Add `heightFt`, `heightIn`, `planDurationWeeks`, `splitPreference` to UserProfile
- [ ] 1.3 — Add `Split` type union (`'auto' | 'full_body' | 'upper_lower' | 'ppl' | 'body_part'`)
- [ ] 1.4 — Add `WorkoutWeek` type wrapping schedule with `weekNumber`
- [ ] 1.5 — Add `alternatives` field to `Exercise` type
- [ ] 1.6 — Add `description` field to `Exercise` type
- [ ] 1.7 — Add `swapExercise` action to store
- [ ] 1.8 — Add `error` state and `setError` action for error handling
- [ ] 1.9 — Use imperial units (lbs, ft/in) as primary since target audience is US
- [ ] 1.10 — Add proper initial defaults that make sense (5'10", 170lbs, etc.)

### Phase 2: AI Service — Switch to GPT
- [ ] 2.1 — Create server-side API proxy route (Vite middleware or Express endpoint) so API key never hits the browser
- [ ] 2.2 — Rewrite `ai.ts` to call the local proxy instead of Gemini directly
- [ ] 2.3 — Engineer a masterclass system prompt incorporating:
  - Periodization model (linear for beginners, undulating for intermediate+)
  - RPE-based intensity scaling
  - Sex-aware programming notes
  - Safety layer (no contraindicated exercises for listed injuries)
  - Mandatory warmup/cooldown prescriptions
  - Exercise alternatives for every movement
  - Description (how to perform) for every exercise
- [ ] 2.4 — Add JSON schema validation on the AI response (don't blindly trust the model)
- [ ] 2.5 — Add retry logic with exponential backoff
- [ ] 2.6 — Add proper error messages ("The AI service is currently busy, please try again")

### Phase 3: Complete UI/UX Redesign
- [ ] 3.1 — Redesign `index.css` with an elevated design system:
  - Custom CSS properties for spacing, radii, shadows
  - Gradient accent system (emerald → cyan signature gradient)
  - Refined typography scale
  - Custom scrollbar styling
  - Smooth global transitions
- [ ] 3.2 — Redesign `WizardLayout` with:
  - Segmented progress indicator (not just a bar — show step labels)
  - Glass-morphism card effect
  - Keyboard navigation support (Enter = Next)
  - Step counter text ("Step 2 of 6")
- [ ] 3.3 — Redesign `StepBiometrics`:
  - Large, touch-friendly number inputs with +/- stepper buttons
  - Visual height picker or ft/in side-by-side with proper labels
  - Unit labels inside inputs
  - Gender as pill selector, not dropdown  
- [ ] 3.4 — Redesign `StepBodyType`:
  - Illustrated silhouettes or icons for each type
  - Better descriptions with goal-mapping ("Best for: Building mass")
  - Animated selection state
- [ ] 3.5 — Redesign `StepConstraints`:
  - Modern range sliders with gradient fill
  - Large value displays
  - Contextual tips ("3 days/week works best with Full Body splits")
- [ ] 3.6 — Redesign `StepGoals`:
  - Card-based goal selector with icons
  - Split preference as visual grid
  - Intensity with colored indicators (green/yellow/red)
- [ ] 3.7 — Redesign `StepHistory`:
  - Experience as visual tier badges
  - Injuries textarea with helpful placeholder examples
- [ ] 3.8 — Redesign `StepReview`:
  - Profile summary card with all selections visible
  - Edit buttons to jump back to specific steps
  - Prominent CTA with loading state
- [ ] 3.9 — Redesign Loading/Generation screen:
  - Multi-phase progress with fake steps
  - Animated particles or pulse effects
  - Progress percentage counter
  - Motivational micro-copy that rotates
- [ ] 3.10 — Redesign `PlanDisplay`:
  - Clean week/day navigation
  - Exercise cards with expand/collapse
  - Swap alternatives inline
  - Exercise detail modal with YouTube link
  - Print/export functionality
  - "Start Over" with confirmation
- [ ] 3.11 — Add proper error UI (toast notifications or inline error states)

### Phase 4: Mobile-First Polish
- [ ] 4.1 — Ensure all touch targets are minimum 44px
- [ ] 4.2 — Test and fix horizontal overflow on 375px viewport
- [ ] 4.3 — Swipe gestures for wizard navigation (nice-to-have)
- [ ] 4.4 — Bottom-anchored navigation buttons on mobile
- [ ] 4.5 — Exercise modal as bottom sheet on mobile

### Phase 5: Animations & Micro-interactions
- [ ] 5.1 — Wizard step transitions (slide left/right based on direction)
- [ ] 5.2 — Selection feedback (scale + glow on option pick)
- [ ] 5.3 — Staggered list animations for exercise rows
- [ ] 5.4 — Number counter animation for stats
- [ ] 5.5 — Smooth accordion expand/collapse for exercise details

### Phase 6: Final Integration & QA
- [ ] 6.1 — Wire everything together end-to-end
- [ ] 6.2 — Verify TypeScript compiles with zero errors
- [ ] 6.3 — Test full user flow: biometrics → body type → constraints → goals → history → review → generate → display
- [ ] 6.4 — Verify mobile responsiveness at 375px, 428px, 768px, 1024px
- [ ] 6.5 — Run `npm run build` to verify production build succeeds

---

*"Child's play. Let's build something world-class."* — The Consortium

