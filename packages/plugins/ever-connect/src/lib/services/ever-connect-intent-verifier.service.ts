import { HttpException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { EverConnectConfig } from '../ever-connect-config';
import { EVER_CONNECT_CLOCK, EVER_CONNECT_SETTINGS, PRODUCT, ULID_SHAPE } from '../ever-connect.constants';
import { EverConnectPlatformService } from '../ever-connect-platform.service';
import { EverConnectStore } from '../ever-connect.store';
import { CONSTANTS, KeySet } from '../sdk';

/** The header `typ` of a provisioning request (Ever Platform's signer sets it for every document of purpose `intent`). */
export const INTENT_HEADER_TYP: string = CONSTANTS.intent_typ;

/** The claim `typ`: the version of the claim set. */
export const INTENT_CLAIMS_TYP = 'ever.provision_intent.v1';

/** The audience of a request for this product. */
export const INTENT_AUDIENCE = `ever-connect:${PRODUCT}`;

/** The longest a request lives (`exp - iat`), seconds. */
export const INTENT_MAX_TTL_S = 900;

/** How far ahead of this clock a request's `iat` may be, seconds. */
export const INTENT_MAX_FUTURE_IAT_S = 300;

/** The longest compact JWS read. */
const MAX_JWS_LENGTH = 65_536;

/**
 * Where Ever Platform's web app sends a person, and so where a request may send them back: app.ever.co
 * and its stage and development hosts (this installation has no setting for another one).
 */
export const RETURN_ORIGINS: ReadonlyArray<string> = Object.freeze([
	'https://app.ever.co',
	'https://app-stage.ever.co',
	'https://app-dev.ever.co'
]);

/** The claims of a verified request (the closed set of `ever.provision_intent.v1`). */
export interface ProvisionIntentClaims {
	iss: string;
	aud: string;
	jti: string;
	iat: number;
	exp: number;
	typ: string;
	ever_purpose: 'intent';
	job_id: string;
	step_seq: number;
	idempotency_key: string;
	org: { id: string; handle: string; display_name: string; legal_name?: string; country?: string; website?: string };
	product: string;
	tier: string;
	features: { teams?: boolean };
	person: { ever_id_sub: string };
	billing?: { stripe_customer_ref: string };
	instance_id?: string;
	/** The consent Ever Platform holds for this hand-off (a ULID). Optional here until every platform sends it. */
	consent_id?: string;
	mode: 'handoff';
	callback: string;
	return_to: string;
}

/**
 * A request refused: an HTTP error whose body is `{statusCode, code, message}` (401 `intent_invalid` for
 * every check but the product, 422 `product_mismatch`), so it reaches the caller as such through any
 * interceptor. `reason` names the check that failed, for this installation's tests and logs only, never
 * for the answer.
 */
export class IntentRefusedError extends HttpException {
	constructor(
		status: 401 | 422,
		readonly code: 'intent_invalid' | 'product_mismatch',
		readonly reason: string
	) {
		super({ statusCode: status, code, message: 'This request is not valid.' }, status);
		this.name = 'IntentRefusedError';
	}
}

const refuse = (reason: string): IntentRefusedError => new IntentRefusedError(401, 'intent_invalid', reason);

/** Where the verifier finds Ever Platform's keys of purpose `intent`. */
export interface IntentKeySource {
	/** The current key set (root-verified). */
	keys(): Promise<KeySet>;
	/** One refresh of the key set (an unknown `kid`); answers the set to use. */
	refresh(): Promise<KeySet>;
}

/** What a request is checked against. */
export interface IntentExpectations {
	/** The issuer Ever Platform's documents name (the origin of `EVER_PLATFORM_API_URL`). */
	issuer: string;
	/** `EVER_PLATFORM_API_URL` (the completion callback must be under it). */
	apiUrl: string;
	/** This installation's Registry id. */
	instanceId: string;
	/** Unix seconds. */
	now: number;
	/** A request may return to a local web app too (a test platform on a local address only). */
	localPlatform?: boolean;
}

const B64URL = /^[A-Za-z0-9_-]+$/;

function decodePart(part: string): Record<string, unknown> {
	if (!B64URL.test(part)) throw refuse('malformed');
	let value: unknown;
	try {
		value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
	} catch {
		throw refuse('malformed');
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw refuse('malformed');
	return value as Record<string, unknown>;
}

const isString = (value: unknown, min = 1, max = 255): value is string =>
	typeof value === 'string' && value.length >= min && value.length <= max;

const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);

/** Whether an object has only the keys listed (the claim set is closed). */
const onlyKeys = (value: Record<string, unknown>, keys: string[]): boolean =>
	Object.keys(value).every((key) => keys.includes(key));

const CLAIM_KEYS = [
	'iss',
	'aud',
	'jti',
	'iat',
	'exp',
	'typ',
	'ever_purpose',
	'job_id',
	'step_seq',
	'idempotency_key',
	'org',
	'product',
	'tier',
	'features',
	'person',
	'billing',
	'instance_id',
	'consent_id',
	'mode',
	'callback',
	'return_to'
];

/** Whether `url` is a page of Ever Platform's web app a request may send the person back to. */
export function returnToAllowed(url: unknown, localPlatform = false): boolean {
	if (!isString(url, 1, 2048)) return false;
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.username || parsed.password) return false;
	if (RETURN_ORIGINS.includes(parsed.origin)) return true;
	if (!localPlatform) return false;
	const host = parsed.hostname.toLowerCase();
	return (
		(parsed.protocol === 'http:' || parsed.protocol === 'https:') && (host === 'localhost' || host === '127.0.0.1')
	);
}

/** Whether `signature` (base64url) is the Ed25519 signature of `signingInput` by the key `x` (base64url). */
function signatureValid(x: string, signingInput: string, signature: string): boolean {
	try {
		const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
		return verifySignature(
			null,
			Buffer.from(signingInput, 'ascii'),
			publicKey,
			Buffer.from(signature, 'base64url')
		);
	} catch {
		return false;
	}
}

/** The organization of a request: ids and public names only. */
function checkOrg(org: unknown): ProvisionIntentClaims['org'] {
	if (!org || typeof org !== 'object' || Array.isArray(org)) throw refuse('org');
	const value = org as Record<string, unknown>;
	if (!onlyKeys(value, ['id', 'handle', 'display_name', 'legal_name', 'country', 'website'])) throw refuse('org');
	if (!isString(value['id'], 26, 26) || !ULID_SHAPE.test(value['id'])) throw refuse('org');
	if (!isString(value['handle'], 1, 64) || !isString(value['display_name'], 1, 200)) throw refuse('org');
	if (value['legal_name'] !== undefined && !isString(value['legal_name'], 0, 200)) throw refuse('org');
	if (
		value['country'] !== undefined &&
		!(typeof value['country'] === 'string' && /^[A-Z]{2}$/.test(value['country']))
	)
		throw refuse('org');
	if (value['website'] !== undefined && !isString(value['website'], 1, 2048)) throw refuse('org');
	return value as ProvisionIntentClaims['org'];
}

/**
 * Verifies a provisioning request from Ever Platform, failing closed at the first check that does not
 * pass, in this order: the compact JWS and its header (`typ`, `alg = EdDSA`, `kid`, no `crit`) → the
 * key, from the root-verified key manifest, of purpose `intent` and state `active` or `previous` (an
 * unknown `kid` refreshes the manifest once) → the Ed25519 signature → `iss` → `aud` → `instance_id`
 * (when present) → `typ`, `ever_purpose` and the closed claim set → `iat` and `exp` → `product` (422)
 * → `mode` → `callback` and `return_to`.
 *
 * @returns The claims.
 * @throws IntentRefusedError
 */
export async function verifyProvisionIntent(
	jws: unknown,
	source: IntentKeySource,
	expected: IntentExpectations
): Promise<ProvisionIntentClaims> {
	if (typeof jws !== 'string' || jws.length > MAX_JWS_LENGTH) throw refuse('malformed');
	const parts = jws.split('.');
	if (parts.length !== 3 || !parts[2] || !B64URL.test(parts[2])) throw refuse('malformed');

	const header = decodePart(parts[0]);
	if (header['typ'] !== INTENT_HEADER_TYP) throw refuse('bad_typ');
	if (header['alg'] !== 'EdDSA' || 'crit' in header) throw refuse('bad_alg');
	const kid = header['kid'];
	if (!isString(kid, 1, 128)) throw refuse('unknown_kid');

	let keySet = await source.keys();
	let key = keySet.find(kid, 'intent', expected.now);
	if (!key && !keySet.has(kid) && keySet.unknownKidRefreshAllowed(expected.now)) {
		keySet = await source.refresh();
		key = keySet.find(kid, 'intent', expected.now);
	}
	if (!key) throw refuse('unknown_kid');
	if (expected.now >= keySet.manifest.expiresAt) throw refuse('manifest_expired');

	if (!signatureValid(key.x, `${parts[0]}.${parts[1]}`, parts[2])) throw refuse('bad_signature');

	const claims = decodePart(parts[1]);
	if (claims['iss'] !== expected.issuer || keySet.issuer !== expected.issuer) throw refuse('issuer_mismatch');
	if (claims['aud'] !== INTENT_AUDIENCE) throw refuse('audience_mismatch');
	if (claims['instance_id'] !== undefined && claims['instance_id'] !== expected.instanceId)
		throw refuse('instance_mismatch');
	if (claims['typ'] !== INTENT_CLAIMS_TYP || claims['ever_purpose'] !== 'intent') throw refuse('schema_violation');
	if (!onlyKeys(claims, CLAIM_KEYS)) throw refuse('schema_violation');

	const { iat, exp } = claims;
	if (!isInteger(iat) || !isInteger(exp) || exp <= iat || exp - iat > INTENT_MAX_TTL_S) throw refuse('lifetime');
	if (iat > expected.now + INTENT_MAX_FUTURE_IAT_S) throw refuse('not_yet_valid');
	if (expected.now >= exp) throw refuse('expired');

	if (claims['product'] !== PRODUCT) throw new IntentRefusedError(422, 'product_mismatch', 'product_mismatch');
	if (claims['mode'] !== 'handoff') throw refuse('mode');

	const jti = claims['jti'];
	if (!isString(jti, 26, 26) || !ULID_SHAPE.test(jti)) throw refuse('schema_violation');
	const apiBase = expected.apiUrl.replace(/\/+$/, '');
	const callbacks = new Set([
		`${expected.issuer}/v1/provision-intents/${jti}/complete`,
		`${apiBase}/v1/provision-intents/${jti}/complete`
	]);
	if (!callbacks.has(String(claims['callback']))) throw refuse('callback');
	if (!returnToAllowed(claims['return_to'], expected.localPlatform)) throw refuse('return_to');

	if (!isString(claims['job_id'], 1, 64) || !isInteger(claims['step_seq']) || (claims['step_seq'] as number) < 0)
		throw refuse('schema_violation');
	if (!isString(claims['idempotency_key'], 1, 200)) throw refuse('schema_violation');
	const org = checkOrg(claims['org']);
	if (!isString(claims['tier'], 1, 64)) throw refuse('schema_violation');
	const features = claims['features'];
	if (!features || typeof features !== 'object' || Array.isArray(features)) throw refuse('schema_violation');
	const featureMap = features as Record<string, unknown>;
	if (
		!onlyKeys(featureMap, ['teams']) ||
		(featureMap['teams'] !== undefined && typeof featureMap['teams'] !== 'boolean')
	)
		throw refuse('schema_violation');
	const person = claims['person'] as Record<string, unknown> | undefined;
	if (
		!person ||
		typeof person !== 'object' ||
		!onlyKeys(person, ['ever_id_sub']) ||
		!isString(person['ever_id_sub'], 1, 255)
	)
		throw refuse('schema_violation');
	const billing = claims['billing'] as Record<string, unknown> | undefined;
	if (
		billing !== undefined &&
		(!billing ||
			typeof billing !== 'object' ||
			!onlyKeys(billing, ['stripe_customer_ref']) ||
			!(
				typeof billing['stripe_customer_ref'] === 'string' &&
				/^cus_[A-Za-z0-9]+$/.test(billing['stripe_customer_ref'])
			))
	)
		throw refuse('schema_violation');
	const consentId = claims['consent_id'];
	if (consentId !== undefined && !(typeof consentId === 'string' && ULID_SHAPE.test(consentId)))
		throw refuse('schema_violation');

	return { ...(claims as unknown as ProvisionIntentClaims), org };
}

/**
 * Verifies provisioning requests against this installation: its connection (the Registry id), Ever
 * Platform's issuer and its root-verified key set (the one the entitlement documents are verified with).
 */
@Injectable()
export class EverConnectIntentVerifier {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
	}

	/**
	 * @throws IntentRefusedError (also when this installation cannot verify anything right now: not
	 *   connected, or no verified key set).
	 */
	async verify(jws: unknown): Promise<ProvisionIntentClaims> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId || !this.config.apiUrl) {
			throw refuse('not_connected');
		}
		let issuer: string;
		try {
			issuer = (await this.platform.getClient()).issuer;
		} catch {
			throw refuse('no_client');
		}
		const source: IntentKeySource = {
			keys: () => this.platform.keys(),
			refresh: () => this.platform.keys({ refresh: true })
		};
		try {
			return await verifyProvisionIntent(jws, source, {
				issuer,
				apiUrl: this.config.apiUrl,
				instanceId: connection.platformInstanceId,
				now: Math.floor(this.now() / 1000),
				localPlatform: this.config.localPlatform
			});
		} catch (error) {
			if (error instanceof IntentRefusedError) {
				throw error;
			}
			this.logger.warn('A provisioning request could not be verified: the key set is not available.');
			throw refuse('keys_unavailable');
		}
	}
}
