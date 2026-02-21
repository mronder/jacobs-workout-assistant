# Engineering Consortium Review — Titan AI Trainer v2

**Date:** 2025 · **Project:** Titan AI Trainer  
**Scope:** Full codebase audit, problem identification, and prescribed solutions  
**Panel:** 10 senior engineers across webapp design, full-stack, UI/UX, edge-case removal, and optimization

---

## Meet the Panel

### 1. Riya Mehta — Senior Full-Stack Architect
> *"I specialize in API-intensive React apps. I'll be looking at the OpenAI integration, the Vite server plugin, data flow, and error boundary architecture."*

### 2. Marcus Chen — Principal UI/UX Engineer
> *"I focus on interaction patterns, accessibility, and micro-interactions. I'll audit every touchpoint — from the wizard flow to the plan display — for friction and polish."*

### 3. Adriana Soler — Senior Edge-Case Removal Engineer
> *"I hunt the bugs nobody thinks to test. Empty inputs, double-clicks, network failures mid-stream, 11-inch heights, 700-pound edge cases. I'll find them all."*

### 4. Tobias Richter — Performance & Optimization Lead
> *"Bundle size, render performance, memoization, lazy loading, asset strategy. I'll make sure this app loads fast and stays fast."*

### 5. Jasmine Okafor — Senior Webapp Designer
> *"I'll evaluate the visual hierarchy, spacing rhythm, color contrast, typography scale, and responsive breakpoints across devices."*

### 6. Sven Eriksson — API & Prompt Engineering Specialist
> *"My focus is the OpenAI prompt, token economics, response reliability, and the generation pipeline. The truncation problem lives in my domain."*

### 7. Camille Dupont — State Management & Data Persistence Engineer
> *"Zustand store architecture, state lifecycle, persistence strategies, and data integrity during wizard navigation — that's my beat."*

### 8. Dmitri Volkov — Mobile-First Responsive Engineer
> *"I'll be testing every component at 320px, 375px, 768px, and 1440px. Touch targets, scroll behavior, and gesture support are my focus."*

### 9. Nadia Kowalski — Accessibility & Semantic HTML Specialist
> *"WCAG 2.1 AA compliance, keyboard navigation, screen reader support, focus management, and ARIA patterns. Every user deserves access."*

### 10. Jordan Blake — DevOps & Build Pipeline Engineer
> *"Package.json hygiene, build optimization, environment configuration, and deployment readiness. I'll make sure the scaffold is rock-solid."*

---

## Deep Dive: Codebase Audit

### CRITICAL: Token Truncation in AI Generation
**Found by: Sven Eriksson**

> *"This is the #1 issue. The app asks gpt-4o-mini (max 16,384 output tokens) to generate 4-8 weeks × 7 days × ~5 exercises × 2 alternatives each — all in a single API call. An 8-week plan easily requires 30,000+ tokens of JSON. Even a 4-week plan frequently hits the ceiling. The `finish_reason: 'length'` check catches it, but the user just sees an error. This is an **architectural problem**, not a parameter tweak."*

**Solution: Week-by-week chunked generation.** Generate each week in a separate API call. This:
- Eliminates token truncation entirely (1 week ≈ 3,000-4,000 tokens)
- Enables real progress updates ("Generating Week 1 of 4...")
- Allows retry of a single failed week instead of the whole plan
- Lets the model produce more detailed output per week
- Reduces alternatives from 2 to 1 per exercise to further save tokens

### CRITICAL: No Input Validation on Wizard
**Found by: Adriana Soler**

> *"Users can click 'Continue' on Step 0 (Biometrics) without entering ANY data. Age=0, heightFt=0, heightIn=0, weight=0 gets sent to the API. The prompt says 'Age: 0, Height: 0'0"' which confuses the model. Every step that has required fields should validate before allowing navigation."*

**Solution:** Add `isNextDisabled` logic to each step. StepBiometrics requires age > 0, heightFt > 0, weight > 0. StepReview validates the complete profile before generation.

### HIGH: Enter Key Triggers Navigation from Textarea
**Found by: Adriana Soler**

> *"In StepHistory, the injuries textarea is inside WizardLayout which has a global `keydown` listener for Enter. Pressing Enter to add a new line in the textarea instead navigates to the next step. This is a significant UX bug."*

**Solution:** Check `e.target` in the keydown handler — skip if the active element is a textarea or contenteditable.

### HIGH: Swap Button Invisible on Mobile (Touch Devices)
**Found by: Dmitri Volkov**

> *"The exercise swap button uses `opacity-0 group-hover:opacity-100`. On touch devices, there's no hover state. Mobile users can never see or tap the swap button. This is a core feature that's completely broken on mobile."*

**Solution:** Always show the swap button (remove the hover-only visibility). Use a more subtle default style that's always visible.

### HIGH: Swap Dropdown Doesn't Close on Outside Click
**Found by: Marcus Chen**

> *"The swap dropdown only closes by clicking the same shuffle button again. Clicking anywhere else on the page leaves it open, overlapping content. This is a standard dropdown pattern violation."*

**Solution:** Add a `useEffect` with a document click listener that closes the dropdown when clicking outside.

### MEDIUM: No Double-Click Protection on Generate
**Found by: Adriana Soler**

> *"Clicking 'Generate My Plan' twice rapidly fires two API requests. The second one may overwrite the first or cause race conditions. The button should be immediately disabled after the first click."*

**Solution:** Disable the button as soon as `isGenerating` becomes true. The `StepReview` already sets `isGenerating(true)` but the button isn't disabled based on it.

### MEDIUM: State Lost on Page Refresh
**Found by: Camille Dupont**

> *"No persistence. If the user fills out 5 steps of the wizard and accidentally refreshes, everything is lost. If they generate a plan and refresh, the plan is gone. This is unacceptable for a multi-step wizard."*

**Solution:** Add Zustand `persist` middleware with localStorage. Persist `userProfile` and `workoutPlan`. Clear on explicit reset.

### MEDIUM: Error Toast Stale After Retry
**Found by: Marcus Chen**

> *"When generation fails and the error toast appears, if the user goes back and tries again, the old error toast remains visible until manually dismissed. It should auto-clear when a new generation starts."*

**Solution:** Call `setError(null)` at the start of `handleGenerate` (already done in StepReview, but verify it clears before the overlay covers it).

### MEDIUM: No Accessible Labels or Focus Management
**Found by: Nadia Kowalski**

> *"Most buttons lack `aria-label`. The wizard has no focus trap. The modals (exercise detail, reset confirmation) don't trap focus or announce themselves. Screen readers can't navigate the day selector or exercise list meaningfully."*

**Solution:** Add `aria-label` to icon-only buttons, `role="dialog"` and `aria-modal="true"` to modals, and focus trap logic for overlays.

### LOW: Vite Duplicated in Dependencies
**Found by: Jordan Blake**

> *"Vite appears in both `dependencies` and `devDependencies`. It should only be in `devDependencies`. This inflates production install size."*

**Solution:** Remove `vite` from `dependencies`.

### LOW: Export Is Just window.print()
**Found by: Jasmine Okafor**

> *"The Export button calls `window.print()`, which produces a browser print dialog with no print-specific styling (the dark background will waste ink, layout isn't print-optimized). Consider generating a structured text or formatted summary."*

**Solution:** Add proper print CSS OR generate a text-based summary that can be copied/downloaded.

### LOW: `tailwindcss` in Both Deps and DevDeps
**Found by: Jordan Blake**

> *"Similar to vite, `tailwindcss` is in both. Should be devDependencies only."*

### LOW: No Animation on Exercise Swap
**Found by: Marcus Chen**

> *"When swapping an exercise, the content just jumps. A subtle transition would make the swap feel intentional."*

### OPTIMIZATION: Reduce Prompt Verbosity
**Found by: Sven Eriksson**

> *"The system prompt is ~1,200 tokens. The JSON schema example alone is ~400 tokens. With a user message, we're spending ~1,800 tokens on input for every API call. For week-by-week generation with 4-8 calls, we should minimize the system prompt and cache it where possible."*

---

## Execution TODO

| # | Priority | Task | Owner |
|---|----------|------|-------|
| 1 | CRITICAL | Implement week-by-week chunked generation | Sven + Riya |
| 2 | CRITICAL | Add input validation to all wizard steps | Adriana |
| 3 | HIGH | Fix Enter key in textarea | Adriana |
| 4 | HIGH | Fix mobile swap button (always visible) | Dmitri |
| 5 | HIGH | Fix swap dropdown outside-click close | Marcus |
| 6 | MEDIUM | Add double-click protection on generate | Adriana |
| 7 | MEDIUM | Add localStorage persistence (Zustand persist) | Camille |
| 8 | MEDIUM | Clear error on retry | Marcus |
| 9 | MEDIUM | Add accessibility (aria-labels, dialog roles, focus) | Nadia |
| 10 | LOW | Fix package.json — remove vite/tailwindcss from deps | Jordan |
| 11 | LOW | Better export (downloadable text summary) | Jasmine |
| 12 | LOW | Optimize prompt token usage for chunked gen | Sven |
| 13 | FINAL | Restart dev server, verify all fixes | All |

---

*Signed: The Engineering Consortium Panel*
