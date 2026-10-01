import type { UserRole, UserStatus } from '@casino/shared';
import type { DB } from './db/client';
import type { Rng } from './lib/rng';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  role: UserRole;
  status: UserStatus;
  xp: number;
  createdAt: Date;
}

export interface AuthInfo {
  user: AuthUser;
  sessionId: string;
  sessionCreatedAt: Date;
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface AppConfig {
  cookieSecure: boolean;
  /** Browser origins (besides the API's own) allowed to make state-changing requests. */
  appOrigins: string[];
  trustProxy: boolean;
  rateLimits: { auth: RateLimitRule; play: RateLimitRule; api: RateLimitRule };
  rng: Rng;
}

export type AppEnv = {
  Variables: {
    db: DB;
    config: AppConfig;
    auth: AuthInfo | null;
    ip: string;
    requestId: string;
  };
};
