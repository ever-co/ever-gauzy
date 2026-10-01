import { Injectable, Logger } from '@nestjs/common';
import type { JWK } from 'jose';
import { OidcError } from './errors';
import { loadJose } from './jose-loader';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcHttpService } from './oidc-http.service';
import { OIDC_SIGNING_ALGORITHMS, OidcDiscoveryDocument, OidcSigningAlgorithm } from './oidc.types';

/** A key set is reused for 600 s. */
export const OIDC_JWKS_TTL_MS = 600 * 1000;

/** A token signed with an unknown `kid` triggers at most one refetch per 30 s. */
export const OIDC_JWKS_REFETCH_COOLDOWN_MS = 30 * 1000;

/** When a refresh fails, a key set up to 21,600 s (6 h) old is still served. */
export const OIDC_JWKS_MAX_STALE_MS = 21_600 * 1000;

interface CachedKeySet {
	keys: JWK[];
	fetchedAt: number;
}

/** The JOSE header fields used to pick a key. */
export interface OidcKeySelector {
	alg?: string;
	kid?: string;
}

/**
 * Whether a JWK can verify a signature made with `alg`.
 *
 * Pins the key type to the algorithm so a key of one type can never be used with an algorithm of
 * another (algorithm confusion).
 *
 * @param jwk - Candidate key.
 * @param alg - The token's `alg` header.
 * @returns `true` when the key fits.
 */
export function isKeyCompatible(jwk: JWK, alg: OidcSigningAlgorithm): boolean {
	if (jwk.use && jwk.use !== 'sig') {
		return false;
	}
	if (jwk.alg && jwk.alg !== alg) {
		return false;
	}
	switch (alg) {
		case 'RS256':
			return jwk.kty === 'RSA';
		case 'ES256':
			return jwk.kty === 'EC' && jwk.crv === 'P-256';
		case 'EdDSA':
			return jwk.kty === 'OKP' && jwk.crv === 'Ed25519';
		default:
			return false;
	}
}

/**
 * Picks the verification key for a token from a key set.
 *
 * @param keys - The issuer's keys.
 * @param selector - The token's `alg` and `kid`.
 * @returns The key, or `undefined` when none (or more than one, without a `kid`) fits.
 */
export function selectKey(keys: JWK[], selector: OidcKeySelector): JWK | undefined {
	const alg = selector.alg as OidcSigningAlgorithm;
	if (!OIDC_SIGNING_ALGORITHMS.includes(alg)) {
		return undefined;
	}
	const candidates = keys.filter((jwk) => isKeyCompatible(jwk, alg));
	if (selector.kid) {
		return candidates.find((jwk) => jwk.kid === selector.kid);
	}
	return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Caches issuers' JSON Web Key Sets.
 *
 * Rules: a set is reused for 600 s; a token whose `kid` is not in the cached set causes one refetch
 * at most every 30 s per issuer (a second unknown `kid` inside that window is rejected without a
 * request); when the issuer cannot be reached, a set up to 6 h old is still used, after which
 * verification fails with `jwks_unavailable`.
 */
@Injectable()
export class OidcJwksService {
	private readonly logger = new Logger(OidcJwksService.name);
	private readonly cache = new Map<string, CachedKeySet>();
	private readonly lastForcedRefetch = new Map<string, number>();
	private readonly inFlight = new Map<string, Promise<CachedKeySet>>();

	constructor(
		private readonly discovery: OidcDiscoveryService,
		private readonly http: OidcHttpService
	) {}

	/**
	 * Returns the key that verifies a token from `issuer`.
	 *
	 * @param issuer - Exact issuer identifier.
	 * @param selector - The token's `alg` and `kid` headers.
	 * @param discoveryDocument - A pre-loaded discovery document (tests).
	 * @returns A key usable by `jose`.
	 * @throws OidcError `token_invalid` when no key fits, `jwks_unavailable` when no key set is available.
	 */
	async getKey(issuer: string, selector: OidcKeySelector, discoveryDocument?: OidcDiscoveryDocument) {
		const alg = selector.alg as OidcSigningAlgorithm;
		if (!OIDC_SIGNING_ALGORITHMS.includes(alg)) {
			throw new OidcError('token_invalid', `Signature algorithm ${String(selector.alg)} is not accepted`);
		}

		const first = await this.getKeySet(issuer, false, discoveryDocument);
		let jwk = selectKey(first.keySet.keys, selector);

		if (!jwk) {
			const now = this.now();
			if (first.fresh) {
				// The set was fetched by this very call; fetching it again cannot help.
				this.lastForcedRefetch.set(issuer, now);
				throw new OidcError('token_invalid', 'No matching signing key');
			}
			const last = this.lastForcedRefetch.get(issuer) ?? 0;
			if (now - last < OIDC_JWKS_REFETCH_COOLDOWN_MS) {
				throw new OidcError('token_invalid', 'No matching signing key (refetch cooldown active)');
			}
			this.lastForcedRefetch.set(issuer, now);
			const reloaded = await this.getKeySet(issuer, true, discoveryDocument);
			jwk = selectKey(reloaded.keySet.keys, selector);
		}

		if (!jwk) {
			throw new OidcError('token_invalid', 'No matching signing key');
		}

		const jose = await loadJose();
		return jose.importJWK(jwk, alg);
	}

	/** Drops every cached key set (tests, configuration changes). */
	clear(): void {
		this.cache.clear();
		this.lastForcedRefetch.clear();
	}

	/** Current time in milliseconds; a method so tests can move the clock. */
	protected now(): number {
		return Date.now();
	}

	/**
	 * Returns the key set of `issuer`, and whether this call obtained it from the issuer (itself, or by
	 * joining a fetch already in flight) rather than from the cache.
	 */
	private async getKeySet(
		issuer: string,
		force: boolean,
		discoveryDocument?: OidcDiscoveryDocument
	): Promise<{ keySet: CachedKeySet; fresh: boolean }> {
		const cached = this.cache.get(issuer);
		const now = this.now();
		if (!force && cached && now - cached.fetchedAt < OIDC_JWKS_TTL_MS) {
			return { keySet: cached, fresh: false };
		}

		let pending = this.inFlight.get(issuer);
		if (!pending) {
			pending = this.fetch(issuer, discoveryDocument).finally(() => this.inFlight.delete(issuer));
			this.inFlight.set(issuer, pending);
		}

		try {
			return { keySet: await pending, fresh: true };
		} catch (error) {
			if (cached && now - cached.fetchedAt < OIDC_JWKS_MAX_STALE_MS) {
				this.logger.warn(`Serving a cached key set for ${issuer}: the refresh failed.`);
				return { keySet: cached, fresh: false };
			}
			if (error instanceof OidcError && error.code === 'discovery_failed') {
				throw new OidcError('jwks_unavailable', error.message);
			}
			throw error instanceof OidcError ? error : new OidcError('jwks_unavailable', `Key set unavailable for ${issuer}`);
		}
	}

	private async fetch(issuer: string, discoveryDocument?: OidcDiscoveryDocument): Promise<CachedKeySet> {
		const document = await this.discovery.get(issuer, discoveryDocument);
		let status: number;
		let data: unknown;
		try {
			({ status, data } = await this.http.get(document.jwks_uri));
		} catch {
			throw new OidcError('jwks_unavailable', `Key set request failed for ${issuer}`);
		}
		const keys = (data as { keys?: unknown })?.keys;
		if (status !== 200 || !Array.isArray(keys)) {
			throw new OidcError('jwks_unavailable', `Key set answered ${status} for ${issuer}`);
		}
		const keySet: CachedKeySet = {
			keys: keys.filter((key): key is JWK => !!key && typeof key === 'object' && typeof key.kty === 'string'),
			fetchedAt: this.now()
		};
		this.cache.set(issuer, keySet);
		return keySet;
	}
}
