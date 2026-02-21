/**
 * Shared types and prompt builders used by both:
 *  - Vite dev server plugin (server/apiPlugin.ts)
 *  - Netlify serverless functions (netlify/functions/)
 */

export interface UserProfile {
  age: number;
  heightFt: number;
  heightIn: number;
  weight: number;
  gender: 'male' | 'female';
  bodyType: 'slim' | 'average' | 'heavy' | 'athletic';
  daysPerWeek: number;
  workoutDuration: number;
  planDurationWeeks: number;
  intensity: 'low' | 'medium' | 'high';
  goal: 'lose_weight' | 'build_muscle' | 'strength' | 'endurance' | 'flexibility';
  splitPreference: 'auto' | 'full_body' | 'upper_lower' | 'ppl' | 'body_part';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  injuries: string;
}

export function buildMetaMessages(profile: UserProfile) {
  return {
    system: 'You create concise metadata for personalized workout programs. Return ONLY valid JSON.',
    user: `Create a workout program title and description for:
- Goal: ${profile.goal.replace(/_/g, ' ')}
- ${profile.daysPerWeek} days/week, ${profile.workoutDuration} min sessions, ${profile.planDurationWeeks} weeks
- Split: ${profile.splitPreference === 'auto' ? 'your choice' : profile.splitPreference.replace(/_/g, ' ')}
- Experience: ${profile.experienceLevel}
- Body type: ${profile.bodyType}

Return JSON: { "title": "catchy program name", "description": "1-2 sentence overview", "frequency": "X days/week" }`,
  };
}

export function buildWeekPrompt(
  p: UserProfile,
  weekNumber: number,
  totalWeeks: number,
  previousWeekSummary?: string
): string {
  const heightInches = p.heightFt * 12 + p.heightIn;
  const heightCm = Math.round(heightInches * 2.54);
  const weightKg = Math.round(p.weight * 0.453592);

  let phaseLabel: string;
  if (weekNumber === 1) {
    phaseLabel = 'FOUNDATION PHASE — establish baseline volumes and moderate intensities.';
  } else if (weekNumber <= Math.floor(totalWeeks * 0.5)) {
    phaseLabel = `BUILD PHASE (Week ${weekNumber}/${totalWeeks}) — increase volume by 10-15% from previous week.`;
  } else if (weekNumber < totalWeeks) {
    phaseLabel = `PEAK PHASE (Week ${weekNumber}/${totalWeeks}) — highest working intensities.`;
  } else {
    phaseLabel = `DELOAD WEEK (Week ${weekNumber}/${totalWeeks}) — reduce volume by 40%, keep intensity at 60-70%.`;
  }

  const goalInstructions: Record<string, string> = {
    lose_weight: 'GOAL = FAT LOSS: Supersets, circuits, 1-2 HIIT finishers per day. Short rest (30-60s). Higher reps (12-20). Include compound cardio.',
    build_muscle: 'GOAL = HYPERTROPHY: 3-4 sets of 8-12 reps compounds, 3x12-15 isolation. Rest 60-90s. Pull+push balance each day.',
    strength: 'GOAL = MAX STRENGTH: Heavy compounds first (squat/bench/dead/OHP). 4-5x3-6 primary lifts, 2-3min rest. RPE targets for advanced.',
    endurance: 'GOAL = ENDURANCE: Reps 15-25+, rest 30-45s, circuit-style. Include cardio blocks.',
    flexibility: 'GOAL = MOBILITY: Extended warmup (10+ min), yoga flows, full ROM movements, 8-10 min cooldowns.',
  };

  const expInstructions: Record<string, string> = {
    beginner: 'BEGINNER: Machines + guided compounds (Smith machine, leg press, cables). NO Olympic lifts. 3x10-12. Form cues in every description.',
    intermediate: 'INTERMEDIATE: Free weights + machines. Barbell compounds. Supersets OK. 5-7 exercises. Tempo variations.',
    advanced: 'ADVANCED: Barbell-focused, drop sets, rest-pause, cluster sets, tempo. RPE per exercise. 6-8 exercises. Advanced variations.',
  };

  let minExercises: number;
  if (p.workoutDuration <= 30) minExercises = 4;
  else if (p.workoutDuration <= 45) minExercises = 5;
  else if (p.workoutDuration <= 60) minExercises = 6;
  else minExercises = 7;

  let injuryRules = '';
  if (p.injuries) {
    const lower = p.injuries.toLowerCase();
    const banned: string[] = [];
    if (lower.includes('knee')) banned.push('NO lunges/jump squats/deep squats/box jumps');
    if (lower.includes('shoulder') || lower.includes('rotator')) banned.push('NO overhead pressing/behind-neck/upright rows');
    if (lower.includes('back') || lower.includes('spine')) banned.push('NO conventional deadlifts/good mornings/heavy bent-over rows');
    if (lower.includes('wrist') || lower.includes('hand')) banned.push('NO heavy gripping/barbell curls/front rack');
    if (lower.includes('hip')) banned.push('NO deep squats/sumo deadlifts/wide-stance');
    if (lower.includes('ankle') || lower.includes('foot')) banned.push('NO jumping/heavy calf raises/running');
    if (lower.includes('neck')) banned.push('NO shrugs/overhead pressing/cervical loading');
    if (banned.length > 0) {
      injuryRules = `\nBANNED (injury): ${banned.join('. ')}.`;
    } else {
      injuryRules = `\nINJURY: "${p.injuries}" — avoid all exercises that aggravate this.`;
    }
  }

  return `You are "Titan", an elite AI Personal Trainer. Generate ONLY Week ${weekNumber} of a ${totalWeeks}-week program.

USER: ${p.age}y ${p.gender}, ${p.heightFt}'${p.heightIn}" (${heightCm}cm), ${p.weight}lbs (${weightKg}kg), ${p.bodyType} build.

${goalInstructions[p.goal] || ''}
${expInstructions[p.experienceLevel] || ''}

SPLIT: ${p.splitPreference === 'auto' ? 'Choose best for ' + p.daysPerWeek + ' days/week' : p.splitPreference.replace(/_/g, ' ')}
INTENSITY: ${p.intensity} (Low=RPE 4-5, Med=RPE 6-7, High=RPE 8-9)
SESSION: ${p.workoutDuration}min, ${p.daysPerWeek} days/week
${injuryRules}

PHASE: ${phaseLabel}
${previousWeekSummary ? `PREV WEEK: ${previousWeekSummary}` : ''}

RULES:
1. EXACTLY ${p.daysPerWeek} TRAINING days with real exercises (at least ${minExercises} exercises each, ${p.workoutDuration}min sessions). "Active Recovery" does NOT count as a training day.
2. EXACTLY ${7 - p.daysPerWeek} REST/ACTIVE RECOVERY days (no gym exercises, only recovery activities like foam rolling, mobility, light walking, stretching, yoga — provide 3-5 activity suggestions per rest day).
3. Total MUST be exactly 7 days (${p.daysPerWeek} training + ${7 - p.daysPerWeek} rest = 7).
4. Warmups MUST target that day's muscles (leg day=hip openers/glute bridges, upper=band pull-aparts/thoracic rotations).
5. Cooldowns target worked muscles.
6. Notes must reference THIS user's goal/level. 1 alternative per exercise.
7. Sets/reps MUST differ from other weeks (progressive overload).

JSON ONLY:
{
  "weekNumber": ${weekNumber},
  "phaseLabel": "Foundation | Build | Peak | Deload",
  "schedule": [
    {
      "dayName": "Day 1 — <Focus>",
      "focus": "Upper Body|Lower Body|Push|Pull|Legs|Full Body",
      "warmup": ["specific1","specific2","specific3"],
      "exercises": [
        {
          "name": "Name", "sets": 3, "reps": "8-10", "rest": "90s",
          "notes": "Why for this user.", "description": "How to perform.",
          "alternatives": [{ "name": "Alt", "sets": 3, "reps": "8-10", "rest": "90s", "notes": "Why.", "description": "How." }]
        }
      ],
      "cooldown": ["targeted stretch 1","targeted stretch 2"]
    },
    {
      "dayName": "Day X — Active Recovery",
      "focus": "Rest",
      "warmup": [],
      "exercises": [],
      "cooldown": ["foam rolling", "light walk 20 min", "hip mobility flow", "full body stretching"]
    }
  ]
}

CRITICAL: The schedule array must have exactly ${p.daysPerWeek} training days (with exercises) and ${7 - p.daysPerWeek} rest days (focus="Rest", exercises=[]). Total = 7 days.`;
}
