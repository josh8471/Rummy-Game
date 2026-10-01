import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { VIRTUAL_NOTICE } from '@casino/shared';
import { createApp } from './app';
import { openDatabase } from './db/client';
import { DEMO_ACCOUNTS, seedBaseData, seedDemoData } from './db/seed';
import { env } from './env';

const database = await openDatabase({
  url: env.databaseUrl,
  dataDir: env.databaseUrl ? undefined : env.pgliteDir,
  migrationsFolder: env.migrationsFolder,
});
await seedBaseData(database.db);
if (env.seedDemoData && (await seedDemoData(database.db))) {
  console.log('Seeded demo data.');
}

const app = createApp({
  db: database.db,
  config: { cookieSecure: env.cookieSecure, appOrigins: env.appOrigins, trustProxy: env.trustProxy },
});

// In production the API also serves the built web app.
const serveWeb = env.isProduction && existsSync(`${env.webDist}/index.html`);
if (serveWeb) {
  const root = relative(process.cwd(), env.webDist);
  app.use('/assets/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  });
  app.use('*', serveStatic({ root }));
  app.get('*', serveStatic({ root, path: 'index.html' }));
}

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`\n  ${VIRTUAL_NOTICE}`);
  console.log(`  API ready on http://localhost:${info.port}  (database: ${database.kind})`);
  if (serveWeb) console.log(`  Web app:     http://localhost:${info.port}`);
  if (env.seedDemoData) {
    console.log(`  Demo player: ${DEMO_ACCOUNTS.player.username} / ${DEMO_ACCOUNTS.player.password}`);
    console.log(`  Demo admin:  ${DEMO_ACCOUNTS.admin.username} / ${DEMO_ACCOUNTS.admin.password}\n`);
  }
});

async function shutdown() {
  server.close();
  await database.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
