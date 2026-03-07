/**
 * GET /api/history/pr?name=xxx — Personal records for an exercise
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
      `SELECT ts.weight, ts.reps
       FROM tracked_sets ts
       JOIN tracked_workouts tw ON tw.id = ts.tracked_workout_id
       WHERE ts.exercise_name = ? AND tw.user_id = ? AND ts.completed = 1`,
    )
    .bind(exerciseName, auth.userId)
    .all<{ weight: number; reps: number }>();

  if (result.results.length === 0) {
    return new Response(JSON.stringify(null), { status: 200, headers });
  }

  let maxWeight = 0;
  let maxVolume = 0;
  let maxVolumeWeight = 0;
  let maxVolumeReps = 0;

  for (const row of result.results) {
    if (row.weight > maxWeight) maxWeight = row.weight;
    const vol = row.weight * row.reps;
    if (vol > maxVolume) {
      maxVolume = vol;
      maxVolumeWeight = row.weight;
      maxVolumeReps = row.reps;
    }
  }

  return new Response(
    JSON.stringify({ maxWeight, maxVolume, maxVolumeWeight, maxVolumeReps }),
    { status: 200, headers },
  );
};
