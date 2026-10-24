/**
 * A stand-in hash: this project's Jest setup compiles without `esModuleInterop`, so the client manager's default
 * import of `bcryptjs` would be undefined here. Like a bcrypt hash, a stand-in hash holds nothing of the secret (a
 * new one each time, as a new salt would give); `mockCompare` counts the bcrypt comparisons.
 */
const mockHashedSecrets = new Map<string, string>();
const mockHash = (secret: string) => {
	const hash = `$2b$12$stand-in-hash-${mockHashedSecrets.size + 1}`;
	mockHashedSecrets.set(hash, secret);
	return hash;
};
const mockCompare = jest.fn(async (secret: string, hash: string) => mockHashedSecrets.get(hash) === secret);
jest.mock('bcryptjs', () => ({
	__esModule: true,
	default: {
		hash: async (secret: string) => mockHash(secret),
		compare: (secret: string, hash: string) => mockCompare(secret, hash)
	}
}));

import { OAuth2ClientManager } from './oauth-client-manager';
import { VERIFIED_CLIENT_SECRET_TTL_MS, VerifiedClientSecretCache } from './oauth-client-secret-cache';

/**
 * The MCP server authenticates to mcp-auth's introspection endpoint on every token it asks about, and each time its
 * secret was compared with a cost-12 bcrypt hash: under load CPU, not the network, bounded introspection. A secret
 * verified in the last five minutes against the same stored hash is now taken as right without bcrypt.
 */
describe('OAuth2ClientManager — verified client secrets', () => {
	const RESOURCE_SERVER = 'mcp-server';
	const SECRET = 'a-resource-server-secret-of-32-characters!';
	const ROTATED = 'the-rotated-resource-server-secret-of-32-chars';

	let clock: number;
	let cache: VerifiedClientSecretCache;
	let manager: OAuth2ClientManager;

	const silence = (target: OAuth2ClientManager) => {
		(target as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
		return target;
	};

	beforeEach(async () => {
		mockCompare.mockClear();
		clock = 1_000_000;
		cache = new VerifiedClientSecretCache(VERIFIED_CLIENT_SECRET_TTL_MS, 100, () => clock);
		manager = silence(new OAuth2ClientManager(undefined, cache));
		await manager.registerResourceServer(RESOURCE_SERVER, SECRET);
	});

	it('compares the right secret with bcrypt once, then answers from the cache', async () => {
		const first = await manager.validateClient(RESOURCE_SERVER, SECRET);
		const second = await manager.validateClient(RESOURCE_SERVER, SECRET);
		const third = await manager.validateClient(RESOURCE_SERVER, SECRET);

		expect(first?.clientId).toBe(RESOURCE_SERVER);
		expect(second).toBe(first);
		expect(third).toBe(first);
		expect(mockCompare).toHaveBeenCalledTimes(1);
	});

	it('still refuses a wrong secret, comparing it with bcrypt every time', async () => {
		await manager.validateClient(RESOURCE_SERVER, SECRET);

		expect(await manager.validateClient(RESOURCE_SERVER, 'wrong-secret')).toBeNull();
		expect(await manager.validateClient(RESOURCE_SERVER, 'wrong-secret')).toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(3);

		// The wrong attempts did not displace the right secret
		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).not.toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(3);
	});

	it('never remembers a failure', async () => {
		expect(await manager.validateClient(RESOURCE_SERVER, 'wrong-secret')).toBeNull();
		expect(cache.size).toBe(0);

		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).not.toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(2);
	});

	it('verifies again once the stored hash changed (a rotated secret)', async () => {
		await manager.validateClient(RESOURCE_SERVER, SECRET);
		manager.getClient(RESOURCE_SERVER)!.clientSecretHash = mockHash(ROTATED);

		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).toBeNull();
		expect(await manager.validateClient(RESOURCE_SERVER, ROTATED)).not.toBeNull();
		expect(await manager.validateClient(RESOURCE_SERVER, ROTATED)).not.toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(3);
	});

	it('verifies again once the TTL has passed', async () => {
		await manager.validateClient(RESOURCE_SERVER, SECRET);

		clock += VERIFIED_CLIENT_SECRET_TTL_MS - 1;
		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).not.toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(1);

		// Counted from the verification: the hit above did not extend it
		clock += 1;
		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).not.toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(2);
	});

	it('refuses a disabled client, and verifies it again with bcrypt once it is enabled', async () => {
		await manager.validateClient(RESOURCE_SERVER, SECRET);
		const client = manager.getClient(RESOURCE_SERVER)!;

		client.isActive = false;
		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).toBeNull();
		expect(cache.size).toBe(0);

		client.isActive = true;
		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).not.toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(2);
	});

	it('refuses a client disabled while its secret was being compared, and verifies it again once enabled', async () => {
		const client = manager.getClient(RESOURCE_SERVER)!;
		const validating = manager.validateClient(RESOURCE_SERVER, SECRET);
		client.isActive = false;

		expect(await validating).toBeNull();
		expect(cache.size).toBe(0);

		client.isActive = true;
		expect(await manager.validateClient(RESOURCE_SERVER, SECRET)).not.toBeNull();
		expect(mockCompare).toHaveBeenCalledTimes(2);
	});

	it('forgets the secret of a dynamically registered client that is forgotten', async () => {
		const small = silence(new OAuth2ClientManager(1, cache));
		const registration = (name: string) =>
			small.registerClient({ client_name: name, redirect_uris: ['https://client.example.com/callback'] });
		const first = await registration('first');
		expect(await small.validateClient(first.client_id, first.client_secret)).not.toBeNull();
		expect(cache.size).toBe(1);

		await registration('second');

		expect(small.getClient(first.client_id)).toBeNull();
		expect(cache.size).toBe(0);
		expect(await small.validateClient(first.client_id, first.client_secret)).toBeNull();
	});

	it('shares one bcrypt comparison between concurrent requests', async () => {
		const results = await Promise.all(
			Array.from({ length: 5 }, () => manager.validateClient(RESOURCE_SERVER, SECRET))
		);

		expect(results.every((client) => client?.clientId === RESOURCE_SERVER)).toBe(true);
		expect(mockCompare).toHaveBeenCalledTimes(1);
	});

	it('keeps no plaintext secret', async () => {
		await manager.validateClient(RESOURCE_SERVER, SECRET);
		const entries = [...((cache as any).entries as Map<string, any>).values()];

		expect(entries).toHaveLength(1);
		expect(JSON.stringify(entries)).not.toContain(SECRET);
		expect((entries[0].digest as Buffer).includes(Buffer.from(SECRET))).toBe(false);
	});
});

describe('VerifiedClientSecretCache', () => {
	const compare = (secret: string, hash: string) => Promise.resolve(hash === `hashed:${secret}`);

	it('keeps at most its bound, forgetting the least recently used client', async () => {
		const cache = new VerifiedClientSecretCache(VERIFIED_CLIENT_SECRET_TTL_MS, 2);
		const counted = jest.fn(compare);

		await cache.verify('a', 'secret-a', 'hashed:secret-a', counted);
		await cache.verify('b', 'secret-b', 'hashed:secret-b', counted);
		await cache.verify('a', 'secret-a', 'hashed:secret-a', counted); // a is now the most recently used
		await cache.verify('c', 'secret-c', 'hashed:secret-c', counted);

		expect(cache.size).toBe(2);
		expect(counted).toHaveBeenCalledTimes(3);
		await cache.verify('a', 'secret-a', 'hashed:secret-a', counted);
		expect(counted).toHaveBeenCalledTimes(3);
		await cache.verify('b', 'secret-b', 'hashed:secret-b', counted);
		expect(counted).toHaveBeenCalledTimes(4);
	});

	it('does not remember a comparison the client was forgotten during, nor share it afterwards', async () => {
		const cache = new VerifiedClientSecretCache();
		const resolvers: Array<(valid: boolean) => void> = [];
		const deferred = () => new Promise<boolean>((resolve) => resolvers.push(resolve));

		const before = cache.verify('a', 'secret-a', 'hashed:secret-a', deferred);
		cache.forget('a');
		const after = cache.verify('a', 'secret-a', 'hashed:secret-a', deferred);
		// The verification after `forget` did not join the comparison started before it
		expect(resolvers).toHaveLength(2);

		resolvers[0](true);
		expect(await before).toBe(true);
		expect(cache.size).toBe(0);

		resolvers[1](true);
		expect(await after).toBe(true);
		expect(cache.size).toBe(1);
	});

	it('verifies a forgotten client again with bcrypt', async () => {
		const cache = new VerifiedClientSecretCache();
		const resolvers: Array<(valid: boolean) => void> = [];
		const deferred = () => new Promise<boolean>((resolve) => resolvers.push(resolve));
		const counted = jest.fn(compare);

		const verifying = cache.verify('a', 'secret-a', 'hashed:secret-a', deferred);
		cache.forget('a');
		resolvers[0](true);
		await verifying;

		expect(await cache.verify('a', 'secret-a', 'hashed:secret-a', counted)).toBe(true);
		expect(counted).toHaveBeenCalledTimes(1);
	});

	it('does not remember a comparison that failed with an error', async () => {
		const cache = new VerifiedClientSecretCache();
		const failing = () => Promise.reject(new Error('bcrypt failed'));

		await expect(cache.verify('a', 'secret-a', 'hashed:secret-a', failing)).rejects.toThrow('bcrypt failed');
		expect(cache.size).toBe(0);
		expect(await cache.verify('a', 'secret-a', 'hashed:secret-a', compare)).toBe(true);
	});
});
