/**
 * Session helpers — create, validate, and delete sessions in D1.
 * Sessions use opaque random IDs stored in HTTP-only cookies.
 */

const SESSION_DURATION_DAYS = 30;
const COOKIE_NAME = 'jw_session';

export function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function sessionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DURATION_DAYS);
  return d.toISOString();
}

export function getSessionCookie(sessionId: string, secure: boolean = true): string {
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;
  const parts = [
    `${COOKIE_NAME}=${sessionId}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function getClearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function validateSession(
  db: D1Database,
  request: Request,
): Promise<{ userId: string; email: string } | null> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  const row = await db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .bind(sessionId)
    .first<{ user_id: string; expires_at: string; email: string }>();

  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    // Lazy cleanup
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }

  return { userId: row.user_id, email: row.email };
}
