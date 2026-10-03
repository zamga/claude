/**
 * API error envelope (spec page 49): error(code, message, field_errors, retryable, request_id).
 * Messages are plain-language and safe to show; request ids belong in diagnostics.
 */
export type ErrorCode =
  | 'offline'
  | 'timeout'
  | 'malformed'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'version_conflict'
  | 'idempotency_conflict'
  | 'validation'
  | 'duplicate'
  | 'throttled'
  | 'unavailable'
  | 'not_configured'
  | 'reauthentication_required'
  | 'unverified';

export const STATUS_FOR: Record<ErrorCode, number> = {
  offline: 0,
  timeout: 0,
  malformed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  version_conflict: 409,
  idempotency_conflict: 409,
  validation: 422,
  duplicate: 409,
  throttled: 429,
  unavailable: 503,
  not_configured: 503,
  reauthentication_required: 401,
  unverified: 403,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: Record<string, string>;
  readonly retryable: boolean;
  requestId: string;
  readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      fieldErrors?: Record<string, string>;
      retryable?: boolean;
      requestId?: string;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_FOR[code];
    this.fieldErrors = options.fieldErrors ?? {};
    this.retryable =
      options.retryable ??
      (code === 'offline' || code === 'timeout' || code === 'unavailable' || code === 'throttled');
    this.requestId = options.requestId ?? '';
    this.details = options.details ?? {};
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isOfflineError(error: unknown): boolean {
  return isApiError(error) && (error.code === 'offline' || error.code === 'timeout');
}

/** Short, human sentence for an unknown failure (never a stack trace). */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (isApiError(error)) return error.message;
  return fallback;
}
