import type { Card } from './cards';
import type { Currency, Outcome, TransactionType, UserRole, UserStatus } from './constants';
import type {
  AndarBaharSide,
  BlackjackAction,
  DiceBetType,
  GameId,
  GameKind,
  PokerHand,
  RouletteBetSpot,
  RouletteColor,
  SlotSymbol,
  TeenPattiHand,
} from './games';
import type { Chances } from './probability';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/* ─────────────── Auth & profile ─────────────── */

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  xp: number;
  level: number;
  createdAt: string;
}

export interface MeResponse {
  user: SessionUser;
  /** When this login session began — used for the responsible-play session timer. */
  sessionStartedAt: string;
}

export interface SessionStats {
  startedAt: string;
  rounds: number;
  virtualWon: number;
  virtualLost: number;
}

export interface ProfileResponse {
  user: SessionUser;
  levelProgress: { currentLevelXp: number; nextLevelXp: number };
  stats: {
    rounds: number;
    totalBet: number;
    totalPayout: number;
    biggestWin: number;
    favoriteGame: GameId | null;
    outcomes: Record<Outcome, number>;
  };
  /** Shown to the player for transparency: the simulation profile applied to their rounds. */
  simulation: { profileName: string; chances: Chances };
  session: SessionStats;
}

/* ─────────────── Wallet ─────────────── */

export interface WalletResponse {
  virtualBalance: number;
  currency: Currency;
}

export interface TransactionItem {
  id: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: Currency;
  description: string;
  roundId: string | null;
  gameId: GameId | null;
  createdAt: string;
}

/* ─────────────── Games ─────────────── */

export interface GameConfig {
  id: GameId;
  name: string;
  kind: GameKind;
  enabled: boolean;
  minBet: number;
  maxBet: number;
}

export interface SlotsDetail {
  /** grid[reel][row], 3 reels × 3 rows. Row 1 is the payline. */
  grid: SlotSymbol[][];
  payline: SlotSymbol[];
  win: { kind: 'THREE' | 'PAIR'; symbol: SlotSymbol; multiplier: number } | null;
}

export interface RouletteBetResult extends RouletteBetSpot {
  amount: number;
  won: boolean;
  payout: number;
}

export interface RouletteDetail {
  number: number;
  color: RouletteColor;
  bets: RouletteBetResult[];
}

export interface DiceBetResult {
  type: DiceBetType;
  amount: number;
  won: boolean;
  payout: number;
}

export interface DiceDetail {
  dice: [number, number];
  total: number;
  bets: DiceBetResult[];
}

export interface AndarBaharDetail {
  joker: Card;
  andar: Card[];
  bahar: Card[];
  side: AndarBaharSide;
  winner: AndarBaharSide;
  cardsDealt: number;
  multiplier: number;
}

export interface TeenPattiHandInfo {
  cards: Card[];
  hand: TeenPattiHand;
  label: string;
}

export interface TeenPattiDetail {
  player: TeenPattiHandInfo;
  dealer: TeenPattiHandInfo;
  winner: 'PLAYER' | 'DEALER' | 'TIE';
  multiplier: number;
}

/** PRD §41 — the result of a settled round. `result` mirrors `outcome` for the §28 API contract. */
export interface GameResult<D = unknown> {
  roundId: string;
  gameId: GameId;
  betAmount: number;
  outcome: Outcome;
  result: Outcome;
  payout: number;
  balanceBefore: number;
  balanceAfter: number;
  virtualBalance: number;
  currency: Currency;
  createdAt: string;
  detail: D;
}

export type BlackjackHandStatus = 'PLAYING' | 'STOOD' | 'BUST' | 'BLACKJACK';
export type BlackjackHandResult = 'BLACKJACK' | 'WIN' | 'PUSH' | 'LOSS';

export interface BlackjackHandView {
  cards: Card[];
  total: number;
  soft: boolean;
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  status: BlackjackHandStatus;
  result: BlackjackHandResult | null;
  payout: number | null;
}

export interface BlackjackState {
  dealer: { cards: Card[]; total: number; hasHiddenCard: boolean };
  hands: BlackjackHandView[];
  activeHand: number | null;
  allowedActions: BlackjackAction[];
}

export interface PokerState {
  cards: Card[];
  held: boolean[];
  phase: 'HOLD' | 'DONE';
  /** Hand currently in view: the initial deal during HOLD, the final hand when DONE. */
  hand: PokerHand;
  handLabel: string;
  multiplier: number;
}

export type RoundStatus = 'IN_PROGRESS' | 'SETTLED';

export interface RoundView<S = unknown> {
  roundId: string;
  gameId: GameId;
  status: RoundStatus;
  /** Number of actions taken so far; the client echoes it to prevent duplicate actions. */
  seq: number;
  betAmount: number;
  state: S;
  outcome: Outcome | null;
  payout: number | null;
  virtualBalance: number;
  currency: Currency;
  createdAt: string;
  settledAt: string | null;
}

export interface HistoryItem {
  roundId: string;
  gameId: GameId;
  gameName: string;
  betAmount: number;
  payout: number | null;
  outcome: Outcome | null;
  status: RoundStatus;
  summary: string;
  createdAt: string;
}

/* ─────────────── Rewards & social ─────────────── */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

export interface RewardsResponse {
  daily: {
    claimedToday: boolean;
    /** Streak including today if claimed. */
    streak: number;
    nextAmount: number;
    nextStreakDay: number;
    ladder: number[];
    todayDate: string;
  };
  achievements: Achievement[];
}

export interface DailyClaimResponse {
  amount: number;
  streak: number;
  virtualBalance: number;
  currency: Currency;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatar: string;
  level: number;
  virtualBalance: number;
  isYou: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  you: LeaderboardEntry | null;
}

/* ─────────────── Admin ─────────────── */

export interface OutcomeMixRow {
  outcome: Outcome;
  target: number;
  actual: number;
}

export interface SecurityEventItem {
  id: string;
  type: string;
  username: string | null;
  ip: string | null;
  detail: string;
  createdAt: string;
}

export interface AdminOverview {
  metrics: {
    totalPlayers: number;
    activePlayers: number;
    virtualCirculation: number;
    gamesPlayed: number;
    roundsToday: number;
  };
  roundsPerDay: { date: string; rounds: number }[];
  outcomeMix: OutcomeMixRow[];
  byGame: { gameId: GameId; rounds: number; wagered: number; paid: number }[];
  recentSecurityEvents: SecurityEventItem[];
}

export interface AdminPlayerRow {
  id: string;
  username: string;
  email: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  virtualBalance: number;
  level: number;
  xp: number;
  profileId: number;
  profileName: string;
  games: number;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface AdminRoundItem extends HistoryItem {
  targetOutcome: Outcome;
  randomValue: number;
  profileName: string;
}

export interface AdminPlayerDetail {
  player: AdminPlayerRow;
  chances: Chances;
  outcomeMix: OutcomeMixRow[];
  recentRounds: AdminRoundItem[];
  transactions: TransactionItem[];
}

export interface ProfileItem extends Chances {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
  assignedPlayers: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminGameConfig extends GameConfig {
  rounds: number;
}

export interface AuditLogItem {
  id: string;
  adminUsername: string;
  action: string;
  targetUsername: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  createdAt: string;
}
