// cspell:ignore evit
import { EverConnectProvisionStore } from '../../ever-connect-provision.store';
import { IdentityHarness, identityHarness, INSTANCE_ID, problem } from '../../fixtures/identity-harness';
import {
	COMPLETION_MAX_ATTEMPTS,
	COMPLETION_RETRY_MS,
	EverConnectProvisionCompletion,
	INTENT_RETENTION_MS
} from '../../services/ever-connect-provision-completion.service';

jest.setTimeout(60_000);

const KEY = '01K9A0000000000000000000JB:2:provision_cloud_tenant:gauzy';
const JTI = '01K9A0000000000000000000JT';
const COMPLETE = `POST /v1/provision-intents/${JTI}/complete`;
const LINK_ID = '01K9A0000000000000000000LK';
const ENV = {
	ENCRYPTION_KEY: 'completion-spec-encryption-key-0123456789',
	API_BASE_URL: 'https://api.gauzy.test',
	CLIENT_BASE_URL: 'https://app.gauzy.test'
};

/**
 * The report to Ever Platform that a workspace it asked for exists, through the real SDK client (which
 * checks the request body against the SDK's own schema): the body (ids and addresses only), done on
 * `completed` and `already_completed`, retried with growing waits when Ever Platform cannot be
 * reached, given up after 8 attempts or at a refusal; the link Ever Platform answers is kept.
 */
describe('workspace completion report', () => {
	let h: IdentityHarness;
	let provisions: EverConnectProvisionStore;
	let completion: EverConnectProvisionCompletion;
	let tenantId: string;
	let organizationId: string;
	let integrationTenantId: string;

	beforeEach(async () => {
		h = await identityHarness(ENV);
		await h.connectAndEnable();
		// The installation's links on Ever Platform (none unless a test says otherwise).
		h.platform.on('GET /v1/instances/me', {
			status: 200,
			body: { instance: { id: INSTANCE_ID }, tenant_links: [] }
		});
		provisions = new EverConnectProvisionStore(h.dataSource, h.clock);
		completion = new EverConnectProvisionCompletion(
			provisions,
			h.store,
			h.platformService as never,
			h.audit,
			h.signals,
			h.config,
			undefined,
			undefined,
			h.clock
		);
		// A workspace created for the request, as the creation leaves it.
		await provisions.saveIntent({
			jti: JTI,
			intent: JSON.stringify({ org: { id: '01K9A0000000000000000000RG', handle: 'acme', display_name: 'Acme' } }),
			keyHash: 'a'.repeat(64),
			idempotencyKey: KEY,
			expiresAt: h.clock.now() + 900_000
		});
		const claim = await provisions.claim(
			{ idempotencyKey: KEY, jti: JTI, everOrgId: '01K9A0000000000000000000RG' },
			'holder',
			h.clock.now() + 60_000
		);
		expect(claim.outcome).toBe('claimed');
		tenantId = '2d1c0f8e-0000-4000-8000-000000000001';
		organizationId = '2d1c0f8e-0000-4000-8000-000000000002';
		const runner = h.dataSource.createQueryRunner();
		await runner.connect();
		integrationTenantId = await provisions.writeCreated(
			{ query: (sql, params) => runner.query(sql, params) },
			{
				idempotencyKey: KEY,
				holder: 'holder',
				ids: {
					productTenantId: tenantId,
					productOrgId: organizationId,
					productUserId: '2d1c0f8e-0000-4000-8000-000000000003',
					employeeId: null,
					teamId: null
				},
				catalogId: null,
				settings: {
					EVER_ORG_ID: '01K9A0000000000000000000RG',
					EVER_HANDLE: 'acme',
					EVER_LINK_STATUS: 'linked'
				},
				audit: {
					action: 'provision.accept',
					actorUserId: '2d1c0f8e-0000-4000-8000-000000000003',
					details: { job_id: 'job' }
				}
			}
		);
		await runner.release();
	});

	afterEach(async () => {
		await h.close();
	});

	const row = async () =>
		(await provisions.result(KEY)) as NonNullable<Awaited<ReturnType<EverConnectProvisionStore['result']>>>;

	it('sends ids and addresses only, and keeps the link Ever Platform answers', async () => {
		h.platform.on(COMPLETE, {
			status: 200,
			body: { status: 'completed', job_id: '01K9A0000000000000000000JB', tenant_link_id: LINK_ID }
		});
		await completion.sendDue();
		const [call] = h.platform.callsTo(COMPLETE);
		expect(call.body).toEqual({
			instance_id: INSTANCE_ID,
			product_tenant_id: tenantId,
			product_org_id: organizationId,
			product_user_ref: '2d1c0f8e-0000-4000-8000-000000000003',
			urls: { app: 'https://app.gauzy.test', api: 'https://api.gauzy.test' },
			result: 'created'
		});
		expect(call.headers['authorization']).toMatch(/^Bearer evit_/);
		expect(JSON.stringify(call.body)).not.toContain('@');
		expect(await row()).toMatchObject({ completionState: 'done', completionAttempts: 1, tenantLinkId: LINK_ID });

		const link = await h.store.linkById(LINK_ID);
		expect(link).toMatchObject({
			tenantId,
			organizationId,
			integrationTenantId,
			everOrgId: '01K9A0000000000000000000RG',
			everHandle: 'acme',
			status: 'linked'
		});
		const settings = await h.dataSource.query(
			`SELECT "settingsName", "settingsValue" FROM "integration_setting" WHERE "integrationId" = ?`,
			[integrationTenantId]
		);
		expect(
			Object.fromEntries(settings.map((s: Record<string, string>) => [s['settingsName'], s['settingsValue']]))
		).toMatchObject({
			EVER_LINK_ID: LINK_ID,
			EVER_LINK_STATUS: 'linked'
		});
		expect((await h.auditRows()).map((r) => r.action)).toEqual(['provision.accept', 'link.create']);

		// Done: never sent again.
		await completion.sendDue();
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(1);
	});

	it('a repeat Ever Platform already recorded (already_completed) counts as done; its link is found again', async () => {
		h.platform.on(COMPLETE, { status: 200, body: { status: 'already_completed' } });
		h.platform.on('GET /v1/instances/me', {
			status: 200,
			body: {
				instance: { id: INSTANCE_ID },
				tenant_links: [
					{
						id: '01K9A0000000000000000000XX',
						org_id: '01K9A0000000000000000000ZZ',
						product_tenant_id: tenantId
					},
					{ id: LINK_ID, org_id: '01K9A0000000000000000000RG', product_tenant_id: tenantId }
				]
			}
		});
		await completion.sendNow(KEY);
		expect(await row()).toMatchObject({ completionState: 'done', completionAttempts: 1, tenantLinkId: LINK_ID });
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(1);
		expect(await h.store.linkById(LINK_ID)).toMatchObject({ tenantId, organizationId });
	});

	it('the report right after the creation and the worker never send it twice at once', async () => {
		h.platform.on(COMPLETE, { status: 200, body: { status: 'completed', tenant_link_id: LINK_ID } });
		const other = new EverConnectProvisionCompletion(
			provisions,
			h.store,
			h.platformService as never,
			h.audit,
			h.signals,
			h.config,
			undefined,
			undefined,
			h.clock
		);
		await Promise.all([completion.sendNow(KEY), other.sendDue(), completion.sendDue()]);
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(1);
		expect(await row()).toMatchObject({ completionState: 'done', tenantLinkId: LINK_ID });
	});

	it('Ever Platform unreachable: retried after 1 minute, then longer; done once it answers', async () => {
		h.platform.on(COMPLETE, problem(503, 'unavailable'));
		await completion.sendDue();
		expect(await row()).toMatchObject({
			completionState: 'pending',
			completionAttempts: 1,
			completionNextAt: h.clock.now() + 60_000
		});
		// Not due yet: nothing is sent.
		await completion.sendDue();
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(1);
		h.clock.t += 60_000;
		await completion.sendDue();
		expect(await row()).toMatchObject({
			completionState: 'pending',
			completionAttempts: 2,
			completionNextAt: h.clock.now() + 4 * 60_000
		});
		h.clock.t += 4 * 60_000;
		h.platform.on(COMPLETE, { status: 200, body: { status: 'completed', tenant_link_id: LINK_ID } });
		await completion.sendDue();
		expect(await row()).toMatchObject({ completionState: 'done', completionAttempts: 3 });
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(3);
	});

	it('a link found nowhere keeps the report open, without asking Ever Platform again, until it is found or given up', async () => {
		// A repeat whose first answer was lost: told "already completed", with no id, and no such link listed yet.
		h.platform.on(COMPLETE, { status: 200, body: { status: 'already_completed' } });
		await completion.sendDue();
		expect(await row()).toMatchObject({
			completionState: 'pending',
			completionAttempts: 1,
			completionError: 'link_not_found',
			completionNextAt: h.clock.now() + 60_000,
			tenantLinkId: null
		});
		expect((await row()).completedAt).toEqual(expect.any(Number));
		expect(await h.store.linkById(LINK_ID)).toBeNull();

		// Listed later: kept, and only now done.
		h.clock.t += 60_000;
		h.platform.on('GET /v1/instances/me', {
			status: 200,
			body: {
				instance: { id: INSTANCE_ID },
				tenant_links: [{ id: LINK_ID, org_id: '01K9A0000000000000000000RG', product_tenant_id: tenantId }]
			}
		});
		await completion.sendDue();
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(1);
		expect(await row()).toMatchObject({ completionState: 'done', completionAttempts: 2, tenantLinkId: LINK_ID });
		expect(await h.store.linkById(LINK_ID)).toMatchObject({ tenantId, organizationId, status: 'linked' });
	});

	it(`a link never found is given up after ${COMPLETION_MAX_ATTEMPTS} attempts, never reported done`, async () => {
		h.platform.on(COMPLETE, { status: 200, body: { status: 'already_completed' } });
		for (let attempt = 1; attempt <= COMPLETION_MAX_ATTEMPTS; attempt++) {
			await completion.sendDue();
			const current = await row();
			if (current.completionNextAt !== null) h.clock.t = current.completionNextAt;
		}
		expect(await row()).toMatchObject({
			completionState: 'failed',
			completionAttempts: COMPLETION_MAX_ATTEMPTS,
			completionNextAt: null,
			completionError: 'link_not_found'
		});
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(1);
	});

	it(`gives up after ${COMPLETION_MAX_ATTEMPTS} attempts, the waits growing from 1 minute to 4 hours`, async () => {
		expect(COMPLETION_RETRY_MS[0]).toBe(60_000);
		expect(COMPLETION_RETRY_MS[COMPLETION_RETRY_MS.length - 1]).toBe(4 * 3_600_000);
		h.platform.offline = true;
		const waits: number[] = [];
		for (let attempt = 1; attempt <= COMPLETION_MAX_ATTEMPTS; attempt++) {
			// Not due a moment before its time: nothing is sent.
			await completion.sendDue();
			const current = await row();
			if (current.completionNextAt === null) break;
			waits.push(current.completionNextAt - h.clock.now());
			h.clock.t = current.completionNextAt - 1;
			await completion.sendDue();
			expect(h.platform.callsTo(COMPLETE)).toHaveLength(attempt);
			h.clock.t += 1;
		}
		expect(waits).toEqual([60_000, 4 * 60_000, 15 * 60_000, 30 * 60_000, 3_600_000, 2 * 3_600_000, 4 * 3_600_000]);
		expect(await row()).toMatchObject({ completionState: 'failed', completionAttempts: 8, completionNextAt: null });
		await completion.sendDue();
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(8);
	});

	it('the link answered is kept before the report is done; a failure to keep it is retried without asking Ever Platform again', async () => {
		h.platform.on(COMPLETE, { status: 200, body: { status: 'completed', tenant_link_id: LINK_ID } });
		const insertLink = jest.spyOn(h.store, 'insertLink').mockRejectedValueOnce(new Error('database timeout'));
		await completion.sendDue();
		expect(await row()).toMatchObject({
			completionState: 'pending',
			completionAttempts: 1,
			tenantLinkId: LINK_ID,
			completionError: 'link_Error'
		});
		expect((await row()).completedAt).toEqual(expect.any(Number));
		expect(await h.store.linkById(LINK_ID)).toBeNull();

		h.clock.t += 60_000;
		await completion.sendDue();
		expect(h.platform.callsTo(COMPLETE)).toHaveLength(1);
		expect(insertLink).toHaveBeenCalledTimes(2);
		expect(await row()).toMatchObject({ completionState: 'done', completionAttempts: 2 });
		expect(await h.store.linkById(LINK_ID)).toMatchObject({ tenantId, organizationId, status: 'linked' });
		expect((await h.auditRows()).map((r) => r.action)).toEqual(['provision.accept', 'link.create']);
	});

	it('a request is removed a day after it ended, unless its workspace report is still open', async () => {
		const stored = () => provisions.intent(JTI);
		h.platform.on(COMPLETE, problem(503, 'unavailable'));
		await completion.sendDue();
		expect(await row()).toMatchObject({ completionState: 'pending', completionAttempts: 1 });

		// Long past its end, with the report still open: it stays, the report reads the handle from it.
		h.clock.t += INTENT_RETENTION_MS + 3_600_000;
		await completion.sendDue();
		expect(await stored()).not.toBeNull();

		// The report ends: the request goes at the next removal.
		h.platform.on(COMPLETE, { status: 200, body: { status: 'completed', tenant_link_id: LINK_ID } });
		h.clock.t += 4 * 3_600_000;
		await completion.sendDue();
		expect(await row()).toMatchObject({ completionState: 'done' });
		h.clock.t += 3_600_000;
		await completion.sendDue();
		expect(await stored()).toBeNull();
		// The result row stays: replays are told by it.
		expect(await row()).toMatchObject({ jti: JTI, status: 'created' });
	});

	it('a request nobody confirmed goes a day after it ended; one still valid stays', async () => {
		const save = (jti: string, expiresAt: number) =>
			provisions.saveIntent({
				jti,
				intent: JSON.stringify({ person: { ever_id_sub: 'someone' } }),
				keyHash: jti.padEnd(64, '0').slice(0, 64),
				idempotencyKey: `other:${jti}`,
				expiresAt
			});
		const ended = '01K9A0000000000000000000E1';
		const valid = '01K9A0000000000000000000V1';
		await save(ended, h.clock.now() - INTENT_RETENTION_MS - 1);
		await save(valid, h.clock.now() + 60_000);
		expect(await provisions.purgeEndedIntents(h.clock.now() - INTENT_RETENTION_MS)).toBe(1);
		expect(await provisions.intent(ended)).toBeNull();
		expect(await provisions.intent(valid)).not.toBeNull();
	});

	it('a refusal is final, kept as a code', async () => {
		h.platform.on(COMPLETE, problem(422, 'validation_failed'));
		await completion.sendDue();
		expect(await row()).toMatchObject({
			completionState: 'failed',
			completionAttempts: 1,
			completionError: '422_validation_failed'
		});
	});

	it('nothing is sent while the installation is not connected', async () => {
		await h.store.updateConnection({ status: 'disconnected' });
		await completion.sendDue();
		await completion.sendNow(KEY);
		expect(h.platform.calls).toEqual([]);
		expect(await row()).toMatchObject({ completionState: 'pending', completionAttempts: 0 });
	});
});
