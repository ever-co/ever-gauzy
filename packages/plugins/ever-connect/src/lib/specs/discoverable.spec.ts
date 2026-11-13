import { createHash } from 'node:crypto';
import { problem } from '../fixtures/identity-harness';
import {
	IDENTIFIERS_DELETE,
	IDENTIFIERS_PUT,
	INTEGRATION_PUT,
	INTEGRATIONS_GET,
	LINK_ID,
	lookupHarness,
	LookupHarness,
	SALT_PATH,
	SALT_V1,
	SALT_V2,
	setOrganizationIdentifiers
} from '../fixtures/lookup-harness';
import {
	EverConnectOrganizationIdentifierSubscriber,
	ORGANIZATION_IDENTIFIER_CHANGED,
	OrganizationIdentifierChange
} from '../subscribers/organization-identifier.subscriber';

const hashOf = (salt: string, normalized: string) =>
	createHash('sha256').update(Buffer.from(salt, 'base64url')).update(`:vat:${normalized}`, 'utf8').digest('hex');

/** Lets the subscriber's signal reach the handler (it runs on the next turns of the event loop). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/**
 * Being findable by partners who already know the organization's tax id: nothing is computed or
 * sent before the organization opted in (in app.ever.co) with the feature granted; then the tax id
 * is uploaded as salted hashes once, again on each change and under each new salt version, and the
 * upload is removed when it is switched off (again at the next heartbeat when Ever Platform could
 * not be reached).
 */
describe('discoverability', () => {
	let h: LookupHarness;
	const subscriber = new EverConnectOrganizationIdentifierSubscriber();
	const ACME = 'BG123456789';

	beforeEach(async () => {
		h = await lookupHarness();
		h.platform.on(IDENTIFIERS_PUT, (call) => ({
			status: 200,
			body: {
				items: ((call.body?.['hashes'] as unknown[]) ?? []).map((_, i) => ({
					id: `01JNE7V9J03J6XQ2WN8H0Z8ID${i}`,
					kind: 'vat',
					discoverable: true,
					provenance: 'instance',
					created_at: '2026-11-07T10:00:00Z'
				}))
			}
		}));
		h.platform.on(IDENTIFIERS_DELETE, { status: 204 });
	});

	afterEach(async () => {
		await h.close();
	});

	/** What Gauzy's ORM does when the organization's tax id is saved (through the module's subscriber). */
	async function saveTaxId(taxId: string | null, country?: string): Promise<void> {
		await setOrganizationIdentifiers(h, { taxId, ...(country ? { country } : {}) });
		const entity = { id: h.acme.organizationId, tenantId: h.acme.tenantId, taxId } as never;
		await subscriber.beforeEntityUpdate(entity, undefined, ['taxId', 'updatedAt']);
		await subscriber.afterEntityUpdate(entity);
		await settle();
	}

	it('a tax id change without the opt-in computes nothing and sends nothing', async () => {
		await saveTaxId(ACME);
		await h.setIntegration('counterparty_discoverable', false, 'available');
		await saveTaxId('BG000000000');
		await h.states.retryPending();
		expect(h.platform.calls).toEqual([]);
	});

	it('the subscriber signals only a write that changes the tax id', async () => {
		const seen: OrganizationIdentifierChange[] = [];
		const subscription = ORGANIZATION_IDENTIFIER_CHANGED.subscribe((change) => seen.push(change));
		const entity = { id: 'org', tenantId: 'tenant', taxId: 'X', name: 'Acme' } as never;
		await subscriber.beforeEntityUpdate(entity, undefined, ['name']);
		await subscriber.afterEntityUpdate(entity);
		expect(seen).toEqual([]);
		await subscriber.beforeEntityUpdate(entity, undefined, ['name', 'taxId']);
		await subscriber.afterEntityUpdate(entity);
		// A query builder update reports no changed properties: its entity holds what it sets.
		const partial = { id: 'org', tenantId: 'tenant', taxId: null } as never;
		await subscriber.beforeEntityUpdate(partial, undefined, undefined);
		await subscriber.afterEntityUpdate(partial);
		subscription.unsubscribe();
		expect(seen).toEqual([
			{ tenantId: 'tenant', organizationId: 'org', taxId: 'X' },
			{ tenantId: 'tenant', organizationId: 'org', taxId: null }
		]);
	});

	it('with the opt-in, a tax id change sends exactly one PUT of the salted hashes (the salt read once a day)', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		await saveTaxId(' bg 123.456.789 ');
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(1);
		expect(h.platform.callsTo(IDENTIFIERS_PUT)[0].body).toEqual({
			hashes: [{ kind: 'vat', salt_version: 1, hash: hashOf(SALT_V1, ACME) }]
		});
		expect(JSON.stringify(h.platform.calls)).not.toContain('123');
		expect(h.platform.calls.map((call) => `${call.method} ${call.path}`)).toEqual([SALT_PATH, IDENTIFIERS_PUT]);
		const audit = await h.auditRows();
		expect(audit.find((row) => row.action === 'identifiers.push')?.details).toEqual({ link_id: LINK_ID, count: 1 });
	});

	it('a tax id without its country prefix takes the country of the organization; one that cannot be read is not sent', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		await saveTaxId('123456789', 'BG');
		expect(h.platform.callsTo(IDENTIFIERS_PUT)[0].body).toEqual({
			hashes: [{ kind: 'vat', salt_version: 1, hash: hashOf(SALT_V1, ACME) }]
		});
		// Cleared: the upload is removed.
		await saveTaxId(null);
		expect(h.platform.callsTo(IDENTIFIERS_DELETE)).toHaveLength(1);
		// No prefix and no country: nothing to send, nothing to remove.
		await saveTaxId('123456789');
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(1);
		expect(h.platform.callsTo(IDENTIFIERS_DELETE)).toHaveLength(1);
	});

	it('without the feature in the entitlement, nothing is sent', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		h.features['discoverability'] = false;
		await saveTaxId(ACME);
		await h.states.retryPending();
		expect(h.platform.calls).toEqual([]);
	});

	it('enabled in app.ever.co (the event feed, then the states): uploaded once', async () => {
		await setOrganizationIdentifiers(h, { taxId: ACME });
		h.platform.on(INTEGRATIONS_GET, {
			status: 200,
			body: {
				instance: {},
				links: {
					[LINK_ID]: {
						counterparty_discoverable: {
							enabled: true,
							state: 'enabled',
							consent_id: '01JD0000000000000000000CNS',
							scope_version: 1
						}
					}
				}
			}
		});
		await h.states.sync({ force: true });
		await h.states.sync({ force: true });
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(1);
		expect((await h.store.integration(LINK_ID, 'counterparty_discoverable'))?.state).toBe('enabled');
		// The audit records the enable and the upload, ids only.
		const actions = (await h.auditRows()).map((row) => row.action);
		expect(actions).toEqual(expect.arrayContaining(['integration.enable', 'identifiers.push']));
	});

	it('switched off while Ever Platform cannot be reached: pending_remote_revoke, and the next heartbeat sends the DELETE', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		await saveTaxId(ACME);
		h.platform.offline = true;
		const view = await h.states.setEnabled('counterparty_discoverable', false, h.scope);
		expect(view).toMatchObject({ state: 'disabled', pending_remote_revoke: true });
		expect(h.platform.callsTo(IDENTIFIERS_DELETE)).toHaveLength(1);
		h.platform.offline = false;
		h.platform.on(INTEGRATION_PUT('counterparty_discoverable'), { status: 200, body: {} });
		const before = h.platform.calls.length;
		await h.states.retryPending();
		const after = h.platform.calls.slice(before).map((call) => `${call.method} ${call.path}`);
		// The removal first (while it is still on there), then Ever Platform is told it is off.
		expect(after).toEqual([IDENTIFIERS_DELETE, INTEGRATION_PUT('counterparty_discoverable')]);
		expect((await h.store.integration(LINK_ID, 'counterparty_discoverable'))?.pendingRemoteRevoke).toBe(false);
		// Nothing more at the following heartbeat.
		await h.states.retryPending();
		expect(h.platform.calls.length).toBe(before + 2);
		expect((await h.auditRows()).map((row) => row.action)).toContain('identifiers.delete');
	});

	it('revoked in app.ever.co (the event feed): the upload is removed', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		await saveTaxId(ACME);
		h.platform.on(INTEGRATIONS_GET, {
			status: 200,
			body: {
				instance: {},
				links: {
					[LINK_ID]: {
						counterparty_discoverable: {
							enabled: false,
							state: 'revoked',
							consent_id: '01JD0000000000000000000CNS'
						}
					}
				}
			}
		});
		await h.states.sync({ force: true });
		expect((await h.store.integration(LINK_ID, 'counterparty_discoverable'))?.state).toBe('revoked_remote');
		expect(h.platform.callsTo(IDENTIFIERS_DELETE)).toHaveLength(1);
	});

	it('a new salt version: at the next heartbeat the tax id is hashed and uploaded under each active version', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		await saveTaxId(ACME);
		await h.states.retryPending();
		// Same salts: nothing uploaded again (the salts are read once a heartbeat).
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(1);
		h.publishSalts([
			{ version: 1, salt: SALT_V1 },
			{ version: 2, salt: SALT_V2, active_from: '2026-12-01T00:00:00Z' }
		]);
		await h.states.retryPending();
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(2);
		expect(h.platform.callsTo(IDENTIFIERS_PUT)[1].body).toEqual({
			hashes: [
				{ kind: 'vat', salt_version: 1, hash: hashOf(SALT_V1, ACME) },
				{ kind: 'vat', salt_version: 2, hash: hashOf(SALT_V2, ACME) }
			]
		});
		await h.states.retryPending();
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(2);
	});

	it('a cleared tax id whose removal did not go through is removed at the next heartbeat, discoverability still on', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		await saveTaxId(ACME);
		h.platform.offline = true;
		await saveTaxId(null);
		h.platform.offline = false;
		expect(h.platform.callsTo(IDENTIFIERS_DELETE)).toHaveLength(1);
		await h.states.retryPending();
		expect(h.platform.callsTo(IDENTIFIERS_DELETE)).toHaveLength(2);
		const state = h.discoverable.read((await h.store.integration(LINK_ID, 'counterparty_discoverable'))!);
		expect(state).toEqual({ pushed: [], digest: null, pending: null });
		await h.states.retryPending();
		expect(h.platform.callsTo(IDENTIFIERS_DELETE)).toHaveLength(2);
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(1);
	});

	it('changes are uploaded in the order they were saved; the heartbeat uploads what the organization holds now', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		await setOrganizationIdentifiers(h, { taxId: 'BG000000002' });
		const change = (taxId: string) =>
			h.discoverable.identifierChanged({
				tenantId: h.acme.tenantId,
				organizationId: h.acme.organizationId,
				taxId
			});
		await Promise.all([change('BG000000001'), change('BG000000002')]);
		const bodies = h.platform.callsTo(IDENTIFIERS_PUT).map((call) => call.body);
		expect(bodies).toEqual([
			{ hashes: [{ kind: 'vat', salt_version: 1, hash: hashOf(SALT_V1, 'BG000000001') }] },
			{ hashes: [{ kind: 'vat', salt_version: 1, hash: hashOf(SALT_V1, 'BG000000002') }] }
		]);
		// A change this process did not see (another API process, a direct database write): the next
		// heartbeat uploads what the organization holds.
		await setOrganizationIdentifiers(h, { taxId: ACME });
		await h.states.retryPending();
		expect(h.platform.callsTo(IDENTIFIERS_PUT).at(-1)?.body).toEqual({
			hashes: [{ kind: 'vat', salt_version: 1, hash: hashOf(SALT_V1, ACME) }]
		});
		expect(h.platform.callsTo(IDENTIFIERS_PUT)).toHaveLength(3);
	});

	it('an upload that did not go through is sent again at the next heartbeat; one Ever Platform refuses as claimed is not', async () => {
		await h.setIntegration('counterparty_discoverable', true);
		h.platform.offline = true;
		await saveTaxId(ACME);
		h.platform.offline = false;
		await h.states.retryPending();
		const puts = h.platform.callsTo(IDENTIFIERS_PUT);
		expect(puts[puts.length - 1].body).toEqual({
			hashes: [{ kind: 'vat', salt_version: 1, hash: hashOf(SALT_V1, ACME) }]
		});

		h.platform.on(IDENTIFIERS_PUT, problem(409, 'identifier_claimed'));
		await saveTaxId('BG000000001');
		const count = h.platform.callsTo(IDENTIFIERS_PUT).length;
		await h.states.retryPending();
		expect(h.platform.callsTo(IDENTIFIERS_PUT).length).toBe(count);
	});
});
