import { STARTING_BALANCE, type GameResult, type RoundView } from '@casino/shared';
import { asc, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminAuditLogs, gameRounds, securityEvents, walletTransactions, wallets } from '../src/db/schema';
import { createTestContext, signUp, TestClient, type TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

async function ledger(userId: string) {
  return ctx.database.db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(asc(walletTransactions.id));
}

async function walletBalance(userId: string) {
  const [w] = await ctx.database.db.select().from(wallets).where(eq(wallets.userId, userId));
  return w!.virtualBalance;
}

/** PRD §43: balance before + transaction = balance after, for every row, forming one unbroken chain. */
async function expectConsistentLedger(userId: string) {
  const rows = await ledger(userId);
  let previous = 0;
  for (const row of rows) {
    expect(row.balanceBefore + row.amount).toBe(row.balanceAfter);
    expect(row.balanceBefore).toBe(previous);
    expect(row.balanceAfter).toBeGreaterThanOrEqual(0);
    expect(row.currency).toBe('INR_VIRTUAL');
    previous = row.balanceAfter;
  }
  expect(await walletBalance(userId)).toBe(previous);
  return rows;
}

async function setProfile(admin: TestClient, playerId: string, chances: [number, number, number, number]) {
  const [winChance, smallWinChance, bigWinChance, lossChance] = chances;
  const res = await admin.put(`/api/admin/players/${playerId}/probability`, {
    winChance,
    smallWinChance,
    bigWinChance,
    lossChance,
    reason: 'test setup',
  });
  expect(res.status).toBe(200);
}

describe('accounts', () => {
  it('registers with a recorded welcome bonus and INR_VIRTUAL wallet', async () => {
    const client = new TestClient(ctx.app);
    const res = await client.post('/api/auth/register', { username: 'new_player', email: 'new@example.test', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('new_player');
    const wallet = await client.get('/api/wallet');
    expect(wallet.body).toEqual({ virtualBalance: STARTING_BALANCE, currency: 'INR_VIRTUAL' });
    const rows = await expectConsistentLedger(res.body.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'BONUS', amount: STARTING_BALANCE });

    const duplicate = await new TestClient(ctx.app).post('/api/auth/register', { username: 'NEW_player', email: 'other@example.test', password: 'password123' });
    expect(duplicate.status).toBe(409);
  });

  it('rejects wrong passwords and requires auth', async () => {
    const { username } = await signUp(ctx);
    const client = new TestClient(ctx.app);
    expect((await client.post('/api/auth/login', { username, password: 'wrong-password' })).status).toBe(401);
    expect((await client.get('/api/wallet')).status).toBe(401);
    expect((await client.play('slots', { betAmount: 100 })).status).toBe(401);
  });

  it('logs out', async () => {
    const { client } = await signUp(ctx);
    expect((await client.post('/api/auth/logout')).status).toBe(200);
    expect((await client.get('/api/wallet')).status).toBe(401);
  });
});

describe('game rounds', () => {
  it('plays every instant game and keeps the ledger exact', async () => {
    const { client, user } = await signUp(ctx);
    const plays: [string, unknown][] = [
      ['slots', { betAmount: 500 }],
      ['roulette', { betAmount: 600, bets: [{ type: 'RED', amount: 500 }, { type: 'NUMBER', value: 17, amount: 100 }] }],
      ['dice', { betAmount: 300, bets: [{ type: 'UP', amount: 200 }, { type: 'SEVEN', amount: 100 }] }],
      ['andar-bahar', { betAmount: 250, side: 'BAHAR' }],
      ['teen-patti', { betAmount: 1000 }],
    ];
    for (let round = 0; round < 6; round++) {
      for (const [gameId, body] of plays) {
        const res = await client.play<GameResult>(gameId, body);
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        const r = res.body;
        expect(r.currency).toBe('INR_VIRTUAL');
        expect(r.result).toBe(r.outcome);
        expect(r.balanceAfter).toBe(r.balanceBefore - r.betAmount + r.payout);
        expect(r.virtualBalance).toBe(r.balanceAfter);
      }
    }
    const rows = await expectConsistentLedger(user.id);
    // Each round's ledger rows net to payout − bet.
    const rounds = await ctx.database.db.select().from(gameRounds).where(eq(gameRounds.userId, user.id));
    expect(rounds).toHaveLength(30);
    for (const round of rounds) {
      const net = rows.filter((t) => t.roundId === round.id).reduce((s, t) => s + t.amount, 0);
      expect(net).toBe(round.payout! - round.betAmount);
    }
  });

  it('returns the same round for a repeated Idempotency-Key', async () => {
    const { client, user } = await signUp(ctx);
    const first = await client.play('slots', { betAmount: 200 }, 'same-key-123');
    const second = await client.play('slots', { betAmount: 200 }, 'same-key-123');
    expect(second.body.roundId).toBe(first.body.roundId);
    const bets = (await ledger(user.id)).filter((t) => t.type === 'BET');
    expect(bets).toHaveLength(1);
    expect((await client.play('slots', { betAmount: 200 })).status).toBe(200);
    expect((await client.post('/api/games/slots/play', { betAmount: 200 })).body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('validates bets without touching the balance', async () => {
    const { client, user } = await signUp(ctx);
    const cases = [
      { betAmount: 105 },
      { betAmount: 0 },
      { betAmount: -500 },
      { betAmount: 50 },
      { betAmount: 30_000 },
      { betAmount: 'lots' },
    ];
    for (const body of cases) {
      const res = await client.play('slots', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const mismatch = await client.play('roulette', { betAmount: 999, bets: [{ type: 'RED', amount: 500 }] });
    expect(mismatch.status).toBe(400);
    expect(await walletBalance(user.id)).toBe(STARTING_BALANCE);
  });

  it('blocks disabled games', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const { client } = await signUp(ctx);
    expect((await admin.client.put('/api/admin/games/dice', { enabled: false, minBet: 100, maxBet: 25000, reason: 'maintenance' })).status).toBe(200);
    const res = await client.play('dice', { betAmount: 100, bets: [{ type: 'UP', amount: 100 }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('GAME_DISABLED');
    await admin.client.put('/api/admin/games/dice', { enabled: true, minBet: 100, maxBet: 25000, reason: 'back online' });
  });
});

describe('interactive games', () => {
  it('plays blackjack to settlement with a consistent ledger', async () => {
    const { client, user } = await signUp(ctx);
    for (let i = 0; i < 12; i++) {
      let res = await client.play<RoundView<any>>('blackjack', { betAmount: 500 });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      let round = res.body;
      while (round.status === 'IN_PROGRESS') {
        const actions: string[] = round.state.allowedActions;
        const action = actions.includes('DOUBLE') && i % 3 === 0 ? 'DOUBLE' : actions.includes('SPLIT') ? 'SPLIT' : round.state.hands[round.state.activeHand].total < 17 ? 'HIT' : 'STAND';
        res = await client.post(`/api/games/blackjack/rounds/${round.roundId}/action`, { action, seq: round.seq });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        round = res.body;
      }
      expect(round.outcome).not.toBeNull();
      expect(round.state.dealer.hasHiddenCard).toBe(false);
      const handBets = round.state.hands.reduce((s: number, h: { bet: number }) => s + h.bet, 0);
      expect(round.betAmount).toBe(handBets);
    }
    await expectConsistentLedger(user.id);
  });

  it('ignores a replayed blackjack action (double-click)', async () => {
    const { client, user } = await signUp(ctx);
    const start = (await client.play<RoundView<any>>('blackjack', { betAmount: 100 })).body;
    if (start.status === 'SETTLED') return; // dealt a natural
    const first = await client.post(`/api/games/blackjack/rounds/${start.roundId}/action`, { action: 'DOUBLE', seq: 0 });
    const replay = await client.post(`/api/games/blackjack/rounds/${start.roundId}/action`, { action: 'DOUBLE', seq: 0 });
    expect(first.status).toBe(200);
    expect(replay.status).toBe(409);
    const bets = (await ledger(user.id)).filter((t) => t.type === 'BET');
    expect(bets.map((b) => b.amount)).toEqual([-100, -100]);
  });

  it('allows one active hand per game and resumes it', async () => {
    const { client } = await signUp(ctx);
    const first = (await client.play<RoundView<any>>('poker', { betAmount: 100 })).body;
    const second = await client.play('poker', { betAmount: 100 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ROUND_IN_PROGRESS');
    const active = await client.get('/api/games/poker/active');
    expect(active.body.round.roundId).toBe(first.roundId);
    expect(active.body.round.state).not.toHaveProperty('deck');
    expect(active.body.round.state).not.toHaveProperty('target');

    const done = await client.post(`/api/games/poker/rounds/${first.roundId}/action`, {
      action: 'DRAW',
      holds: [true, false, true, false, false],
      seq: 0,
    });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('SETTLED');
    expect(done.body.state.cards[0]).toEqual(first.state.cards[0]);
    expect(done.body.state.cards[2]).toEqual(first.state.cards[2]);
    expect(done.body.payout).toBe(100 * done.body.state.multiplier);
    expect((await client.get('/api/games/poker/active')).body.round).toBeNull();
  });

  it("cannot act on another player's round", async () => {
    const a = await signUp(ctx);
    const b = await signUp(ctx);
    const round = (await a.client.play<RoundView>('poker', { betAmount: 100 })).body;
    const res = await b.client.post(`/api/games/poker/rounds/${round.roundId}/action`, { action: 'DRAW', holds: [false, false, false, false, false], seq: 0 });
    expect(res.status).toBe(404);
  });
});

describe('concurrency (PRD §43)', () => {
  it('simultaneous rounds cannot overspend or corrupt the wallet', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const { client, user } = await signUp(ctx);
    // Every round loses, and the balance only covers 3 bets of ₹1,000.
    await setProfile(admin.client, user.id, [0, 0, 0, 100]);
    await admin.client.post(`/api/admin/players/${user.id}/adjust-balance`, { amount: -(STARTING_BALANCE - 3000), reason: 'concurrency test' });

    const results = await Promise.all(Array.from({ length: 10 }, () => client.play('slots', { betAmount: 1000 })));
    const ok = results.filter((r) => r.status === 200);
    const rejected = results.filter((r) => r.status !== 200);
    expect(ok).toHaveLength(3);
    expect(rejected.every((r) => r.body.error.code === 'INSUFFICIENT_BALANCE')).toBe(true);
    expect(await walletBalance(user.id)).toBe(0);
    await expectConsistentLedger(user.id);
  });

  it('simultaneous duplicates of one request create exactly one round', async () => {
    const { client, user } = await signUp(ctx);
    const results = await Promise.all(Array.from({ length: 6 }, () => client.play('slots', { betAmount: 500 }, 'dup-key-777')));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.roundId)).size).toBe(1);
    const rounds = await ctx.database.db.select().from(gameRounds).where(eq(gameRounds.userId, user.id));
    expect(rounds).toHaveLength(1);
    await expectConsistentLedger(user.id);
  });

  it('many parallel rounds keep an unbroken ledger chain', async () => {
    const { client, user } = await signUp(ctx);
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => client.play('slots', { betAmount: 100 + (i % 5) * 100 })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    await expectConsistentLedger(user.id);
  });
});

describe('the server decides outcomes (PRD §17, §29)', () => {
  it('follows the assigned profile regardless of what the client sends', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const loser = await signUp(ctx);
    const winner = await signUp(ctx);
    await setProfile(admin.client, loser.user.id, [0, 0, 0, 100]);
    await setProfile(admin.client, winner.user.id, [60, 30, 10, 0]);
    for (let i = 0; i < 15; i++) {
      expect((await loser.client.play('slots', { betAmount: 100 })).body.outcome).toBe('LOSS');
      expect((await winner.client.play('slots', { betAmount: 100 })).body.outcome).not.toBe('LOSS');
    }
  });

  it('rejects attempts to set balance, payout, probability or result from the client', async () => {
    const { client, user } = await signUp(ctx);
    const tampered = [
      { betAmount: 500, payout: 1_000_000 },
      { betAmount: 500, balance: 9_999_999 },
      { betAmount: 500, outcome: 'BIG_WIN' },
      { betAmount: 500, result: 'WIN' },
      { betAmount: 500, winChance: 100, lossChance: 0 },
      { betAmount: 500, probability: { win: 100 } },
    ];
    for (const body of tampered) {
      const res = await client.play('slots', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await walletBalance(user.id)).toBe(STARTING_BALANCE);
    const events = await ctx.database.db.select().from(securityEvents).where(eq(securityEvents.userId, user.id));
    expect(events.filter((e) => e.type === 'TAMPER_ATTEMPT')).toHaveLength(tampered.length);

    // Also through in-round actions and rewards.
    const round = (await client.play<RoundView>('poker', { betAmount: 100 })).body;
    const act = await client.post(`/api/games/poker/rounds/${round.roundId}/action`, { action: 'DRAW', holds: [true, true, true, true, true], seq: 0, payout: 5000 });
    expect(act.status).toBe(400);
    expect((await client.post('/api/rewards/daily/claim', { amount: 1_000_000 })).status).toBe(400);
  });

  it('players cannot use admin endpoints', async () => {
    const { client, user } = await signUp(ctx);
    expect((await client.get('/api/admin/overview')).status).toBe(403);
    const res = await client.put(`/api/admin/players/${user.id}/probability`, { winChance: 100, smallWinChance: 0, bigWinChance: 0, lossChance: 0, reason: 'me' });
    expect(res.status).toBe(403);
    const adjust = await client.post(`/api/admin/players/${user.id}/adjust-balance`, { amount: 100000, reason: 'free money' });
    expect(adjust.status).toBe(403);
    expect(await walletBalance(user.id)).toBe(STARTING_BALANCE);
  });

  it('blocks cross-site and non-JSON writes (CSRF)', async () => {
    const { client } = await signUp(ctx);
    const evil = await client.post('/api/games/slots/play', { betAmount: 100 }, { 'idempotency-key': 'csrf-test-1', origin: 'https://evil.example' });
    expect(evil.status).toBe(403);
    const form = await client.request('POST', '/api/games/slots/play', 'betAmount=100', {
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': 'csrf-test-2',
    });
    expect(form.status).toBe(415);
    // The site's own pages behind an HTTPS proxy (server sees http, browser says https) are allowed.
    const own = await client.post('/api/games/slots/play', { betAmount: 100 }, { 'idempotency-key': 'csrf-test-3', origin: 'https://localhost' });
    expect(own.status).toBe(200);
  });
});

describe('admin', () => {
  it('rejects probability that does not total 100% and audits valid changes', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const { user } = await signUp(ctx);
    const bad = await admin.client.put(`/api/admin/players/${user.id}/probability`, {
      winChance: 45,
      smallWinChance: 25,
      bigWinChance: 5,
      lossChance: 30,
      reason: 'Simulation testing',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe('Probability must equal 100%.');

    const profiles = (await admin.client.get('/api/admin/profiles')).body as { id: number; name: string }[];
    const high = profiles.find((p) => p.name === 'High')!;
    const ok = await admin.client.put(`/api/admin/players/${user.id}/probability`, { profileId: high.id, reason: 'Simulation testing' });
    expect(ok.status).toBe(200);

    const logs = (await admin.client.get('/api/admin/audit-logs?limit=5')).body.items;
    const entry = logs.find((l: { targetUsername: string }) => l.targetUsername === user.username);
    expect(entry).toMatchObject({
      action: 'PROBABILITY_PROFILE_CHANGED',
      adminUsername: admin.username,
      reason: 'Simulation testing',
      oldValue: { profileName: 'Normal' },
      newValue: { profileName: 'High' },
    });
  });

  it('creates custom profiles and protects presets', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const created = await admin.client.post('/api/admin/profiles', {
      name: 'Test Profile',
      lossChance: 50,
      smallWinChance: 30,
      winChance: 15,
      bigWinChance: 5,
      reason: 'balancing',
    });
    expect(created.status).toBe(201);
    const profiles = (await admin.client.get('/api/admin/profiles')).body as { id: number; name: string; isSystem: boolean }[];
    const preset = profiles.find((p) => p.isSystem)!;
    const edit = await admin.client.put(`/api/admin/profiles/${preset.id}`, { name: preset.name, winChance: 100, smallWinChance: 0, bigWinChance: 0, lossChance: 0, reason: 'x'.repeat(5) });
    expect(edit.status).toBe(403);
  });

  it('audit logs and the ledger are append-only, even at the database level', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const { user } = await signUp(ctx);
    await setProfile(admin.client, user.id, [40, 20, 5, 35]);
    expect((await admin.client.request('DELETE', '/api/admin/audit-logs/1')).status).toBe(404);
    expect((await admin.client.put('/api/admin/audit-logs/1', { reason: 'edit' })).status).toBe(404);

    const db = ctx.database.db;
    await expect(db.update(adminAuditLogs).set({ reason: 'tampered' })).rejects.toThrow();
    await expect(db.delete(adminAuditLogs)).rejects.toThrow();
    await expect(db.update(walletTransactions).set({ amount: 1_000_000 })).rejects.toThrow();
    await expect(db.delete(walletTransactions)).rejects.toThrow();
    // Constraint: a ledger row whose math doesn't add up is refused.
    await expect(
      db.insert(walletTransactions).values({ userId: user.id, type: 'BONUS', amount: 100, balanceBefore: 0, balanceAfter: 1_000_000, description: 'bad' }),
    ).rejects.toThrow();
    await expect(db.execute(sql`update wallets set virtual_balance = -1 where user_id = ${user.id}`)).rejects.toThrow();
  });

  it('suspending a player ends their sessions', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const player = await signUp(ctx);
    expect((await admin.client.put(`/api/admin/players/${player.user.id}/status`, { status: 'suspended', reason: 'abuse test' })).status).toBe(200);
    expect((await player.client.get('/api/wallet')).status).toBe(401);
    const login = await new TestClient(ctx.app).post('/api/auth/login', { username: player.username, password: player.password });
    expect(login.status).toBe(403);
  });

  it('serves the overview and player detail', async () => {
    const admin = await signUp(ctx, { role: 'admin' });
    const overview = await admin.client.get('/api/admin/overview');
    expect(overview.status).toBe(200);
    expect(overview.body.metrics.gamesPlayed).toBeGreaterThan(0);
    expect(overview.body.roundsPerDay).toHaveLength(14);
    const players = await admin.client.get('/api/admin/players?search=player_');
    expect(players.body.items.length).toBeGreaterThan(0);
    const detail = await admin.client.get(`/api/admin/players/${players.body.items[0].id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.chances).toBeDefined();
  });
});

describe('rewards', () => {
  it('pays the daily reward once per IST day', async () => {
    const { client, user } = await signUp(ctx);
    const first = await client.post('/api/rewards/daily/claim');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ amount: 500, streak: 1, virtualBalance: STARTING_BALANCE + 500 });
    const second = await client.post('/api/rewards/daily/claim');
    expect(second.status).toBe(409);
    const rewards = await client.get('/api/rewards');
    expect(rewards.body.daily.claimedToday).toBe(true);
    await expectConsistentLedger(user.id);
  });
});

describe('rate limiting', () => {
  it('limits rapid play and records the abuse', async () => {
    const limited = await createTestContext({ rateLimits: { play: { limit: 3, windowMs: 60_000 } } as never });
    try {
      const { client, user } = await signUp(limited);
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await client.play('slots', { betAmount: 100 })).status);
      expect(statuses).toEqual([200, 200, 200, 429, 429]);
      const events = await limited.database.db.select().from(securityEvents).where(eq(securityEvents.userId, user.id));
      expect(events.filter((e) => e.type === 'RATE_LIMITED')).toHaveLength(1);
    } finally {
      await limited.close();
    }
  });
});
