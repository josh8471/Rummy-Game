import { rmSync } from 'node:fs';
import { env } from '../env';

// Deletes the embedded (PGlite) database. It is recreated and re-seeded on next start.
if (env.databaseUrl) {
  console.error('DATABASE_URL is set — refusing to touch an external database. Reset it with your provider instead.');
  process.exit(1);
}
rmSync(env.pgliteDir, { recursive: true, force: true });
console.log(`Removed ${env.pgliteDir}. Start the server to create a fresh database.`);
