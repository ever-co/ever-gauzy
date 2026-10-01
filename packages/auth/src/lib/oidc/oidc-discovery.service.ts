import { Injectable, Logger } from '@nestjs/common';
import { OidcError } from './errors';
import { OidcHttpService } from './oidc-http.service';
import { OidcDiscoveryDocument } from './oidc.types';

/** A discovery document is reused for 24 hours before it is fetched again. */
export const OIDC_DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000;

/** When a refresh fails, a document up to 7 days old is still served. */
export const OIDC_DISCOVERY_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedDocument {
	document: OidcDiscoveryDocument;
	fetchedAt: number;
}

/**
 * Removes trailing slashes without a regular expression.
 *
 * @param value - A URL or issuer identifier.
 * @returns The value without trailing slashes.
 */
export function stripTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charAt(end - 1) === '/') {
		end--;
	}
	return value.slice(0, end);
}

/**
 * Whether two absolute URLs share scheme, host and port.
 *
 * @param url - The URL to check.
 * @param issuer - The issuer identifier.
 * @returns `true` on the same origin; `false` for a different origin or an unparsable URL.
 */
export function isSameOrigin(url: unknown, issuer: string): boolean {
	if (typeof url !== 'string' || !url) {
		return false;
	}
	try {
		return new URL(url).origin === new URL(issuer).origin;
	} catch {
		return false;
	}
}

/** Hosts on which an `http` issuer is accepted: the local machine only (development). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether an issuer identifier may be used: `https`, or `http` on the local machine only. Client
 * credentials and tokens are never sent to a remote issuer without TLS.
 *
 * @param issuer - The issuer identifier.
 * @returns `true` when the scheme and host are acceptable.
 */
export function isAcceptableIssuer(issuer: string): boolean {
	try {
		const url = new URL(issuer);
		return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
	} catch {
		return false;
	}
}

/**
 * Fetches and caches OpenID Provider metadata (OpenID Connect Discovery 1.0).
 *
 * A document is accepted only when its `issuer` equals the configured issuer exactly and every
 * endpoint the library uses lives on the issuer's own origin. This is what guarantees the library
 * only ever contacts the issuer an operator configured.
 */
@Injectable()
export class OidcDiscoveryService {
	private readonly logger = new Logger(OidcDiscoveryService.name);
	private readonly cache = new Map<string, CachedDocument>();
	private readonly inFlight = new Map<string, Promise<OidcDiscoveryDocument>>();

	constructor(private readonly http: OidcHttpService) {}

	/**
	 * Returns the discovery document of an issuer.
	 *
	 * @param issuer - Exact issuer identifier.
	 * @param preloaded - A document to use instead of fetching (validated the same way).
	 * @returns The validated document.
	 * @throws OidcError `discovery_failed` when no valid document is available.
	 */
	async get(issuer: string, preloaded?: OidcDiscoveryDocument): Promise<OidcDiscoveryDocument> {
		if (!isAcceptableIssuer(issuer)) {
			throw new OidcError('discovery_failed', `Issuer ${issuer} must use https (http only on the local machine)`);
		}
		if (preloaded) {
			return this.validate(issuer, preloaded);
		}

		const cached = this.cache.get(issuer);
		const now = this.now();
		if (cached && now - cached.fetchedAt < OIDC_DISCOVERY_TTL_MS) {
			return cached.document;
		}

		let pending = this.inFlight.get(issuer);
		if (!pending) {
			pending = this.fetch(issuer).finally(() => this.inFlight.delete(issuer));
			this.inFlight.set(issuer, pending);
		}

		try {
			return await pending;
		} catch (error) {
			if (cached && now - cached.fetchedAt < OIDC_DISCOVERY_MAX_STALE_MS) {
				this.logger.warn(`Serving a cached discovery document for ${issuer}: the refresh failed.`);
				return cached.document;
			}
			throw error instanceof OidcError ? error : new OidcError('discovery_failed', `Discovery failed for ${issuer}`);
		}
	}

	/** Drops every cached document (tests, configuration changes). */
	clear(): void {
		this.cache.clear();
	}

	/** Current time in milliseconds; a method so tests can move the clock. */
	protected now(): number {
		return Date.now();
	}

	private async fetch(issuer: string): Promise<OidcDiscoveryDocument> {
		const url = `${stripTrailingSlashes(issuer)}/.well-known/openid-configuration`;
		let status: number;
		let data: unknown;
		try {
			({ status, data } = await this.http.get(url));
		} catch {
			throw new OidcError('discovery_failed', `Discovery request failed for ${issuer}`);
		}
		if (status !== 200 || !data || typeof data !== 'object') {
			throw new OidcError('discovery_failed', `Discovery answered ${status} for ${issuer}`);
		}
		const document = this.validate(issuer, data as OidcDiscoveryDocument);
		this.cache.set(issuer, { document, fetchedAt: this.now() });
		return document;
	}

	private validate(issuer: string, document: OidcDiscoveryDocument): OidcDiscoveryDocument {
		if (document.issuer !== issuer) {
			throw new OidcError('discovery_failed', `Discovery document issuer does not match ${issuer}`);
		}
		const required: Array<keyof OidcDiscoveryDocument> = ['authorization_endpoint', 'token_endpoint', 'jwks_uri'];
		for (const key of required) {
			if (!isSameOrigin(document[key], issuer)) {
				throw new OidcError('discovery_failed', `Discovery document ${String(key)} is not on the issuer origin`);
			}
		}
		const optional: Array<keyof OidcDiscoveryDocument> = ['userinfo_endpoint', 'end_session_endpoint'];
		for (const key of optional) {
			if (document[key] !== undefined && !isSameOrigin(document[key], issuer)) {
				throw new OidcError('discovery_failed', `Discovery document ${String(key)} is not on the issuer origin`);
			}
		}
		return document;
	}
}
