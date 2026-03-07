/**
 * GET  /api/weekly-notes?planId=xxx           — Load all weekly notes for a plan
 * POST /api/weekly-notes                       — Save/update a weekly note
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

  const notes = await db
    .prepare(
      `SELECT week_number, note FROM weekly_notes
       WHERE user_id = ? AND plan_id = ?
       ORDER BY week_number`,
    )
    .bind(userId, planId)
    .all<{ week_number: number; note: string }>();

  const result = notes.results.map((n) => ({
    weekNumber: n.week_number,
    note: n.note,
  }));

  return new Response(JSON.stringify(result), { status: 200, headers });
}

async function handlePost(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = await request.json() as {
    planId: string;
    weekNumber: number;
    note: string;
  };

  const { planId, weekNumber, note } = body;

  if (!planId || typeof weekNumber !== 'number' || typeof note !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers });
  }

  const existing = await db
    .prepare(
      `SELECT id FROM weekly_notes WHERE user_id = ? AND plan_id = ? AND week_number = ?`,
    )
    .bind(userId, planId, weekNumber)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE weekly_notes SET note = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(note, existing.id)
      .run();
  } else {
    const id = crypto.randomUUID().replace(/-/g, '');
    await db
      .prepare(
        `INSERT INTO weekly_notes (id, user_id, plan_id, week_number, note)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, planId, weekNumber, note)
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
