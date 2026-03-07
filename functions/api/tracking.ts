/**
 * GET /api/tracking?planId=xxx — Load tracked workouts for a plan
 * POST /api/tracking — Save/update a tracked workout
 */
import type { Env } from './_shared/types';
import { validateSession } from './_shared/session';

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };
  const auth = await validateSession(env.DB, request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  if (request.method === 'GET') return handleGet(env.DB, auth.userId, request, headers);
  if (request.method === 'POST') return handlePost(env.DB, auth.userId, request, headers);
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

/* ------------------------------------------------------------------ */
/*  GET — load all tracked workouts for a plan                         */
/* ------------------------------------------------------------------ */
async function handleGet(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  if (!planId) {
    return new Response(JSON.stringify({ error: 'planId required' }), { status: 400, headers });
  }

  const workouts = await db
    .prepare(
      `SELECT id, week_number, day_number, completed, completed_at, note
       FROM tracked_workouts
       WHERE user_id = ? AND plan_id = ?
       ORDER BY week_number, day_number`,
    )
    .bind(userId, planId)
    .all<{ id: string; week_number: number; day_number: number; completed: number; completed_at: string | null; note: string | null }>();

  // Load all sets for all these workouts
  const workoutIds = workouts.results.map((w) => w.id);
  let allSets: { tracked_workout_id: string; exercise_name: string; set_number: number; weight: number; reps: number; completed: number; weight_unit: string; note: string | null }[] = [];

  if (workoutIds.length > 0) {
    const placeholders = workoutIds.map(() => '?').join(',');
    const setsResult = await db
      .prepare(
        `SELECT tracked_workout_id, exercise_name, set_number, weight, reps, completed, weight_unit, note
         FROM tracked_sets
         WHERE tracked_workout_id IN (${placeholders})
         ORDER BY set_number`,
      )
      .bind(...workoutIds)
      .all();
    allSets = setsResult.results as typeof allSets;
  }

  // Group sets by workout
  const setsMap = new Map<string, typeof allSets>();
  for (const s of allSets) {
    if (!setsMap.has(s.tracked_workout_id)) setsMap.set(s.tracked_workout_id, []);
    setsMap.get(s.tracked_workout_id)!.push(s);
  }

  const result = workouts.results.map((tw) => {
    const sets = setsMap.get(tw.id) ?? [];

    // Group by exercise name
    const exerciseMap = new Map<string, typeof sets>();
    for (const s of sets) {
      if (!exerciseMap.has(s.exercise_name)) exerciseMap.set(s.exercise_name, []);
      exerciseMap.get(s.exercise_name)!.push(s);
    }

    const exercises = Array.from(exerciseMap.entries()).map(([name, exSets]) => ({
      exerciseName: name,
      weightUnit: exSets[0]?.weight_unit ?? 'lbs',
      sets: exSets
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          weight: s.weight,
          reps: s.reps,
          completed: s.completed === 1,
        })),
      ...(exSets[0]?.note ? { note: exSets[0].note } : {}),
    }));

    return {
      weekNumber: tw.week_number,
      dayNumber: tw.day_number,
      date: tw.completed_at ?? '',
      exercises,
      completed: tw.completed === 1,
      ...(tw.note ? { note: tw.note } : {}),
    };
  });

  return new Response(JSON.stringify(result), { status: 200, headers });
}

/* ------------------------------------------------------------------ */
/*  POST — save/update a tracked workout                               */
/* ------------------------------------------------------------------ */
async function handlePost(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = await request.json() as {
    planId: string;
    workout: {
      weekNumber: number;
      dayNumber: number;
      exercises: Array<{
        exerciseName: string;
        weightUnit?: string;
        sets: Array<{ weight: number; reps: number; completed: boolean }>;
        note?: string;
      }>;
      completed: boolean;
      note?: string;
    };
  };

  const { planId, workout } = body;

  // Check if existing
  const existing = await db
    .prepare(
      `SELECT id FROM tracked_workouts
       WHERE user_id = ? AND plan_id = ? AND week_number = ? AND day_number = ?`,
    )
    .bind(userId, planId, workout.weekNumber, workout.dayNumber)
    .first<{ id: string }>();

  let workoutId: string;

  if (existing) {
    workoutId = existing.id;
    await db
      .prepare(
        `UPDATE tracked_workouts SET completed = ?, completed_at = ?, note = ? WHERE id = ?`,
      )
      .bind(
        workout.completed ? 1 : 0,
        workout.completed ? new Date().toISOString() : null,
        workout.note ?? null,
        workoutId,
      )
      .run();

    // Delete old sets
    await db.prepare('DELETE FROM tracked_sets WHERE tracked_workout_id = ?').bind(workoutId).run();
  } else {
    workoutId = crypto.randomUUID().replace(/-/g, '');
    await db
      .prepare(
        `INSERT INTO tracked_workouts (id, user_id, plan_id, week_number, day_number, completed, completed_at, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        workoutId, userId, planId, workout.weekNumber, workout.dayNumber,
        workout.completed ? 1 : 0,
        workout.completed ? new Date().toISOString() : null,
        workout.note ?? null,
      )
      .run();
  }

  // Insert sets
  const batch: D1PreparedStatement[] = [];
  for (const ex of workout.exercises) {
    for (let i = 0; i < ex.sets.length; i++) {
      const s = ex.sets[i];
      const setId = crypto.randomUUID().replace(/-/g, '');
      batch.push(
        db.prepare(
          `INSERT INTO tracked_sets (id, tracked_workout_id, exercise_name, set_number, weight, reps, completed, weight_unit, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(setId, workoutId, ex.exerciseName, i + 1, s.weight, s.reps, s.completed ? 1 : 0, ex.weightUnit ?? 'lbs', i === 0 ? (ex.note ?? null) : null),
      );
    }
  }

  if (batch.length > 0) {
    await db.batch(batch);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
