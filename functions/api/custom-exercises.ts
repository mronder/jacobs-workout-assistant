/**
 * Custom exercises CRUD API
 * GET    /api/custom-exercises?planId=xxx&dayNumber=yyy — Load custom exercises for a plan day
 * POST   /api/custom-exercises — Add a custom exercise for a plan day
 * DELETE /api/custom-exercises — Remove a custom exercise by id
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
  if (request.method === 'DELETE') return handleDelete(env.DB, auth.userId, request, headers);
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

/* ------------------------------------------------------------------ */
/*  GET — load custom exercises for a plan + day                       */
/* ------------------------------------------------------------------ */
async function handleGet(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const planId = url.searchParams.get('planId');
  const dayNumber = url.searchParams.get('dayNumber');

  if (!planId) {
    return new Response(JSON.stringify({ error: 'planId required' }), { status: 400, headers });
  }

  let query: string;
  let binds: unknown[];

  if (dayNumber) {
    query = `SELECT id, day_number, exercise_name, sets, position
             FROM custom_exercises
             WHERE user_id = ? AND plan_id = ? AND day_number = ?
             ORDER BY position, created_at`;
    binds = [userId, planId, Number(dayNumber)];
  } else {
    query = `SELECT id, day_number, exercise_name, sets, position
             FROM custom_exercises
             WHERE user_id = ? AND plan_id = ?
             ORDER BY day_number, position, created_at`;
    binds = [userId, planId];
  }

  const result = await db
    .prepare(query)
    .bind(...binds)
    .all<{
      id: string;
      day_number: number;
      exercise_name: string;
      sets: number;
      position: number;
    }>();

  const exercises = result.results.map((r) => ({
    id: r.id,
    dayNumber: r.day_number,
    exerciseName: r.exercise_name,
    sets: r.sets,
    position: r.position,
  }));

  return new Response(JSON.stringify(exercises), { status: 200, headers });
}

/* ------------------------------------------------------------------ */
/*  POST — add a custom exercise                                       */
/* ------------------------------------------------------------------ */
async function handlePost(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = await request.json() as {
    planId: string;
    dayNumber: number;
    exerciseName: string;
    sets?: number;
  };

  const { planId, dayNumber, exerciseName, sets } = body;

  if (!planId || typeof dayNumber !== 'number' || !exerciseName?.trim()) {
    return new Response(JSON.stringify({ error: 'planId, dayNumber, and exerciseName are required' }), {
      status: 400, headers,
    });
  }

  // Check for duplicate
  const existing = await db
    .prepare(
      `SELECT id FROM custom_exercises
       WHERE user_id = ? AND plan_id = ? AND day_number = ? AND exercise_name = ?`,
    )
    .bind(userId, planId, dayNumber, exerciseName.trim())
    .first();

  if (existing) {
    return new Response(JSON.stringify({ error: 'Exercise already exists for this day' }), {
      status: 409, headers,
    });
  }

  // Get next position
  const maxPos = await db
    .prepare(
      `SELECT COALESCE(MAX(position), 98) as max_pos
       FROM custom_exercises
       WHERE user_id = ? AND plan_id = ? AND day_number = ?`,
    )
    .bind(userId, planId, dayNumber)
    .first<{ max_pos: number }>();

  const id = crypto.randomUUID().replace(/-/g, '');
  const position = (maxPos?.max_pos ?? 98) + 1;

  await db
    .prepare(
      `INSERT INTO custom_exercises (id, user_id, plan_id, day_number, exercise_name, sets, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, planId, dayNumber, exerciseName.trim(), sets ?? 3, position)
    .run();

  return new Response(
    JSON.stringify({ id, dayNumber, exerciseName: exerciseName.trim(), sets: sets ?? 3, position }),
    { status: 201, headers },
  );
}

/* ------------------------------------------------------------------ */
/*  DELETE — remove a custom exercise                                  */
/* ------------------------------------------------------------------ */
async function handleDelete(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = await request.json() as { id: string };

  if (!body.id) {
    return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers });
  }

  // Verify ownership before deleting
  await db
    .prepare('DELETE FROM custom_exercises WHERE id = ? AND user_id = ?')
    .bind(body.id, userId)
    .run();

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
