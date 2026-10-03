// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/token.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The instance token: acquired lazily with a client assertion, kept in memory only, refreshed
 * after `token_refresh_after_s` (or earlier when the platform gives a shorter life) and after a
 * 401. It is never written anywhere, never logged and never part of `JSON.stringify` or `inspect`
 * output; `onToken` receives timings only.
 */
import { CONSTANTS } from '../connect-contracts';

/** What the token endpoint answers. */
export interface AcquiredToken {
  readonly access_token: string;
  readonly expires_in: number;
}

export interface InstanceTokenOptions {
  /** Builds a client assertion and calls the token endpoint. */
  readonly acquire: () => Promise<AcquiredToken>;
  /** Unix seconds. */
  readonly now: () => number;
  readonly onToken?: (event: { acquired_at: number; expires_in: number }) => void;
}

export class InstanceTokens {
  #token: string | null = null;
  #refreshAt = 0;
  #inflight: Promise<string> | null = null;
  readonly #o: InstanceTokenOptions;

  constructor(options: InstanceTokenOptions) {
    this.#o = options;
  }

  /** The current token, acquiring one when there is none or it is due for refresh. */
  async get(): Promise<string> {
    if (this.#token !== null && this.#o.now() < this.#refreshAt) return this.#token;
    if (this.#inflight) return this.#inflight;
    this.#inflight = (async () => {
      try {
        const answer = await this.#o.acquire();
        if (typeof answer?.access_token !== 'string' || !answer.access_token.startsWith(CONSTANTS.instance_token_prefix))
          throw new TypeError('the token endpoint answered no instance token');
        const acquiredAt = this.#o.now();
        const life = Number.isInteger(answer.expires_in) && answer.expires_in > 0 ? answer.expires_in : CONSTANTS.token_ttl_s;
        this.#token = answer.access_token;
        this.#refreshAt = acquiredAt + Math.min(CONSTANTS.token_refresh_after_s, Math.max(0, life - 60));
        this.#o.onToken?.({ acquired_at: acquiredAt, expires_in: life });
        return answer.access_token;
      } finally {
        this.#inflight = null;
      }
    })();
    return this.#inflight;
  }

  /** Drops the token (after a 401, a revocation or a disconnect). */
  invalidate(): void {
    this.#token = null;
    this.#refreshAt = 0;
  }

  /** Whether a token is held (never the token itself). */
  get held(): boolean {
    return this.#token !== null;
  }

  toJSON(): { held: boolean } {
    return { held: this.held };
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `InstanceTokens { held: ${this.held} }`;
  }
}
