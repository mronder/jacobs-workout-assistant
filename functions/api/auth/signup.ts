/**
 * POST /api/auth/signup
 * Creates a new user account and returns a session cookie.
 */
import type { Env } from '../_shared/types';
import { hashPassword } from '../_shared/crypto';
import { generateSessionId, sessionExpiresAt, getSessionCookie } from '../_shared/session';
import { checkRateLimit } from '../_shared/rateLimit';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };

  // Rate limit: 5 signups per 15 minutes per IP
  const rateLimited = checkRateLimit(request, 5, 15 * 60 * 1000);
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400, headers,
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400, headers,
      });
    }

    // Check if email already exists
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists' }), {
        status: 409, headers,
      });
    }

    // Create user
    const userId = crypto.randomUUID().replace(/-/g, '');
    const passwordHash = await hashPassword(password);

    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
    ).bind(userId, email, passwordHash).run();

    // Create session
    const sessionId = generateSessionId();
    const expiresAt = sessionExpiresAt();
    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    ).bind(sessionId, userId, expiresAt).run();

    return new Response(
      JSON.stringify({ user: { id: userId, email } }),
      {
        status: 201,
        headers: {
          ...headers,
          'Set-Cookie': getSessionCookie(sessionId, new URL(request.url).protocol === 'https:'),
        },
      },
    );
  } catch (err) {
    console.error('Signup error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers,
    });
  }
};
