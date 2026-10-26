import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EverInstanceService } from '@gauzy/plugin-ever-instance';
import type { EverConnectConfig } from './ever-connect-config';
import { EVER_CONNECT_ENV, EVER_CONNECT_FETCH, EVER_CONNECT_SETTINGS, PRODUCT } from './ever-connect.constants';
import {
	createEverPlatformClient,
	EverPlatformClient,
	KeyManifestError,
	KeySet,
	ProblemError,
	StoredKeySet,
	TimeoutError,
	VerifiedEntitlement
} from './sdk';

/** Ever Platform cannot be used from this installation right now (no call was made, or none got through). */
export class PlatformUnavailableError extends Error {
	constructor(
		readonly code: 'platform_url_unusable' | 'no_connect_key' | 'platform_unreachable' | 'keys_unverifiable'
	) {
		super(`Ever Platform is not available (${code}).`);
		this.name = 'PlatformUnavailableError';
	}
}

/**
 * Whether an error means Ever Platform could not be reached (no answer, a timeout, a 5xx or a 429),
 * as opposed to an answer that refuses the request.
 */
export function isUnreachable(error: unknown): boolean {
	if (error instanceof ProblemError) {
		return error.status >= 500 || error.status === 429;
	}
	if (error instanceof PlatformUnavailableError) {
		return error.code === 'platform_unreachable';
	}
	return error instanceof TimeoutError || (error instanceof TypeError && /fetch/i.test(error.message));
}

/** Whether an error is Ever Platform saying this installation's credential was revoked. */
export function isCredentialRevoked(error: unknown): boolean {
	return error instanceof ProblemError && error.status === 401 && error.code === 'credential_revoked';
}

/**
 * The Ever Platform client of this installation (the SDK client over its generated operation table),
 * and the key set that verifies Ever Platform's documents.
 *
 * Nothing is made at start: the client object exists only once the operator connects or a connection
 * exists, and every call it makes is one of the SDK's operations against `EVER_PLATFORM_API_URL`
 * (anything else is refused before any I/O, redirects are never followed, no cookie is kept). The
 * instance token lives in the client's memory only.
 */
@Injectable()
export class EverConnectPlatformService {
	private readonly logger = new Logger('EverConnect');
	private readonly env: Record<string, string | undefined>;
	private client: EverPlatformClient | null = null;
	private clientKid: string | null = null;
	private registryId: string | null = null;
	private keySet: KeySet | null = null;

	constructor(
		private readonly instance: EverInstanceService,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>,
		@Optional() @Inject(EVER_CONNECT_FETCH) private readonly fetchImpl?: typeof globalThis.fetch
	) {
		this.env = env ?? process.env;
	}

	/** Whether a client object exists. */
	get created(): boolean {
		return this.client !== null;
	}

	/** The Registry id the client signs its assertions for (`null` before a redeem). */
	setRegistryInstanceId(id: string | null): void {
		this.registryId = id;
	}

	get registryInstanceId(): string | null {
		return this.registryId;
	}

	/** The client, made on first use with the connect key (a new one when the key changed). */
	async getClient(): Promise<EverPlatformClient> {
		if (!this.config.apiUrl) {
			throw new PlatformUnavailableError('platform_url_unusable');
		}
		const signer = await this.instance.connectSigner();
		if (!signer) {
			throw new PlatformUnavailableError('no_connect_key');
		}
		if (this.client && this.clientKid === signer.kid) {
			return this.client;
		}
		this.client = createEverPlatformClient({
			baseUrl: this.config.apiUrl,
			userAgentProduct: { product: PRODUCT, version: this.config.version },
			signer,
			registryInstanceId: () => this.registryId,
			fetch: this.fetchImpl,
			...(this.config.issuer ? { issuer: this.config.issuer } : {}),
			// Test root keys only for a platform on a local or private address (the contract's list).
			env: this.config.localPlatform ? this.env : withoutTestKeys(this.env),
			onWarning: (message) => this.logger.warn(message)
		});
		this.clientKid = signer.kid;
		return this.client;
	}

	/** Forgets the client, its token and the key set (disconnect, revocation, shutdown). */
	reset(): void {
		this.client = null;
		this.clientKid = null;
		this.registryId = null;
		this.keySet = null;
	}

	/**
	 * The key set that verifies Ever Platform's documents: the one in memory, else the stored manifest
	 * (verified again for this issuer), else a fetch. With `refresh`, or 24 hours after the last fetch,
	 * it is fetched again; a manifest that does not verify never replaces a good one.
	 */
	async keys(options: { refresh?: boolean } = {}): Promise<KeySet> {
		const client = await this.getClient();
		const now = Math.floor(Date.now() / 1000);
		if (!this.keySet) {
			const stored = await this.instance.jwksCache();
			if (stored.json) {
				try {
					this.keySet = KeySet.restore(JSON.parse(stored.json) as StoredKeySet, {
						unsafeRootKeys: client.keys.rootKeys(),
						issuer: client.issuer,
						now
					});
				} catch {
					this.keySet = null;
				}
			}
		}
		if (this.keySet && !options.refresh && !this.keySet.needsRefresh(now)) {
			return this.keySet;
		}
		try {
			const update = await client.keys.refresh(this.keySet ?? undefined);
			if (update.error && !this.keySet) {
				throw update.error;
			}
			if (update.replaced || !this.keySet) {
				this.keySet = update.keySet;
				await this.instance.setJwksCache(JSON.stringify(this.keySet.toJSON()));
			}
		} catch (error) {
			if (this.keySet) {
				// The current set stays in use until a newer manifest verifies.
				this.logger.warn(`Ever Platform's key manifest could not be refreshed (${errorCode(error)}).`);
				return this.keySet;
			}
			if (error instanceof KeyManifestError) {
				throw new PlatformUnavailableError('keys_unverifiable');
			}
			throw error;
		}
		return this.keySet;
	}

	/**
	 * Verifies an entitlement document of this installation (`instance:<id>`) or of one of its links
	 * (`link:<id>`), with the SDK's verifier. On an unknown key id the key set is refreshed once (at
	 * most every 10 minutes) and the document verified again. Throws the verifier's error.
	 */
	async verify(
		jws: string,
		subject: string,
		cached?: { seq: number; iat: number } | null
	): Promise<VerifiedEntitlement> {
		const client = await this.getClient();
		const keySet = await this.keys();
		const { verified, keySet: next } = await client.verifyEntitlementRefreshing(jws, { keySet, subject, cached });
		if (next !== keySet) {
			this.keySet = next;
			await this.instance.setJwksCache(JSON.stringify(next.toJSON()));
		}
		return verified;
	}
}

/** The environment without the test root keys file (honoured for a local platform only). */
function withoutTestKeys(env: Record<string, string | undefined>): Record<string, string | undefined> {
	const copy = { ...env };
	delete copy['EVER_PLATFORM_ROOT_KEYS_FILE'];
	return copy;
}

/** A short, value-free name for an error, for logs and `last_error`. */
export function errorCode(error: unknown): string {
	if (error instanceof ProblemError) return `${error.status} ${error.code}`;
	if (
		error &&
		typeof error === 'object' &&
		'code' in error &&
		typeof (error as { code: unknown }).code === 'string'
	) {
		return String((error as { code: string }).code);
	}
	if (error instanceof Error) return error.name;
	return 'error';
}
