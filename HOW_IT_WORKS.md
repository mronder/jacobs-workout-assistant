# How Titan AI Trainer Works

---

## For Everyone (The Simple Version)

**Titan AI Trainer is a web app that builds you a fully personalized, multi-week workout program in about 30–60 seconds.**

Here's what happens when someone uses it:

### Step 1 — You Tell Us About Yourself
The app walks you through a short wizard (6 screens). You enter:
- Age, height, weight, body type
- Your fitness goal (fat loss, muscle building, strength, endurance, or flexibility)
- How many days per week you can train
- How long each session should be
- Your experience level (beginner, intermediate, advanced)
- Any injuries or limitations
- How many weeks you want the program to run

### Step 2 — AI Builds Your Program
When you hit "Generate," the app sends your information to OpenAI's GPT-4o-mini (a fast, cost-effective AI model). The AI doesn't just make a generic plan — it factors in your exact profile, injuries, goals, and experience to create a truly custom program.

The AI generates each week of your plan with:
- The right number of training days and rest days
- Specific exercises with sets, reps, and rest periods
- Muscle-specific warmups for each session
- Cooldown routines
- Alternative exercises you can swap in with one click
- Progressive overload (the program gets harder over time, then deloads)

### Step 3 — You Use It
The finished program displays in a clean, interactive interface. You can:
- Browse through each week and day
- See exercise descriptions and coaching notes
- Swap any exercise for an alternative
- Copy the entire plan as text
- Start over with new parameters anytime

Your plan is saved in your browser automatically — close the tab, come back later, it's still there.

---

## For the Technical Team (How It Actually Works Under the Hood)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                     │
│                                                          │
│  React 19 + Vite 6 + Tailwind CSS v4 + Zustand Store   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │  Wizard   │→ │ AI Service│→ │    PlanDisplay.tsx     │ │
│  │  (6 steps)│  │ (ai.ts)  │  │  (interactive viewer) │ │
│  └──────────┘  └────┬─────┘  └───────────────────────┘ │
│                      │ fetch()                           │
└──────────────────────┼───────────────────────────────────┘
                       │
          ─────────────┼─────────────────
          Development  │     Production
          ─────────────┼─────────────────
                       │
       ┌───────────────┴───────────────┐
       │                               │
  ┌────▼─────┐              ┌──────────▼──────────┐
  │ Vite Dev │              │ Netlify Edge Funcs   │
  │ Plugin   │              │ (Deno runtime, 50s)  │
  │ (Node.js)│              │                      │
  └────┬─────┘              └──────────┬───────────┘
       │                               │
       └───────────┬───────────────────┘
                   │
           ┌───────▼───────┐
           │  OpenAI API   │
           │ (gpt-4o-mini) │
           └───────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 19 | Component-based UI |
| Build Tool | Vite 6.4 | Dev server + production bundler |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| State Management | Zustand v5 (with persist) | Global state + localStorage persistence |
| Animations | motion/react (Framer Motion) | Page transitions, dropdowns |
| AI Model | OpenAI gpt-4o-mini | Fast, cheap workout generation |
| Dev Server API | Vite Plugin (Node.js) | Local API routes during development |
| Production API | Netlify Edge Functions (Deno) | Serverless API with 50-second timeout |
| Hosting | Netlify | Static site + edge functions |
| Version Control | GitHub (private repo) | Source management |

### The Generation Pipeline (What Happens on "Generate")

#### 1. Client fires all requests in parallel (`src/services/ai.ts`)

```
Promise.all([
  fetchMeta(profile),        // ~1-2 seconds — title, description
  fetchWeek(profile, 1),     // ~15-25 seconds — full week of workouts
  fetchWeek(profile, 2),     // same, runs simultaneously
  fetchWeek(profile, 3),     // same
  fetchWeek(profile, 4),     // same (if 4-week plan)
])
```

All API calls fire at once using `Promise.all`. Total time = slowest single call, not the sum of all calls.

#### 2. Each request hits the Edge Function (`netlify/edge-functions/generate-week.ts`)

The Edge Function:
- Reads the user profile from the POST body
- Builds a compressed system prompt using `shared/prompts.ts`
- Calls OpenAI's API (non-streaming, `response_format: json_object`)
- Validates the JSON response
- Returns it to the client

The prompt includes:
- Exact training day / rest day counts (e.g., "5 WORKOUT days + 2 REST days = 7 total")
- Goal-specific programming rules (hypertrophy rep ranges, fat loss circuits, etc.)
- Experience-gated exercises (beginners get machines, advanced get barbell compounds)
- Injury-specific banned exercise lists
- Periodization phase labels (Foundation → Build → Peak → Deload)
- A JSON schema template the AI must follow

#### 3. Client validates and enforces rules (`enforceSevenDays()` in `ai.ts`)

Even with careful prompting, AI can occasionally miscategorize days. The `enforceSevenDays()` function runs on every week response and:

1. **Classifies** every day — any day with "rest" or "recovery" in its focus gets its exercises stripped (forced to rest day)
2. **Counts** training vs. rest days — trims excess training days to the user's target
3. **Pads** to exactly 7 days if needed — adds rest days
4. **Interleaves** training and rest days naturally
5. **Re-numbers** all days (Day 1 through Day 7)

This guarantees the user always sees exactly N training days + (7-N) rest days, regardless of what the AI returns.

#### 4. Plan is assembled and persisted

The meta response (title, description) is merged with all validated weeks into a `WorkoutPlan` object, stored in Zustand state, and automatically persisted to `localStorage` (key: `titan-ai-trainer`).

### Key Optimizations

| Optimization | Impact |
|-------------|--------|
| **Parallel week generation** | 5× faster for a 4-week plan (all weeks generated simultaneously) |
| **Non-streaming Edge Functions** | Lower overhead than chunked streaming; 50s timeout is sufficient |
| **Name-only alternatives** | ~40% fewer output tokens (only the exercise name, not full sets/reps/rest) |
| **Compressed prompts** | ~800 tokens per prompt vs. ~1500 in early versions |
| **max_tokens: 3500** | Limits AI verbosity; faster completions |
| **temperature: 0.5** | More consistent outputs, fewer creative deviations |
| **Client-side day enforcement** | Eliminates expensive retry loops for day-count errors |
| **localStorage persistence** | No re-generation needed if user refreshes or returns |

### File Map

| File | Role |
|------|------|
| `src/services/ai.ts` | Orchestrates all API calls, validates responses, enforces 7-day schedule |
| `src/store/useAppStore.ts` | Zustand store — all types, state, and actions |
| `src/components/PlanDisplay.tsx` | Interactive plan viewer with exercise swap, copy, phases |
| `src/components/Step*.tsx` | Wizard step components (Biometrics, Goals, etc.) |
| `src/components/WizardLayout.tsx` | Wizard container with progress bar and navigation |
| `shared/prompts.ts` | Prompt builders shared between dev and production |
| `server/apiPlugin.ts` | Vite dev server middleware (local API for development) |
| `netlify/edge-functions/generate-week.ts` | Production Edge Function — per-week generation |
| `netlify/edge-functions/generate-meta.ts` | Production Edge Function — plan metadata |
| `netlify.toml` | Netlify build + deploy configuration |

### Environment Requirements

- **OPENAI_API_KEY** — set in Netlify env vars (production) and `.env` (local dev)
- **Node.js 20+** — build and dev server
- **npm** — package management

### Cost Per Plan Generation

Using `gpt-4o-mini` pricing (~$0.15 / 1M input tokens, ~$0.60 / 1M output tokens):
- A 4-week plan uses roughly ~5K input tokens and ~15K output tokens
- **Cost: ~$0.01 per plan** (about one cent)
