import { HttpException } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	ENTITLEMENT_FILE_MAX_BYTES,
	entitlementLadder,
	EverConnectEntitlementService
} from './ever-connect-entitlement.service';
import { EntitlementError } from './sdk';

const NOW_S = 1_800_000_000;
const DAY = 86_400;
const ENV = { ENCRYPTION_KEY: 'a'.repeat(64) };
const INSTANCE = 'ins_01J00000000000000000000000';
const LINK = 'evl_01J00000000000000000000000';

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A compact JWS with the given claims (the signature is never checked here: the verifier is a fake). */
function jwsOf(claims: Record<string, unknown>): string {
	return `${b64({ alg: 'EdDSA', typ: 'ever-entitlement+jwt', kid: 'ent-test-1' })}.${b64(claims)}.${Buffer.from('sig').toString('base64url')}`;
}

function claimsFor(sub: string, seq: number, extra: Record<string, unknown> = {}) {
	return {
		iss: 'https://mock-platform.test',
		sub,
		iat: NOW_S - 60,
		exp: NOW_S + 7 * DAY,
		ever: {
			seq,
			grace_s: 30 * DAY,
			handle: 'acme',
			org_id: 'org_1',
			tier: 'paid',
			plan: { code: 'gauzy-team', source: 'subscription' },
			licence_ids: ['EVER-GAUZY-SB-1A2B3C4D'],
			features: { discoverability: true, ever_id_login: true },
			...extra
		}
	};
}

function setup(options: { connected?: boolean; storedSeq?: number | null; link?: boolean; verifyError?: Error } = {}) {
	const connection = {
		status: options.connected === false ? 'disconnected' : 'connected',
		platformInstanceId: INSTANCE,
		instanceEntitlementSeq: options.storedSeq ?? null,
		instanceEntitlementIat: options.storedSeq != null ? NOW_S - 3600 : null,
		instanceEntitlementJwsEncrypted: null
	};
	const link = options.link
		? {
				linkId: LINK,
				status: 'linked',
				tenantId: 'tenant-1',
				organizationId: 'org-1',
				entitlementSeq: null,
				entitlementIat: null,
				entitlementJwsEncrypted: null as string | null,
				entitlementFetchedAt: null,
				everHandle: null,
				integrationTenantId: null
			}
		: null;
	const store = {
		connection: jest.fn(async () => connection),
		updateConnection: jest.fn(async (values: Record<string, unknown>) => Object.assign(connection, values)),
		linkById: jest.fn(async (id: string) => (link && id === link.linkId ? link : null)),
		linkOf: jest.fn(async () => link),
		updateLink: jest.fn(async (_id: string, values: Record<string, unknown>) => Object.assign(link ?? {}, values))
	};
	const audit = { record: jest.fn(async () => undefined) };
	const platform = {
		verify: jest.fn(async (jws: string, subject: string) => {
			if (options.verifyError) throw options.verifyError;
			const claims = JSON.parse(Buffer.from(jws.split('.')[1], 'base64url').toString('utf8'));
			if (claims.sub !== subject) throw new EntitlementError('subject_mismatch');
			return { jws, seq: claims.ever.seq, claims };
		})
	};
	const service = new EverConnectEntitlementService(
		platform as never,
		store as never,
		audit as never,
		{ revoked$: { next: jest.fn() } } as never,
		ENV,
		{ now: () => NOW_S * 1000 }
	);
	return { service, store, audit, platform, connection, link };
}

const answerOf = async (promise: Promise<unknown>) => {
	try {
		await promise;
	} catch (error) {
		if (error instanceof HttpException)
			return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
		throw error;
	}
	throw new Error('expected an HttpException');
};

describe('entitlementLadder', () => {
	const claims = (expOffsetS: number, grace_s?: number) => ({ exp: NOW_S + expOffsetS, ever: { grace_s } });

	it.each([
		['valid before exp', 3600, undefined, 'valid'],
		['grace 1 s after exp', -1, undefined, 'grace'],
		['grace 1 day after exp', -DAY, undefined, 'grace'],
		['grace 29 days 23 h after exp', -(30 * DAY - 3600), undefined, 'grace'],
		['paused 30 days after exp', -30 * DAY, undefined, 'paused'],
		['paused when the document says a shorter grace', -2 * DAY, DAY, 'paused']
	])('%s', (_name, offset, grace, expected) => {
		expect(entitlementLadder(claims(offset as number, grace as number | undefined), NOW_S)).toBe(expected);
	});

	it('pauses without a document, and when the connection was revoked', () => {
		expect(entitlementLadder(null, NOW_S)).toBe('paused');
		expect(entitlementLadder(claims(3600), NOW_S, true)).toBe('paused');
	});
});

describe('EverConnectEntitlementService.importDocument', () => {
	const operator = { actorLabel: 'operator' as const, actorUserId: 'user-1' };

	it('stores a valid instance document and audits it as a file import', async () => {
		const { service, store, audit } = setup();
		const result = await service.importDocument(jwsOf(claimsFor(`instance:${INSTANCE}`, 7)), operator);
		expect(result).toEqual({ subject: 'instance', seq: 7, status: 'stored' });
		expect(store.updateConnection).toHaveBeenCalledWith(expect.objectContaining({ instanceEntitlementSeq: 7 }));
		expect(audit.record).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'entitlement.refresh',
				details: expect.objectContaining({ subject: 'instance', seq: 7, status: 'stored', source: 'file' })
			})
		);
		// No token, no document in the audit row.
		expect(JSON.stringify(audit.record.mock.calls)).not.toMatch(/eyJ/);
	});

	it('stores a link document of this installation on its link', async () => {
		const { service, store } = setup({ link: true });
		const result = await service.importDocument(jwsOf(claimsFor(`link:${LINK}`, 3)), operator);
		expect(result).toEqual({ subject: 'link', seq: 3, status: 'stored' });
		expect(store.updateLink).toHaveBeenCalledWith(LINK, expect.objectContaining({ entitlementSeq: 3 }));
	});

	it('answers 409 not_connected before a connection exists, and changes nothing', async () => {
		const { service, store } = setup({ connected: false });
		const answer = await answerOf(service.importDocument(jwsOf(claimsFor(`instance:${INSTANCE}`, 1)), operator));
		expect(answer).toMatchObject({ status: 409, body: { code: 'not_connected' } });
		expect(store.updateConnection).not.toHaveBeenCalled();
	});

	it('answers 413 for a document over 16 KiB', async () => {
		const { service } = setup();
		const answer = await answerOf(service.importDocument('x'.repeat(ENTITLEMENT_FILE_MAX_BYTES + 1), operator));
		expect(answer.status).toBe(413);
	});

	it('refuses a document of another installation (422) and audits the refusal', async () => {
		const { service, store, audit } = setup();
		const answer = await answerOf(service.importDocument(jwsOf(claimsFor('instance:ins_other', 9)), operator));
		expect(answer).toMatchObject({
			status: 422,
			body: { code: 'entitlement_invalid', reason: 'subject_mismatch' }
		});
		expect(store.updateConnection).not.toHaveBeenCalled();
		expect(audit.record).toHaveBeenCalledWith(
			expect.objectContaining({ details: expect.objectContaining({ status: 'refused', source: 'file' }) })
		);
	});

	it('refuses a link this installation does not have', async () => {
		const { service } = setup();
		const answer = await answerOf(service.importDocument(jwsOf(claimsFor(`link:${LINK}`, 2)), operator));
		expect(answer).toMatchObject({ status: 422, body: { reason: 'subject_mismatch' } });
	});

	it('refuses what the verifier refuses (a tampered signature) and keeps the stored document', async () => {
		const { service, store } = setup({ storedSeq: 4, verifyError: new EntitlementError('bad_signature') });
		const answer = await answerOf(service.importDocument(jwsOf(claimsFor(`instance:${INSTANCE}`, 9)), operator));
		expect(answer).toMatchObject({ status: 422, body: { code: 'entitlement_invalid' } });
		expect(store.updateConnection).not.toHaveBeenCalled();
	});

	it('refuses an older document (entitlement_stale) and keeps the stored one', async () => {
		const { service, store, audit } = setup({ storedSeq: 5 });
		const answer = await answerOf(service.importDocument(jwsOf(claimsFor(`instance:${INSTANCE}`, 4)), operator));
		expect(answer).toMatchObject({ status: 422, body: { reason: 'entitlement_stale' } });
		expect(store.updateConnection).not.toHaveBeenCalled();
		expect(audit.record).toHaveBeenCalledWith(
			expect.objectContaining({ details: expect.objectContaining({ status: 'stale' }) })
		);
	});

	it('answers unchanged for the stored document again (a restart with the same file)', async () => {
		const { service, store, audit, connection } = setup({ storedSeq: 5 });
		connection.instanceEntitlementIat = NOW_S - 60;
		const result = await service.importDocument(jwsOf(claimsFor(`instance:${INSTANCE}`, 5)), operator);
		expect(result).toEqual({ subject: 'instance', seq: 5, status: 'unchanged' });
		expect(store.updateConnection).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it('refuses something that is not a document', async () => {
		const { service } = setup();
		expect((await answerOf(service.importDocument('', operator))).status).toBe(422);
		expect((await answerOf(service.importDocument({ jws: 1 }, operator))).status).toBe(422);
		expect((await answerOf(service.importDocument('not.a.jws', operator))).status).toBe(422);
	});
});

describe('EVER_ENTITLEMENT_FILE', () => {
	let dir: string;
	beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'ever-ent-'))));
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it('imports the file once connected, and a bad file changes nothing', async () => {
		const file = join(dir, 'entitlement.jws');
		writeFileSync(file, `${jwsOf(claimsFor(`instance:${INSTANCE}`, 2))}\n`);
		const { service, store } = setup();
		(service as unknown as { env: Record<string, string> }).env['EVER_ENTITLEMENT_FILE'] = file;
		expect(await service.importFromEnvFile()).toEqual({ subject: 'instance', seq: 2, status: 'stored' });
		expect(store.updateConnection).toHaveBeenCalledTimes(1);

		writeFileSync(file, 'garbage');
		expect(await service.importFromEnvFile()).toBeNull();
		(service as unknown as { env: Record<string, string> }).env['EVER_ENTITLEMENT_FILE'] = join(dir, 'missing.jws');
		expect(await service.importFromEnvFile()).toBeNull();
		expect(store.updateConnection).toHaveBeenCalledTimes(1);
	});

	it('does nothing when unset', async () => {
		const { service, store } = setup();
		expect(await service.importFromEnvFile()).toBeNull();
		expect(store.connection).not.toHaveBeenCalled();
	});
});

describe('EverConnectEntitlementService.features and the summary', () => {
	it('answers the document features while valid or in grace, all off when paused', async () => {
		const { service, link } = setup({ link: true });
		const seal = (claims: Record<string, unknown>) =>
			(service as unknown as { secrets: { seal: (v: string) => string } }).secrets.seal(jwsOf(claims));

		link!.entitlementJwsEncrypted = seal(claimsFor(`link:${LINK}`, 1));
		expect(await service.features('tenant-1', 'org-1')).toEqual({
			ladder: 'valid',
			features: { discoverability: true, ever_id_login: true }
		});

		link!.entitlementJwsEncrypted = seal({ ...claimsFor(`link:${LINK}`, 2), exp: NOW_S - DAY });
		expect((await service.features('tenant-1', 'org-1')).ladder).toBe('grace');

		link!.entitlementJwsEncrypted = seal({ ...claimsFor(`link:${LINK}`, 3), exp: NOW_S - 31 * DAY });
		expect(await service.features('tenant-1', 'org-1')).toEqual({
			ladder: 'paused',
			features: { discoverability: false, ever_id_login: false }
		});

		link!.entitlementJwsEncrypted = null;
		expect(await service.features('tenant-1', 'org-1')).toEqual({ ladder: 'paused', features: {} });
	});

	it('shows the licence ids and the ladder in the summary', async () => {
		const { service, link } = setup({ link: true });
		link!.entitlementJwsEncrypted = (
			service as unknown as { secrets: { seal: (v: string) => string } }
		).secrets.seal(jwsOf(claimsFor(`link:${LINK}`, 1)));
		const summary = await service.summary('tenant-1', 'org-1', false);
		expect(summary.link).toMatchObject({ ladder: 'valid', licence_ids: ['EVER-GAUZY-SB-1A2B3C4D'] });
		expect(summary.instance).toBeNull();
	});
});
