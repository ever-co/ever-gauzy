import { CLIENT_REGISTRATION_LIMITS, OAuth2ClientManager } from './oauth-client-manager';

/**
 * `POST /oauth2/register` is open to anyone, the server parsed up to 10 MB per request, and every registration was
 * kept in an in-memory map with no bound on its fields or on the number of clients: about a gigabyte per address per
 * rate-limit window. A registration now holds only what a real client needs, and the oldest self-registered client
 * is forgotten past a cap.
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
