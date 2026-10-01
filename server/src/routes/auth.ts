import { loginSchema, registerSchema, type MeResponse } from '@casino/shared';
import { Hono } from 'hono';
import { verifyAgainstDummy, verifyPassword } from '../auth/password';
import { createSession, destroySession } from '../auth/session';
import type { AppConfig, AppEnv } from '../context';
import { AppError } from '../lib/errors';
import { byIp, parseBody, rateLimit, RateLimiter, requireAuth, requireUser } from '../middleware';
import { findUserForLogin, registerUser } from '../services/accounts';
import { toSessionUser } from '../services/players';
import { recordSecurityEvent } from '../services/security';

export function authRoutes(config: AppConfig) {
  const app = new Hono<AppEnv>();
  const limit = rateLimit('auth', config.rateLimits.auth, byIp);
  // Abuse detection: 5 failed logins from one IP within 15 minutes is flagged.
  const failedLogins = new RateLimiter({ limit: 4, windowMs: 15 * 60 * 1000 });

  app.post('/register', limit, async (c) => {
    const body = await parseBody(c, registerSchema);
    const user = await registerUser(c.var.db, body);
    await createSession(c, user.id);
    return c.json<MeResponse>({ user: toSessionUser(user), sessionStartedAt: new Date().toISOString() }, 201);
  });

  app.post('/login', limit, async (c) => {
    const body = await parseBody(c, loginSchema);
    const user = await findUserForLogin(c.var.db, body.username);
    const ok = user ? await verifyPassword(body.password, user.passwordHash) : await verifyAgainstDummy(body.password);
    if (!user || !ok) {
      if (failedLogins.hit(c.var.ip).firstViolation) {
        await recordSecurityEvent(c.var.db, {
          type: 'REPEATED_LOGIN_FAILURE',
          detail: `5+ failed sign-ins (last tried: ${body.username.slice(0, 60)})`,
          userId: user?.id,
          ip: c.var.ip,
        });
      }
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect username or password.');
    }
    if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended.');
    await createSession(c, user.id);
    const { passwordHash: _hash, ...safe } = user;
    return c.json<MeResponse>({ user: toSessionUser(safe), sessionStartedAt: new Date().toISOString() });
  });

  app.post('/logout', async (c) => {
    await destroySession(c);
    return c.json({ ok: true });
  });

  app.get('/me', requireAuth, (c) => {
    const auth = requireUser(c);
    return c.json<MeResponse>({ user: toSessionUser(auth.user), sessionStartedAt: auth.sessionCreatedAt.toISOString() });
  });

  return app;
}
