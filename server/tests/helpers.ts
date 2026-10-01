import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createApp, defaultConfig, type App } from '../src/app';
import type { AppConfig } from '../src/context';
import { openDatabase, type Database } from '../src/db/client';
import { seedBaseData } from '../src/db/seed';
import { registerUser } from '../src/services/accounts';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface TestContext {
  app: App;
  database: Database;
  close(): Promise<void>;
}

/**
 * A throwaway database on a real Postgres server (set TEST_DATABASE_URL, e.g.
 * postgresql:///postgres?host=/tmp). Real Postgres runs transactions truly in
 * parallel, which makes the concurrency tests meaningful for row locking.
 */
async function createPostgresDatabase(adminUrl: string): Promise<Database> {
  const name = `casino_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const run = async (statement: string) => {
    const client = new pg.Client({ connectionString: adminUrl });
    await client.connect();
    try {
      await client.query(statement);
    } finally {
      await client.end();
    }
  };
  await run(`create database ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const database = await openDatabase({ url: url.toString(), migrationsFolder });
  return {
    ...database,
    close: async () => {
      await database.close();
      await run(`drop database if exists ${name} with (force)`);
    },
  };
}

/** Fresh database (in-memory PGlite by default), migrated and seeded with games + preset profiles. */
export async function createTestContext(config: Partial<AppConfig> = {}): Promise<TestContext> {
  const database = process.env.TEST_DATABASE_URL
    ? await createPostgresDatabase(process.env.TEST_DATABASE_URL)
    : await openDatabase({ migrationsFolder });
  await seedBaseData(database.db);
  const app = createApp({
    db: database.db,
    config: {
      ...config,
      rateLimits: {
        ...defaultConfig.rateLimits,
        auth: { limit: 1000, windowMs: 60_000 },
        play: { limit: 1000, windowMs: 60_000 },
        api: { limit: 5000, windowMs: 60_000 },
        ...config.rateLimits,
      },
    },
  });
  return { app, database, close: () => database.close() };
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

/** Minimal cookie-carrying client that talks to the Hono app in-process. */
export class TestClient {
  cookie = '';
  constructor(private readonly app: App) {}

  async request<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    const res = await this.app.request(path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  get<T = any>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T = any>(path: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.request<T>('POST', path, body, headers);
  }
  put<T = any>(path: string, body: unknown = {}) {
    return this.request<T>('PUT', path, body);
  }

  private keyCounter = 0;
  /** POST /api/games/:id/play with a fresh idempotency key (or a given one). */
  play<T = any>(gameId: string, body: unknown, key = `k-${Date.now()}-${++this.keyCounter}-${Math.random().toString(36).slice(2)}`) {
    return this.post<T>(`/api/games/${gameId}/play`, body, { 'idempotency-key': key });
  }
}

let userCounter = 0;

export async function signUp(ctx: TestContext, overrides: { role?: 'player' | 'admin' } = {}) {
  const n = ++userCounter;
  const username = `${overrides.role === 'admin' ? 'admin' : 'player'}_${n}_${Math.random().toString(36).slice(2, 7)}`;
  const password = 'correct-horse-battery';
  const user = await registerUser(ctx.database.db, { username, email: `${username}@example.test`, password, role: overrides.role });
  const client = new TestClient(ctx.app);
  const res = await client.post('/api/auth/login', { username, password });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
  return { client, user, username, password };
}
