/**
 * POST /api/preferences — Upsert user preferences
 * GET  /api/preferences — Load all preferences for the authenticated user
 */
import type { Env } from './_shared/types';
import { validateSession } from './_shared/session';

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

async function handleGet(
  db: D1Database,
  userId: string,
  headers: Record<string, string>,
): Promise<Response> {
  const row = await db
    .prepare(
      `SELECT default_weight_unit, mobility_focus, stretching_goals, updated_at
       FROM user_preferences
       WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ default_weight_unit: string; mobility_focus: string | null; stretching_goals: string | null; updated_at: string }>();

  if (!row) {
    return new Response(JSON.stringify({ defaultWeightUnit: 'lbs', mobilityAreas: [], sessionDuration: 60 }), { status: 200, headers });
  }

  // mobility_focus stores JSON array of areas, stretching_goals stores session duration
  let mobilityAreas: string[] = [];
  try {
    if (row.mobility_focus) mobilityAreas = JSON.parse(row.mobility_focus);
  } catch { /* ignore */ }

  let sessionDuration = 60;
  try {
    if (row.stretching_goals) sessionDuration = parseInt(row.stretching_goals, 10) || 60;
  } catch { /* ignore */ }

  return new Response(JSON.stringify({
    defaultWeightUnit: row.default_weight_unit,
    mobilityAreas,
    sessionDuration,
  }), { status: 200, headers });
}

async function handlePost(
  db: D1Database,
  userId: string,
  request: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = await request.json() as {
    defaultWeightUnit?: string;
    mobilityAreas?: string[];
    sessionDuration?: number;
  };

  const weightUnit = body.defaultWeightUnit === 'kg' ? 'kg' : 'lbs';
  const mobilityFocus = body.mobilityAreas ? JSON.stringify(body.mobilityAreas) : null;
  const sessionDuration = body.sessionDuration ? String(body.sessionDuration) : null;

  // Upsert
  const existing = await db
    .prepare(`SELECT user_id FROM user_preferences WHERE user_id = ?`)
    .bind(userId)
    .first();

  if (existing) {
    await db
      .prepare(
        `UPDATE user_preferences SET default_weight_unit = ?, mobility_focus = ?, stretching_goals = ?, updated_at = datetime('now')
         WHERE user_id = ?`,
      )
      .bind(weightUnit, mobilityFocus, sessionDuration, userId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO user_preferences (user_id, default_weight_unit, mobility_focus, stretching_goals)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(userId, weightUnit, mobilityFocus, sessionDuration)
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
