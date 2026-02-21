import OpenAI from 'openai';
import { buildWeekPrompt } from '../../shared/prompts.ts';
import type { UserProfile } from '../../shared/prompts.ts';

/**
 * Netlify Edge Function for generating a single workout week.
 *
 * Edge Functions have a 50-second timeout (vs 10-15s for regular Functions),
 * which is critical because gpt-4o-mini may need 20-40s to stream a full
 * week of exercises.  We pipe the OpenAI stream directly to the client so
 * the connection stays alive the entire time.
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

    const stream = await openai.chat.completions.create({
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
      max_tokens: 4500,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
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
