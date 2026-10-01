import { fileURLToPath } from 'node:url';

const serverRoot = fileURLToPath(new URL('..', import.meta.url));

// Optional settings file at the repository root (see .env.example).
try {
  process.loadEnvFile(`${serverRoot}../.env`);
} catch {
  // No .env file — defaults apply.
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 8787),
  /** When set, use this Postgres (e.g. Neon). Otherwise an embedded PGlite database is used. */
  databaseUrl: process.env.DATABASE_URL || undefined,
  pgliteDir: process.env.PGLITE_DIR || `${serverRoot}.data/pglite`,
  /** Extra browser origins allowed to call the API (comma-separated). */
  appOrigins: (process.env.APP_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  cookieSecure: bool(process.env.COOKIE_SECURE, isProduction),
  /** Trust X-Forwarded-For (only behind a reverse proxy you control). */
  trustProxy: bool(process.env.TRUST_PROXY, false),
  seedDemoData: bool(process.env.SEED_DEMO_DATA, true),
  webDist: process.env.WEB_DIST || `${serverRoot}../apps/web/dist`,
  migrationsFolder: `${serverRoot}drizzle`,
};

export type Env = typeof env;
