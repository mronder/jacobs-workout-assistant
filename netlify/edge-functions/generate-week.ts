import OpenAI from 'openai';
import { buildWeekPrompt } from '../../shared/prompts.ts';
import type { UserProfile } from '../../shared/prompts.ts';

/**
 * Netlify Edge Function — single workout week generation.
 * Non-streaming for lower latency (50s timeout is plenty).
 */
export default async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: {
    profile: UserProfile;
    weekNumber: number;
    totalWeeks: number;
    previousWeekSummary?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { profile, weekNumber, totalWeeks, previousWeekSummary } = payload;

  const apiKey = Netlify.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const systemPrompt = buildWeekPrompt(profile, weekNumber, totalWeeks, previousWeekSummary);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate Week ${weekNumber} of ${totalWeeks}. Return ONLY valid JSON. Keep descriptions and notes to 1 sentence each.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 3500,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenAI');

    // Validate JSON before sending
    const weekData = JSON.parse(text);

    return new Response(JSON.stringify(weekData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error(`[Titan] generate-week ${weekNumber} error:`, err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `AI generation failed: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: '/api/generate-week' };
