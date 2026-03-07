/**
 * GET /api/history/exercises — Distinct exercises the user has logged
 */
import type { Env } from '../_shared/types';
import { validateSession } from '../_shared/session';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };
  const auth = await validateSession(env.DB, request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const result = await env.DB
    .prepare(
      `SELECT ts.exercise_name, COUNT(DISTINCT ts.tracked_workout_id) as session_count
       FROM tracked_sets ts
       JOIN tracked_workouts tw ON tw.id = ts.tracked_workout_id
       WHERE tw.user_id = ?
       GROUP BY ts.exercise_name
       ORDER BY ts.exercise_name COLLATE NOCASE`,
    )
    .bind(auth.userId)
    .all<{ exercise_name: string; session_count: number }>();

  const exercises = result.results.map((r) => ({
    exerciseName: r.exercise_name,
    sessionCount: r.session_count,
  }));

  return new Response(JSON.stringify(exercises), { status: 200, headers });
};
