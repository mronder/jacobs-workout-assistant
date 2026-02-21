// Type declarations for Netlify Edge Functions runtime globals.
// These are provided by Netlify's Deno-based edge runtime at deploy time.
declare const Netlify: {
  env: {
    get(key: string): string | undefined;
    has(key: string): boolean;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  };
};
