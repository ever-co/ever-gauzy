// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-contracts/src/problem.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
import { PENDING_PROBLEM_CODES, PROBLEM_CODES, type ProblemCode } from './generated/problems';

export type { ProblemCode };
export { PENDING_PROBLEM_CODES, PROBLEM_CODES };

/** One field-level failure of a validation problem. */
export interface FieldError {
  /** A JSON pointer into the body (`/tenant/product_org_id`), `?name` for a query parameter or `#Name` for a header. */
  readonly path: string;
  /** `required`, `unknown_field`, `invalid_shape`, `too_long`, `out_of_range` or `invalid`. */
  readonly code: string;
  readonly message: string;
}

/** An RFC 9457 problem document, as every Ever Platform error is. */
export interface Problem {
  /** `https://api.ever.co/problems/<code>`. */
  readonly type: string;
  readonly title: string;
  readonly status: number;
  /** The stable machine code; an unknown code is handled by its HTTP status. */
  readonly code: ProblemCode;
  readonly detail: string;
  /** The request id. */
  readonly instance?: string | null;
  readonly errors?: readonly FieldError[];
  readonly retry_after_s?: number | null;
}

export const PROBLEM_TYPE_PREFIX = 'https://api.ever.co/problems/';

/** The `type` URI of a problem code. */
export const problemType = (code: ProblemCode): string => `${PROBLEM_TYPE_PREFIX}${code}`;

const CODES: ReadonlySet<string> = new Set(PROBLEM_CODES);

/** Whether a parsed response body is a problem document with a known code. */
export function isProblem(value: unknown): value is Problem {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' &&
    typeof v.title === 'string' &&
    typeof v.status === 'number' &&
    typeof v.code === 'string' &&
    CODES.has(v.code) &&
    typeof v.detail === 'string'
  );
}
