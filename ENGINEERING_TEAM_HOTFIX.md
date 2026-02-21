# Engineering Strike Team — 504/JSON Truncation Hotfix

## Team Introduction

### 1. Sarah Chen — Senior Full Stack Engineer (Netflix, 12 YOE)
Speciality: React + serverless architectures, streaming APIs.
*"I've shipped streaming chat UIs at Netflix scale. I know exactly what's happening here."*

### 2. Marcus Wright — Netlify Platform Engineer (Netlify, 8 YOE)
Speciality: Netlify Functions, Edge Functions, CDN routing, deploy pipelines.
*"I've seen this timeout pattern a hundred times. Free-tier Lambda has a 10-second wall."*

### 3. Dmitri Volkov — Backend Architect (Stripe → Independent, 15 YOE)
Speciality: API design, serverless performance, OpenAI integrations.
*"The fix isn't 'make it faster' — it's 'pick the right compute layer.' Edge Functions give us 50 seconds."*

### 4. Aisha Patel — DevOps / Cloud Engineer (AWS → Vercel → Freelance, 10 YOE)
Speciality: CI/CD, infrastructure as code, serverless function bundling.
*"The bundling and import resolution between shared modules and edge function context is where things break silently."*

### 5. Jake Torres — Frontend Performance Engineer (Shopify, 7 YOE)
Speciality: Client-side resilience, fetch patterns, streaming consumption.
*"The client code needs to handle partial responses, streaming, and environment-specific URL routing cleanly."*

---

## Root Cause Analysis

### Timeline of Errors
| Deploy | Error | Root Cause |
|--------|-------|------------|
| v1 | `404` | No serverless functions existed. API routes only lived in Vite dev middleware. |
| v2 | `504 Gateway Timeout` | Netlify Functions deployed, but OpenAI response takes 15-30s → exceeds 10s Lambda timeout. |
| v3 | `invalid JSON (truncated)` | Added streaming, but Netlify Functions v2 streaming extends timeout to only **15 seconds** on free tier. OpenAI stream gets severed mid-response. |

### Marcus's Diagnosis
> "The Netlify Functions runtime (AWS Lambda under the hood) has hard limits:
> - **Free tier:** 10s execution (15s with streaming)
> - **Pro tier:** 26s execution
>
> A typical gpt-4o-mini week generation streams ~3000-6000 tokens at ~100-150 tokens/sec. That's 20-40 seconds.
> Even with streaming, the function gets killed at 15 seconds, severing the ReadableStream mid-JSON."

### Dmitri's Solution
> "Switch to **Netlify Edge Functions**. They run on Deno at the edge with a **50-second timeout**.
> Native streaming support. The OpenAI SDK v4+ works on Deno because it uses standard Web APIs (fetch, ReadableStream).
> This is the correct compute layer for AI proxy endpoints."

---

## Action Plan

### TODO List

- [x] **1. Create Edge Function: `generate-meta`** — `netlify/edge-functions/generate-meta.ts`
  - Lightweight (200 max_tokens), non-streaming, returns JSON directly
  - Uses `Netlify.env.get('OPENAI_API_KEY')` for env vars
  - Imports shared prompt builder from `../../shared/prompts.ts`

- [x] **2. Create Edge Function: `generate-week`** — `netlify/edge-functions/generate-week.ts`
  - Uses OpenAI streaming API (`stream: true`)
  - Returns `ReadableStream` response — pipes chunks directly to client
  - 50s timeout is plenty for even the longest generation (~40s max)
  - Imports `buildWeekPrompt` from shared module

- [x] **3. Update `netlify.toml`** — Remove regular function config, add edge function routing
  - Remove `functions = "netlify/functions"` and old redirects
  - Add `[[edge_functions]]` entries mapping `/api/generate-meta` and `/api/generate-week`
  - Keep SPA catch-all redirect for client-side routing

- [x] **4. Simplify client `ai.ts`** — Use `/api/` base path always
  - Remove `import.meta.env.DEV` conditional (edge functions serve `/api/` in prod)
  - Vite dev server still handles `/api/` in development
  - Keep `res.text()` + `JSON.parse()` for streaming support
  - Keep HTML detection and text preview in errors

- [x] **5. Remove old Netlify Functions** — Clean up `netlify/functions/` directory
  - Delete `generate-meta.mts` and `generate-week.mts`
  - Remove `@netlify/functions` dev dependency

- [x] **6. TypeScript + Build Verification** — Ensure clean compilation
  - Run `npx tsc --noEmit`
  - Run `npm run build` to verify production build works

- [x] **7. Commit, Push, Verify Deployment** — Final deploy
  - Commit all changes with clear message
  - Push to GitHub → triggers Netlify auto-deploy
  - Edge functions should deploy automatically

---

## Architecture After Fix

```
[Client Browser]
    │
    ├── /api/generate-meta  ──→  [Netlify Edge Function]  ──→  OpenAI (non-streaming, 200 tokens)
    │                              50s timeout, Deno runtime
    │
    └── /api/generate-week  ──→  [Netlify Edge Function]  ──→  OpenAI (streaming, 10000 tokens)
                                   50s timeout, Deno runtime       │
                                   ReadableStream response  ◄─────┘
```

Dev mode: Vite plugin intercepts `/api/*` — no change to local development workflow.
