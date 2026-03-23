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

type PlanAlternative = {
  name: string;
  expertAdvice: string;
  videoSearchQuery: string;
};

type PlanExercise = {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  alternatives: PlanAlternative[];
  videoSearchQuery: string;
  expertAdvice: string;
};

type PlanDay = {
  dayNumber: number;
  focus: string;
  description: string;
  exercises: PlanExercise[];
};

type PlanWeek = {
  weekNumber: number;
  days: PlanDay[];
};

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

function normalizeLevel(level: string): 'beginner' | 'intermediate' | 'advanced' {
  const normalized = level.trim().toLowerCase();
  if (normalized.startsWith('beg')) return 'beginner';
  if (normalized.startsWith('inter')) return 'intermediate';
  return 'advanced';
}

function getIntermediateSupersetDays(daysPerWeek: number): number[] {
  const targetCount = daysPerWeek <= 3 ? 1 : daysPerWeek <= 5 ? 2 : 3;
  const selected = new Set<number>();

  for (let index = 1; index <= targetCount; index += 1) {
    const dayNumber = Math.max(1, Math.min(daysPerWeek, Math.round((index * (daysPerWeek + 1)) / (targetCount + 1))));
    selected.add(dayNumber);
  }

  while (selected.size < targetCount) {
    selected.add(Math.min(daysPerWeek, selected.size + 1));
  }

  return Array.from(selected).sort((a, b) => a - b);
}

function buildSupersetRule(dayNumber: number, daysPerWeek: number, level: string): string {
  const normalizedLevel = normalizeLevel(level);

  if (normalizedLevel === 'beginner') {
    return 'Do not include supersets anywhere in this workout. Never use the word "superset" in rest or expert advice.';
  }

  if (normalizedLevel === 'intermediate') {
    const supersetDays = new Set(getIntermediateSupersetDays(daysPerWeek));
    if (supersetDays.has(dayNumber)) {
      return 'Include exactly one superset pair on this day. A superset pair must be two consecutive exercises whose rest fields both say "Superset with [partner exercise name] — 60s rest after both". Do not include more than one superset pair on this day.';
    }

    return 'Do not include any supersets on this day. Never use the word "superset" unless this day specifically allows a paired superset.';
  }

  return 'You may include zero or one superset pair on this day. If you include one, it must be two consecutive exercises whose rest fields both say "Superset with [partner exercise name] — 60s rest after both". Never include more than one superset pair on this day.';
}

function cloneExercise(exercise: PlanExercise): PlanExercise {
  return {
    ...exercise,
    alternatives: exercise.alternatives.map((alternative) => ({ ...alternative })),
  };
}

function mentionsSuperset(exercise: PlanExercise): boolean {
  return /super\s*set/i.test(exercise.rest) || /super\s*set/i.test(exercise.expertAdvice);
}

function stripSupersetText(text: string): string {
  return text
    .replace(/superset\s+with\s+[^.!?\n]+(?:[-–—]\s*)?/gi, '')
    .replace(/\bsuper\s*set\b[:\s-]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function sanitizeExerciseWithoutSuperset(exercise: PlanExercise): PlanExercise {
  const rest = stripSupersetText(exercise.rest) || '60-90s rest';
  const expertAdvice = stripSupersetText(exercise.expertAdvice) || 'Control the tempo and keep the target muscle engaged.';

  return {
    ...exercise,
    rest,
    expertAdvice,
  };
}

function getSupersetPairStarts(exercises: PlanExercise[]): number[] {
  const starts: number[] = [];

  for (let index = 0; index < exercises.length - 1; index += 1) {
    if (mentionsSuperset(exercises[index]) && mentionsSuperset(exercises[index + 1])) {
      starts.push(index);
      index += 1;
    }
  }

  return starts;
}

function applySupersetRules(days: PlanDay[], daysPerWeek: number, level: string): PlanDay[] {
  const normalizedLevel = normalizeLevel(level);
  const allowedIntermediateDays = new Set(getIntermediateSupersetDays(daysPerWeek));

  return days.map((day) => {
    const pairStarts = getSupersetPairStarts(day.exercises);
    const keptStarts = new Set<number>();

    if (normalizedLevel === 'intermediate' && allowedIntermediateDays.has(day.dayNumber) && pairStarts.length > 0) {
      keptStarts.add(pairStarts[0]);
    }

    if (normalizedLevel === 'advanced' && pairStarts.length > 0) {
      keptStarts.add(pairStarts[0]);
    }

    return {
      ...day,
      exercises: day.exercises.map((exercise, index) => {
        if (normalizedLevel === 'beginner') {
          return sanitizeExerciseWithoutSuperset(cloneExercise(exercise));
        }

        const isKeptPairMember = keptStarts.has(index) || keptStarts.has(index - 1);
        if (isKeptPairMember) {
          return cloneExercise(exercise);
        }

        if (mentionsSuperset(exercise)) {
          return sanitizeExerciseWithoutSuperset(cloneExercise(exercise));
        }

        return cloneExercise(exercise);
      }),
    };
  });
}

function swapExerciseWithAlternative(exercise: PlanExercise, alternativeIndex: number): PlanExercise {
  const alternative = exercise.alternatives[alternativeIndex];
  if (!alternative) return cloneExercise(exercise);

  return {
    ...exercise,
    name: alternative.name,
    expertAdvice: alternative.expertAdvice,
    videoSearchQuery: alternative.videoSearchQuery,
    alternatives: exercise.alternatives.map((item, index) => (
      index === alternativeIndex
        ? {
            name: exercise.name,
            expertAdvice: exercise.expertAdvice,
            videoSearchQuery: exercise.videoSearchQuery,
          }
        : { ...item }
    )),
  };
}

function bumpRepRange(reps: string, increase: number): string {
  const rangeMatch = reps.match(/^(\d+)\s*[-–]\s*(\d+)(.*)$/);
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    return `${low}-${high + increase}${rangeMatch[3]}`.trim();
  }

  const singleMatch = reps.match(/^(\d+)(.*)$/);
  if (singleMatch) {
    return `${Number(singleMatch[1]) + increase}${singleMatch[2]}`.trim();
  }

  return reps;
}

function buildWeekVariant(days: PlanDay[], weekNumber: number): PlanDay[] {
  if (weekNumber === 1) {
    return days.map((day) => ({
      ...day,
      exercises: day.exercises.map(cloneExercise),
    }));
  }

  return days.map((day, dayIndex) => {
    const exercises = day.exercises.map(cloneExercise);
    const blockedIndexes = new Set(getSupersetPairStarts(exercises).flatMap((start) => [start, start + 1]));
    const eligibleSwapIndexes = exercises
      .map((_, index) => index)
      .filter((index) => !blockedIndexes.has(index) && exercises[index].alternatives.length > 0);

    if (eligibleSwapIndexes.length > 0) {
      const swapIndex = eligibleSwapIndexes[(dayIndex + weekNumber - 2) % eligibleSwapIndexes.length];
      const alternativeIndex = (weekNumber - 2) % exercises[swapIndex].alternatives.length;
      exercises[swapIndex] = swapExerciseWithAlternative(exercises[swapIndex], alternativeIndex);
    }

    const volumeTargetIndex = exercises.findIndex((exercise, index) => !blockedIndexes.has(index) && exercise.sets < 5);
    if (volumeTargetIndex >= 0) {
      if (weekNumber === 2) {
        exercises[volumeTargetIndex] = {
          ...exercises[volumeTargetIndex],
          sets: exercises[volumeTargetIndex].sets + 1,
        };
      }

      if (weekNumber === 3) {
        exercises[volumeTargetIndex] = {
          ...exercises[volumeTargetIndex],
          reps: bumpRepRange(exercises[volumeTargetIndex].reps, 1),
        };
      }

      if (weekNumber === 4) {
        exercises[volumeTargetIndex] = {
          ...exercises[volumeTargetIndex],
          sets: Math.max(2, exercises[volumeTargetIndex].sets - 1),
        };
      }
    }

    const suffix = weekNumber === 2
      ? ' Week 2 rotates one accessory movement and adds a touch more volume.'
      : weekNumber === 3
        ? ' Week 3 pushes progression with a slightly harder rep target on one lift.'
        : ' Week 4 eases volume slightly while keeping movement quality high.';

    return {
      ...day,
      description: `${day.description}${suffix}`,
      exercises,
    };
  });
}

function buildProgressiveWeeks(days: PlanDay[]): PlanWeek[] {
  return [1, 2, 3, 4].map((weekNumber) => ({
    weekNumber,
    days: buildWeekVariant(days, weekNumber),
  }));
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
  const supersetRule = buildSupersetRule(dayNumber, daysPerWeek, level);

  return `You are an elite personal trainer. Create day ${dayNumber} of a ${daysPerWeek}-day "${splitName}" split for a ${level} individual whose goal is ${goalText}.

This day's focus: ${dayFocus}

RULES:
1. Each day MUST have a MINIMUM of 5 exercises and a MAXIMUM of 8. A superset pair counts as 2 exercises. Vary the exercise count across days — NOT every day should have the same number. Tailor the count to the muscle group, day focus, and training goals. For example, a Legs day might have 7-8 exercises while an Arms day might have 5-6.
2. 2 alternatives per exercise, each with a YouTube search query and 1-sentence expert advice.
3. expertAdvice = 1 concise sentence: key form cue or common mistake. No fluff.
4. videoSearchQuery = short YouTube search string for the exercise.
5. focus = short title, 1-5 words max. Example: "Chest & Triceps".
6. description = 1-2 sentences explaining what muscle areas/sections are targeted and why. For example for a chest day: "Focus on upper, mid, and lower pec development with heavy compounds for thickness and flyes for width." Be specific about anatomy.
7. ${supersetRule}${secondaryGoal ? `
8. Where appropriate, incorporate exercise selection, rep ranges, or rest periods that also serve the secondary goal of ${secondaryGoal}, while still obeying the superset limits above.` : ''}
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
    const body: { daysPerWeek?: number; goal?: string; level?: string; secondaryGoal?: string | null; noSupersets?: boolean } =
      await context.request.json();

    const { daysPerWeek, goal, level, secondaryGoal = null, noSupersets = false } = body;

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

    const effectiveLevel = noSupersets ? 'Beginner' : level;

    const dayPromises = dayFocuses.map((focus, idx) =>
      callOpenAI(
        sysMsg,
        buildDayPrompt(idx + 1, focus, daysPerWeek, goal, effectiveLevel, splitName, secondaryGoal),
        daySchema,
        1500,
      ),
    );

    // Wait for everything at once — total time ≈ slowest single day (~6-10s)
    const [meta, ...rawDays] = await Promise.all([metaPromise, ...dayPromises]);

    /* ---------- Shape the response ---------- */
    // Sort days by dayNumber just in case
    const days = applySupersetRules(rawDays as PlanDay[], daysPerWeek, effectiveLevel)
      .sort((a, b) => a.dayNumber - b.dayNumber);

    const weeks = buildProgressiveWeeks(days);

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
