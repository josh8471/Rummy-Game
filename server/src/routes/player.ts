import { AVATARS, CURRENCY, transactionQuerySchema, type WalletResponse } from '@casino/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../context';
import { parseBody, parseQuery, requireAuth, requireUser } from '../middleware';
import { updateAvatar } from '../services/accounts';
import { getLeaderboard, getProfile } from '../services/players';
import { claimDailyReward, getRewards } from '../services/rewards';
import { getBalance, listTransactions } from '../services/wallet';

const avatarSchema = z.strictObject({ avatar: z.enum(AVATARS) });

export function playerRoutes() {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth);

  app.get('/wallet', async (c) => {
    const virtualBalance = await getBalance(c.var.db, requireUser(c).user.id);
    return c.json<WalletResponse>({ virtualBalance, currency: CURRENCY });
  });

  app.get('/wallet/transactions', async (c) => {
    const query = parseQuery(c, transactionQuerySchema);
    return c.json(await listTransactions(c.var.db, requireUser(c).user.id, query));
  });

  app.get('/profile', async (c) => {
    // Optional display filter for session stats; clamped to the last 24 hours.
    const since = Date.parse(c.req.query('since') ?? '');
    const floor = Date.now() - 24 * 60 * 60 * 1000;
    const sessionStart = Number.isFinite(since) ? new Date(Math.min(Date.now(), Math.max(floor, since))) : undefined;
    return c.json(await getProfile(c.var.db, requireUser(c), sessionStart));
  });

  app.put('/profile', async (c) => {
    const { avatar } = await parseBody(c, avatarSchema, { watchTampering: true });
    await updateAvatar(c.var.db, requireUser(c).user.id, avatar);
    return c.json({ avatar });
  });

  app.get('/rewards', async (c) => c.json(await getRewards(c.var.db, requireUser(c).user.id)));

  app.post('/rewards/daily/claim', async (c) => {
    await parseBody(c, z.strictObject({}), { watchTampering: true });
    return c.json(await claimDailyReward(c.var.db, requireUser(c).user.id));
  });

  app.get('/leaderboard', async (c) => c.json(await getLeaderboard(c.var.db, requireUser(c).user.id)));

  return app;
}
