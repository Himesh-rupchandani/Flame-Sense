/**
 * Vercel serverless entrypoint.
 *
 * Everything under `/api/*` is rewritten to this single Express function (see
 * `vercel.json`), reusing the exact same app factory as the long-running
 * server in `server.ts`. The React build in `dist/` is served statically by
 * Vercel's CDN, so this handler only ever responds to API traffic.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server.ts';

type ExpressApp = Awaited<ReturnType<typeof createApp>>;

let appPromise: Promise<ExpressApp> | null = null;

function getApp(): Promise<ExpressApp> {
  // Cache the initialised app (and its SQLite connection) across warm invocations.
  if (!appPromise) {
    appPromise = createApp().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  return app(req as never, res as never);
}
