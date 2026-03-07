/**
 * GET /api/history/exercise?name=xxx — Full history for one exercise
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
      `SELECT ts.set_number, ts.weight, ts.reps, ts.completed,
              tw.completed_at, tw.week_number, tw.day_number,
              wp.plan_name
       FROM tracked_sets ts
       JOIN tracked_workouts tw ON tw.id = ts.tracked_workout_id
       JOIN workout_plans wp ON wp.id = tw.plan_id
       WHERE ts.exercise_name = ? AND tw.user_id = ?
       ORDER BY tw.completed_at DESC, ts.set_number`,
    )
    .bind(exerciseName, auth.userId)
    .all<{
      set_number: number; weight: number; reps: number; completed: number;
      completed_at: string | null; week_number: number; day_number: number; plan_name: string;
    }>();

  // Group by session (completed_at)
  const sessionMap = new Map<string, {
    date: string; planName: string; weekNumber: number; dayNumber: number;
    sets: Array<{ setNumber: number; weight: number; reps: number; completed: boolean }>;
  }>();

  for (const row of result.results) {
    const key = row.completed_at ?? 'unknown';
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        date: row.completed_at ?? '',
        planName: row.plan_name,
        weekNumber: row.week_number,
        dayNumber: row.day_number,
        sets: [],
      });
    }
    sessionMap.get(key)!.sets.push({
      setNumber: row.set_number,
      weight: row.weight,
      reps: row.reps,
      completed: row.completed === 1,
    });
  }

  const sessions = Array.from(sessionMap.values());
  for (const s of sessions) s.sets.sort((a, b) => a.setNumber - b.setNumber);
  sessions.sort((a, b) => (b.date > a.date ? 1 : -1));

  return new Response(JSON.stringify(sessions), { status: 200, headers });
};
