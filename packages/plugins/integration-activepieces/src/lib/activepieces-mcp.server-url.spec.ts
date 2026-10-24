import { BadRequestException } from '@nestjs/common';
import { ACTIVEPIECES_MCP_SERVERS_URL } from './activepieces.config';
import { ActivepiecesMcpService, mcpServerUrl } from './activepieces-mcp.service';

/**
 * `PATCH /integration/activepieces/mcp/:serverId` and `POST …/:serverId/rotate` put the route's id into the Activepieces
 * URL as it came, and Express decodes `%2F` in a route parameter: `..%2F..%2F<path>` turned them into POSTs to any other
 * path of the Activepieces API, under the installation's key when the tenant has none of its own.
 */
describe('Activepieces MCP server URLs', () => {
	const TRAVERSAL = '../../platforms/platform-1';

	it('keeps the server id one path segment', () => {
		expect(mcpServerUrl(TRAVERSAL)).toBe(`${ACTIVEPIECES_MCP_SERVERS_URL}/..%2F..%2Fplatforms%2Fplatform-1`);
		expect(mcpServerUrl('mcp-1')).toBe(`${ACTIVEPIECES_MCP_SERVERS_URL}/mcp-1`);
	});

	it('refuses an empty server id', () => {
		expect(() => mcpServerUrl(' ')).toThrow(BadRequestException);
	});

	it('refuses a dot segment, which the HTTP client would resolve to the server list or the API root', () => {
		expect(() => mcpServerUrl('.')).toThrow(BadRequestException);
		expect(() => mcpServerUrl('..')).toThrow(BadRequestException);
		expect(mcpServerUrl('...')).toBe(`${ACTIVEPIECES_MCP_SERVERS_URL}/...`);
	});

	it.each([
		['updates', (service: ActivepiecesMcpService) => service.updateMcpServer(TRAVERSAL, {} as any), ''],
		[
			'rotates the token of',
			(service: ActivepiecesMcpService) => service.rotateMcpServerToken(TRAVERSAL),
			'/rotate'
		],
		['reads', (service: ActivepiecesMcpService) => service.getMcpServer(TRAVERSAL), '']
	])('%s the server named, and no other path', async (_label, call, suffix) => {
		const service = new ActivepiecesMcpService({} as any, {} as any, {} as any);
		Object.assign(service, { logger: { log: jest.fn(), error: jest.fn() } });
		const request = jest.spyOn(service as any, 'request').mockResolvedValue({ id: 'mcp-1' });

		await call(service);

		expect(request.mock.calls[0][1]).toBe(
			`${ACTIVEPIECES_MCP_SERVERS_URL}/..%2F..%2Fplatforms%2Fplatform-1${suffix}`
		);
	});
});
