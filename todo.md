# Project Titan: To-Do List

## Phase 1: Foundation & Setup
- [ ] **Configure Metadata**: Update `metadata.json` with app name "Titan AI Trainer" and description.
- [ ] **Clean Project**: Clear out default Vite/React boilerplate.
- [ ] **Install Dependencies**: Ensure `lucide-react`, `motion`, `clsx`, `tailwind-merge` are ready (install if missing).
- [ ] **Design System Setup**: Define Tailwind theme colors (Slate/Emerald/Violet) and fonts in `index.css`.

## Phase 2: User Input Wizard (The "Intake")
- [ ] **Create Store**: Build a simple state manager (Zustand or Context) to hold user metrics (Age, W/H, Goal, Days, etc.).
- [ ] **Component: StepLayout**: A wrapper with a progress bar and "Next/Back" navigation.
- [ ] **Step 1: Biometrics**: Inputs for Age, Gender, Height, Weight.
- [ ] **Step 2: Body Composition**: Visual selector for "Body Type" (Slim, Average, Heavy, Athletic).
- [ ] **Step 3: Constraints**: Slider for "Days per week", "Minutes per workout".
- [ ] **Step 4: Intensity & Goals**: Toggle for Intensity (Low/Med/High), Goal (Lose Fat, Build Muscle, Endurance).
- [ ] **Step 5: Review**: Summary screen before generation.

## Phase 3: The AI Brain (Gemini Integration)
- [ ] **Service Layer**: Create `src/services/ai.ts`.
- [ ] **Prompt Engineering**: Write a robust system prompt that:
    - Accepts user JSON.
    - Returns strictly structured JSON (Week -> Day -> Exercises).
    - Includes Warmup/Cooldown.
    - Adds "Why this exercise?" notes (simulating the web research).
- [ ] **API Connection**: Hook up `GoogleGenAI` with the environment key.

## Phase 4: The Workout Plan Display
- [ ] **Component: PlanContainer**: The main dashboard showing the generated result.
- [ ] **Component: WeekView**: Tabs or accordion for navigating weeks (if long plan).
- [ ] **Component: DayCard**: A card showing that day's workout.
- [ ] **Component: ExerciseRow**: Detailed row with Sets, Reps, RPE, and Rest time.
- [ ] **Feature: Export/Save**: Simple "Print to PDF" or "Copy to Clipboard" feature (keep it simple for MVP).

## Phase 5: Polish & UX
- [ ] **Loading State**: Create the "Scanning web..." animation Leo requested.
- [ ] **Animations**: Use `framer-motion` for page transitions and list staggering.
- [ ] **Responsive Check**: Ensure it works on mobile (gym use context).

## Phase 6: Final Review
- [ ] **Lint & Build**: Run `lint_applet` and `compile_applet`.
- [ ] **Manual Test**: Verify the AI doesn't hallucinate dangerous exercises.
