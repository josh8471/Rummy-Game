import { DEFAULT_PROFILE_NAME, type Chances } from '@casino/shared';
import { eq } from 'drizzle-orm';
import type { Queryable } from '../db/client';
import { probabilityProfiles, userProbabilityProfiles } from '../db/schema';
import { AppError } from '../lib/errors';

export interface AssignedProfile {
  id: number;
  name: string;
  chances: Chances;
}

type ProfileRow = typeof probabilityProfiles.$inferSelect;

export function chancesOf(row: ProfileRow): Chances {
  return {
    winChance: row.winProbability,
    smallWinChance: row.smallWinProbability,
    bigWinChance: row.bigWinProbability,
    lossChance: row.lossProbability,
  };
}

export function chancesToColumns(chances: Chances) {
  return {
    winProbability: chances.winChance,
    smallWinProbability: chances.smallWinChance,
    bigWinProbability: chances.bigWinChance,
    lossProbability: chances.lossChance,
  };
}

export async function getDefaultProfile(db: Queryable): Promise<ProfileRow> {
  const [row] = await db.select().from(probabilityProfiles).where(eq(probabilityProfiles.name, DEFAULT_PROFILE_NAME));
  if (!row) throw new AppError(500, 'NO_DEFAULT_PROFILE', 'Default probability profile is missing. Run the seed.');
  return row;
}

/** The simulation profile applied to a player's rounds (falls back to Normal). */
export async function getAssignedProfile(db: Queryable, userId: string): Promise<AssignedProfile> {
  const [row] = await db
    .select({ profile: probabilityProfiles })
    .from(userProbabilityProfiles)
    .innerJoin(probabilityProfiles, eq(probabilityProfiles.id, userProbabilityProfiles.profileId))
    .where(eq(userProbabilityProfiles.userId, userId));
  const profile = row?.profile ?? (await getDefaultProfile(db));
  return { id: profile.id, name: profile.name, chances: chancesOf(profile) };
}
