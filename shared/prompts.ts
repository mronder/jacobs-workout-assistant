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

  return `Titan AI Trainer. Week ${weekNumber}/${totalWeeks}.

*** ${p.daysPerWeek} WORKOUT days + ${7 - p.daysPerWeek} REST days = 7 total. ***

USER: ${p.age}y ${p.gender}, ${p.heightFt}'${p.heightIn}", ${p.weight}lbs, ${p.bodyType}.
${goalInstructions[p.goal] || ''}
${expInstructions[p.experienceLevel] || ''}
SPLIT: ${p.splitPreference === 'auto' ? 'best for ' + p.daysPerWeek + 'd/wk' : p.splitPreference.replace(/_/g, ' ')}
INTENSITY: ${p.intensity} | SESSION: ${p.workoutDuration}min${injuryRules}
PHASE: ${phaseLabel}

RULES: ${minExercises}+ exercises per training day. Muscle-specific warmups (3) and cooldowns (2-3). Rest days: 3-5 recovery activities (foam roll, mobility, walk, stretch). 1 alternative per exercise. Progressive overload week-to-week.

JSON:
{"weekNumber":${weekNumber},"phaseLabel":"phase","schedule":[
{"dayName":"Day 1 — Focus","focus":"Upper Body|Lower Body|Push|Pull|Legs|Full Body","warmup":["a","b","c"],"exercises":[{"name":"X","sets":3,"reps":"8-10","rest":"90s","notes":"why","description":"how","alternatives":[{"name":"Y","sets":3,"reps":"8-10","rest":"90s","notes":"why","description":"how"}]}],"cooldown":["a","b"]},
{"dayName":"Day N — Rest","focus":"Rest","warmup":[],"exercises":[],"cooldown":["foam rolling","light walk","mobility","stretching"]}
]}

${p.daysPerWeek} training + ${7 - p.daysPerWeek} rest = 7 days exactly.`;
}
