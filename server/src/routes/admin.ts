import {
  balanceAdjustmentSchema,
  cursorQuerySchema,
  gameUpdateSchema,
  playerStatusSchema,
  profileUpsertSchema,
  setProbabilitySchema,
} from '@casino/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../context';
import { notFound } from '../lib/errors';
import { parseBody, parseQuery, requireAdmin, requireUser } from '../middleware';
import {
  adjustPlayerBalance,
  createProfile,
  getOverview,
  getPlayerDetail,
  listAdminGames,
  listAuditLogs,
  listPlayers,
  listProfiles,
  listSecurityEvents,
  setPlayerProbability,
  setPlayerStatus,
  updateGame,
  updateProfile,
} from '../services/admin';

const playerQuerySchema = cursorQuerySchema.extend({ search: z.string().max(100).optional() });

/*
 * Admin API. Every mutation writes an append-only audit record. There are
 * deliberately no endpoints to edit or delete audit logs, and the database
 * rejects such changes even if attempted directly.
 */
export function adminRoutes() {
  const app = new Hono<AppEnv>();
  app.use('*', requireAdmin);

  const adminId = (c: Parameters<typeof requireUser>[0]) => requireUser(c).user.id;
  const profileIdParam = (raw: string | undefined) => {
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id <= 0) throw notFound('Probability profile not found.');
    return id;
  };

  app.get('/overview', async (c) => c.json(await getOverview(c.var.db)));

  app.get('/players', async (c) => c.json(await listPlayers(c.var.db, parseQuery(c, playerQuerySchema))));
  app.get('/players/:id', async (c) => c.json(await getPlayerDetail(c.var.db, c.req.param('id'))));

  /** PRD §28: PUT /api/admin/players/:playerId/probability */
  app.put('/players/:id/probability', async (c) => {
    const body = await parseBody(c, setProbabilitySchema);
    return c.json(await setPlayerProbability(c.var.db, adminId(c), c.req.param('id'), body));
  });

  app.put('/players/:id/status', async (c) => {
    const body = await parseBody(c, playerStatusSchema);
    return c.json(await setPlayerStatus(c.var.db, adminId(c), c.req.param('id'), body));
  });

  app.post('/players/:id/adjust-balance', async (c) => {
    const body = await parseBody(c, balanceAdjustmentSchema);
    return c.json(await adjustPlayerBalance(c.var.db, adminId(c), c.req.param('id'), body));
  });

  app.get('/profiles', async (c) => c.json(await listProfiles(c.var.db)));

  app.post('/profiles', async (c) => {
    const body = await parseBody(c, profileUpsertSchema);
    return c.json(await createProfile(c.var.db, adminId(c), body), 201);
  });

  app.put('/profiles/:id', async (c) => {
    const body = await parseBody(c, profileUpsertSchema);
    return c.json(await updateProfile(c.var.db, adminId(c), profileIdParam(c.req.param('id')), body));
  });

  app.get('/games', async (c) => c.json(await listAdminGames(c.var.db)));

  app.put('/games/:id', async (c) => {
    const body = await parseBody(c, gameUpdateSchema);
    return c.json(await updateGame(c.var.db, adminId(c), c.req.param('id'), body));
  });

  app.get('/audit-logs', async (c) => c.json(await listAuditLogs(c.var.db, parseQuery(c, cursorQuerySchema))));

  app.get('/security-events', async (c) => c.json(await listSecurityEvents(c.var.db, 100)));

  return app;
}
