/**
 * Shared Env interface for all Pages Functions.
 * D1 binding "DB" must be configured in wrangler.toml / CF Pages dashboard.
 */
export interface Env {
  DB: D1Database;
  OPENAI_API_KEY: string;
}

/**
 * Extended context data passed through middleware.
 */
export interface AuthData {
  userId: string;
  email: string;
}
