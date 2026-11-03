/**
 * Test-only: an Ever Platform of its own for provisioning requests. A root key signs a key manifest
 * (verified by the SDK's own `KeySet.verify`, with the root passed as a test root), which lists intent
 * keys in each state; `intent()` signs a request with one of them. Excluded from the library build.
 */
import { generateKeyPairSync, KeyObject, sign } from 'node:crypto';
import { keysSha256, KeySet, signCompactJws } from '@ever-co/connect-sdk';
import {
	INTENT_AUDIENCE,
	INTENT_CLAIMS_TYP,
	INTENT_HEADER_TYP
} from '../services/ever-connect-intent-verifier.service';

export const TEST_ISSUER = 'https://api.platform.test';
export const TEST_INSTANCE_ID = '01K9A0000000000000000000IN';
export const OTHER_INSTANCE_ID = '01K9A0000000000000000000XX';
export const TEST_ORG_ID = '01K9A0000000000000000000RG';
export const TEST_JOB_ID = '01K9A0000000000000000000JB';
export const TEST_SUBJECT = '300000000000000001';

export interface TestKey {
	kid: string;
	x: string;
	privateKey: KeyObject;
}

export function newKey(kid: string): TestKey {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;
	return { kid, x, privateKey };
}

const signer = (key: TestKey) => (bytes: Uint8Array) => new Uint8Array(sign(null, Buffer.from(bytes), key.privateKey));

/** A manifest key entry (a manifest lists `active` and `previous` keys only; `notAfter` ends a key's window). */
function entry(
	key: TestKey,
	purpose: 'intent' | 'entitlement' | 'assertion',
	state: 'active' | 'previous',
	notAfter?: string
) {
	return {
		kty: 'OKP',
		crv: 'Ed25519',
		kid: key.kid,
		x: key.x,
		use: 'sig',
		alg: 'EdDSA',
		ever_purpose: purpose,
		state,
		not_before: '2026-01-01T00:00:00Z',
		...(notAfter ? { not_after: notAfter } : {})
	};
}

export interface TestPlatform {
	root: TestKey;
	active: TestKey;
	previous: TestKey;
	/** A key whose overlap ended (listed as `previous`, past its `not_after`). */
	retired: TestKey;
	entitlement: TestKey;
	/** A key that is in no manifest yet (the next one). */
	next: TestKey;
	/** The key set of the first manifest (without `next`). */
	keySet: KeySet;
	/** The key set of a newer manifest that lists `next` too. */
	refreshed: KeySet;
	/** Unix seconds the manifests were made at. */
	now: number;
}

async function manifest(
	root: TestKey,
	keys: unknown[],
	now: number,
	issuer = TEST_ISSUER
): Promise<{ manifest: string; keys: unknown[] }> {
	const jws = await signCompactJws(
		signer(root),
		{ alg: 'EdDSA', kid: root.kid, typ: 'ever-key-manifest+jwt' },
		{ iss: issuer, iat: now, exp: now + 30 * 86_400, keys_sha256: keysSha256(keys), root_kid: root.kid }
	);
	return { manifest: jws, keys };
}

export async function testPlatform(now = Math.floor(Date.now() / 1000)): Promise<TestPlatform> {
	const root = newKey('ever-202611-0001');
	const active = newKey('ever-202611-0002');
	const previous = newKey('ever-202610-0003');
	const retired = newKey('ever-202609-0004');
	const entitlement = newKey('ever-202611-0005');
	const next = newKey('ever-202612-0006');
	const base = [
		entry(active, 'intent', 'active'),
		entry(previous, 'intent', 'previous'),
		// Retired: its overlap ended a day before the manifest was made.
		entry(retired, 'intent', 'previous', new Date((now - 86_400) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')),
		entry(entitlement, 'entitlement', 'active')
	];
	const rootEntry = { kid: root.kid, x: root.x, iss: TEST_ISSUER };
	const keySet = KeySet.verify(await manifest(root, base, now - 60), {
		issuer: TEST_ISSUER,
		unsafeRootKeys: [rootEntry],
		now
	});
	const refreshed = KeySet.verify(await manifest(root, [...base, entry(next, 'intent', 'active')], now), {
		issuer: TEST_ISSUER,
		unsafeRootKeys: [rootEntry],
		now
	});
	return { root, active, previous, retired, entitlement, next, keySet, refreshed, now };
}

/** The claims of a valid request for this installation (override any of them). */
export function intentClaims(now: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	const jti = (overrides['jti'] as string) ?? '01K9A0000000000000000000JT';
	return {
		iss: TEST_ISSUER,
		aud: INTENT_AUDIENCE,
		jti,
		iat: now - 10,
		exp: now + 890,
		typ: INTENT_CLAIMS_TYP,
		ever_purpose: 'intent',
		job_id: TEST_JOB_ID,
		step_seq: 2,
		idempotency_key: `${TEST_JOB_ID}:2:provision_cloud_tenant:gauzy`,
		org: { id: TEST_ORG_ID, handle: 'acme', display_name: 'Acme', legal_name: 'Acme GmbH', country: 'DE' },
		product: 'gauzy',
		tier: 'starter',
		features: { teams: true },
		person: { ever_id_sub: TEST_SUBJECT },
		instance_id: TEST_INSTANCE_ID,
		mode: 'handoff',
		callback: `${TEST_ISSUER}/v1/provision-intents/${jti}/complete`,
		return_to: 'https://app.ever.co/start/jobs/01K9A0000000000000000000JB',
		...overrides
	};
}

/** Signs a request (compact JWS) with `key`; `header` overrides the protected header. */
export function signIntent(
	key: TestKey,
	claims: Record<string, unknown>,
	header: Record<string, unknown> = {}
): string {
	const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
	const head = encode({ alg: 'EdDSA', kid: key.kid, typ: INTENT_HEADER_TYP, ...header });
	const body = encode(claims);
	const signature = sign(null, Buffer.from(`${head}.${body}`, 'ascii'), key.privateKey).toString('base64url');
	return `${head}.${body}.${signature}`;
}
