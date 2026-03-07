/**
 * GET /api/plans — Load the user's active plan
 * POST /api/plans — Save a new plan
 */
import type { Env } from '../_shared/types';
import { validateSession } from '../_shared/session';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };
  const auth = await validateSession(env.DB, request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  if (request.method === 'GET') return handleGet(env.DB, auth.userId, headers);
  if (request.method === 'POST') return handlePost(env.DB, auth.userId, request, headers);
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

/* ------------------------------------------------------------------ */
/*  GET — load active plan                                             */
/* ------------------------------------------------------------------ */
async function handleGet(
  db: D1Database,
  userId: string,
  headers: Record<string, string>,
): Promise<Response> {
  const planRow = await db
    .prepare(
      `SELECT id, plan_name, split_description, motivational_quote, quote_author
       FROM workout_plans
       WHERE user_id = ? AND is_active = 1
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(userId)
    .first<{
      id: string;
      plan_name: string;
      split_description: string;
      motivational_quote: string;
      quote_author: string;
    }>();

  if (!planRow) {
    return new Response(JSON.stringify(null), { status: 200, headers });
  }

  // Load days
  const days = await db
    .prepare('SELECT id, day_number, focus FROM plan_days WHERE plan_id = ? ORDER BY day_number')
    .bind(planRow.id)
    .all<{ id: string; day_number: number; focus: string }>();

  // Load exercises for all days
  const dayIds = days.results.map((d) => d.id);
  let exercises: { id: string; plan_day_id: string; position: number; name: string; sets: number; reps: string; rest: string; expert_advice: string; video_search_query: string }[] = [];

  if (dayIds.length > 0) {
    const placeholders = dayIds.map(() => '?').join(',');
    const exResult = await db
      .prepare(
        `SELECT id, plan_day_id, position, name, sets, reps, rest, expert_advice, video_search_query
         FROM plan_exercises
         WHERE plan_day_id IN (${placeholders})
         ORDER BY position`,
      )
      .bind(...dayIds)
      .all();
    exercises = exResult.results as typeof exercises;
  }

  // Load alternatives for all exercises
  const exerciseIds = exercises.map((e) => e.id);
  let alternatives: { exercise_id: string; name: string; expert_advice: string; video_search_query: string }[] = [];

  if (exerciseIds.length > 0) {
    const placeholders = exerciseIds.map(() => '?').join(',');
    const altResult = await db
      .prepare(
        `SELECT exercise_id, name, expert_advice, video_search_query
         FROM exercise_alternatives
         WHERE exercise_id IN (${placeholders})`,
      )
      .bind(...exerciseIds)
      .all();
    alternatives = altResult.results as typeof alternatives;
  }

  // Build the WorkoutPlan shape
  const altMap = new Map<string, typeof alternatives>();
  for (const alt of alternatives) {
    if (!altMap.has(alt.exercise_id)) altMap.set(alt.exercise_id, []);
    altMap.get(alt.exercise_id)!.push(alt);
  }

  const exMap = new Map<string, typeof exercises>();
  for (const ex of exercises) {
    if (!exMap.has(ex.plan_day_id)) exMap.set(ex.plan_day_id, []);
    exMap.get(ex.plan_day_id)!.push(ex);
  }

  const shapedDays = days.results.map((d) => ({
    dayNumber: d.day_number,
    focus: d.focus,
    exercises: (exMap.get(d.id) ?? []).map((ex) => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      rest: ex.rest,
      expertAdvice: ex.expert_advice ?? '',
      videoSearchQuery: ex.video_search_query ?? '',
      alternatives: (altMap.get(ex.id) ?? []).map((a) => ({
        name: a.name,
        expertAdvice: a.expert_advice ?? '',
        videoSearchQuery: a.video_search_query ?? '',
      })),
    })),
  }));

  const weeks = [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, days: shapedDays }));

  const plan = {
    planName: planRow.plan_name,
    splitDescription: planRow.split_description ?? '',
    motivationalQuote: planRow.motivational_quote ?? '',
    quoteAuthor: planRow.quote_author ?? '',
    weeks,
  };

  return new Response(JSON.stringify({ plan, planId: planRow.id }), { status: 200, headers });
}

/* ------------------------------------------------------------------ */
/*  POST — save a new plan                                             */
/* ------------------------------------------------------------------ */
async function handlePost(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = await request.json() as {
    plan: {
      planName: string;
      splitDescription: string;
      motivationalQuote: string;
      quoteAuthor: string;
      weeks: Array<{ days: Array<{ dayNumber: number; focus: string; description?: string; exercises: Array<{ name: string; sets: number; reps: string; rest: string; expertAdvice: string; videoSearchQuery: string; alternatives: Array<{ name: string; expertAdvice: string; videoSearchQuery: string }> }> }> }>;
    };
    daysPerWeek: number;
    goal: string;
    level: string;
    secondaryGoal?: string | null;
  };

  const { plan, daysPerWeek, goal, level, secondaryGoal } = body;

  // Deactivate current active plans
  await db
    .prepare('UPDATE workout_plans SET is_active = 0 WHERE user_id = ? AND is_active = 1')
    .bind(userId)
    .run();

  // Insert plan
  const planId = crypto.randomUUID().replace(/-/g, '');
  await db
    .prepare(
      `INSERT INTO workout_plans (id, user_id, plan_name, split_description, motivational_quote, quote_author, days_per_week, goal, level, secondary_goal, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(
      planId, userId, plan.planName, plan.splitDescription,
      plan.motivationalQuote, plan.quoteAuthor, daysPerWeek, goal, level,
      secondaryGoal ?? null,
    )
    .run();

  // Use the first week as template (weeks 2-4 are clones)
  const templateDays = plan.weeks[0]?.days ?? [];

  // Batch insert days, exercises, alternatives
  const batch: D1PreparedStatement[] = [];

  for (const day of templateDays) {
    const dayId = crypto.randomUUID().replace(/-/g, '');
    batch.push(
      db.prepare('INSERT INTO plan_days (id, plan_id, day_number, focus) VALUES (?, ?, ?, ?)')
        .bind(dayId, planId, day.dayNumber, day.focus),
    );

    for (let i = 0; i < day.exercises.length; i++) {
      const ex = day.exercises[i];
      const exId = crypto.randomUUID().replace(/-/g, '');
      batch.push(
        db.prepare(
          `INSERT INTO plan_exercises (id, plan_day_id, position, name, sets, reps, rest, expert_advice, video_search_query)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(exId, dayId, i + 1, ex.name, ex.sets, ex.reps, ex.rest, ex.expertAdvice, ex.videoSearchQuery),
      );

      for (const alt of ex.alternatives) {
        const altId = crypto.randomUUID().replace(/-/g, '');
        batch.push(
          db.prepare(
            `INSERT INTO exercise_alternatives (id, exercise_id, name, expert_advice, video_search_query)
             VALUES (?, ?, ?, ?, ?)`,
          ).bind(altId, exId, alt.name, alt.expertAdvice, alt.videoSearchQuery),
        );
      }
    }
  }

  if (batch.length > 0) {
    await db.batch(batch);
  }

  return new Response(JSON.stringify({ planId }), { status: 201, headers });
}
