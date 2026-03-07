/**
 * GET /api/auth/me
 * Returns the currently authenticated user from the session cookie.
 */
import type { Env } from '../_shared/types';
import { validateSession } from '../_shared/session';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };

  const auth = await validateSession(env.DB, request);
  if (!auth) {
    return new Response(JSON.stringify({ user: null }), { status: 200, headers });
  }

  return new Response(
    JSON.stringify({ user: { id: auth.userId, email: auth.email } }),
    { status: 200, headers },
  );
};
