/**
 * GET /api/plans/history — Load all plans for the user
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
      `SELECT id, plan_name, created_at, is_active, split_type
       FROM workout_plans
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(auth.userId)
    .all<{ id: string; plan_name: string; created_at: string; is_active: number; split_type: string | null }>();

  const plans = result.results.map((r) => ({
    id: r.id,
    planName: r.plan_name,
    createdAt: r.created_at,
    isActive: r.is_active === 1,
    splitType: r.split_type ?? null,
  }));

  return new Response(JSON.stringify(plans), { status: 200, headers });
};
