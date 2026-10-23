/**
 * The service imports only entity classes and the password hasher from `@gauzy/core`; stand-ins keep the
 * whole core module (and its entity graph) out of this spec.
 */
jest.mock('@gauzy/core', () => ({
	Employee: class Employee {},
	User: class User {},
	PasswordHashService: class PasswordHashService {}
}));

import { oAuth2ClientManager } from '@gauzy/auth';
import { McpOAuthService } from './mcp-oauth.service';

/**
 * Owner decision 7 (2026-10-22): the MCP server asks mcp-auth whether each token is active. mcp-auth answers only
 * the resource server the operator configured, with the same two variables the MCP server presents.
 */
describe('McpOAuthService — registering the MCP server for introspection', () => {
	const SECRET = 'a-resource-server-secret-of-32-characters!';
	const saved = { ...process.env };

	function build() {
		const service: McpOAuthService = Object.create(McpOAuthService.prototype);
		Object.assign(service, { logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn() } });
		return service as any;
	}

	afterEach(() => {
		process.env = { ...saved };
		jest.restoreAllMocks();
	});

	it('registers the configured client as the resource server', async () => {
		process.env.MCP_AUTH_INTROSPECTION_CLIENT_ID = 'mcp-server';
		process.env.MCP_AUTH_INTROSPECTION_CLIENT_SECRET = SECRET;
		const register = jest.spyOn(oAuth2ClientManager, 'registerResourceServer').mockResolvedValue(undefined);

		await build().registerMcpServer();

		expect(register).toHaveBeenCalledWith('mcp-server', SECRET);
	});

	it('registers nothing, and says so, without the credentials', async () => {
		delete process.env.MCP_AUTH_INTROSPECTION_CLIENT_ID;
		delete process.env.MCP_AUTH_INTROSPECTION_CLIENT_SECRET;
		const register = jest.spyOn(oAuth2ClientManager, 'registerResourceServer');
		const service = build();

		await service.registerMcpServer();

		expect(register).not.toHaveBeenCalled();
		expect(service.logger.warn).toHaveBeenCalled();
	});

	it('keeps starting, and logs why, when the credentials are refused', async () => {
		process.env.MCP_AUTH_INTROSPECTION_CLIENT_ID = 'mcp-server';
		process.env.MCP_AUTH_INTROSPECTION_CLIENT_SECRET = 'short';
		const service = build();

		await expect(service.registerMcpServer()).resolves.toBeUndefined();
		expect(service.logger.error).toHaveBeenCalled();
	});
});
