import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { AppConfig, AppEnv } from './context';
import type { DB } from './db/client';
import { AppError } from './lib/errors';
import { cryptoRng } from './lib/rng';
import { byUserOrIp, contextMiddleware, originGuard, rateLimit, sessionMiddleware } from './middleware';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { gameRoutes } from './routes/games';
import { playerRoutes } from './routes/player';

export const defaultConfig: AppConfig = {
  cookieSecure: false,
  appOrigins: [],
  trustProxy: false,
  rateLimits: {
    auth: { limit: 10, windowMs: 60_000 },
    play: { limit: 120, windowMs: 60_000 },
    api: { limit: 600, windowMs: 60_000 },
  },
  rng: cryptoRng,
};

export function createApp(options: { db: DB; config?: Partial<AppConfig> }) {
  const config: AppConfig = { ...defaultConfig, ...options.config };
  const app = new Hono<AppEnv>();

  app.use('*', requestId());
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use('*', compress());

  app.use(
    '/api/*',
    contextMiddleware(options.db, config),
    async (c, next) => {
      await next();
      c.header('Cache-Control', 'no-store');
    },
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (c) => c.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } }, 413),
    }),
    originGuard,
    sessionMiddleware,
    rateLimit('api', config.rateLimits.api, byUserOrIp),
  );

  app.get('/api/health', (c) => c.json({ ok: true, currency: 'INR_VIRTUAL' }));
  app.route('/api/auth', authRoutes(config));
  app.route('/api/games', gameRoutes(config));
  app.route('/api/admin', adminRoutes());
  app.route('/api', playerRoutes());
  app.all('/api/*', (c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404));

  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json({ error: { code: error.code, message: error.message, details: error.details } }, error.status);
    }
    console.error(`[${c.get('requestId') ?? '-'}]`, error);
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Your virtual balance was not changed.' } },
      500,
    );
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
