import { OAuth2ClientManager } from './oauth-client-manager';

/**
 * The MCP server's collaboration tool groups are read and written under their own scopes (`chat:read`, `docs:write`,
 * …). A client registers them like the `mcp.*` scopes, and only those: any other scope it names is dropped.
 */
describe('OAuth2ClientManager — collaboration scopes', () => {
	const request = (scope?: string) =>
		({
			client_name: 'MCP client',
			client_type: 'public',
			redirect_uris: ['https://client.example.com/callback'],
			...(scope !== undefined && { scope })
		}) as any;

	it('registers the group scopes it names, and drops unknown ones', async () => {
		const manager = new OAuth2ClientManager();
		const response = await manager.registerClient(
			request('mcp.read chat:write docs:read chat:admin inbox:delete openid')
		);
		expect(manager.getClient(response.client_id)?.scopes).toEqual(['mcp.read', 'chat:write', 'docs:read']);
	});

	it('still registers mcp.read alone by default', async () => {
		const manager = new OAuth2ClientManager();
		const response = await manager.registerClient(request());
		expect(manager.getClient(response.client_id)?.scopes).toEqual(['mcp.read']);
	});

	it('refuses a registration that names no known scope', async () => {
		const manager = new OAuth2ClientManager();
		await expect(manager.registerClient(request('chat:admin'))).rejects.toThrow(/No valid scopes/);
	});
});
