import { WorkoutPlan } from '../types';

/* ------------------------------------------------------------------ */
/*  Injected by Vite (see vite.config.ts).                             */
/*  • dev  → real key from .env.local   (for direct OpenAI calls)      */
/*  • prod → empty string  (tree-shaken — never ships in the bundle)   */
/* ------------------------------------------------------------------ */
declare const __DEV_API_KEY__: string;

/* ------------------------------------------------------------------ */
/*  Shared prompt builder (identical prompt in function & client)       */
/* ------------------------------------------------------------------ */
function buildPrompt(daysPerWeek: number, goal: string, level: string): string {
  return `Act as an elite personal trainer. Create a 1-week workout template for a ${level} individual whose goal is ${goal}. They train ${daysPerWeek} days/week.

RULES:
1. Use PROVEN splits:
   - 3 Days: Full Body (3x) or Push/Pull/Legs
   - 4 Days: Condensed Bro Split or Upper/Lower (2x)
   - 5 Days: Bro Split or Upper/Lower/PPL
   - 6 Days: Push/Pull/Legs (2x) or Extended Bro Split.
   Stick to these. No weird hybrids.
2. Each day: MINIMUM 6 exercises.
3. 2 alternatives per exercise with YouTube search queries and expert advice.
4. Expert advice = practical form cues (body position, where to feel tension, mistakes to avoid). No silly analogies. Plain English.
5. Each day's focus explains the goal and why the split works.
6. Include a real motivational quote from a famous person (Ali, Arnold, Marcus Aurelius, etc.) with their name.`;
}

/* ------------------------------------------------------------------ */
/*  JSON schema for structured output (OpenAI REST API format)         */
/* ------------------------------------------------------------------ */
const jsonSchema = {
  name: 'workout_plan',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      planName: { type: 'string' },
      splitDescription: { type: 'string' },
      motivationalQuote: { type: 'string' },
      quoteAuthor: { type: 'string' },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dayNumber: { type: 'number' },
            focus: { type: 'string' },
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  sets: { type: 'number' },
                  reps: { type: 'string' },
                  rest: { type: 'string' },
                  alternatives: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        expertAdvice: { type: 'string' },
                        videoSearchQuery: { type: 'string' },
                      },
                      required: ['name', 'expertAdvice', 'videoSearchQuery'],
                      additionalProperties: false,
                    },
                  },
                  videoSearchQuery: { type: 'string' },
                  expertAdvice: { type: 'string' },
                },
                required: [
                  'name', 'sets', 'reps', 'rest',
                  'alternatives', 'videoSearchQuery', 'expertAdvice',
                ],
                additionalProperties: false,
              },
            },
          },
          required: ['dayNumber', 'focus', 'exercises'],
          additionalProperties: false,
        },
      },
    },
    required: ['planName', 'splitDescription', 'motivationalQuote', 'quoteAuthor', 'days'],
    additionalProperties: false,
  },
} as const;

/* ------------------------------------------------------------------ */
/*  DEV path — calls the OpenAI REST API directly (plain fetch)        */
/*  Key injected by Vite; entire block is tree-shaken in prod builds   */
/* ------------------------------------------------------------------ */
async function callOpenAIDirect(
  daysPerWeek: number,
  goal: string,
  level: string,
): Promise<WorkoutPlan> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__DEV_API_KEY__}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert personal trainer and exercise scientist. Return structured workout plans. Be concise but thorough with form cues.',
        },
        { role: 'user', content: buildPrompt(daysPerWeek, goal, level) },
      ],
      response_format: { type: 'json_schema', json_schema: jsonSchema },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: {} }));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ||
        `OpenAI error ${res.status}`,
    );
  }

  const json = await res.json();
  const data = JSON.parse(json.choices[0].message.content);

  // Map 1 week → 4 identical weeks
  const days = data.days.map(
    (d: { dayNumber: number; focus: string; exercises: unknown[] }) => ({
      dayNumber: d.dayNumber,
      focus: d.focus,
      exercises: d.exercises,
    }),
  );
  const weeks = [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, days }));

  return {
    planName: data.planName,
    splitDescription: data.splitDescription,
    motivationalQuote: data.motivationalQuote,
    quoteAuthor: data.quoteAuthor,
    weeks,
  } as WorkoutPlan;
}

/* ------------------------------------------------------------------ */
/*  PROD path — calls the Cloudflare Pages function                    */
/*  API key stays server-side; never shipped in the JS bundle          */
/* ------------------------------------------------------------------ */
async function callViaFunction(
  daysPerWeek: number,
  goal: string,
  level: string,
): Promise<WorkoutPlan> {
  const response = await fetch('/api/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daysPerWeek, goal, level }),
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
): Promise<WorkoutPlan> {
  // DEV  → direct OpenAI call (key from .env.local, tree-shaken in prod)
  // PROD → Cloudflare Pages function (key in Cloudflare env vars)
  if (import.meta.env.DEV && __DEV_API_KEY__) {
    return callOpenAIDirect(daysPerWeek, goal, level);
  }
  return callViaFunction(daysPerWeek, goal, level);
}
