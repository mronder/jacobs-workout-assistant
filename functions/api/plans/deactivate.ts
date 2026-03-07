/**
 * POST /api/plans/deactivate — Deactivate the current active plan
 */
import type { Env } from '../_shared/types';
import { validateSession } from '../_shared/session';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };
  const auth = await validateSession(env.DB, request);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const body = await request.json() as { planId: string };

  await env.DB
    .prepare('UPDATE workout_plans SET is_active = 0 WHERE id = ? AND user_id = ?')
    .bind(body.planId, auth.userId)
    .run();

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
