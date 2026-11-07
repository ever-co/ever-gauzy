import { createHash } from 'node:crypto';
import {
	LOOKUP_NEGATIVE_MS,
	LOOKUP_POSITIVE_MS,
	LOOKUP_SALT_MS,
	LookupRateLimitedError
} from '../ever-connect-lookup.service';
import { parseLookupRequest } from '../dto/lookup.dto';
import { problem } from '../fixtures/identity-harness';
import {
	LINK_ID,
	LOOKUP_PATH,
	lookupHarness,
	LookupHarness,
	SALT_PATH,
	SALT_V1,
	SALT_V2
} from '../fixtures/lookup-harness';

/** The published hash: sha256(salt bytes ‖ ":" ‖ kind ‖ ":" ‖ normalized), as Ever Platform computes it. */
const hashOf = (salt: string, kind: string, normalized: string) =>
	createHash('sha256').update(Buffer.from(salt, 'base64url')).update(`:${kind}:${normalized}`, 'utf8').digest('hex');

/**
 * The counterparty check: only while the integration is enabled for the organization's link and its
 * entitlement grants the feature; the identifiers are normalised and hashed here by the SDK and
 * never sent in clear; Ever Platform receives the salt version and the hashes with the link's id,
 * nothing else; answers are kept (a day / an hour), and at most 30 checks a minute ask.
 */
describe('the counterparty check', () => {
	let h: LookupHarness;
	const ACME_VAT = hashOf(SALT_V1, 'vat', 'BG123456789');

	beforeEach(async () => {
		h = await lookupHarness();
		h.platform.on(LOOKUP_PATH, (call) => ({
			status: 200,
			body: {
				salt_version: call.body?.['salt_version'],
				matches: ((call.body?.['hashes'] as string[]) ?? [])
					.filter((hash) => hash === ACME_VAT)
					.map((hash) => ({ hash, handle: 'acme', features: ['pay', 'invoice_exchange'] }))
			}
		}));
	});

	afterEach(async () => {
		await h.close();
	});

	const items = (...list: Array<{ kind: string; value: string; country?: string }>) =>
		parseLookupRequest({ items: list }).items;

	it('refuses before anything is sent unless the integration is enabled for the link (403 integration_disabled)', async () => {
		for (const state of [null, 'available', 'disabled', 'revoked_remote', 'denied_by_policy', 'coming_soon']) {
			if (state) await h.setIntegration('counterparty_lookup', false, state);
			await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456789' }))).rejects.toMatchObject({
				status: 403,
				response: { code: 'integration_disabled' }
			});
		}
		expect(h.platform.calls).toEqual([]);
	});

	it('refuses when the entitlement does not grant the feature (403 entitlement_required), and when not connected', async () => {
		await h.setIntegration('counterparty_lookup', true);
		h.features['lookup'] = false;
		await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456789' }))).rejects.toMatchObject({
			status: 403,
			response: { code: 'entitlement_required' }
		});
		h.features['lookup'] = true;
		await h.store.updateConnection({ status: 'disconnected' });
		await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456789' }))).rejects.toMatchObject({
			status: 403,
			response: { code: 'integration_disabled' }
		});
		expect(h.platform.calls).toEqual([]);
	});

	it('EVER_CONNECT_INTEGRATIONS_DENY refuses it at once, whatever the stored state says', async () => {
		await h.close();
		h = await lookupHarness({
			env: {
				ENCRYPTION_KEY: 'lookup-spec-encryption-key-0123456789abcdef',
				EVER_CONNECT_INTEGRATIONS_DENY: 'counterparty_lookup,counterparty_discoverable'
			}
		});
		await h.setIntegration('counterparty_lookup', true);
		await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456789' }))).rejects.toMatchObject({
			status: 403
		});
		expect(h.platform.calls).toEqual([]);
	});

	it('sends the salt version and the hashes only, with the link id; answers the handle of a discoverable organization', async () => {
		await h.setIntegration('counterparty_lookup', true);
		const answer = await h.lookup.check(
			h.scope,
			items(
				{ kind: 'vat', value: ' bg 123 456 789 ' },
				{ kind: 'email', value: '  Billing@Example.COM ' },
				{ kind: 'registration', value: '123 456 789', country: 'BG' }
			)
		);
		expect(answer.items).toEqual([
			{ kind: 'vat', status: 'match', handle: 'acme', features: ['pay', 'invoice_exchange'] },
			{ kind: 'email', status: 'none' },
			{ kind: 'registration', status: 'none' }
		]);
		expect(h.platform.calls.map((call) => `${call.method} ${call.path}`)).toEqual([SALT_PATH, LOOKUP_PATH]);
		const query = h.platform.callsTo(LOOKUP_PATH)[0];
		expect(Object.keys(query.body ?? {}).sort()).toEqual(['hashes', 'salt_version']);
		expect(query.body).toEqual({
			salt_version: 1,
			hashes: [
				ACME_VAT,
				hashOf(SALT_V1, 'email', 'billing@example.com'),
				hashOf(SALT_V1, 'registration', 'BG:123456789')
			]
		});
		expect(query.headers['ever-link-id']).toBe(LINK_ID);
		expect(query.headers['authorization']).toMatch(/^Bearer /);
		const sent = JSON.stringify(h.platform.calls);
		for (const value of ['123 456 789', '123456789', 'Billing@Example', 'billing@example.com']) {
			expect(sent).not.toContain(value);
		}
	});

	it('answers "cannot be checked" for what cannot be normalised, and never sends it', async () => {
		await h.setIntegration('counterparty_lookup', true);
		const answer = await h.lookup.check(
			h.scope,
			items(
				{ kind: 'vat', value: '123456789' },
				{ kind: 'email', value: 'no-at-sign' },
				{ kind: 'vat', value: '   ' }
			)
		);
		expect(answer.items).toEqual([
			{ kind: 'vat', status: 'cannot_be_checked', reason: 'no_country' },
			{ kind: 'email', status: 'cannot_be_checked', reason: 'no_at_sign' },
			{ kind: 'vat', status: 'cannot_be_checked', reason: 'empty' }
		]);
		// Nothing could be checked: not even the salt is read.
		expect(h.platform.calls).toEqual([]);
		// A VAT number without its prefix is checked with the contact's country.
		const withCountry = await h.lookup.check(h.scope, items({ kind: 'vat', value: '123456789', country: 'bg' }));
		expect(withCountry.items).toEqual([
			{ kind: 'vat', status: 'match', handle: 'acme', features: ['pay', 'invoice_exchange'] }
		]);
	});

	it('keeps a match for a day and "none found" for an hour; the salts are read once a day', async () => {
		await h.setIntegration('counterparty_lookup', true);
		const check = () =>
			h.lookup.check(
				h.scope,
				items({ kind: 'vat', value: 'BG123456789' }, { kind: 'email', value: 'x@example.com' })
			);
		await check();
		await check();
		expect(h.platform.callsTo(LOOKUP_PATH)).toHaveLength(1);
		const rows = (await h.dataSource.query('SELECT * FROM "ever_connect_lookup_cache"')) as Array<
			Record<string, unknown>
		>;
		expect(rows).toHaveLength(2);
		expect(rows.every((row) => row['organizationId'] === h.acme.organizationId && row['saltVersion'] === '1')).toBe(
			true
		);
		// After an hour, the negative answer is asked again; the match is still kept.
		h.clock.t += LOOKUP_NEGATIVE_MS + 1;
		await check();
		expect(h.platform.callsTo(LOOKUP_PATH)).toHaveLength(2);
		expect(h.platform.callsTo(LOOKUP_PATH)[1].body?.['hashes']).toEqual([
			hashOf(SALT_V1, 'email', 'x@example.com')
		]);
		// After a day, both; and the salts are read again.
		expect(h.platform.callsTo(SALT_PATH)).toHaveLength(1);
		h.clock.t += Math.max(LOOKUP_POSITIVE_MS, LOOKUP_SALT_MS);
		await check();
		expect(h.platform.callsTo(LOOKUP_PATH)[2].body?.['hashes']).toHaveLength(2);
		expect(h.platform.callsTo(SALT_PATH)).toHaveLength(2);
	});

	it("switching the integration off removes the organization's kept answers", async () => {
		await h.setIntegration('counterparty_lookup', true);
		await h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456789' }));
		expect(await h.dataSource.query('SELECT * FROM "ever_connect_lookup_cache"')).toHaveLength(1);
		h.platform.on('PUT /v1/instances/me/integrations/counterparty_lookup', { status: 200, body: {} });
		await h.states.setEnabled('counterparty_lookup', false, h.scope);
		expect(await h.dataSource.query('SELECT * FROM "ever_connect_lookup_cache"')).toEqual([]);
	});

	it('at most 30 checks a minute per organization ask Ever Platform (429 with the seconds to wait)', async () => {
		await h.setIntegration('counterparty_lookup', true);
		for (let i = 0; i < 30; i++) {
			await h.lookup.check(h.scope, items({ kind: 'email', value: `person${i}@example.com` }));
		}
		const refused = h.lookup.check(h.scope, items({ kind: 'email', value: 'one-more@example.com' }));
		await expect(refused).rejects.toBeInstanceOf(LookupRateLimitedError);
		await expect(refused).rejects.toMatchObject({ status: 429, retryAfterS: 60 });
		expect(h.platform.callsTo(LOOKUP_PATH)).toHaveLength(30);
		// A kept answer needs no slot.
		await expect(
			h.lookup.check(h.scope, items({ kind: 'email', value: 'person0@example.com' }))
		).resolves.toBeDefined();
		h.clock.t += 60_001;
		await expect(
			h.lookup.check(h.scope, items({ kind: 'email', value: 'one-more@example.com' }))
		).resolves.toBeDefined();
	});

	it("Ever Platform's 429 is passed on with its Retry-After; its refusals as 403 with their code", async () => {
		await h.setIntegration('counterparty_lookup', true);
		const limited = problem(429, 'rate_limited');
		h.platform.on(LOOKUP_PATH, { status: 429, body: { ...(limited.body as object), retry_after_s: 17 } });
		await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456789' }))).rejects.toMatchObject({
			status: 429,
			retryAfterS: 17
		});
		h.platform.on(LOOKUP_PATH, problem(403, 'entitlement_required'));
		await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456780' }))).rejects.toMatchObject({
			status: 403,
			response: { code: 'entitlement_required' }
		});
		h.platform.on(LOOKUP_PATH, problem(403, 'integration_disabled'));
		await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456781' }))).rejects.toMatchObject({
			status: 403,
			response: { code: 'integration_disabled' }
		});
		h.platform.offline = true;
		await expect(h.lookup.check(h.scope, items({ kind: 'vat', value: 'BG123456782' }))).rejects.toMatchObject({
			status: 502,
			response: { code: 'platform_unreachable' }
		});
	});

	it('a salt version Ever Platform no longer takes: the salts are read again and the check made once more', async () => {
		await h.setIntegration('counterparty_lookup', true);
		await h.lookup.check(h.scope, items({ kind: 'email', value: 'a@example.com' }));
		let refused = false;
		h.platform.on(LOOKUP_PATH, (call) => {
			if (call.body?.['salt_version'] === 1) {
				refused = true;
				return problem(422, 'salt_version_retired');
			}
			return { status: 200, body: { salt_version: 2, matches: [] } };
		});
		h.publishSalts([{ version: 2, salt: SALT_V2 }]);
		const answer = await h.lookup.check(h.scope, items({ kind: 'email', value: 'b@example.com' }));
		expect(refused).toBe(true);
		expect(answer.items).toEqual([{ kind: 'email', status: 'none' }]);
		expect(h.platform.callsTo(LOOKUP_PATH).at(-1)?.body).toEqual({
			salt_version: 2,
			hashes: [hashOf(SALT_V2, 'email', 'b@example.com')]
		});
	});

	it('during a rotation, checks use the newest salt already active', async () => {
		await h.setIntegration('counterparty_lookup', true);
		h.publishSalts([
			{ version: 1, salt: SALT_V1, active_from: '2026-11-01T00:00:00Z' },
			{ version: 2, salt: SALT_V2, active_from: '2026-11-20T00:00:00Z' }
		]);
		await h.lookup.check(h.scope, items({ kind: 'email', value: 'a@example.com' }));
		expect(h.platform.callsTo(LOOKUP_PATH)[0].body?.['salt_version']).toBe(1);
		h.clock.t = Date.parse('2026-11-21T00:00:00Z');
		await h.lookup.check(h.scope, items({ kind: 'email', value: 'a@example.com' }));
		expect(h.platform.callsTo(LOOKUP_PATH)[1].body?.['salt_version']).toBe(2);
	});

	it('the auto-check option is off by default, kept as a setting of the link, and audited', async () => {
		expect(await h.lookup.autoCheck(h.link)).toBe(false);
		await h.lookup.setAutoCheck(h.scope, true);
		expect(await h.lookup.autoCheck(h.link)).toBe(true);
		const settings = (await h.dataSource.query(
			'SELECT "settingsName", "settingsValue" FROM "integration_setting" WHERE "settingsName" = ?',
			['LOOKUP_AUTO_CHECK']
		)) as Array<{ settingsValue: string }>;
		expect(settings).toEqual([{ settingsName: 'LOOKUP_AUTO_CHECK', settingsValue: 'true' }]);
		await h.lookup.setAutoCheck(h.scope, false);
		expect(await h.lookup.autoCheck(h.link)).toBe(false);
		expect((await h.auditRows()).filter((row) => row.action === 'integration.configure')).toHaveLength(2);
		expect(h.platform.calls).toEqual([]);
	});

	it('the request is checked before anything is read (400 names the field, never the value)', () => {
		expect(() => parseLookupRequest({})).toThrow('items must be a non-empty list.');
		expect(() => parseLookupRequest({ items: [{ kind: 'phone', value: '+359' }] })).toThrow('items[0].kind');
		expect(() => parseLookupRequest({ items: [{ kind: 'vat', value: 'BG1', country: 'Bulgaria' }] })).toThrow(
			'items[0].country must be two letters.'
		);
		expect(() => parseLookupRequest({ items: [{ kind: 'vat', value: 'BG1', note: 'x' }] })).toThrow(
			'unknown field'
		);
		expect(() =>
			parseLookupRequest({ items: Array.from({ length: 101 }, () => ({ kind: 'vat', value: 'x' })) })
		).toThrow('at most 100');
		try {
			parseLookupRequest({ items: [{ kind: 'vat', value: 'x'.repeat(400) }] });
		} catch (error) {
			expect(String((error as Error).message)).not.toContain('xxxx');
		}
	});
});
