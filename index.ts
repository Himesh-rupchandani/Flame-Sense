/**
 * Local / container entrypoint.
 *
 * Serves the Vite dev middleware in development and the built `dist/` bundle in
 * production, then listens on `PORT`. Kept separate from `server.ts` so Vercel's
 * function bundler never traces Vite (and its native binaries) into `api/index.ts`.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await createApp();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Flame in Freefall server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Flame in Freefall server:', err);
  process.exit(1);
});
