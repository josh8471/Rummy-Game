import type { UserRole } from '@casino/shared';
import { eq, or, sql } from 'drizzle-orm';
import { hashPassword } from '../auth/password';
import type { AuthUser } from '../context';
import type { DB } from '../db/client';
import { userProbabilityProfiles, users } from '../db/schema';
import { conflict, pgErrorCode, PG_UNIQUE_VIOLATION } from '../lib/errors';
import { getDefaultProfile } from './probability';
import { createWallet } from './wallet';

export interface NewAccount {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  role?: UserRole;
  at?: Date;
}

const toAuthUser = (u: typeof users.$inferSelect): AuthUser => ({
  id: u.id,
  username: u.username,
  email: u.email,
  avatar: u.avatar,
  role: u.role,
  status: u.status,
  xp: u.xp,
  createdAt: u.createdAt,
});

/** Creates the user, their wallet (with the recorded welcome bonus) and default simulation profile. */
export async function registerUser(db: DB, input: NewAccount): Promise<AuthUser> {
  const passwordHash = await hashPassword(input.password);
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  try {
    return await db.transaction(async (tx) => {
      const [taken] = await tx
        .select({ username: users.username })
        .from(users)
        .where(or(sql`lower(${users.username}) = ${username.toLowerCase()}`, sql`lower(${users.email}) = ${email}`))
        .limit(1);
      if (taken) {
        throw taken.username.toLowerCase() === username.toLowerCase()
          ? conflict('USERNAME_TAKEN', 'That username is already taken.')
          : conflict('EMAIL_TAKEN', 'An account with this email already exists.');
      }
      const [user] = await tx
        .insert(users)
        .values({
          username,
          email,
          passwordHash,
          avatar: input.avatar ?? '🦚',
          role: input.role ?? 'player',
          createdAt: input.at,
          updatedAt: input.at,
        })
        .returning();
      await createWallet(tx, user!.id, input.at);
      const profile = await getDefaultProfile(tx);
      await tx.insert(userProbabilityProfiles).values({ userId: user!.id, profileId: profile.id });
      return toAuthUser(user!);
    });
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw conflict('ACCOUNT_EXISTS', 'That username or email is already registered.');
    }
    throw error;
  }
}

export async function findUserForLogin(db: DB, identifier: string) {
  const ident = identifier.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(or(sql`lower(${users.username}) = ${ident}`, sql`lower(${users.email}) = ${ident}`))
    .limit(1);
  return user ? { ...toAuthUser(user), passwordHash: user.passwordHash } : null;
}

export async function updateAvatar(db: DB, userId: string, avatar: string) {
  await db.update(users).set({ avatar, updatedAt: new Date() }).where(eq(users.id, userId));
}
