/**
 * POST /api/cleanup-sessions — Delete expired sessions from the database.
 * Protected by a shared secret in the X-Cron-Secret header.
 * Designed to be called periodically (e.g., daily) via Cloudflare Cron Trigger
 * or external scheduler.
 */
import type { Env } from './_shared/types';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { 'Content-Type': 'application/json' };

  // Protect with a secret (set CRON_SECRET in CF Pages environment variables)
  const cronSecret = (env as unknown as Record<string, unknown>).CRON_SECRET as string | undefined;
  const providedSecret = request.headers.get('X-Cron-Secret');

  if (cronSecret && providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  try {
    const result = await env.DB
      .prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`)
      .run();

    return new Response(
      JSON.stringify({ ok: true, deletedCount: result.meta?.changes ?? 0 }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error('Session cleanup failed:', err);
    return new Response(
      JSON.stringify({ error: 'Cleanup failed' }),
      { status: 500, headers },
    );
  }
};
