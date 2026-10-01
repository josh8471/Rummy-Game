import { cursorQuerySchema, isGameId, playSchemas, type GameId } from '@casino/shared';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppConfig, AppEnv } from '../context';
import { badRequest, notFound } from '../lib/errors';
import { byUserOrIp, parseBody, parseQuery, rateLimit, requireAuth, requireUser } from '../middleware';
import { ENGINES } from '../games/registry';
import { actOnRound, getActiveRound, getRoundDetail, listGameConfigs, listHistory, playRound } from '../services/rounds';

const historyQuerySchema = cursorQuerySchema.extend({
  gameId: z.string().refine(isGameId, 'Unknown game').optional(),
});

function gameParam(c: Context): GameId {
  const gameId = c.req.param('gameId') ?? '';
  if (!isGameId(gameId)) throw notFound('Game not found.');
  return gameId;
}

function roundParam(c: Context): number {
  const roundId = Number(c.req.param('roundId'));
  if (!Number.isSafeInteger(roundId) || roundId <= 0) throw notFound('Round not found.');
  return roundId;
}

export function gameRoutes(config: AppConfig) {
  const app = new Hono<AppEnv>();
  const playLimit = rateLimit('play', config.rateLimits.play, byUserOrIp);
  app.use('*', requireAuth);

  app.get('/', async (c) => c.json(await listGameConfigs(c.var.db)));

  app.get('/history', async (c) => {
    const query = parseQuery(c, historyQuerySchema);
    return c.json(
      await listHistory(c.var.db, requireUser(c).user.id, {
        cursor: query.cursor,
        limit: query.limit,
        gameId: query.gameId as GameId | undefined,
      }),
    );
  });

  app.get('/rounds/:roundId', async (c) => c.json(await getRoundDetail(c.var.db, requireUser(c).user.id, roundParam(c))));

  /** PRD §28: POST /api/games/:gameId/play — requires an Idempotency-Key header. */
  app.post('/:gameId/play', playLimit, async (c) => {
    const gameId = gameParam(c);
    const idempotencyKey = c.req.header('idempotency-key') ?? '';
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) {
      throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'Missing or invalid Idempotency-Key header.');
    }
    const bet = await parseBody(c, playSchemas[gameId], { watchTampering: true });
    const response = await playRound(c.var.db, {
      userId: requireUser(c).user.id,
      gameId,
      bet: bet as { betAmount: number },
      idempotencyKey,
      rng: config.rng,
    });
    return c.json(response.kind === 'instant' ? response.result : response.round);
  });

  app.get('/:gameId/active', async (c) => {
    const round = await getActiveRound(c.var.db, requireUser(c).user.id, gameParam(c));
    return c.json({ round });
  });

  app.post('/:gameId/rounds/:roundId/action', playLimit, async (c) => {
    const gameId = gameParam(c);
    const entry = ENGINES[gameId];
    if (entry.kind !== 'interactive') throw notFound('This game has no in-round actions.');
    const action = await parseBody(c, entry.actionSchema, { watchTampering: true });
    return c.json(
      await actOnRound(c.var.db, {
        userId: requireUser(c).user.id,
        gameId,
        roundId: roundParam(c),
        action: action as { seq: number; action: string },
        rng: config.rng,
      }),
    );
  });

  return app;
}
