import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Base '/windhawk-inspector/' for project Pages, '/' for custom domains.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
  build: { target: 'es2022' },
  worker: { format: 'es' },
  test: { environment: 'node' },
});
