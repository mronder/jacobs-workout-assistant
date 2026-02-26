/**
 * Cloudflare Pages Function – POST /api/generate-plan
 *
 * Uses plain fetch (no Node-only SDK) so it runs natively on the
 * Cloudflare Workers runtime without nodejs_compat.
 *
 * Requires the OPENAI_API_KEY environment variable to be set in the
 * Cloudflare Pages dashboard (Settings → Environment variables).
 */

interface Env {
  OPENAI_API_KEY: string;
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
/*  Prompt builder                                                     */
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
    const body: { daysPerWeek?: number; goal?: string; level?: string } =
      await context.request.json();

    const { daysPerWeek, goal, level } = body;

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

    /* ---------- Call OpenAI via plain fetch ---------- */
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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

    if (!openaiRes.ok) {
      const errBody: { error?: { message?: string } } = await openaiRes
        .json()
        .catch(() => ({ error: {} }));
      throw new Error(
        errBody.error?.message || `OpenAI error ${openaiRes.status}`,
      );
    }

    const json: {
      choices: { message: { content: string } }[];
    } = await openaiRes.json();

    const data = JSON.parse(json.choices[0].message.content);

    /* ---------- Shape the response ---------- */
    const days = data.days.map(
      (d: { dayNumber: number; focus: string; exercises: unknown[] }) => ({
        dayNumber: d.dayNumber,
        focus: d.focus,
        exercises: d.exercises,
      }),
    );

    const weeks = [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, days }));

    const plan = {
      planName: data.planName,
      splitDescription: data.splitDescription,
      motivationalQuote: data.motivationalQuote,
      quoteAuthor: data.quoteAuthor,
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
