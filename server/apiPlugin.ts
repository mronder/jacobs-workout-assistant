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

  // ─── Periodization phase label ───
  let phaseLabel: string;
  if (weekNumber === 1) {
    phaseLabel = 'FOUNDATION PHASE — establish baseline volumes and moderate intensities.';
  } else if (weekNumber <= Math.floor(totalWeeks * 0.5)) {
    phaseLabel = `BUILD PHASE (Week ${weekNumber}/${totalWeeks}) — increase volume by 10-15% from previous week. Add 1 set to primary lifts or increase reps.`;
  } else if (weekNumber < totalWeeks) {
    phaseLabel = `PEAK PHASE (Week ${weekNumber}/${totalWeeks}) — highest working intensities. Reduce volume slightly, increase weight/RPE.`;
  } else {
    phaseLabel = `DELOAD WEEK (Week ${weekNumber}/${totalWeeks}) — reduce volume by 40%, keep intensity at 60-70%. Active recovery focus.`;
  }

  // ─── Goal-specific programming instructions ───
  const goalInstructions: Record<string, string> = {
    lose_weight: `GOAL = FAT LOSS: Program supersets and circuits. Include 1-2 HIIT/metabolic finishers per training day (e.g., "30s battle ropes / 30s rest x 4 rounds"). Keep rest periods short (30-60s). Include at least 1 compound cardio movement per session. Higher rep ranges (12-20).`,
    build_muscle: `GOAL = HYPERTROPHY: Prioritize time under tension. Use 3-4 sets of 8-12 reps for compounds, 3 sets of 12-15 for isolation. Include both compound AND isolation exercises. Rest 60-90s. Each training day needs pull + push balance.`,
    strength: `GOAL = MAXIMUM STRENGTH: Heavy compound lifts first (squat, bench, deadlift, OHP). Use 4-5 sets of 3-6 reps for primary lifts with 2-3min rest. Include accessory work at moderate volume. For advanced users, include RPE targets per exercise.`,
    endurance: `GOAL = ENDURANCE: High rep ranges (15-25+), short rest (30-45s), circuit-style when possible. Include cardio blocks (rowing, cycling, running intervals). Emphasize muscular endurance with lighter weights and higher volume.`,
    flexibility: `GOAL = MOBILITY & FLEXIBILITY: Every session should have extended mobility work (10+ min warmup). Include dynamic stretching, yoga flows, banded stretches. Strength work should emphasize full ROM movements. Cooldowns should be 8-10 minutes.`,
  };

  // ─── Experience-specific instructions ───
  const expInstructions: Record<string, string> = {
    beginner: `EXPERIENCE = BEGINNER: Use primarily machines and guided compound movements (Smith machine squat, leg press, cable rows). NO Olympic lifts, NO advanced barbell work. Simple rep schemes (3x10-12). Include form cue in EVERY exercise description. Keep exercise count manageable (4-5 per session).`,
    intermediate: `EXPERIENCE = INTERMEDIATE: Mix of free weights and machines. Include barbell compounds (squat, bench, deadlift, rows). Can use supersets. Moderate complexity (5-7 exercises). Include tempo variations on some exercises (e.g., "3-1-2 tempo").`,
    advanced: `EXPERIENCE = ADVANCED: Emphasize barbell compounds, include specialized techniques (drop sets, rest-pause, cluster sets, tempo work). Include RPE target for each exercise in notes (e.g., "RPE 8"). Program 6-8 exercises per session. Use advanced variations (deficit deadlift, pause squat, close-grip bench). Include specific % or RPE targets.`,
  };

  // ─── Min exercises based on session duration ───
  let minExercises: number;
  if (p.workoutDuration <= 30) minExercises = 4;
  else if (p.workoutDuration <= 45) minExercises = 5;
  else if (p.workoutDuration <= 60) minExercises = 6;
  else minExercises = 7;

  // ─── Injury-specific banned exercises ───
  let injuryRules = '';
  if (p.injuries) {
    const lower = p.injuries.toLowerCase();
    const banned: string[] = [];
    if (lower.includes('knee')) banned.push('NO lunges, jump squats, deep squats, leg extensions with heavy weight, box jumps, or plyometric leg work');
    if (lower.includes('shoulder') || lower.includes('rotator')) banned.push('NO overhead pressing, behind-neck movements, upright rows, or heavy lateral raises');
    if (lower.includes('back') || lower.includes('spine')) banned.push('NO conventional deadlifts, good mornings, heavy bent-over rows, or spinal-loaded movements');
    if (lower.includes('wrist') || lower.includes('hand')) banned.push('NO heavy gripping exercises, barbell curls, or front rack positions');
    if (lower.includes('hip')) banned.push('NO deep squats, sumo deadlifts, or wide-stance movements');
    if (lower.includes('ankle') || lower.includes('foot')) banned.push('NO jumping, calf raises with heavy weight, or running');
    if (lower.includes('neck')) banned.push('NO shrugs, overhead pressing, or exercises that load the cervical spine');
    if (banned.length > 0) {
      injuryRules = `\nBANNED EXERCISES (injury safety): ${banned.join('. ')}.`;
    } else {
      injuryRules = `\nINJURY NOTE: User reports "${p.injuries}". Avoid ALL exercises that could aggravate this area. Provide safe alternatives.`;
    }
  }

  // ─── Warmup specificity ───
  const warmupNote = `Warmups MUST target the SPECIFIC muscles being trained that day. Leg day = hip openers, ankle mobility, glute bridges, leg swings. Upper day = band pull-aparts, arm circles, thoracic rotations. NEVER use generic warmups.`;

  return `You are "Titan", an elite AI Personal Trainer. Generate ONLY Week ${weekNumber} of a ${totalWeeks}-week program.

USER: ${p.age}y ${p.gender}, ${p.heightFt}'${p.heightIn}" (${heightCm}cm), ${p.weight}lbs (${weightKg}kg), ${p.bodyType} build.

${goalInstructions[p.goal] || ''}
${expInstructions[p.experienceLevel] || ''}

SPLIT: ${p.splitPreference === 'auto' ? 'Choose the best split for ' + p.daysPerWeek + ' days/week' : p.splitPreference.replace(/_/g, ' ')}
INTENSITY: ${p.intensity} (Low=RPE 4-5, Medium=RPE 6-7, High=RPE 8-9)
SESSION: ${p.workoutDuration} minutes, ${p.daysPerWeek} training days/week
${injuryRules}

PHASE: ${phaseLabel}
${previousWeekSummary ? `PREVIOUS WEEK: ${previousWeekSummary}` : ''}

CRITICAL RULES:
1. Training days MUST have at least ${minExercises} exercises. Fill the ${p.workoutDuration}-minute session.
2. ${warmupNote}
3. Cooldowns MUST target the muscles worked (after chest = pec stretch, thoracic rotation; after legs = quad stretch, hip flexor stretch).
4. REST/RECOVERY days: Include 3-5 activities (foam rolling specific areas, mobility flow, light cardio option, stretching routine). NOT just "walking."
5. Every exercise note MUST reference why it's chosen for THIS user's goal and experience level.
6. Each exercise needs 1 alternative exercise (with full details).
7. Schedule MUST have exactly 7 days (Day 1 through Day 7).
8. Sets/reps MUST change from week to week (this is week ${weekNumber}). Show progressive overload.

OUTPUT — Return ONLY this JSON:
{
  "weekNumber": ${weekNumber},
  "phaseLabel": "Foundation | Build | Peak | Deload",
  "schedule": [
    {
      "dayName": "Day 1 — <Focus>",
      "focus": "Upper Body | Lower Body | Push | Pull | Legs | Full Body | Rest | Active Recovery",
      "warmup": ["specific warmup 1", "specific warmup 2", "specific warmup 3"],
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": "8-10",
          "rest": "90s",
          "notes": "Why for THIS user (1 sentence referencing their goal/level).",
          "description": "How to perform with form cues (1 sentence).",
          "alternatives": [
            { "name": "Alt Name", "sets": 3, "reps": "8-10", "rest": "90s", "notes": "Why.", "description": "How." }
          ]
        }
      ],
      "cooldown": ["targeted stretch 1", "targeted stretch 2", "foam rolling focus area"]
    }
  ]
}`;
}
