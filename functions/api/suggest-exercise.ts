/**
 * Cloudflare Pages Function – POST /api/suggest-exercise
 *
 * Given an exercise name, user goal, and level, returns AI-suggested
 * sets, reps, rest, and expert advice. Uses GPT-4.1-mini with
 * structured output for fast, cheap suggestions (~200 tokens).
 */

import type { Env } from './_shared/types';
import { validateSession } from './_shared/session';

const suggestionSchema = {
  name: 'exercise_suggestion',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      sets: { type: 'number' },
      reps: { type: 'string' },
      rest: { type: 'string' },
      expertAdvice: { type: 'string' },
    },
    required: ['sets', 'reps', 'rest', 'expertAdvice'],
    additionalProperties: false,
  },
} as const;

export const onRequest: PagesFunction<Env> = async (context) => {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  // Auth check
  const session = await validateSession(context.env.DB, context.request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    const body: { exerciseName?: string; goal?: string; level?: string } = await context.request.json();
    const { exerciseName, goal, level } = body;

    if (!exerciseName || typeof exerciseName !== 'string' || exerciseName.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'exerciseName is required' }), { status: 400, headers: corsHeaders });
    }

    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fall back to defaults if no API key
      return new Response(JSON.stringify({ sets: 3, reps: '8-12', rest: '60-90s', expertAdvice: 'Focus on controlled form and full range of motion.' }), {
        status: 200, headers: corsHeaders,
      });
    }

    const goalText = goal || 'general fitness';
    const levelText = level || 'intermediate';

    const prompt = `You are an elite personal trainer. A ${levelText} client whose goal is ${goalText} wants to add "${exerciseName.trim()}" to their workout.

Suggest optimal sets, reps, rest period, and one concise expert advice sentence (key form cue or common mistake). Be specific to the exercise.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are an expert personal trainer. Return structured exercise suggestions. Be concise.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_schema', json_schema: suggestionSchema },
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      console.error('OpenAI suggest-exercise error:', res.status);
      // Fall back to sensible defaults
      return new Response(JSON.stringify({ sets: 3, reps: '8-12', rest: '60-90s', expertAdvice: 'Focus on controlled form and full range of motion.' }), {
        status: 200, headers: corsHeaders,
      });
    }

    const json: { choices: { message: { content: string } }[] } = await res.json();
    const suggestion = JSON.parse(json.choices[0].message.content);

    return new Response(JSON.stringify(suggestion), { status: 200, headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Suggest exercise error:', error);
    // Fall back to sensible defaults on any error
    return new Response(JSON.stringify({ sets: 3, reps: '8-12', rest: '60-90s', expertAdvice: 'Focus on controlled form and full range of motion.' }), {
      status: 200, headers: corsHeaders,
    });
  }
};
