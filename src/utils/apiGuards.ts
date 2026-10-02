/**
 * Pure request-hardening helpers for the Express API.
 *
 * Kept free of Express / process state so they can be unit tested directly:
 *  - field and serialised-payload size caps (bound prompt + token cost),
 *  - enum whitelists (a client can never inject arbitrary prompt text through a
 *    "tone" or "reply length" field),
 *  - a fixed-window in-memory rate limiter with an injectable clock,
 *  - constant-time shared-token comparison.
 */

import { timingSafeEqual } from 'node:crypto';

/** Per-field character ceilings. Anything larger is rejected with HTTP 400. */
export const FIELD_LIMITS = {
  leadMessage: 4000,
  currentText: 8000,
  // Workspace routes. customerName is a display label, so a modest ceiling is
  // enough; the draft body reuses the larger currentText-style ceiling.
  customerName: 200,
  draft: 8000,
  instruction: 500,
  purpose: 500,
  customInstructions: 2000,
  templateBody: 6000,
  senderName: 200,
  postcodeOrArea: 200,
  tradeCategory: 100,
  platform: 50,
  token: 512,
} as const;

export type LimitedField = keyof typeof FIELD_LIMITS;

/** Optional structured objects (business profile, prior analysis, template). */
export const SERIALISED_LIMITS = {
  businessProfile: 6000,
  leadAnalysis: 6000,
} as const;

/**
 * Reject a string field that is missing, not a string, or over its ceiling.
 * Returns null when the value is acceptable.
 */
export function textFieldError(
  value: unknown,
  field: LimitedField,
  options: { required?: boolean } = {},
): string | null {
  const { required = false } = options;

  if (value === undefined || value === null || value === '') {
    return required ? `${field} is required` : null;
  }
  if (typeof value !== 'string') {
    return `${field} must be a string`;
  }
  if (value.length > FIELD_LIMITS[field]) {
    return `${field} exceeds the ${FIELD_LIMITS[field]} character limit`;
  }
  return null;
}

/**
 * Reject a structured field whose serialised form is too large (or that cannot
 * be serialised at all, e.g. a cyclic object).
 */
export function serialisedFieldError(
  value: unknown,
  field: keyof typeof SERIALISED_LIMITS,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object') return `${field} must be an object`;

  let serialised: string;
  try {
    serialised = JSON.stringify(value);
  } catch {
    return `${field} could not be serialised`;
  }
  if (serialised.length > SERIALISED_LIMITS[field]) {
    return `${field} exceeds the ${SERIALISED_LIMITS[field]} character limit`;
  }
  return null;
}

/** First failure from a list of checks, or null when every check passes. */
export function firstError(...checks: Array<string | null>): string | null {
  return checks.find((check) => check !== null) ?? null;
}

/** Accept only listed values; anything else falls back to the default. */
export function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Clamp an optional numeric field into range, falling back when unusable. */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds the caller should wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
  /** Calls remaining in the current window (after this one when allowed). */
  remaining: number;
}

export interface RateLimiter {
  /** Record a hit for `key` and return the decision. */
  check(key: string): RateLimitDecision;
  /** Keys currently tracked — exposed for tests and diagnostics. */
  size(): number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiter held in process memory.
 *
 * Deliberately dependency-free and per-instance: it bounds abuse and accidental
 * runaway cost for a single server process. A multi-instance deployment needs a
 * shared store (Redis) instead — see README, "API hardening".
 */
export function createRateLimiter(options: {
  maxPerWindow: number;
  windowMs?: number;
  now?: () => number;
  /** Hard cap on tracked keys to keep memory bounded (default 5000). */
  maxKeys?: number;
}): RateLimiter {
  const { maxPerWindow, windowMs = 60_000, now = () => Date.now(), maxKeys = 5000 } = options;
  const buckets = new Map<string, Bucket>();

  function prune(nowMs: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= nowMs) buckets.delete(key);
    }
  }

  return {
    check(key: string): RateLimitDecision {
      const nowMs = now();
      const existing = buckets.get(key);

      if (!existing || existing.resetAt <= nowMs) {
        if (buckets.size >= maxKeys) prune(nowMs);
        buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
        return { allowed: true, retryAfterSeconds: 0, remaining: maxPerWindow - 1 };
      }

      if (existing.count >= maxPerWindow) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
          remaining: 0,
        };
      }

      existing.count += 1;
      return { allowed: true, retryAfterSeconds: 0, remaining: maxPerWindow - existing.count };
    },
    size(): number {
      return buckets.size;
    },
  };
}

/**
 * Constant-time comparison for the optional shared API token.
 *
 * Comparing unequal-length strings leaks length only, which is acceptable for a
 * caller-supplied token; equal-length values are compared without an early exit.
 */
export function tokensMatch(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0 || expected.length === 0) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
