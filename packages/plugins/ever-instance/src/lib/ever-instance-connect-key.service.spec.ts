// cspell:ignore changeme
import { createPublicKey, verify } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EverInstanceEvents } from './ever-instance.events';
import { EverConnectKeyMaterialError, EverInstanceService } from './ever-instance.service';
import {
	connectKeyMaterialProblem,
	EverInstanceKeyError,
	storedKeySource,
	unwrapKey,
	wrapKey
} from './ever-instance-key';
import { dropTables, everInstanceMigration, openTestDataSource, q, TEST_TARGETS } from './fixtures/test-db';

const ENV = { ENCRYPTION_KEY: 'an-encryption-key-for-tests' };

jest.setTimeout(120_000);

describe('connect key material', () => {
	it.each([
		[{}, 'no_secret'],
		[{ JWT_SECRET: 'secretKey' }, 'jwt_secret_default'],
		[{ ENCRYPTION_KEY: 'changeme' }, 'encryption_key_default'],
		[{ JWT_SECRET: 'a-strong-unique-secret' }, null],
		[{ ENCRYPTION_KEY: 'an-encryption-key' }, null]
	])('%j → %s', (env, problem) => {
		expect(connectKeyMaterialProblem(env)).toBe(problem);
	});

	it('a value stored for one purpose cannot be read as another', () => {
		const blob = wrapKey(Buffer.from('document'), 'entitlement', ENV);
		expect(unwrapKey(blob, 'entitlement', ENV).toString()).toBe('document');
		expect(() => unwrapKey(blob, 'connect', ENV)).toThrow(EverInstanceKeyError);
	});
});

/**
 * The Ever Platform connect key: a second key pair, separate from the statistics key, made once
 * (also under concurrent calls), refused without a strong secret, signing with the stored key, and
 * dropped after a revocation without touching the statistics identity.
 */
describe.each(TEST_TARGETS)('EverInstanceService connect key on $name', (target) => {
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

	const service = (env: Record<string, string | undefined> = ENV) =>
		new EverInstanceService(dataSource, new EverInstanceEvents(), env);

	it('is refused without ENCRYPTION_KEY or a non-default JWT_SECRET, and nothing is stored', async () => {
		await expect(service({ JWT_SECRET: 'secretKey' }).ensureConnectKey()).rejects.toBeInstanceOf(
			EverConnectKeyMaterialError
		);
		expect(await service().connectKey()).toBeNull();
	});

	it('is made once under concurrent calls, separate from the statistics key, stored encrypted', async () => {
		const keys = await Promise.all(Array.from({ length: 10 }, () => service().ensureConnectKey()));
		expect(new Set(keys.map((key) => key.publicKey)).size).toBe(1);
		const identity = await service().ensure();
		expect(keys[0].publicKey).not.toBe(identity.statsPublicKey);
		expect(keys[0].keyId).toMatch(/^[A-Za-z0-9_-]{11}$/);
		const [row] = await dataSource.query(`SELECT * FROM ${q(target.name, 'ever_instance')}`);
		expect(storedKeySource(row.connectPrivateKeyEncrypted)).toBe('k');
		expect(String(row.connectPrivateKeyEncrypted)).not.toContain('MC4CAQ');
	});

	it('signs with the stored key; JSON shows the key id only', async () => {
		const key = await service().ensureConnectKey();
		const signer = await service().connectSigner();
		expect(signer?.kid).toBe(key.keyId);
		expect(JSON.stringify(signer)).toBe(JSON.stringify({ kid: key.keyId }));
		const bytes = Buffer.from('assertion');
		const signature = await signer!.sign(bytes);
		const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key.publicKey }, format: 'jwk' });
		expect(verify(null, bytes, publicKey, signature)).toBe(true);
	});

	it('fails closed when the secret changed', async () => {
		await service().ensureConnectKey();
		await expect(service({ ENCRYPTION_KEY: 'another-key' }).connectSigner()).rejects.toBeInstanceOf(
			EverInstanceKeyError
		);
	});

	it('is dropped after a revocation (the next connect makes a new one); the statistics identity stays', async () => {
		const before = await service().ensure();
		const first = await service().ensureConnectKey();
		await service().dropConnectKey();
		expect(await service().connectKey()).toBeNull();
		expect(await service().connectSigner()).toBeNull();
		const second = await service().ensureConnectKey();
		expect(second.publicKey).not.toBe(first.publicKey);
		const after = await service().get();
		expect(after?.instanceId).toBe(before.instanceId);
		expect(after?.statsPublicKey).toBe(before.statsPublicKey);
	});

	it('a statistics reset leaves the connect key alone', async () => {
		const key = await service().ensureConnectKey();
		await service().resetIdentity('user-1');
		expect(await service().connectKey()).toEqual(key);
	});

	it('keeps the key manifest cache', async () => {
		await service().ensure();
		await service().setJwksCache('{"document":"x","fetchedAt":1}');
		const cache = await service().jwksCache();
		expect(cache.json).toBe('{"document":"x","fetchedAt":1}');
		expect(cache.fetchedAt).toBeGreaterThan(0);
	});
});
