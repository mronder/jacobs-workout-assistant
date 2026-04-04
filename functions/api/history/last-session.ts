/**
 * GET /api/history/last-session?planId=X&dayNumber=Y
 * Returns the most recent tracked sets for all exercises on a given day.
 * Response: { [exerciseName]: { sets: [{ weight, reps }], date } }
 */
import type { Env } from '../_shared/types';
import { validateSession } from '../_shared/session';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };
  const auth = await validateSession(env.DB, request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const dayNumber = url.searchParams.get('dayNumber');
  if (!planId || !dayNumber) {
    return new Response(JSON.stringify({ error: 'planId and dayNumber required' }), { status: 400, headers });
  }

  // Find the most recent completed workout for this plan + day
  const lastWorkout = await env.DB
    .prepare(
      `SELECT id, completed_at
       FROM tracked_workouts
       WHERE user_id = ? AND plan_id = ? AND day_number = ? AND completed = 1
       ORDER BY completed_at DESC
       LIMIT 1`,
    )
    .bind(auth.userId, planId, parseInt(dayNumber, 10))
    .first<{ id: string; completed_at: string }>();

  if (!lastWorkout) {
    return new Response(JSON.stringify({}), { status: 200, headers });
  }

  // Get all sets from that workout
  const sets = await env.DB
    .prepare(
      `SELECT exercise_name, set_number, weight, reps, completed
       FROM tracked_sets
       WHERE tracked_workout_id = ?
       ORDER BY exercise_name, set_number`,
    )
    .bind(lastWorkout.id)
    .all<{ exercise_name: string; set_number: number; weight: number; reps: number; completed: number }>();

  // Group by exercise name
  const result: Record<string, { sets: Array<{ weight: number; reps: number }>; date: string }> = {};
  for (const row of sets.results) {
    if (!result[row.exercise_name]) {
      result[row.exercise_name] = { sets: [], date: lastWorkout.completed_at };
    }
    result[row.exercise_name].sets.push({
      weight: row.weight,
      reps: row.reps,
    });
  }

  return new Response(JSON.stringify(result), { status: 200, headers });
};
