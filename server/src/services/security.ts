import type { DB, Tx } from '../db/client';
import { adminAuditLogs, securityEvents } from '../db/schema';

/**
 * Records suspicious activity (rate-limit hits, tampered requests, repeated
 * login failures) for the admin dashboard. Never call this inside an open
 * transaction callback — use it from route/middleware level only.
 */
export async function recordSecurityEvent(
  db: DB,
  event: { type: string; detail: string; userId?: string | null; ip?: string | null },
): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      type: event.type,
      detail: event.detail.slice(0, 500),
      userId: event.userId ?? null,
      ip: event.ip ?? null,
    });
  } catch (error) {
    console.error('Failed to record security event', error);
  }
}

/** Append-only; the database rejects updates and deletes on this table. */
export async function writeAudit(
  tx: Tx,
  entry: { adminId: string; action: string; targetUserId?: string | null; oldValue?: unknown; newValue?: unknown; reason: string },
): Promise<void> {
  await tx.insert(adminAuditLogs).values({
    adminId: entry.adminId,
    action: entry.action,
    targetUserId: entry.targetUserId ?? null,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    reason: entry.reason,
  });
}
