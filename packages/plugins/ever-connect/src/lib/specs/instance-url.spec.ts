import { ConflictException, HttpException } from '@nestjs/common';
import { INSTANCE_URL } from '../ever-connect-integration-state.service';
import { INSTANCE_ID, problem, testSigner } from '../fixtures/identity-harness';
import { lookupHarness, LookupHarness } from '../fixtures/lookup-harness';
import { normalisedPublicAddress } from '../public-address';
import { EverConnectWellKnownService } from '../well-known/ever-connect-well-known.service';

const PUT = 'PUT /v1/instances/me/public-url';
const DELETE = 'DELETE /v1/instances/me/public-url';
const OPERATOR = { actorLabel: 'operator' as const, userId: '2f0d6a52-6a0f-4a8e-9d3c-4b7d9e1f0a11' };

const codeOf = (error: unknown) => ((error as HttpException).getResponse() as { code?: string }).code;

/**
 * The installation's address (`instance_url`, row 18): reported only once the integration is enabled
 * (consent in app.ever.co and the operator's accept), only as the operator typed it, through the SDK's
 * client (which checks the body against the contract); kept as Ever Platform normalised it, audited
 * without the address, and withdrawn on request.
 */
describe('the installation address', () => {
	let h: LookupHarness;

	beforeEach(async () => {
		h = await lookupHarness();
		h.platform.on(PUT, (call) => ({
			status: 200,
			body: { base_url: String(call.body?.['base_url']).replace('Gauzy.', 'gauzy.') }
		}));
		h.platform.on(DELETE, { status: 204 });
	});

	afterEach(async () => {
		await h.close();
	});

	const enable = (enabled = true) =>
		h.store.saveIntegration('instance', INSTANCE_URL, {
			state: enabled ? 'enabled' : 'pending_operator',
			enabled,
			consentId: '01JD0000000000000000000CNS'
		});

	const audit = async () => (await h.auditRows()).filter((row) => row.action === 'integration.configure');

	it('before "Installation address" is enabled: 409 consent_required, nothing is sent', async () => {
		const error = await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e);
		expect(error).toBeInstanceOf(ConflictException);
		expect(codeOf(error)).toBe('consent_required');
		await enable(false);
		expect(codeOf(await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e))).toBe(
			'consent_required'
		);
		expect(h.platform.callsTo(PUT)).toHaveLength(0);
		expect(await h.states.publicUrlView()).toEqual({ enabled: false, url: null });
	});

	it('not connected: 409 not_connected, nothing is sent', async () => {
		await enable();
		await h.store.updateConnection({ status: 'disconnected' });
		expect(codeOf(await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e))).toBe(
			'not_connected'
		);
		expect(h.platform.calls).toHaveLength(0);
	});

	it('reported as typed, kept as Ever Platform normalised it, audited without the address; the statement answers', async () => {
		await enable();
		const view = await h.states.setPublicUrl('https://Gauzy.acme.example/app/', OPERATOR);
		expect(view).toEqual({ enabled: true, url: 'https://gauzy.acme.example/app/' });
		const [sent] = h.platform.callsTo(PUT);
		expect(sent.body).toEqual({ base_url: 'https://Gauzy.acme.example/app/' });
		expect(sent.headers['idempotency-key']).toMatch(/^[0-9a-f]{64}$/);
		expect(await h.states.publicUrlView()).toEqual(view);
		const rows = await audit();
		expect(rows).toEqual([
			{ action: 'integration.configure', details: { platform_instance_id: INSTANCE_ID, status: 'reported' } }
		]);
		expect(JSON.stringify(await h.auditRows())).not.toContain('acme.example');
		// `/.well-known/ever-connect` answers for 10 minutes, then 404 again.
		const signer = testSigner();
		const wellKnown = new EverConnectWellKnownService(
			h.store,
			{ connectSigner: async () => signer } as never,
			undefined,
			h.clock
		);
		expect(await wellKnown.statement()).toEqual(expect.any(String));
		h.clock.t += 10 * 60 * 1000 + 1;
		expect(await wellKnown.statement()).toBeNull();
	});

	it('switched off or disconnected while Ever Platform answered: nothing is kept, no statement', async () => {
		await enable();
		h.platform.on(PUT, async (call) => {
			// A revocation read meanwhile switches the integration off here.
			await enable(false);
			return { status: 200, body: { base_url: String(call.body?.['base_url']) } };
		});
		expect(codeOf(await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e))).toBe(
			'consent_changed'
		);
		expect((await h.store.connection()).publicUrl).toBeNull();
		expect(await audit()).toEqual([]);

		await enable();
		h.platform.on(PUT, async (call) => {
			await h.store.updateConnection({ status: 'disconnected' });
			return { status: 200, body: { base_url: String(call.body?.['base_url']) } };
		});
		expect(codeOf(await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e))).toBe(
			'consent_changed'
		);
		expect((await h.store.connection()).publicUrl).toBeNull();
	});

	it('a new consent while Ever Platform answered: the address reported under the old one is not kept', async () => {
		await enable();
		h.platform.on(PUT, async (call) => {
			await h.store.saveIntegration('instance', INSTANCE_URL, { consentId: '01JD0000000000000000000NEW' });
			return { status: 200, body: { base_url: String(call.body?.['base_url']) } };
		});
		expect(codeOf(await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e))).toBe(
			'consent_changed'
		);
		expect((await h.store.connection()).publicUrl).toBeNull();
	});

	it('a report answered after a new consent never replaces the address another process reported under it', async () => {
		await enable();
		h.platform.on(PUT, async (call) => {
			// Meanwhile, in another API process: a new consent, and a report under it.
			await h.store.saveIntegration('instance', INSTANCE_URL, { consentId: '01JD0000000000000000000NEW' });
			await h.store.updateConnection({ publicUrl: 'https://newer.acme.example/' });
			return { status: 200, body: { base_url: String(call.body?.['base_url']) } };
		});
		expect(codeOf(await h.states.setPublicUrl('https://older.acme.example/', OPERATOR).catch((e) => e))).toBe(
			'consent_changed'
		);
		expect((await h.store.connection()).publicUrl).toBe('https://newer.acme.example/');
	});

	it("Ever Platform's refusal: 403 is a 409 with its code, and nothing is kept", async () => {
		await enable();
		h.platform.on(PUT, problem(403, 'integration_disabled'));
		const error = await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e);
		expect(error).toBeInstanceOf(ConflictException);
		expect(codeOf(error)).toBe('integration_disabled');
		expect((await h.store.connection()).publicUrl).toBeNull();
		expect(await audit()).toEqual([]);
	});

	it('Ever Platform not answering: 502 platform_unreachable, nothing is kept', async () => {
		await enable();
		h.platform.offline = true;
		const error = await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR).catch((e) => e);
		expect((error as HttpException).getStatus()).toBe(502);
		expect(codeOf(error)).toBe('platform_unreachable');
		expect((await h.store.connection()).publicUrl).toBeNull();
	});

	it('withdrawn: removed on Ever Platform while enabled, and forgotten here', async () => {
		await enable();
		await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR);
		expect(await h.states.clearPublicUrl(OPERATOR)).toEqual({ enabled: true, url: null });
		expect(h.platform.callsTo(DELETE)).toHaveLength(1);
		const connection = await h.store.connection();
		expect([connection.publicUrl, connection.publicUrlCheckUntil]).toEqual([null, null]);
		expect((await audit()).map((row) => row.details['status'])).toEqual(['reported', 'withdrawn']);
	});

	it('a withdrawal does not clear an address reported meanwhile by another API process', async () => {
		await enable();
		await h.states.setPublicUrl('https://old.acme.example/', OPERATOR);
		h.platform.on(DELETE, async () => {
			// Another API process reports a newer address while Ever Platform answers this withdrawal.
			await h.store.updateConnection({ publicUrl: 'https://new.acme.example/' });
			return { status: 204 };
		});
		expect(await h.states.clearPublicUrl(OPERATOR)).toEqual({ enabled: true, url: 'https://new.acme.example/' });
		expect((await h.store.connection()).publicUrl).toBe('https://new.acme.example/');
	});

	it('reports and withdrawals asked at once in one process run in the order they were asked', async () => {
		await enable();
		const order: string[] = [];
		h.platform.on(PUT, async (call) => {
			order.push(`put ${call.body?.['base_url']}`);
			await new Promise((resolve) => setTimeout(resolve, 20));
			return { status: 200, body: { base_url: String(call.body?.['base_url']) } };
		});
		h.platform.on(DELETE, async () => {
			order.push('delete');
			return { status: 204 };
		});
		const [, withdrawn] = await Promise.all([
			h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR),
			h.states.clearPublicUrl(OPERATOR)
		]);
		expect(order).toEqual(['put https://gauzy.acme.example/', 'delete']);
		expect(withdrawn).toEqual({ enabled: true, url: null });
		expect((await h.store.connection()).publicUrl).toBeNull();
	});

	it('withdrawn once the integration ended: only the copy kept here is cleared', async () => {
		await enable();
		await h.states.setPublicUrl('https://gauzy.acme.example/', OPERATOR);
		await enable(false);
		await h.states.clearPublicUrl(OPERATOR);
		expect(h.platform.callsTo(DELETE)).toHaveLength(0);
		expect((await h.store.connection()).publicUrl).toBeNull();
	});

	it('the address the operator may publish: https with a host name, normalised, at most 255 characters', () => {
		expect(normalisedPublicAddress('https://Gauzy.Acme.example:443/app/')).toBe('https://gauzy.acme.example/app/');
		expect(normalisedPublicAddress('https://gauzy.acme.example')).toBe('https://gauzy.acme.example/');
		for (const refused of [
			'http://gauzy.acme.example',
			'https://10.0.0.1',
			'https://[::1]/',
			'https://localhost',
			'https://user:pass@gauzy.acme.example',
			'https://gauzy.acme.example/?a=1',
			'https://gauzy.acme.example/#x',
			`https://gauzy.acme.example/${'a'.repeat(240)}`,
			42,
			null
		]) {
			expect(normalisedPublicAddress(refused)).toBeNull();
		}
	});
});
