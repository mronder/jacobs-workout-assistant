/**
 * GET /api/history/progression?name=xxx — Weight progression chart data
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
  const exerciseName = url.searchParams.get('name');
  if (!exerciseName) {
    return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers });
  }

  const result = await env.DB
    .prepare(
      `SELECT ts.weight, tw.completed_at
       FROM tracked_sets ts
       JOIN tracked_workouts tw ON tw.id = ts.tracked_workout_id
       WHERE ts.exercise_name = ? AND tw.user_id = ? AND ts.completed = 1`,
    )
    .bind(exerciseName, auth.userId)
    .all<{ weight: number; completed_at: string | null }>();

  // Group by date, take max weight per session
  const dateMap = new Map<string, number>();
  for (const row of result.results) {
    const date = row.completed_at?.split('T')[0] ?? '';
    if (!date) continue;
    const current = dateMap.get(date) ?? 0;
    if (row.weight > current) dateMap.set(date, row.weight);
  }

  const points = Array.from(dateMap.entries())
    .map(([date, maxWeight]) => ({ date, maxWeight }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  return new Response(JSON.stringify(points), { status: 200, headers });
};
