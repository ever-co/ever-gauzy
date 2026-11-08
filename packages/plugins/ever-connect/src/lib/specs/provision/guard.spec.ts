import { NotFoundException } from '@nestjs/common';
import { KeySet } from '@ever-co/connect-sdk';
import {
	intentClaims,
	OTHER_INSTANCE_ID,
	signIntent,
	TEST_INSTANCE_ID,
	TEST_ISSUER,
	TestPlatform,
	testPlatform
} from '../../fixtures/provision-intents';
import { EverConnectProvisionGuard } from '../../guards/ever-connect-provision.guard';
import {
	IntentExpectations,
	IntentKeySource,
	IntentRefusedError,
	returnToAllowed,
	verifyProvisionIntent
} from '../../services/ever-connect-intent-verifier.service';

jest.setTimeout(30_000);

/**
 * The checks of a provisioning request, in their fail-closed order: every refusal is the same 401
 * `intent_invalid` (no detail reaches the caller), except a request for another product (422
 * `product_mismatch`). Keys come from a root-verified manifest (the SDK's own `KeySet.verify`): only
 * purpose `intent`, state `active` or `previous`; an unknown `kid` refreshes the manifest once.
 */
describe('provisioning request verification', () => {
	let platform: TestPlatform;
	let refreshes: number;

	beforeAll(async () => {
		platform = await testPlatform();
	});

	beforeEach(() => {
		refreshes = 0;
	});

	const rootOf = () => ({ kid: platform.root.kid, x: platform.root.x, iss: TEST_ISSUER });

	/** A key source over a fresh copy of the first manifest, whose refresh answers the newer one. */
	function source(): IntentKeySource {
		let current = KeySet.restore(platform.keySet.toJSON(), {
			issuer: TEST_ISSUER,
			unsafeRootKeys: [rootOf()],
			now: platform.now
		});
		return {
			keys: async () => current,
			refresh: async () => {
				refreshes += 1;
				current = platform.refreshed;
				return current;
			}
		};
	}

	const expected = (overrides: Partial<IntentExpectations> = {}): IntentExpectations => ({
		issuer: TEST_ISSUER,
		apiUrl: TEST_ISSUER,
		instanceId: TEST_INSTANCE_ID,
		// Later than the SDK's unknown-kid cooldown after the manifest was fetched.
		now: platform.now + 3_600,
		...overrides
	});

	const claimsAt = (overrides: Record<string, unknown> = {}) => intentClaims(platform.now + 3_600, overrides);

	async function refused(jws: unknown, overrides: Partial<IntentExpectations> = {}): Promise<IntentRefusedError> {
		try {
			await verifyProvisionIntent(jws, source(), expected(overrides));
		} catch (error) {
			expect(error).toBeInstanceOf(IntentRefusedError);
			return error as IntentRefusedError;
		}
		throw new Error('The request was accepted.');
	}

	async function expectInvalid(jws: unknown, overrides: Partial<IntentExpectations> = {}): Promise<string> {
		const error = await refused(jws, overrides);
		expect({ status: error.getStatus(), code: error.code }).toEqual({ status: 401, code: 'intent_invalid' });
		return error.reason;
	}

	it('accepts a request signed with the active intent key, and answers its claims', async () => {
		const claims = await verifyProvisionIntent(signIntent(platform.active, claimsAt()), source(), expected());
		expect(claims.org).toEqual({
			id: '01K9A0000000000000000000RG',
			handle: 'acme',
			display_name: 'Acme',
			legal_name: 'Acme GmbH',
			country: 'DE'
		});
		expect(claims.person.ever_id_sub).toBe('300000000000000001');
		expect(claims.idempotency_key).toBe('01K9A0000000000000000000JB:2:provision_cloud_tenant:gauzy');
		expect(refreshes).toBe(0);
	});

	it('accepts a key in its overlap (previous), and a request that names no installation', async () => {
		const claims = claimsAt();
		delete claims['instance_id'];
		await expect(
			verifyProvisionIntent(signIntent(platform.previous, claims), source(), expected())
		).resolves.toBeDefined();
	});

	it('accepts the consent Ever Platform holds for the hand-off', async () => {
		const claims = claimsAt({ consent_id: '01K9A0000000000000000000CN' });
		const verified = await verifyProvisionIntent(signIntent(platform.active, claims), source(), expected());
		expect(verified.consent_id).toBe('01K9A0000000000000000000CN');
	});

	it('refuses a retired key and a key of another purpose, without a refresh (both are listed)', async () => {
		expect(await expectInvalid(signIntent(platform.retired, claimsAt()))).toBe('unknown_kid');
		expect(await expectInvalid(signIntent(platform.entitlement, claimsAt()))).toBe('unknown_kid');
		expect(refreshes).toBe(0);
	});

	it('an unknown kid refreshes the manifest exactly once, then verifies with the new key', async () => {
		await expect(
			verifyProvisionIntent(signIntent(platform.next, claimsAt()), source(), expected())
		).resolves.toBeDefined();
		expect(refreshes).toBe(1);
	});

	it('an unknown kid the refreshed manifest does not list either is refused after one refresh', async () => {
		const stranger = { ...platform.next, kid: 'ever-202612-ffff' };
		expect(await expectInvalid(signIntent(stranger, claimsAt()))).toBe('unknown_kid');
		expect(refreshes).toBe(1);
	});

	it('no refresh inside the cooldown after a fetch', async () => {
		const stranger = { ...platform.next, kid: 'ever-202612-eeee' };
		expect(await expectInvalid(signIntent(stranger, claimsAt()), { now: platform.now + 5 })).toBe('unknown_kid');
		expect(refreshes).toBe(0);
	});

	it.each([
		['the header typ of an earlier draft', { typ: 'ever-provision-intent+jwt' }, 'bad_typ'],
		['the claim-set name as header typ', { typ: 'ever.provision_intent.v1' }, 'bad_typ'],
		['alg none', { alg: 'none' }, 'bad_alg'],
		['alg HS256', { alg: 'HS256' }, 'bad_alg'],
		['a crit header', { crit: ['exp'] }, 'bad_alg'],
		['no kid', { kid: undefined }, 'unknown_kid']
	])('refuses %s', async (_name, header, reason) => {
		expect(await expectInvalid(signIntent(platform.active, claimsAt(), header))).toBe(reason);
	});

	it('refuses a changed payload (bad signature) and malformed documents', async () => {
		const [head, , signature] = signIntent(platform.active, claimsAt()).split('.');
		const forged = Buffer.from(JSON.stringify(claimsAt({ tier: 'enterprise' }))).toString('base64url');
		expect(await expectInvalid(`${head}.${forged}.${signature}`)).toBe('bad_signature');
		for (const jws of [undefined, 42, '', 'a.b', 'a.b.c.d', `${head}..${signature}`, 'x'.repeat(70_000)]) {
			await expectInvalid(jws);
		}
	});

	it.each([
		['another issuer', { iss: 'https://api.other.test' }, 'issuer_mismatch'],
		['another product audience (Works)', { aud: 'ever-connect:works' }, 'audience_mismatch'],
		['another installation', { instance_id: OTHER_INSTANCE_ID }, 'instance_mismatch'],
		['another claim-set version', { typ: 'ever.provision_intent.v2' }, 'schema_violation'],
		['another purpose', { ever_purpose: 'entitlement' }, 'schema_violation'],
		['an extra claim (an e-mail)', { email: 'owner@example.test' }, 'schema_violation'],
		['a consent id that is not a ULID', { consent_id: 'owner@example.test' }, 'schema_violation'],
		['a consent id that is not a string', { consent_id: 42 }, 'schema_violation'],
		[
			'an e-mail in the person',
			{ person: { ever_id_sub: '300000000000000001', email: 'owner@example.test' } },
			'schema_violation'
		],
		['the headless mode', { mode: 'headless' }, 'mode'],
		[
			'a callback elsewhere',
			{ callback: 'https://evil.test/v1/provision-intents/01K9A0000000000000000000JT/complete' },
			'callback'
		],
		[
			'a callback for another jti',
			{ callback: `${TEST_ISSUER}/v1/provision-intents/01K9A0000000000000000000ZZ/complete` },
			'callback'
		],
		['a return address off Ever', { return_to: 'https://evil.test/start' }, 'return_to'],
		['a return address over http', { return_to: 'http://app.ever.co/start' }, 'return_to'],
		['an org id that is not a ULID', { org: { id: 'acme', handle: 'acme', display_name: 'Acme' } }, 'org'],
		['a step that is not a number', { step_seq: '2' }, 'schema_violation'],
		['a feature that is not a switch', { features: { teams: 'yes' } }, 'schema_violation'],
		['an unknown feature', { features: { works: true } }, 'schema_violation'],
		[
			'a billing reference that is not a customer',
			{ billing: { stripe_customer_ref: 'card_123' } },
			'schema_violation'
		]
	])('refuses %s', async (_name, overrides, reason) => {
		expect(await expectInvalid(signIntent(platform.active, claimsAt(overrides as Record<string, unknown>)))).toBe(
			reason
		);
	});

	it('refuses a lifetime over 15 minutes, an expired request and one issued in the future', async () => {
		const now = platform.now + 3_600;
		expect(await expectInvalid(signIntent(platform.active, claimsAt({ iat: now - 10, exp: now + 891 })))).toBe(
			'lifetime'
		);
		expect(await expectInvalid(signIntent(platform.active, claimsAt({ iat: now - 900, exp: now - 1 })))).toBe(
			'expired'
		);
		expect(await expectInvalid(signIntent(platform.active, claimsAt({ iat: now + 301, exp: now + 900 })))).toBe(
			'not_yet_valid'
		);
		// Five minutes of clock difference are tolerated.
		await expect(
			verifyProvisionIntent(
				signIntent(platform.active, claimsAt({ iat: now + 299, exp: now + 900 })),
				source(),
				expected()
			)
		).resolves.toBeDefined();
	});

	it('a request for another product with this audience is 422 product_mismatch', async () => {
		const error = await refused(signIntent(platform.active, claimsAt({ product: 'works' })));
		expect({ status: error.getStatus(), code: error.code }).toEqual({ status: 422, code: 'product_mismatch' });
	});

	it('accepts the optional billing reference and a request without features.teams', async () => {
		const claims = claimsAt({ billing: { stripe_customer_ref: 'cus_TEST123' }, features: {} });
		await expect(
			verifyProvisionIntent(signIntent(platform.active, claims), source(), expected())
		).resolves.toMatchObject({
			billing: { stripe_customer_ref: 'cus_TEST123' }
		});
	});

	it('return addresses: app.ever.co and its stage and development hosts; local ones only for a local platform', () => {
		expect(returnToAllowed('https://app.ever.co/start')).toBe(true);
		expect(returnToAllowed('https://app-stage.ever.co/start')).toBe(true);
		expect(returnToAllowed('https://app-dev.ever.co/start?job=1')).toBe(true);
		expect(returnToAllowed('https://app.ever.co.evil.test/start')).toBe(false);
		expect(returnToAllowed('https://user:pw@app.ever.co/start')).toBe(false);
		expect(returnToAllowed('http://localhost:3030/start')).toBe(false);
		expect(returnToAllowed('http://localhost:3030/start', true)).toBe(true);
	});
});

/** Every provisioning route answers 404 unless the module, the switch, the sign-in plugin and the connection are all there. */
describe('EverConnectProvisionGuard', () => {
	const guard = (options: { env?: string; available?: boolean; status?: string; instance?: string | null }) =>
		new EverConnectProvisionGuard(
			{ available: options.available ?? true } as never,
			{
				connection: async () => ({
					status: options.status ?? 'connected',
					platformInstanceId: options.instance === undefined ? TEST_INSTANCE_ID : options.instance
				})
			} as never,
			{ EVER_CONNECT_ENABLED: options.env ?? 'true' }
		);

	it('lets a request through on a connected installation with the switch on', async () => {
		await expect(guard({}).canActivate()).resolves.toBe(true);
	});

	it.each([
		['the module off', { env: 'false' }],
		['the switch off or the sign-in plugin absent', { available: false }],
		['not connected', { status: 'disconnected' }],
		['waiting for approval', { status: 'pending_approval' }],
		['no Registry id', { instance: null }]
	])('404 with %s', async (_name, options) => {
		await expect(guard(options).canActivate()).rejects.toBeInstanceOf(NotFoundException);
	});
});
