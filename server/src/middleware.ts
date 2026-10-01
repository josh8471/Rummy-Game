import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { z } from 'zod';
import { loadSession, SESSION_COOKIE } from './auth/session';
import type { AppConfig, AppEnv, RateLimitRule } from './context';
import type { DB } from './db/client';
import { AppError, badRequest, forbidden, unauthorized } from './lib/errors';
import { recordSecurityEvent } from './services/security';

export function contextMiddleware(db: DB, config: AppConfig): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('db', db);
    c.set('config', config);
    c.set('auth', null);
    c.set('ip', clientIp(c, config.trustProxy));
    await next();
  };
}

function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF protection for cookie-authenticated JSON APIs:
 *  - state-changing requests must be application/json (forms can't send that
 *    cross-site without a CORS preflight, which this API never approves);
 *  - when the browser reports an Origin, it must be this site or an allowed app origin;
 *  - cookies are SameSite=Lax as a further layer.
 */
export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (UNSAFE_METHODS.has(c.req.method)) {
    const contentType = c.req.header('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Requests must be sent as JSON.');
    }
    const origin = c.req.header('origin');
    if (origin && !isSameSite(c, origin) && !c.var.config.appOrigins.includes(origin)) {
      await recordSecurityEvent(c.var.db, { type: 'CSRF_BLOCKED', detail: `Origin ${origin} → ${c.req.path}`, ip: c.var.ip });
      throw forbidden('Cross-site request blocked.');
    }
    if (c.req.header('sec-fetch-site') === 'cross-site') throw forbidden('Cross-site request blocked.');
  }
  await next();
};

/**
 * Same-site check by host. Behind an HTTPS-terminating proxy the server sees
 * http:// while the browser reports https://, so comparing full origins would
 * wrongly block the site's own requests.
 */
function isSameSite(c: Context<AppEnv>, origin: string): boolean {
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const forwarded = c.var.config.trustProxy ? c.req.header('x-forwarded-host')?.split(',')[0]?.trim() : undefined;
  const host = forwarded || c.req.header('host') || new URL(c.req.url).host;
  return originHost.toLowerCase() === host.toLowerCase();
}

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token && token.length < 200) c.set('auth', await loadSession(c.var.db, token));
  await next();
};

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.var.auth;
  if (!auth) throw unauthorized();
  if (auth.user.status !== 'active') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended.');
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.var.auth;
  if (!auth) throw unauthorized();
  if (auth.user.role !== 'admin' || auth.user.status !== 'active') {
    await recordSecurityEvent(c.var.db, {
      type: 'ADMIN_ACCESS_DENIED',
      detail: `${c.req.method} ${c.req.path}`,
      userId: auth.user.id,
      ip: c.var.ip,
    });
    throw forbidden('Administrator access required.');
  }
  await next();
};

/** Fixed-window, in-memory limiter. Per process — use a shared store if you run several instances. */
export class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number; reported: boolean }>();
  constructor(readonly rule: RateLimitRule) {}

  hit(key: string, now = Date.now()) {
    if (this.windows.size > 10_000) {
      for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
    }
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.rule.windowMs, reported: false };
      this.windows.set(key, window);
    }
    window.count++;
    const firstViolation = window.count > this.rule.limit && !window.reported;
    if (firstViolation) window.reported = true;
    return {
      allowed: window.count <= this.rule.limit,
      firstViolation,
      retryAfterSec: Math.ceil((window.resetAt - now) / 1000),
    };
  }
}

export function rateLimit(name: string, rule: RateLimitRule, keyOf: (c: Context<AppEnv>) => string): MiddlewareHandler<AppEnv> {
  const limiter = new RateLimiter(rule);
  return async (c, next) => {
    const key = keyOf(c);
    const result = limiter.hit(key);
    if (!result.allowed) {
      if (result.firstViolation) {
        // Abuse detection: record the first violation in each window.
        await recordSecurityEvent(c.var.db, {
          type: 'RATE_LIMITED',
          detail: `${name}: more than ${rule.limit} requests in ${rule.windowMs / 1000}s (${c.req.method} ${c.req.path})`,
          userId: c.var.auth?.user.id,
          ip: c.var.ip,
        });
      }
      c.header('Retry-After', String(result.retryAfterSec));
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.');
    }
    await next();
  };
}

export const byUserOrIp = (c: Context<AppEnv>) => c.var.auth?.user.id ?? `ip:${c.var.ip}`;
export const byIp = (c: Context<AppEnv>) => `ip:${c.var.ip}`;

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest('INVALID_JSON', 'Request body must be valid JSON.');
  }
}

/** Fields a client might try to inject to influence money or outcomes. */
const TAMPER_FIELDS = new Set([
  'balance',
  'virtualBalance',
  'balanceBefore',
  'balanceAfter',
  'payout',
  'outcome',
  'result',
  'targetOutcome',
  'randomValue',
  'probability',
  'winChance',
  'smallWinChance',
  'bigWinChance',
  'lossChance',
  'profileId',
  'xp',
  'level',
  'reward',
  'multiplier',
  'role',
]);

/**
 * Validates a JSON body against a strict schema. Unknown fields are rejected;
 * when `watchTampering` is on, attempts to send money/outcome fields are logged.
 */
export async function parseBody<S extends z.ZodType>(
  c: Context<AppEnv>,
  schema: S,
  options: { watchTampering?: boolean } = {},
): Promise<z.infer<S>> {
  const body = await readJson(c);
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;

  const unknownKeys = parsed.error.issues.flatMap((issue) => (issue.code === 'unrecognized_keys' ? issue.keys : []));
  const tampered = unknownKeys.filter((k) => TAMPER_FIELDS.has(k));
  if (options.watchTampering && tampered.length > 0) {
    await recordSecurityEvent(c.var.db, {
      type: 'TAMPER_ATTEMPT',
      detail: `Client sent server-controlled field(s) ${tampered.join(', ')} to ${c.req.method} ${c.req.path}`,
      userId: c.var.auth?.user.id,
      ip: c.var.ip,
    });
  }
  const first = parsed.error.issues[0]!;
  throw badRequest(
    'VALIDATION_ERROR',
    first.code === 'unrecognized_keys' ? `Field(s) not allowed: ${first.keys.join(', ')}` : first.message,
    parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

export function parseQuery<S extends z.ZodType>(c: Context, schema: S): z.infer<S> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) throw badRequest('VALIDATION_ERROR', parsed.error.issues[0]!.message);
  return parsed.data;
}

export function requireUser(c: Context<AppEnv>) {
  const auth = c.var.auth;
  if (!auth) throw unauthorized();
  return auth;
}
