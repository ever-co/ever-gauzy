import { createPublicKey, verify } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverInstanceEvent, EverInstanceEvents } from './ever-instance.events';
import { EverInstanceService } from './ever-instance.service';
import { EverInstanceKeyError, storedKeySource } from './ever-instance-key';
import { dropTables, everInstanceMigration, openTestDataSource, q, TEST_TARGETS } from './fixtures/test-db';

const ENV = { JWT_SECRET: 'a-strong-jwt-secret-for-tests' };

// Creating and dropping tables on a real Postgres or MySQL takes longer than the default 5 s.
jest.setTimeout(120_000);

describe.each(TEST_TARGETS)('EverInstanceService on $name', (target) => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = await openTestDataSource(target);
	});

	afterAll(async () => {
		await dropTables(dataSource, target.name, ['ever_instance']);
		await dataSource.destroy();
	});

	beforeEach(async () => {
		await dropTables(dataSource, target.name, ['ever_instance']);
		const runner = dataSource.createQueryRunner();
		await everInstanceMigration().up(runner);
		await runner.release();
	});

	function service(env: Record<string, string | undefined> = ENV, events = new EverInstanceEvents()) {
		return new EverInstanceService(dataSource, events, env);
	}

	it('creates one identity under 20 concurrent first boots', async () => {
		const results = await Promise.all(Array.from({ length: 20 }, () => service().ensure()));
		expect(new Set(results.map((r) => r.instanceId)).size).toBe(1);
		expect(new Set(results.map((r) => r.statsPublicKey)).size).toBe(1);
		const rows = await dataSource.query(`SELECT COUNT(*) AS n FROM ${q(target.name, 'ever_instance')}`);
		expect(Number(rows[0].n)).toBe(1);
		const record = results[0];
		expect(record.instanceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(record.statsKeyId).toMatch(/^[A-Za-z0-9_-]{11}$/);
		expect(record.statsEnabledUi).toBe(true);
		expect(record.resetCount).toBe(0);
		expect(record.statsKeySource).toBe('j');
		expect(JSON.stringify(record)).not.toMatch(/Encrypted|v1:/);
	});

	it('uses EVER_INSTANCE_ID only for a new identity, and only a UUID v4', async () => {
		const fixed = '3d2b1a0c-5e4f-4a6b-8c7d-9e0f1a2b3c4d';
		expect((await service({ ...ENV, EVER_INSTANCE_ID: fixed }).ensure()).instanceId).toBe(fixed);
		expect((await service({ ...ENV, EVER_INSTANCE_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }).ensure()).instanceId).toBe(fixed);
		await dropTables(dataSource, target.name, ['ever_instance']);
		const runner = dataSource.createQueryRunner();
		await everInstanceMigration().up(runner);
		await runner.release();
		expect((await service({ ...ENV, EVER_INSTANCE_ID: 'acme-corp' }).ensure()).instanceId).not.toBe('acme-corp');
	});

	it('signs with the statistics key, and the signature verifies with the stored public key', async () => {
		const record = await service().ensure();
		const signer = await service().statsSigner();
		expect(signer.publicKey).toBe(record.statsPublicKey);
		expect(JSON.stringify(signer)).toBe(JSON.stringify({ publicKey: record.statsPublicKey, keyId: record.statsKeyId }));
		const bytes = Buffer.from('{"a":1}');
		const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: record.statsPublicKey }, format: 'jwk' });
		expect(verify(null, bytes, key, signer.sign(bytes))).toBe(true);
	});

	it('fails closed when the secret changed, and reset recovers', async () => {
		await service().ensure();
		await expect(service({ JWT_SECRET: 'another-secret' }).statsSigner()).rejects.toBeInstanceOf(EverInstanceKeyError);
		const reset = await service({ JWT_SECRET: 'another-secret' }).resetIdentity('user-1');
		expect(reset.resetCount).toBe(1);
		await expect(service({ JWT_SECRET: 'another-secret' }).statsSigner()).resolves.toBeDefined();
	});

	it('stores the key again under ENCRYPTION_KEY once it is set', async () => {
		const before = await service().ensure();
		const signerBefore = await service().statsSigner();
		const after = await service({ ...ENV, ENCRYPTION_KEY: 'now-set' }).ensure();
		expect(after.statsKeySource).toBe('k');
		expect(after.statsPublicKey).toBe(before.statsPublicKey);
		const signerAfter = await service({ ...ENV, ENCRYPTION_KEY: 'now-set' }).statsSigner();
		const bytes = Buffer.from('x');
		expect(signerAfter.sign(bytes).equals(signerBefore.sign(bytes))).toBe(true);
		const rows = await dataSource.query(`SELECT ${q(target.name, 'statsPrivateKeyEncrypted')} AS wrapped_key FROM ${q(target.name, 'ever_instance')}`);
		expect(storedKeySource(rows[0].wrapped_key)).toBe('k');
	});

	it('toggles the statistics, emits one event and writes one audit line with the actor', async () => {
		const events = new EverInstanceEvents();
		const seen: EverInstanceEvent[] = [];
		events.events$.subscribe((event) => seen.push(event));
		const svc = service(ENV, events);
		const log = jest.spyOn((svc as unknown as { logger: { log: (message: string) => void } }).logger, 'log').mockImplementation(() => undefined);
		await svc.ensure();
		expect((await svc.setStatsEnabledUi(false, 'user-1')).statsEnabledUi).toBe(false);
		await svc.setStatsEnabledUi(false, 'user-1');
		expect((await svc.setStatsEnabledUi(true, 'user-2')).statsEnabledUi).toBe(true);
		expect(seen.map((e) => e.type)).toEqual(['ever.instance.stats_toggle', 'ever.instance.stats_toggle']);
		expect(seen[0]).toMatchObject({ actorId: 'user-1', from: true, to: false });
		const audits = log.mock.calls.map((c) => String(c[0])).filter((line) => line.includes('"audit"'));
		expect(audits).toHaveLength(2);
		expect(JSON.parse(audits[0])).toEqual({ audit: 'ever_instance', action: 'stats.toggle', actor_id: 'user-1', from: true, to: false });
	});

	it('resets the statistics id and key and leaves the connection columns byte for byte', async () => {
		const svc = service();
		const before = await svc.ensure();
		const t = (c: string) => q(target.name, c);
		await dataSource.query(
			`UPDATE ${t('ever_instance')} SET ${t('connectPublicKey')} = 'connect-pub', ${t('connectPrivateKeyEncrypted')} = 'v1:k:a:b:c', ${t('connectKeyId')} = 'connect-kid', ${t('jwksCache')} = '{"keys":[]}', ${t('jwksFetchedAt')} = 1234`
		);
		const connect = async () =>
			(await dataSource.query(`SELECT ${t('connectPublicKey')} AS a, ${t('connectPrivateKeyEncrypted')} AS b, ${t('connectKeyId')} AS c, ${t('jwksCache')} AS d, ${t('jwksFetchedAt')} AS e FROM ${t('ever_instance')}`))[0];
		const connectBefore = await connect();
		const after = await svc.resetIdentity('user-1');
		expect(after.instanceId).not.toBe(before.instanceId);
		expect(after.statsPublicKey).not.toBe(before.statsPublicKey);
		expect(after.statsKeyId).not.toBe(before.statsKeyId);
		expect(after.resetCount).toBe(1);
		expect(await connect()).toEqual(connectBefore);
	});

	it('pins the operator once (compare and set)', async () => {
		const svc = service();
		await svc.ensure();
		expect(await svc.pinOperator('first')).toBe('first');
		expect(await svc.pinOperator('second')).toBe('first');
	});
});
