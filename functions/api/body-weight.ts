/**
 * POST /api/body-weight — Save a bodyweight entry (upserts for same date)
 * GET  /api/body-weight?range=90 — Get entries for the last N days
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
  const range = parseInt(url.searchParams.get('range') || '90', 10);
  const daysAgo = Math.min(Math.max(range, 7), 365);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysAgo);

  const result = await db
    .prepare(
      `SELECT id, weight, weight_unit, recorded_at
       FROM body_weights
       WHERE user_id = ? AND recorded_at >= ?
       ORDER BY recorded_at ASC`,
    )
    .bind(userId, cutoff.toISOString())
    .all<{ id: string; weight: number; weight_unit: string; recorded_at: string }>();

  const entries = result.results.map(r => ({
    id: r.id,
    weight: r.weight,
    unit: r.weight_unit,
    date: r.recorded_at,
  }));

  return new Response(JSON.stringify(entries), { status: 200, headers });
}

async function handlePost(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = await request.json() as { weight: number; unit?: string; date?: string };
  const weight = body.weight;
  const unit = body.unit === 'kg' ? 'kg' : 'lbs';

  if (!weight || weight <= 0 || weight > 1000) {
    return new Response(JSON.stringify({ error: 'Invalid weight' }), { status: 400, headers });
  }

  // Use provided date or today, normalized to date-only
  const recordDate = body.date ? new Date(body.date) : new Date();
  const dateStr = recordDate.toISOString().split('T')[0] + 'T00:00:00.000Z';

  // Upsert — check if entry exists for this date
  const existing = await db
    .prepare(
      `SELECT id FROM body_weights
       WHERE user_id = ? AND date(recorded_at) = date(?)`,
    )
    .bind(userId, dateStr)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE body_weights SET weight = ?, weight_unit = ? WHERE id = ?`)
      .bind(weight, unit, existing.id)
      .run();
  } else {
    const id = crypto.randomUUID().replace(/-/g, '');
    await db
      .prepare(
        `INSERT INTO body_weights (id, user_id, weight, weight_unit, recorded_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, weight, unit, dateStr)
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
