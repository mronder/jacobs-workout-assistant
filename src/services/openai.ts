import { WorkoutPlan } from '../types';

/* ------------------------------------------------------------------ */
/*  Calls the Cloudflare Pages function at /api/generate-plan.         */
/*  The OpenAI key lives ONLY on the server — never in the browser.    */
/*                                                                     */
/*  In production Cloudflare handles the route natively.               */
/*  In local dev Vite proxies /api → http://localhost:8788 where       */
/*  `wrangler pages dev` serves the same function.                     */
/* ------------------------------------------------------------------ */
async function callViaFunction(
  daysPerWeek: number,
  goal: string,
  level: string,
  secondaryGoal: string | null,
  noSupersets: boolean = false,
  splitType: string | null = null,
  mobilityAreas?: string[],
  sessionDuration?: number,
): Promise<WorkoutPlan> {
  const response = await fetch('/api/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daysPerWeek, goal, level, secondaryGoal, noSupersets, splitType, mobilityAreas, sessionDuration }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(
      (err as { error?: string }).error || `Server error: ${response.status}`,
    );
  }

  return (await response.json()) as WorkoutPlan;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
export async function generateWorkoutPlan(
  daysPerWeek: number,
  goal: string,
  level: string,
  secondaryGoal: string | null = null,
  noSupersets: boolean = false,
  splitType: string | null = null,
  mobilityAreas?: string[],
  sessionDuration?: number,
): Promise<WorkoutPlan> {
  return callViaFunction(daysPerWeek, goal, level, secondaryGoal, noSupersets, splitType, mobilityAreas, sessionDuration);
}
