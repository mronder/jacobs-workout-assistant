import OpenAI from 'openai';
import { buildWeekPrompt } from '../../shared/prompts';
import type { UserProfile } from '../../shared/prompts';
import type { Context } from "@netlify/functions";

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
      temperature: 0.7,
      max_tokens: 10000,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenAI');

    const finishReason = response.choices[0]?.finish_reason;
    if (finishReason === 'length') {
      throw new Error(`Week ${weekNumber} response was truncated. Please try again.`);
    }

    let weekData;
    try {
      weekData = JSON.parse(text);
    } catch {
      throw new Error(`AI returned invalid JSON for week ${weekNumber}. Please try again.`);
    }

    return new Response(JSON.stringify(weekData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error(`[Titan] generate-week ${weekNumber} error:`, err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `AI generation failed: ${message}` }), { status: 500 });
  }
};
