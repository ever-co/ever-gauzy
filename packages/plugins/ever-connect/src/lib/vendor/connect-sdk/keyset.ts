// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/keyset.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The key set: the keys of the last verified manifest, for one issuer, held in memory. Storage
 * stays in the product (persist `toJSON()` and rebuild with `KeySet.restore`, which verifies again
 * for the issuer it is given).
 *
 * - A key set exists only over a manifest `verifyKeyManifest` answered; it cannot be built from an
 *   object of the same shape.
 * - `issuer` is the issuer the manifest was verified for: the entitlement verifier refuses a
 *   document expected from any other issuer.
 * - `find(kid, purpose)` answers only an `active` or `previous` key of that purpose inside its
 *   validity window, so an assertion or intent key never verifies an entitlement document.
 * - `needsRefresh(now)` is true 24 h after the last fetch, and when the manifest has expired.
 * - `unknownKidRefreshAllowed(now)` answers true at most once per 10 minutes.
 * - A manifest that fails verification, is for another issuer, or is older than the current one
 *   never replaces it.
 */
import { CONSTANTS } from '../connect-contracts';
import { KeyManifestError } from './errors';
import { originOf } from './local';
import {
  CLOCK_SKEW_S,
  isVerifiedKeyManifest,
  type KeyManifestDocument,
  type ManifestKey,
  type VerifiedKeyManifest,
  type VerifyKeyManifestOptions,
  verifyKeyManifest,
  verifyStoredKeyManifest,
} from './manifest';
import { parseUtcTime } from './time';

/** What a product persists between restarts. */
export interface StoredKeySet {
  readonly document: KeyManifestDocument;
  /** Unix seconds of the fetch. */
  readonly fetchedAt: number;
}

/** The outcome of {@link KeySet.update}. */
export interface KeySetUpdate {
  /** The key set to use from now on (the previous one when the manifest was refused). */
  readonly keySet: KeySet;
  readonly replaced: boolean;
  /** Why the manifest was refused; null when it replaced the set or was older than the current one. */
  readonly error: KeyManifestError | null;
}

const BUILD = Symbol('KeySet');
const GENUINE = new WeakSet<KeySet>();
const nowS = () => Math.floor(Date.now() / 1000);

export class KeySet {
  readonly #manifest: VerifiedKeyManifest;
  readonly #fetchedAt: number;
  #lastUnknownKidRefresh: number | null = null;

  /** Not public: build a key set with `KeySet.verify`, `KeySet.restore` or `KeySet.fromManifest`. */
  constructor(token: symbol, manifest: VerifiedKeyManifest, fetchedAt: number) {
    if (token !== BUILD || !isVerifiedKeyManifest(manifest))
      throw new TypeError('a KeySet is built by KeySet.verify, KeySet.restore or KeySet.fromManifest');
    this.#manifest = manifest;
    this.#fetchedAt = fetchedAt;
    GENUINE.add(this);
  }

  /** Whether `value` is a key set this module built (not an object of the same shape). */
  static isKeySet(value: unknown): value is KeySet {
    return value instanceof KeySet && GENUINE.has(value);
  }

  /** A key set over a manifest that {@link verifyKeyManifest} answered (anything else is refused). */
  static fromManifest(manifest: VerifiedKeyManifest, fetchedAt: number = nowS()): KeySet {
    return new KeySet(BUILD, manifest, Math.max(0, Math.floor(fetchedAt)));
  }

  /** Verifies a served body for one issuer and builds a key set; throws {@link KeyManifestError}. */
  static verify(body: unknown, options: VerifyKeyManifestOptions): KeySet {
    const now = Math.floor(options?.now ?? nowS());
    return new KeySet(BUILD, verifyKeyManifest(body, { ...options, now }), now);
  }

  /**
   * Rebuilds a stored key set for one issuer, verifying the stored manifest again (offline: only
   * the pinned root of that issuer is needed). A stored fetch time in the future counts as now.
   * A manifest past its `exp` is restored too (reading it back is not a new verification): its
   * keys verify no new document (`manifest_expired`) and `needsRefresh` is true.
   */
  static restore(stored: StoredKeySet, options: VerifyKeyManifestOptions): KeySet {
    const now = Math.floor(options?.now ?? nowS());
    const manifest = verifyStoredKeyManifest(stored?.document, { ...options, now });
    const fetchedAt = typeof stored.fetchedAt === 'number' && Number.isFinite(stored.fetchedAt) ? stored.fetchedAt : 0;
    return new KeySet(BUILD, manifest, Math.min(Math.max(0, Math.floor(fetchedAt)), now));
  }

  /** The verified manifest. */
  get manifest(): VerifiedKeyManifest {
    return this.#manifest;
  }

  /** The issuer origin the manifest was verified for. */
  get issuer(): string {
    return this.#manifest.issuer;
  }

  /** Unix seconds of the fetch. */
  get fetchedAt(): number {
    return this.#fetchedAt;
  }

  /** The key `kid` for `purpose` at `now`, or null: unknown, another purpose, retired or outside its window. */
  find(kid: string, purpose: ManifestKey['ever_purpose'], now: number = nowS()): ManifestKey | null {
    const key = this.#manifest.keys.find((k) => k.kid === kid);
    if (!key || key.ever_purpose !== purpose || (key.state !== 'active' && key.state !== 'previous')) return null;
    const notBefore = parseUtcTime(key.not_before);
    if (notBefore === null || now + CLOCK_SKEW_S < notBefore) return null;
    if (key.not_after !== undefined && key.not_after !== null) {
      const notAfter = parseUtcTime(key.not_after);
      if (notAfter === null || now > notAfter + CLOCK_SKEW_S) return null;
    }
    return key;
  }

  /** Whether the manifest lists `kid` at all (an unknown `kid` suggests one refresh). */
  has(kid: string): boolean {
    return this.#manifest.keys.some((k) => k.kid === kid);
  }

  /** True 24 h after the fetch, and once the manifest has expired. */
  needsRefresh(now: number = nowS()): boolean {
    return now - this.#fetchedAt >= CONSTANTS.key_manifest.refresh_s || now >= this.#manifest.expiresAt;
  }

  /**
   * Whether an unknown `kid` may trigger a refresh now (at most once per 10 minutes); answering
   * true records the refresh.
   */
  unknownKidRefreshAllowed(now: number = nowS()): boolean {
    // A fetch is a refresh too: a set fetched less than 10 minutes ago is not fetched again.
    const last = Math.max(this.#fetchedAt, this.#lastUnknownKidRefresh ?? Number.NEGATIVE_INFINITY);
    if (now - last < CONSTANTS.key_manifest.unknown_kid_refresh_min_s) return false;
    this.#lastUnknownKidRefresh = now;
    return true;
  }

  /**
   * Verifies a newly fetched manifest body for this set's issuer. It replaces this set only when
   * it verifies and is not older than the current manifest; otherwise this set stays in use.
   */
  update(body: unknown, options: VerifyKeyManifestOptions): KeySetUpdate {
    const now = Math.floor(options?.now ?? nowS());
    if (originOf(options?.issuer ?? '') !== this.issuer)
      return { keySet: this, replaced: false, error: new KeyManifestError('issuer_mismatch') };
    let next: VerifiedKeyManifest;
    try {
      next = verifyKeyManifest(body, { ...options, now });
    } catch (error) {
      if (error instanceof KeyManifestError) return { keySet: this, replaced: false, error };
      throw error;
    }
    if (next.issuedAt < this.#manifest.issuedAt) return { keySet: this, replaced: false, error: null };
    const keySet = new KeySet(BUILD, next, now);
    keySet.#lastUnknownKidRefresh = this.#lastUnknownKidRefresh;
    return { keySet, replaced: true, error: null };
  }

  /** What to persist: the served body and the fetch time (no secret is in it). */
  toJSON(): StoredKeySet {
    return { document: this.#manifest.document, fetchedAt: this.#fetchedAt };
  }
}
