/**
 * Cloudflare Pages Function – POST /api/generate-plan
 *
 * Uses plain fetch (no Node-only SDK) so it runs natively on the
 * Cloudflare Workers runtime without nodejs_compat.
 *
 * Requires the OPENAI_API_KEY environment variable to be set in the
 * Cloudflare Pages dashboard (Settings → Environment variables).
 */

import type { Env } from './_shared/types';

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
            description: { type: 'string' },
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
          required: ['dayNumber', 'focus', 'description', 'exercises'],
          additionalProperties: false,
        },
      },
    },
    required: ['planName', 'splitDescription', 'motivationalQuote', 'quoteAuthor', 'days'],
    additionalProperties: false,
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Batch-parallel prompt: one call per day, run concurrently          */
/* ------------------------------------------------------------------ */
const daySchema = {
  name: 'workout_day',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      dayNumber: { type: 'number' },
      focus: { type: 'string' },
      description: { type: 'string' },
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
    required: ['dayNumber', 'focus', 'description', 'exercises'],
    additionalProperties: false,
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Prompt builders                                                    */
/* ------------------------------------------------------------------ */

/** Metadata prompt — very small output, returns instantly */
function buildMetaPrompt(daysPerWeek: number, goal: string, level: string, splitName: string, secondaryGoal: string | null): string {
  const goalText = secondaryGoal
    ? `${goal} (primary) with a secondary focus on ${secondaryGoal}`
    : goal;
  return `You are an elite personal trainer. A ${level} client wants ${goalText}, training ${daysPerWeek} days/week using a "${splitName}" split.

Return:
- planName: a short motivating name for this plan (max 5 words)
- splitDescription: 1-2 sentences describing the split and why it suits this client
- motivationalQuote: a real quote from a famous person (Ali, Arnold, Marcus Aurelius, etc.)
- quoteAuthor: the person's name`;
}

/** Per-day prompt — generates one day's exercises only */
function buildDayPrompt(
  dayNumber: number,
  dayFocus: string,
  daysPerWeek: number,
  goal: string,
  level: string,
  splitName: string,
  secondaryGoal: string | null,
): string {
  const goalText = secondaryGoal
    ? `${goal} (primary goal) with a secondary focus on ${secondaryGoal}`
    : goal;
  return `You are an elite personal trainer. Create day ${dayNumber} of a ${daysPerWeek}-day "${splitName}" split for a ${level} individual whose goal is ${goalText}.

This day's focus: ${dayFocus}

RULES:
1. Each day MUST have a MINIMUM of 5 exercises and a MAXIMUM of 8. A superset pair counts as 2 exercises. Vary the exercise count across days — NOT every day should have the same number. Tailor the count to the muscle group, day focus, and training goals. For example, a Legs day might have 7-8 exercises while an Arms day might have 5-6.
2. 2 alternatives per exercise, each with a YouTube search query and 1-sentence expert advice.
3. expertAdvice = 1 concise sentence: key form cue or common mistake. No fluff.
4. videoSearchQuery = short YouTube search string for the exercise.
5. focus = short title, 1-5 words max. Example: "Chest & Triceps".
6. description = 1-2 sentences explaining what muscle areas/sections are targeted and why. For example for a chest day: "Focus on upper, mid, and lower pec development with heavy compounds for thickness and flyes for width." Be specific about anatomy.
7. Include at least ONE superset pair per day. A superset pair must be two consecutive exercises whose rest fields BOTH mention "Superset with [partner exercise name]". For example if exercises 3 and 4 are a superset, exercise 3's rest should say "Superset with [Exercise 4 name] — 60s rest after both" and exercise 4's rest should say "Superset with [Exercise 3 name] — 60s rest after both". Both exercises must cross-reference each other.${secondaryGoal ? `
8. Where appropriate, incorporate exercise selection, rep ranges, or rest periods that also serve the secondary goal of ${secondaryGoal}. For example, if the secondary goal is Fat Loss, include 2-3 superset pairs and shorter rest periods; if Strength, include heavier compound movements with longer rests (and still include at least one superset for antagonist or accessory pairing).` : ''}
${secondaryGoal ? '9' : '8'}. Return dayNumber as ${dayNumber}.`;
}

/** Pick the canonical split and day focuses for a given frequency */
function getSplitConfig(daysPerWeek: number): { splitName: string; dayFocuses: string[] } {
  switch (daysPerWeek) {
    case 3:
      return {
        splitName: 'Push/Pull/Legs',
        dayFocuses: ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps, Rear Delts)', 'Legs (Quads, Hamstrings, Glutes, Calves)'],
      };
    case 4:
      return {
        splitName: '4 Day Bro Split',
        dayFocuses: ['Chest & Triceps', 'Back & Biceps', 'Shoulders & Abs', 'Legs'],
      };
    case 5:
      return {
        splitName: 'Classic 5 Day Bro Split',
        dayFocuses: ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms (Biceps & Triceps)'],
      };
    case 6:
      return {
        splitName: 'Arnold Split',
        dayFocuses: [
          'Chest & Back A',
          'Shoulders & Arms A',
          'Legs A',
          'Chest & Back B',
          'Shoulders & Arms B',
          'Legs B',
        ],
      };
    default:
      return {
        splitName: 'Full Body',
        dayFocuses: Array.from({ length: daysPerWeek }, (_, i) => `Full Body Day ${i + 1}`),
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Request handler                                                    */
/* ------------------------------------------------------------------ */
export const onRequest: PagesFunction<Env> = async (context) => {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const body: { daysPerWeek?: number; goal?: string; level?: string; secondaryGoal?: string | null } =
      await context.request.json();

    const { daysPerWeek, goal, level, secondaryGoal = null } = body;

    if (
      typeof daysPerWeek !== 'number' ||
      daysPerWeek < 1 ||
      daysPerWeek > 7 ||
      typeof goal !== 'string' ||
      typeof level !== 'string'
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: corsHeaders },
      );
    }

    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: corsHeaders },
      );
    }

    const { splitName, dayFocuses } = getSplitConfig(daysPerWeek);

    /* ---------- Helper: single OpenAI call ---------- */
    async function callOpenAI(
      systemMsg: string,
      userMsg: string,
      schema: typeof jsonSchema | typeof daySchema,
      maxTokens: number,
    ) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg },
          ],
          response_format: { type: 'json_schema', json_schema: schema },
          temperature: 0.5,
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const errBody: { error?: { message?: string } } = await res
          .json()
          .catch(() => ({ error: {} }));
        throw new Error(errBody.error?.message || `OpenAI error ${res.status}`);
      }

      const json: { choices: { message: { content: string } }[] } = await res.json();
      return JSON.parse(json.choices[0].message.content);
    }

    const sysMsg = 'You are an expert personal trainer and exercise scientist. Return structured workout plans. Be concise.';

    /* ---------- Fire ALL requests in parallel ---------- */
    const metaPromise = callOpenAI(
      sysMsg,
      buildMetaPrompt(daysPerWeek, goal, level, splitName, secondaryGoal),
      jsonSchema,   // reuse full schema — OpenAI will just fill the top-level fields + empty days
      300,
    ).catch((err) => {
      // Fallback: generate metadata locally so we don't block the whole plan
      console.error('Meta prompt failed, using defaults:', err);
      const goalDesc = secondaryGoal ? `${goal} with a secondary focus on ${secondaryGoal}` : goal;
      return {
        planName: `${splitName} Program`,
        splitDescription: `A ${daysPerWeek}-day ${splitName} split designed for ${level} trainees focused on ${goalDesc}.`,
        motivationalQuote: 'The only bad workout is the one that didn\'t happen.',
        quoteAuthor: 'Unknown',
        days: [],
      };
    });

    const dayPromises = dayFocuses.map((focus, idx) =>
      callOpenAI(
        sysMsg,
        buildDayPrompt(idx + 1, focus, daysPerWeek, goal, level, splitName, secondaryGoal),
        daySchema,
        1500,
      ),
    );

    // Wait for everything at once — total time ≈ slowest single day (~6-10s)
    const [meta, ...days] = await Promise.all([metaPromise, ...dayPromises]);

    /* ---------- Shape the response ---------- */
    // Sort days by dayNumber just in case
    days.sort((a: { dayNumber: number }, b: { dayNumber: number }) => a.dayNumber - b.dayNumber);

    const weeks = [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, days }));

    const plan = {
      planName: meta.planName,
      splitDescription: meta.splitDescription,
      motivationalQuote: meta.motivationalQuote,
      quoteAuthor: meta.quoteAuthor,
      weeks,
    };

    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('Generate plan error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};
