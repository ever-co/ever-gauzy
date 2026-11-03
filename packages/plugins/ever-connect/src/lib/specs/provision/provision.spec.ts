import { HttpException } from '@nestjs/common';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OWNER_EMAIL, provisionHarness, ProvisionHarness, sha256 } from '../../fixtures/provision-harness';
import { TEST_JOB_ID, TEST_ORG_ID } from '../../fixtures/provision-intents';
import { EverConnectProvisionGate, KNOWN_TIERS } from '../../services/ever-connect-provision-gate.service';

jest.setTimeout(60_000);

const OTHER_SUBJECT = '300000000000000999';

/** The status and code of what a call threw. */
async function failure(promise: Promise<unknown>): Promise<{ status: number; code: string }> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(HttpException);
		const http = error as HttpException;
		const body = http.getResponse() as { code?: string };
		return { status: http.getStatus(), code: body?.code ?? '' };
	}
	throw new Error('The call succeeded.');
}

/**
 * Creating a workspace from Ever, on a real database with stand-ins for the request verifier and the
 * Ever ID sign-in plugin: the one-time keys, the identity binding, idempotency and replays, what is
 * written (and that nothing is written when it fails), and the entitlement check.
 */
describe('creating a workspace from Ever', () => {
	let h: ProvisionHarness;

	beforeEach(async () => {
		h = await provisionHarness();
	});

	afterEach(async () => {
		await h.close();
	});

	describe('preflight', () => {
		it('keeps the verified request under a new one-time key: only its digest is stored, and no e-mail', async () => {
			const jws = h.request();
			const answer = await h.service.preflight(jws);
			expect(answer).toEqual({
				ok: true,
				org_display_name: 'Acme',
				handle: 'acme',
				product_tenant_exists: false,
				sign_in_required: true,
				provision_key: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/)
			});
			const [row] = await h.rows('ever_connect_provision_intent');
			expect(row['jti']).toBe('01K9A0000000000000000000JT');
			expect(row['status']).toBe('pending');
			expect(row['keyHash']).toBe(sha256(answer.provision_key));
			expect(JSON.stringify(row)).not.toContain(answer.provision_key);
			expect(JSON.stringify(row)).not.toContain('@');
			expect(row['expiresAt']).toBe((h.nowS() + 890) * 1000);
			// Nothing else is written.
			expect(await h.rows('ever_connect_provision_result')).toEqual([]);
			expect(await h.rows('integration_tenant')).toEqual([]);
		});

		it('the same request again answers a new key; the older key stops working', async () => {
			const jws = h.request();
			const first = await h.signedIn(jws);
			const second = await h.signedIn(jws);
			expect(second.provisionKey).not.toBe(first.provisionKey);
			expect(await h.rows('ever_connect_provision_intent')).toHaveLength(1);
			expect(await failure(h.service.summary(first.provisionKey, first.handoffKey))).toEqual({
				status: 401,
				code: 'intent_invalid'
			});
			await expect(h.service.summary(second.provisionKey, second.handoffKey)).resolves.toMatchObject({
				handle: 'acme'
			});
		});

		it('the same jti under another idempotency key is a replay (409 intent_replayed)', async () => {
			await h.service.preflight(h.request());
			const other = h.request({ idempotency_key: `${TEST_JOB_ID}:3:provision_cloud_tenant:gauzy` });
			expect(await failure(h.service.preflight(other))).toEqual({ status: 409, code: 'intent_replayed' });
		});

		it('a refused request writes nothing', async () => {
			await expect(h.service.preflight('not.a.request')).rejects.toMatchObject({
				status: 401,
				code: 'intent_invalid'
			});
			expect(await h.rows('ever_connect_provision_intent')).toEqual([]);
		});
	});

	describe('the signed-in Ever ID', () => {
		it("summary: what the confirmation page shows, with the e-mail of the person's own sign-in", async () => {
			const keys = await h.signedIn(h.request({ features: {} }));
			expect(await h.service.summary(keys.provisionKey, keys.handoffKey)).toEqual({
				org_display_name: 'Acme',
				handle: 'acme',
				legal_name: 'Acme GmbH',
				email: OWNER_EMAIL,
				first_name: 'Ada',
				last_name: 'Owner',
				creates: { workspace: true, organization: true, admin_account: true, employee: true, team: true },
				tier: 'starter',
				product_tenant_exists: false,
				return_to: 'https://app.ever.co/start/jobs/01K9A0000000000000000000JB',
				expires_at: (h.nowS() + 890) * 1000
			});
			// No side effect: the sign-in key is still there.
			expect(h.handoffs.records.has(keys.handoffKey)).toBe(true);
			expect(h.provisioner.inputs).toEqual([]);
		});

		it('another Ever ID than the one the request names: 401 identity_mismatch, nothing created', async () => {
			const keys = await h.signedIn(h.request(), OTHER_SUBJECT);
			expect(await failure(h.service.summary(keys.provisionKey, keys.handoffKey))).toEqual({
				status: 401,
				code: 'identity_mismatch'
			});
			expect(await failure(h.service.create(keys.provisionKey, keys.handoffKey, {}))).toEqual({
				status: 401,
				code: 'identity_mismatch'
			});
			expect(h.provisioner.inputs).toEqual([]);
			expect(await h.rows('ever_connect_provision_result')).toEqual([]);
			expect(await h.rows('integration_tenant')).toEqual([]);
			expect(await h.auditRows()).toEqual([]);
		});

		it('a sign-in started for another request, an unknown or malformed key: 401, nothing created', async () => {
			const keys = await h.signedIn(h.request());
			const elsewhere = h.handoffs.add('x'.repeat(43));
			expect(await failure(h.service.create(keys.provisionKey, elsewhere, {}))).toEqual({
				status: 401,
				code: 'intent_invalid'
			});
			expect(await failure(h.service.create('y'.repeat(43), keys.handoffKey, {}))).toEqual({
				status: 401,
				code: 'intent_invalid'
			});
			expect(await failure(h.service.create('short', keys.handoffKey, {}))).toEqual({
				status: 401,
				code: 'intent_invalid'
			});
			expect(await failure(h.service.create(keys.provisionKey, 'unknown-sign-in-key', {}))).toEqual({
				status: 401,
				code: 'sign_in_required'
			});
			expect(h.provisioner.inputs).toEqual([]);
		});

		it('an expired request: 401 intent_expired', async () => {
			const keys = await h.signedIn(h.request());
			h.clock.t += 900_000;
			expect(await failure(h.service.create(keys.provisionKey, keys.handoffKey, {}))).toEqual({
				status: 401,
				code: 'intent_expired'
			});
			expect(h.provisioner.inputs).toEqual([]);
		});
	});

	describe('create', () => {
		it('creates the workspace with the owner e-mail of the Ever ID sign-in and writes the link record and the audit row', async () => {
			const keys = await h.signedIn(h.request());
			const answer = await h.service.create(keys.provisionKey, keys.handoffKey, {
				first_name: ' Ada ',
				last_name: 'Lovelace'
			});
			expect(answer).toEqual({
				status: 'created',
				product_tenant_id: expect.any(String),
				product_org_id: expect.any(String),
				product_user_id: expect.any(String),
				employee_id: expect.any(String),
				team_id: expect.any(String),
				sign_in_url: 'https://app.gauzy.test/#/auth/ever-id?handoff=signin-1',
				return_to: 'https://app.ever.co/start/jobs/01K9A0000000000000000000JB'
			});
			const [input] = h.provisioner.inputs;
			expect(input).toEqual({
				issuer: 'https://auth.ever.test',
				subject: '300000000000000001',
				email: OWNER_EMAIL,
				firstName: 'Ada',
				lastName: 'Lovelace',
				tenant: { name: 'Acme' },
				organization: { name: 'Acme', officialName: 'Acme GmbH', country: 'DE', website: undefined },
				everOrgId: TEST_ORG_ID,
				everTenantId: TEST_ORG_ID,
				handle: 'acme',
				options: { createEmployee: true, createTeam: true },
				idempotencyKey: `${TEST_JOB_ID}:2:provision_cloud_tenant:gauzy`
			});

			const [result] = await h.rows('ever_connect_provision_result');
			expect(result).toMatchObject({
				idempotencyKey: `${TEST_JOB_ID}:2:provision_cloud_tenant:gauzy`,
				jti: '01K9A0000000000000000000JT',
				status: 'created',
				everOrgId: TEST_ORG_ID,
				productTenantId: answer.product_tenant_id,
				productOrgId: answer.product_org_id,
				productUserId: answer.product_user_id,
				employeeId: answer.employee_id,
				teamId: answer.team_id,
				completionState: 'pending',
				claimedBy: null
			});

			const [record] = await h.rows('integration_tenant');
			expect(record).toMatchObject({
				name: 'Ever_Connect',
				tenantId: answer.product_tenant_id,
				organizationId: answer.product_org_id
			});
			expect(result['integrationTenantId']).toBe(record['id']);
			const settings = await h.rows('integration_setting');
			expect(Object.fromEntries(settings.map((row) => [row['settingsName'], row['settingsValue']]))).toEqual({
				EVER_ORG_ID: TEST_ORG_ID,
				EVER_HANDLE: 'acme',
				EVER_LINK_STATUS: 'linked'
			});

			const audit = await h.auditRows();
			expect(audit).toEqual([
				{
					action: 'provision.accept',
					details: {
						job_id: TEST_JOB_ID,
						step_seq: 2,
						product_tenant_id: answer.product_tenant_id,
						product_org_id: answer.product_org_id
					}
				}
			]);
			expect(JSON.stringify(audit)).not.toContain('@');

			const [intent] = await h.rows('ever_connect_provision_intent');
			expect(intent['status']).toBe('accepted');
			// The sign-in key was used up for the owner's one-time sign-in; Ever Platform is told.
			expect(h.handoffs.signIns).toEqual([{ handoffKey: keys.handoffKey, userId: answer.product_user_id }]);
			expect(h.completion.sendNow).toHaveBeenCalledTimes(1);
		});

		it('features.teams false: no team', async () => {
			const keys = await h.signedIn(h.request({ features: { teams: false } }));
			const answer = await h.service.create(keys.provisionKey, keys.handoffKey, {});
			expect(h.provisioner.inputs[0].options).toEqual({ createEmployee: true, createTeam: false });
			expect(answer.team_id).toBeUndefined();
		});

		it('the same idempotency key again: 200 exists with the same ids, nothing created twice', async () => {
			const jws = h.request();
			const first = await h.signedIn(jws);
			const created = await h.service.create(first.provisionKey, first.handoffKey, {});
			const again = await h.signedIn(jws);
			expect((await h.service.summary(again.provisionKey, again.handoffKey)).product_tenant_exists).toBe(true);
			const replay = await h.service.create(again.provisionKey, again.handoffKey, {});
			expect(replay).toEqual({
				...created,
				status: 'exists',
				sign_in_url: 'https://app.gauzy.test/#/auth/ever-id?handoff=signin-2'
			});
			expect(h.provisioner.tenants).toBe(1);
			expect(h.provisioner.inputs).toHaveLength(1);
			expect(await h.rows('integration_tenant')).toHaveLength(1);
			expect((await h.auditRows()).filter((row) => row.action === 'provision.accept')).toHaveLength(1);
		});

		it('ten concurrent confirmations: one workspace, ten answers with the same ids', async () => {
			h.provisioner.delayMs = 300;
			const jws = h.request();
			const { provisionKey } = await h.signedIn(jws);
			const answers = await Promise.all(
				Array.from({ length: 10 }, () => h.service.create(provisionKey, h.handoffs.add(provisionKey), {}))
			);
			expect(h.provisioner.tenants).toBe(1);
			expect(new Set(answers.map((answer) => answer.product_tenant_id)).size).toBe(1);
			expect(answers.filter((answer) => answer.status === 'created')).toHaveLength(1);
			expect(answers.filter((answer) => answer.status === 'exists')).toHaveLength(9);
			expect(await h.rows('integration_tenant')).toHaveLength(1);
		});

		it('an Ever organization another creation linked already: 409 organization_already_linked', async () => {
			const first = await h.signedIn(h.request());
			await h.service.create(first.provisionKey, first.handoffKey, {});
			const other = h.request({
				jti: '01K9A0000000000000000000J2',
				idempotency_key: `${TEST_JOB_ID}:9:provision_cloud_tenant:gauzy`
			});
			const keys = await h.signedIn(other);
			expect(await failure(h.service.create(keys.provisionKey, keys.handoffKey, {}))).toEqual({
				status: 409,
				code: 'organization_already_linked'
			});
			expect(h.provisioner.tenants).toBe(1);
		});

		it('a creation that stops half way: 500 provisioning_failed, the ids are kept, and the retry finishes the same workspace', async () => {
			h.provisioner.failAt = 'tenant';
			const jws = h.request();
			const first = await h.signedIn(jws);
			expect(await failure(h.service.create(first.provisionKey, first.handoffKey, {}))).toEqual({
				status: 500,
				code: 'provisioning_failed'
			});
			const [failed] = await h.rows('ever_connect_provision_result');
			expect(failed).toMatchObject({ status: 'failed', errorCode: 'Error', claimedBy: null });
			expect(failed['productTenantId']).toEqual(expect.any(String));
			// Nobody can sign in yet: no link record, no audit, the sign-in key is still there.
			expect(await h.rows('integration_tenant')).toEqual([]);
			expect(await h.auditRows()).toEqual([]);

			const answer = await h.service.create(first.provisionKey, first.handoffKey, {});
			expect(answer.status).toBe('created');
			expect(answer.product_tenant_id).toBe(failed['productTenantId']);
			expect(h.provisioner.resumes[1]).toMatchObject({
				userId: failed['productUserId'],
				tenantId: failed['productTenantId']
			});
			expect(h.provisioner.tenants).toBe(1);
			expect(h.provisioner.users).toBe(1);
		});

		it('a failure in the last step leaves no link record and no audit row (one transaction)', async () => {
			h.provisioner.failAt = 'finalize';
			const keys = await h.signedIn(h.request());
			expect(await failure(h.service.create(keys.provisionKey, keys.handoffKey, {}))).toEqual({
				status: 500,
				code: 'provisioning_failed'
			});
			expect(await h.rows('integration_tenant')).toEqual([]);
			expect(await h.rows('integration_setting')).toEqual([]);
			expect(await h.auditRows()).toEqual([]);
			const [row] = await h.rows('ever_connect_provision_result');
			expect(row['status']).toBe('failed');
			// The retry completes it.
			const answer = await h.service.create(keys.provisionKey, keys.handoffKey, {});
			expect(answer.status).toBe('created');
			expect(await h.rows('integration_tenant')).toHaveLength(1);
		});

		it('the error answer carries a code only, never the e-mail or the cause', async () => {
			h.provisioner.failAt = 'organization';
			const keys = await h.signedIn(h.request());
			try {
				await h.service.create(keys.provisionKey, keys.handoffKey, {});
			} catch (error) {
				const body = JSON.stringify((error as HttpException).getResponse());
				expect(body).not.toContain('@');
				expect(body).not.toContain('timeout');
			}
		});
	});

	describe('entitlement check (the signed plan)', () => {
		it.each(KNOWN_TIERS.map((tier) => [tier]))('%s: allowed', async (tier) => {
			const keys = await h.signedIn(h.request({ tier }));
			await expect(h.service.create(keys.provisionKey, keys.handoffKey, {})).resolves.toMatchObject({
				status: 'created'
			});
		});

		it('an unknown plan: 422 validation_failed, nothing created', async () => {
			const keys = await h.signedIn(h.request({ tier: 'platinum' }));
			expect(await failure(h.service.summary(keys.provisionKey, keys.handoffKey))).toEqual({
				status: 422,
				code: 'validation_failed'
			});
			expect(await failure(h.service.create(keys.provisionKey, keys.handoffKey, {}))).toEqual({
				status: 422,
				code: 'validation_failed'
			});
			expect(h.provisioner.inputs).toEqual([]);
		});

		it('makes no payment-provider call: the check has no dependency, and the plugin never reads a payment key or service', () => {
			expect(EverConnectProvisionGate.length).toBe(0);
			const root = join(__dirname, '../..');
			const files: string[] = [];
			const walk = (dir: string) => {
				for (const entry of readdirSync(dir)) {
					const path = join(dir, entry);
					if (statSync(path).isDirectory()) {
						if (entry !== 'fixtures' && entry !== 'specs') walk(path);
					} else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
						files.push(path);
					}
				}
			};
			walk(root);
			expect(files.length).toBeGreaterThan(20);
			const offending = files.filter((path) =>
				/StripeSubscriptionService|SubscriptionRequiredGuard|STRIPE_SECRET_KEY|from 'stripe'/.test(
					readFileSync(path, 'utf8')
				)
			);
			expect(offending).toEqual([]);
		});
	});

	it('the switch off: the service reports itself unavailable (every route answers 404)', async () => {
		const off = await provisionHarness({ enabled: false });
		try {
			expect(off.service.available).toBe(false);
			expect(h.service.available).toBe(true);
		} finally {
			await off.close();
		}
	});
});
