import { CLIENT_REGISTRATION_LIMITS, OAuth2ClientManager } from './oauth-client-manager';

/**
 * `POST /oauth2/register` is open to anyone, the server parsed up to 10 MB per request, and every registration was
 * kept in an in-memory map with no bound on its fields or on the number of clients: about a gigabyte per address per
 * rate-limit window. A registration now holds only what a real client needs, and past a cap a self-registered
 * client is forgotten: the oldest that never obtained a token, else the least recently used.
 */
describe('OAuth2ClientManager — dynamic registration bounds', () => {
	const valid = (overrides: Record<string, unknown> = {}) =>
		({
			client_name: 'MCP client',
			client_type: 'public',
			redirect_uris: ['https://client.example.com/callback'],
			...overrides
		}) as any;

	it('registers a client within the bounds (positive control)', async () => {
		const manager = new OAuth2ClientManager();
		const response = await manager.registerClient(valid({ metadata: { integration_type: 'custom' } }));

		expect(manager.getClient(response.client_id)).toBeTruthy();
	});

	it.each([
		['a huge client name', { client_name: 'x'.repeat(CLIENT_REGISTRATION_LIMITS.clientNameLength + 1) }],
		[
			'too many redirect URIs',
			{
				redirect_uris: Array.from(
					{ length: CLIENT_REGISTRATION_LIMITS.redirectUris + 1 },
					(_, i) => `https://client.example.com/${i}`
				)
			}
		],
		['a huge redirect URI', { redirect_uris: [`https://client.example.com/${'a'.repeat(5000)}`] }],
		['a redirect URI that is not a string', { redirect_uris: [{ huge: 'object' }] }],
		['huge metadata', { metadata: { blob: 'x'.repeat(CLIENT_REGISTRATION_LIMITS.metadataBytes) } }],
		['a long grant type list', { grant_types: Array.from({ length: 50 }, () => 'authorization_code') }],
		['a huge scope string', { scope: `mcp.read ${'x'.repeat(1000)}` }],
		['a huge logo URI', { logo_uri: `https://client.example.com/${'a'.repeat(5000)}` }],
		['a client name that is not a string', { client_name: { length: 1 } }]
	])('refuses %s', async (_label, overrides) => {
		const manager = new OAuth2ClientManager();

		await expect(manager.registerClient(valid(overrides))).rejects.toThrow(/Client registration failed/);
		expect(manager.listClients()).toHaveLength(0);
	});

	it('keeps at most the cap of self-registered clients, forgetting the oldest', async () => {
		const manager = new OAuth2ClientManager(3);
		const ids: string[] = [];
		for (let i = 0; i < 5; i++) {
			ids.push((await manager.registerClient(valid({ client_name: `client ${i}` }))).client_id);
		}

		expect(manager.listClients().map((client) => client.clientId)).toEqual(ids.slice(2));
		expect(manager.getClient(ids[0])).toBeFalsy();
	});

	/**
	 * Registration is public, and past the cap the oldest client was forgotten whatever it was doing: anyone could
	 * register clients until active ones were evicted, and their next refresh failed with `invalid_client`. A client
	 * that obtained a token is now forgotten only after every client that never did.
	 */
	describe('a client that obtained a token', () => {
		const register = async (manager: OAuth2ClientManager, name: string) =>
			(await manager.registerClient(valid({ client_name: name }))).client_id;

		it('is kept through a flood of registrations', async () => {
			const manager = new OAuth2ClientManager(3);
			const inUse = await register(manager, 'in use');
			manager.markClientUsed(inUse);

			for (let i = 0; i < 20; i++) {
				await register(manager, `flood ${i}`);
			}

			expect(manager.getClient(inUse)).toBeTruthy();
			expect(manager.listClients()).toHaveLength(3);
		});

		it('is forgotten, least recently used first, only once every kept client obtained one', async () => {
			const manager = new OAuth2ClientManager(2);
			const first = await register(manager, 'first');
			const second = await register(manager, 'second');
			manager.markClientUsed(first);
			manager.markClientUsed(second);
			manager.markClientUsed(first);

			const third = await register(manager, 'third');

			expect(manager.getClient(second)).toBeFalsy();
			expect(manager.getClient(first)).toBeTruthy();
			expect(manager.getClient(third)).toBeTruthy();
		});

		it('ignores a client it does not keep as dynamically registered', async () => {
			const manager = new OAuth2ClientManager(2);
			await manager.registerDefaultClients();
			manager.markClientUsed('chatgpt-mcp-client');
			manager.markClientUsed('never-registered');

			expect((manager as any).usedDynamicClientIds.size).toBe(0);
		});
	});

	it('never forgets a client the operator registered under its own id', async () => {
		const manager = new OAuth2ClientManager(2);
		await manager.registerDefaultClients();
		for (let i = 0; i < 5; i++) {
			await manager.registerClient(valid({ client_name: `client ${i}` }));
		}

		expect(manager.getClient('chatgpt-mcp-client')).toBeTruthy();
		expect(manager.getClient('claude-mcp-client')).toBeTruthy();
		expect(manager.listClients()).toHaveLength(4);
	});
});
