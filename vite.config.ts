import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The Windhawk Inspector custom domain serves the app from '/'.
// GITHUB_PAGES_BASE is set by the deployment workflow.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/',
  build: { target: 'es2022' },
  worker: { format: 'es' },
  test: { environment: 'node' },
});
