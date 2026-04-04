/**
 * Centralized storage key definitions.
 * All localStorage and sessionStorage keys used across the app
 * should be defined here to prevent typos and ease migration.
 */

export const STORAGE_KEYS = {
  plan: 'jw_plan',
  tracked: 'jw_tracked',
  activeSession: 'jw_active_session',
} as const;

/**
 * Session storage keys (cleared when tab closes).
 * Used for ephemeral caching of server data.
 */
export const SESSION_KEYS = {
  /** Prefix for last-session data cache — append `:${planId}:${dayNumber}` */
  lastSession: 'jw_last_session',
} as const;

/** Build a session-storage cache key for last-session data */
export function lastSessionCacheKey(planId: string, dayNumber: number): string {
  return `${SESSION_KEYS.lastSession}:${planId}:${dayNumber}`;
}
