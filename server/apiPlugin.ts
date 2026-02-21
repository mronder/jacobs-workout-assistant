import type { Plugin } from 'vite';
import OpenAI from 'openai';
import type { UserProfile } from '../src/store/useAppStore';

/**
 * Vite plugin — week-by-week generation to eliminate token truncation.
 *
 * Endpoints:
 *  POST /api/generate-meta  → plan title / description / frequency (~200 tokens)
 *  POST /api/generate-week  → single week of workouts (~3-4k tokens)
 */

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');
  if (!openaiClient) openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export default function apiPlugin(): Plugin {
  return {
    name: 'titan-api-proxy',
    configureServer(server) {
      // ─── Generate Plan Metadata ─────────────────────────
      server.middlewares.use('/api/generate-meta', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        for await (const chunk of req) body += chunk;
        let profile: UserProfile;
        try {
          profile = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        try {
          const openai = getClient();
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You create concise metadata for personalized workout programs. Return ONLY valid JSON.',
              },
              {
                role: 'user',
                content: `Create a workout program title and description for:
- Goal: ${profile.goal.replace(/_/g, ' ')}
- ${profile.daysPerWeek} days/week, ${profile.workoutDuration} min sessions, ${profile.planDurationWeeks} weeks
- Split: ${profile.splitPreference === 'auto' ? 'your choice' : profile.splitPreference.replace(/_/g, ' ')}
- Experience: ${profile.experienceLevel}
- Body type: ${profile.bodyType}

Return JSON: { "title": "catchy program name", "description": "1-2 sentence overview", "frequency": "X days/week" }`,
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 200,
          });

          const text = response.choices[0]?.message?.content;
          if (!text) throw new Error('Empty response from OpenAI');

          const meta = JSON.parse(text);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(meta));
        } catch (err: unknown) {
          console.error('[Titan API] meta error:', err);
          res.statusCode = 500;
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.end(JSON.stringify({ error: `AI generation failed: ${message}` }));
        }
      });

      // ─── Generate Single Week ───────────────────────────
      server.middlewares.use('/api/generate-week', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        for await (const chunk of req) body += chunk;
        let payload: { profile: UserProfile; weekNumber: number; totalWeeks: number; previousWeekSummary?: string };
        try {
          payload = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        const { profile: p, weekNumber, totalWeeks, previousWeekSummary } = payload;

        try {
          const openai = getClient();
          const systemPrompt = buildWeekPrompt(p, weekNumber, totalWeeks, previousWeekSummary);

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

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify(weekData));
        } catch (err: unknown) {
          console.error(`[Titan API] week ${weekNumber} error:`, err);
          res.statusCode = 500;
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.end(JSON.stringify({ error: `AI generation failed: ${message}` }));
        }
      });
    },
  };
}

function buildWeekPrompt(p: UserProfile, weekNumber: number, totalWeeks: number, previousWeekSummary?: string): string {
  const heightInches = p.heightFt * 12 + p.heightIn;
  const heightCm = Math.round(heightInches * 2.54);
  const weightKg = Math.round(p.weight * 0.453592);

  const progressionNote = weekNumber === 1
    ? 'This is Week 1 — establish baseline volumes and intensities.'
    : weekNumber <= Math.ceil(totalWeeks / 2)
      ? `Week ${weekNumber} of ${totalWeeks} — progressively increase volume or intensity from previous weeks.`
      : weekNumber === totalWeeks
        ? `Final week (${weekNumber} of ${totalWeeks}) — deload week. Reduce volume by 40%, keep intensity moderate.`
        : `Week ${weekNumber} of ${totalWeeks} — peak phase, highest intensities of the program.`;

  return `You are "Titan", an elite AI Personal Trainer. Generate ONLY Week ${weekNumber} of a ${totalWeeks}-week program.

USER PROFILE:
- Age: ${p.age}, Sex: ${p.gender}, Height: ${p.heightFt}'${p.heightIn}" (${heightCm}cm), Weight: ${p.weight}lbs (${weightKg}kg)
- Body type: ${p.bodyType}, Goal: ${p.goal.replace(/_/g, ' ')}, Experience: ${p.experienceLevel}
- Training: ${p.daysPerWeek} days/week, ${p.workoutDuration}min sessions
- Split: ${p.splitPreference === 'auto' ? 'auto (choose best for frequency)' : p.splitPreference.replace(/_/g, ' ')}
- Intensity: ${p.intensity} (Low=RPE 4-5, Medium=RPE 6-7, High=RPE 8-9)
- Injuries: ${p.injuries || 'None'}

PERIODIZATION: ${progressionNote}
${previousWeekSummary ? `PREVIOUS WEEK CONTEXT: ${previousWeekSummary}` : ''}

RULES:
1. Use linear progression for beginners, DUP for intermediate, block periodization for advanced.
2. NEVER load injured joints aggressively. Provide safe alternatives.
3. If beginner + high intensity, cap RPE at 7.
4. Every training day: 3-5 warmup movements, 2-3 cooldown stretches.
5. Each exercise: name, sets, reps, rest, 1-sentence description (form cues), 1-sentence note (why chosen), plus 1 alternative (same fields).
6. Non-training days: label "Rest" or "Active Recovery" with 1-2 light activities.
7. Schedule MUST have exactly 7 days (Day 1 through Day 7).

OUTPUT — Return ONLY this JSON:
{
  "weekNumber": ${weekNumber},
  "schedule": [
    {
      "dayName": "Day 1 — <Focus>",
      "focus": "Upper Body | Lower Body | Push | Pull | Legs | Full Body | Rest | Active Recovery",
      "warmup": ["movement 1", "movement 2", "movement 3"],
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": "8-10",
          "rest": "90s",
          "notes": "Why (1 sentence).",
          "description": "How to perform (1 sentence).",
          "alternatives": [
            { "name": "Alt Name", "sets": 3, "reps": "8-10", "rest": "90s", "notes": "Why.", "description": "How." }
          ]
        }
      ],
      "cooldown": ["stretch 1", "stretch 2"]
    }
  ]
}`;
}
