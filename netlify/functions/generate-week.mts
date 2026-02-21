import OpenAI from 'openai';
import { buildWeekPrompt } from '../../shared/prompts';
import type { UserProfile } from '../../shared/prompts';
import type { Context } from "@netlify/functions";

/**
 * Streaming Netlify Function for generating a single workout week.
 *
 * Uses OpenAI's streaming API so that the first byte reaches the client
 * within ~1-2 s, avoiding Netlify's 10 s gateway-timeout on the free tier.
 * The client reads the full stream, then JSON-parses the result.
 */
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let payload: { profile: UserProfile; weekNumber: number; totalWeeks: number; previousWeekSummary?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { profile, weekNumber, totalWeeks, previousWeekSummary } = payload;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const systemPrompt = buildWeekPrompt(profile, weekNumber, totalWeeks, previousWeekSummary);

    // Use streaming so the first byte arrives quickly (< 2 s) and the
    // Netlify gateway never triggers a 504.
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
      temperature: 0.7,
      max_tokens: 10000,
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
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err: unknown) {
    console.error(`[Titan] generate-week ${weekNumber} error:`, err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `AI generation failed: ${message}` }), { status: 500 });
  }
};
