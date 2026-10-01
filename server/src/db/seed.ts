import {
  BET_CHIPS,
  GAME_IDS,
  GAMES,
  PRESET_PROFILES,
  type DiceBet,
  type GameId,
  type RouletteBet,
} from '@casino/shared';
import { count, eq } from 'drizzle-orm';
import { cryptoRng, pick, type Rng } from '../lib/rng';
import { registerUser } from '../services/accounts';
import { setPlayerProbability } from '../services/admin';
import { chancesToColumns } from '../services/probability';
import { playRound } from '../services/rounds';
import type { DB } from './client';
import { games, probabilityProfiles, users } from './schema';

/** Games and preset profiles. Safe to run on every start. */
export async function seedBaseData(db: DB): Promise<void> {
  await db
    .insert(games)
    .values(
      GAME_IDS.map((id, i) => ({
        id,
        name: GAMES[id].name,
        type: GAMES[id].kind,
        minBet: GAMES[id].defaultMinBet,
        maxBet: GAMES[id].defaultMaxBet,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(probabilityProfiles)
    .values(PRESET_PROFILES.map((p) => ({ name: p.name, description: p.description, ...chancesToColumns(p), isSystem: true })))
    .onConflictDoNothing();
}

export const DEMO_ACCOUNTS = {
  admin: { username: 'admin_001', password: 'admin1234' },
  player: { username: 'demo_player_001', password: 'demo1234' },
} as const;

const BOTS: { username: string; avatar: string; profile: string }[] = [
  { username: 'lotus_ace', avatar: '🪷', profile: 'High' },
  { username: 'monsoon_max', avatar: '🌙', profile: 'Normal' },
  { username: 'chai_champ', avatar: '⭐', profile: 'Low' },
  { username: 'rani_royale', avatar: '👑', profile: 'Normal' },
  { username: 'spice_spinner', avatar: '🎲', profile: 'Very Low' },
  { username: 'tiger_tilak', avatar: '🐯', profile: 'Normal' },
  { username: 'mango_maverick', avatar: '🐘', profile: 'Low' },
];

const INSTANT_GAMES: GameId[] = ['slots', 'roulette', 'dice', 'andar-bahar', 'teen-patti'];

function randomBet(gameId: GameId, rng: Rng): { betAmount: number } & Record<string, unknown> {
  const chip = () => pick(BET_CHIPS.slice(0, 4), rng);
  switch (gameId) {
    case 'roulette': {
      const options: RouletteBet[] = [
        { type: 'RED', amount: chip() },
        { type: 'BLACK', amount: chip() },
        { type: 'ODD', amount: chip() },
        { type: 'DOZEN', value: 1 + rng.int(3), amount: chip() },
        { type: 'NUMBER', value: rng.int(37), amount: 100 },
      ];
      const bets = [pick(options, rng)];
      if (rng.int(3) === 0) bets.push({ type: 'NUMBER', value: rng.int(37), amount: 100 });
      return { betAmount: bets.reduce((s, b) => s + b.amount, 0), bets };
    }
    case 'dice': {
      const bets: DiceBet[] = [{ type: pick(['DOWN', 'UP', 'SEVEN'] as const, rng), amount: chip() }];
      return { betAmount: bets[0]!.amount, bets };
    }
    case 'andar-bahar':
      return { betAmount: chip(), side: pick(['ANDAR', 'BAHAR'] as const, rng) };
    default:
      return { betAmount: chip() };
  }
}

/**
 * Demo accounts plus a couple of weeks of simulated play, so the admin
 * dashboard has something to show. Runs only on an empty database.
 */
export async function seedDemoData(db: DB, rng: Rng = cryptoRng, now = new Date()): Promise<boolean> {
  const [existing] = await db.select({ n: count() }).from(users);
  if (existing!.n > 0) return false;

  const DAY = 24 * 60 * 60 * 1000;
  const start = new Date(now.getTime() - 14 * DAY);

  const admin = await registerUser(db, {
    username: DEMO_ACCOUNTS.admin.username,
    email: 'admin_001@example.test',
    password: DEMO_ACCOUNTS.admin.password,
    role: 'admin',
    avatar: '👑',
    at: start,
  });
  await registerUser(db, {
    username: DEMO_ACCOUNTS.player.username,
    email: 'demo_player_001@example.test',
    password: DEMO_ACCOUNTS.player.password,
    avatar: '🦚',
    at: start,
  });

  const profiles = await db.select({ id: probabilityProfiles.id, name: probabilityProfiles.name }).from(probabilityProfiles);
  const bots = [];
  for (const bot of BOTS) {
    const user = await registerUser(db, {
      username: bot.username,
      email: `${bot.username}@example.test`,
      password: DEMO_ACCOUNTS.player.password,
      avatar: bot.avatar,
      at: start,
    });
    const profileId = profiles.find((p) => p.name === bot.profile)!.id;
    if (bot.profile !== 'Normal') {
      await setPlayerProbability(db, admin.id, user.id, { profileId, reason: 'Demo data: initial simulation profile' });
    }
    bots.push(user);
  }

  // Build a chronological schedule of rounds across the last 14 days.
  const schedule: { at: Date; userId: string; gameId: GameId }[] = [];
  for (const bot of bots) {
    for (let day = 13; day >= 0; day--) {
      const rounds = rng.int(7);
      for (let i = 0; i < rounds; i++) {
        const at = new Date(now.getTime() - day * DAY - rng.int(20 * 60 * 60 * 1000));
        if (at < start || at > now) continue;
        schedule.push({ at, userId: bot.id, gameId: pick(INSTANT_GAMES, rng) });
      }
    }
  }
  schedule.sort((a, b) => a.at.getTime() - b.at.getTime());

  let key = 0;
  for (const item of schedule) {
    try {
      await playRound(db, {
        userId: item.userId,
        gameId: item.gameId,
        bet: randomBet(item.gameId, rng),
        idempotencyKey: `seed-round-${++key}`,
        rng,
        now: item.at,
      });
    } catch {
      // A bot ran low on virtual balance; skip the round.
    }
  }

  await db.update(users).set({ updatedAt: now }).where(eq(users.id, admin.id));
  return true;
}
