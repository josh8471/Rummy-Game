import { CURRENCY, STARTING_BALANCE, TRANSACTION_FILTERS, type TransactionFilter, type TransactionItem, type TransactionType } from '@casino/shared';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Queryable, Tx } from '../db/client';
import { gameRounds, wallets, walletTransactions } from '../db/schema';
import { AppError, insufficientBalance } from '../lib/errors';

/*
 * The only way virtual balances change. Every change:
 *   - happens inside a database transaction that holds the wallet row lock,
 *   - writes a ledger row with balance_before / amount / balance_after,
 *   - is checked by database constraints (no negative balances, exact math).
 */

export interface LockedWallet {
  id: string;
  userId: string;
  balance: number;
}

/** SELECT … FOR UPDATE: concurrent requests for the same player queue here. */
export async function lockWallet(tx: Tx, userId: string): Promise<LockedWallet> {
  const [wallet] = await tx
    .select({ id: wallets.id, userId: wallets.userId, balance: wallets.virtualBalance })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .for('update');
  if (!wallet) throw new AppError(404, 'WALLET_NOT_FOUND', 'Virtual wallet not found.');
  return wallet;
}

export interface LedgerEntry {
  type: TransactionType;
  /** Signed: negative for bets, positive for wins/rewards. */
  amount: number;
  description: string;
  roundId?: number | null;
  at?: Date;
}

export async function postTransaction(tx: Tx, wallet: LockedWallet, entry: LedgerEntry) {
  if (!Number.isSafeInteger(entry.amount) || entry.amount === 0) {
    throw new AppError(500, 'BAD_LEDGER_AMOUNT', 'Invalid ledger amount.');
  }
  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + entry.amount;
  if (balanceAfter < 0) throw insufficientBalance();

  const at = entry.at ?? new Date();
  const [updated] = await tx
    .update(wallets)
    .set({ virtualBalance: sql`${wallets.virtualBalance} + ${entry.amount}`, updatedAt: at })
    .where(eq(wallets.id, wallet.id))
    .returning({ balance: wallets.virtualBalance });
  if (updated?.balance !== balanceAfter) {
    // Should be impossible while we hold the row lock; refuse rather than write a wrong ledger.
    throw new AppError(500, 'WALLET_CONFLICT', 'Wallet changed unexpectedly. No changes were made.');
  }

  const [row] = await tx
    .insert(walletTransactions)
    .values({
      userId: wallet.userId,
      roundId: entry.roundId ?? null,
      type: entry.type,
      amount: entry.amount,
      balanceBefore,
      balanceAfter,
      currency: CURRENCY,
      description: entry.description,
      createdAt: at,
    })
    .returning({ id: walletTransactions.id });

  wallet.balance = balanceAfter;
  return { id: row!.id, balanceBefore, balanceAfter };
}

/** New wallets start at zero; the starting balance arrives as a recorded bonus. */
export async function createWallet(tx: Tx, userId: string, at?: Date) {
  const [wallet] = await tx.insert(wallets).values({ userId, virtualBalance: 0, updatedAt: at }).returning({ id: wallets.id });
  const locked: LockedWallet = { id: wallet!.id, userId, balance: 0 };
  await postTransaction(tx, locked, { type: 'BONUS', amount: STARTING_BALANCE, description: 'Welcome bonus', at });
  return locked;
}

export async function getBalance(db: Queryable, userId: string): Promise<number> {
  const [wallet] = await db.select({ balance: wallets.virtualBalance }).from(wallets).where(eq(wallets.userId, userId));
  if (!wallet) throw new AppError(404, 'WALLET_NOT_FOUND', 'Virtual wallet not found.');
  return wallet.balance;
}

export async function listTransactions(
  db: Queryable,
  userId: string,
  options: { filter: TransactionFilter; cursor?: string; limit: number },
): Promise<{ items: TransactionItem[]; nextCursor: string | null }> {
  const types = TRANSACTION_FILTERS[options.filter];
  const rows = await db
    .select({
      id: walletTransactions.id,
      type: walletTransactions.type,
      amount: walletTransactions.amount,
      balanceBefore: walletTransactions.balanceBefore,
      balanceAfter: walletTransactions.balanceAfter,
      description: walletTransactions.description,
      roundId: walletTransactions.roundId,
      gameId: gameRounds.gameId,
      createdAt: walletTransactions.createdAt,
    })
    .from(walletTransactions)
    .leftJoin(gameRounds, eq(gameRounds.id, walletTransactions.roundId))
    .where(
      and(
        eq(walletTransactions.userId, userId),
        types ? inArray(walletTransactions.type, [...types]) : undefined,
        options.cursor ? lt(walletTransactions.id, Number(options.cursor)) : undefined,
      ),
    )
    .orderBy(desc(walletTransactions.id))
    .limit(options.limit + 1);

  const page = rows.slice(0, options.limit);
  return {
    items: page.map(toTransactionItem),
    nextCursor: rows.length > options.limit ? String(page[page.length - 1]!.id) : null,
  };
}

export function toTransactionItem(row: {
  id: number;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  roundId: number | null;
  gameId: string | null;
  createdAt: Date;
}): TransactionItem {
  return {
    id: String(row.id),
    type: row.type,
    amount: row.amount,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    currency: CURRENCY,
    description: row.description,
    roundId: row.roundId === null ? null : String(row.roundId),
    gameId: row.gameId as TransactionItem['gameId'],
    createdAt: row.createdAt.toISOString(),
  };
}
