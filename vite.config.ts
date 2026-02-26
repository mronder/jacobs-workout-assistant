import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // DEV  → real key from .env.local (for direct OpenAI calls in browser)
      // PROD → empty string (the code path is tree-shaken by Rollup)
      __DEV_API_KEY__: JSON.stringify(
        mode === 'development' ? (env.OPENAI_API_KEY ?? '') : '',
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
    },
  };
});
