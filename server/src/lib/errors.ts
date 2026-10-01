import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Please sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have access to this.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);

export const insufficientBalance = () =>
  new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough virtual balance for this bet.');

/** Postgres SQLSTATE from a driver error, whether or not Drizzle wrapped it. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const PG_UNIQUE_VIOLATION = '23505';
