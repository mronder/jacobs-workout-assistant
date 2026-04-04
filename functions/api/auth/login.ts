/**
 * POST /api/auth/login
 * Authenticates user and returns a session cookie.
 */
import type { Env } from '../_shared/types';
import { verifyPassword } from '../_shared/crypto';
import { generateSessionId, sessionExpiresAt, getSessionCookie } from '../_shared/session';
import { checkRateLimit } from '../_shared/rateLimit';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };

  // Rate limit: 10 attempts per 15 minutes per IP
  const rateLimited = checkRateLimit(request, 10, 15 * 60 * 1000);
  if (rateLimited) return rateLimited;

  try {
    const body: { email?: string; password?: string } = await request.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400, headers,
      });
    }

    // Look up user
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
    ).bind(email).first<{ id: string; email: string; password_hash: string }>();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401, headers,
      });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401, headers,
      });
    }

    // Create session
    const sessionId = generateSessionId();
    const expiresAt = sessionExpiresAt();
    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    ).bind(sessionId, user.id, expiresAt).run();

    return new Response(
      JSON.stringify({ user: { id: user.id, email: user.email } }),
      {
        status: 200,
        headers: {
          ...headers,
          'Set-Cookie': getSessionCookie(sessionId, new URL(request.url).protocol === 'https:'),
        },
      },
    );
  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers,
    });
  }
};
