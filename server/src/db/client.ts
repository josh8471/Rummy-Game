import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema';

export type DB = ReturnType<typeof drizzlePglite<typeof schema>>;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
/** Anything that can run queries: the root handle or an open transaction. */
export type Queryable = DB | Tx;

export interface Database {
  db: DB;
  kind: 'pglite' | 'postgres';
  close(): Promise<void>;
}

export interface OpenDatabaseOptions {
  /** Postgres connection string. Omit to use embedded PGlite. */
  url?: string;
  /** PGlite data directory. Omit (with no url) for a throwaway in-memory database. */
  dataDir?: string;
  migrationsFolder: string;
}

export async function openDatabase(options: OpenDatabaseOptions): Promise<Database> {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url, max: 10 });
    // Both drivers expose the same Drizzle query API; the Postgres one is
    // typed as the PGlite variant so the rest of the code has a single DB type.
    const pgDb = drizzlePg(pool, { schema });
    await migratePg(pgDb, { migrationsFolder: options.migrationsFolder });
    return { db: pgDb as unknown as DB, kind: 'postgres', close: () => pool.end() };
  }

  if (options.dataDir) mkdirSync(options.dataDir, { recursive: true });
  const client = options.dataDir ? new PGlite(options.dataDir) : new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: options.migrationsFolder });
  return { db, kind: 'pglite', close: () => client.close() };
}
