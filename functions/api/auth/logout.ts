/**
 * POST /api/auth/logout
 * Clears the session cookie and deletes the session from D1.
 */
import type { Env } from '../_shared/types';
import { getSessionIdFromRequest, getClearSessionCookie } from '../_shared/session';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };

  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...headers, 'Set-Cookie': getClearSessionCookie() },
  });
};
