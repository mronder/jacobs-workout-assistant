import OpenAI from 'openai';
import { buildMetaMessages } from '../../shared/prompts.ts';
import type { UserProfile } from '../../shared/prompts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  let profile: UserProfile;
  try {
    profile = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const apiKey = Netlify.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const msgs = buildMetaMessages(profile);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: msgs.system },
        { role: 'user', content: msgs.user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 200,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenAI');

    const meta = JSON.parse(text);
    return new Response(JSON.stringify(meta), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (err: unknown) {
    console.error('[Titan] generate-meta error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `AI generation failed: ${message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
};

export const config = { path: '/api/generate-meta' };
