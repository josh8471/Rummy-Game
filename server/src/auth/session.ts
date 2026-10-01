import { createHash, randomBytes } from 'node:crypto';
import { SESSION_TTL_DAYS } from '@casino/shared';
import { and, eq, gt } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, AuthInfo } from '../context';
import type { DB } from '../db/client';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'sim_session';
const TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Avoid a database write on every request: refresh last_seen at most this often. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await c.var.db.insert(sessions).values({
    id: hashToken(token),
    userId,
    ip: c.var.ip,
    userAgent: c.req.header('user-agent')?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: c.var.config.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  });
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.var.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: c.var.config.cookieSecure });
}

export async function loadSession(db: DB, token: string): Promise<AuthInfo | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      sessionCreatedAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      username: users.username,
      email: users.email,
      avatar: users.avatar,
      role: users.role,
      status: users.status,
      xp: users.xp,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;

  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
  }

  const { sessionId, sessionCreatedAt, lastSeenAt: _lastSeen, ...user } = row;
  return { user, sessionId, sessionCreatedAt };
}
