/**
 * Under the installation's Activepieces platform key, Activepieces answers a resource read by id from whichever project
 * of the platform it is in, and changes or deletes it there. A tenant pinned to its own project must therefore never
 * name another project, and never read, change, rotate or delete a resource of another project by its id (decision 13).
 */
const mockCurrentTenantId = jest.fn();

jest.mock('@gauzy/core', () => ({
	RequestContext: { currentTenantId: () => mockCurrentTenantId() },
	IntegrationService: class {},
	IntegrationSettingService: class {},
	IntegrationTenantService: class {},
	TenantOrganizationBaseDTO: class {}
}));
jest.mock('@gauzy/config', () => ({ ConfigService: class {} }));

import { HttpException, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { ActivepiecesConnectionMode, ActivepiecesSettingName } from '@gauzy/contracts';
import { ACTIVEPIECES_CONNECTIONS_URL, ACTIVEPIECES_MCP_SERVERS_URL } from './activepieces.config';
import { ActivepiecesCredentialsService, IActivepiecesCredential } from './activepieces-credentials.service';
import { ActivepiecesMcpService } from './activepieces-mcp.service';
import { ActivepiecesService } from './activepieces.service';

const PINNED: IActivepiecesCredential = {
	mode: ActivepiecesConnectionMode.PLATFORM_PROJECT,
	token: 'platform-key',
	projectId: 'proj-a',
	enforceProject: true
};

function credentialsFor(credential: IActivepiecesCredential) {
	const credentials = new ActivepiecesCredentialsService({} as any, {} as any, {} as any, {} as any, {} as any);
	jest.spyOn(credentials, 'resolve').mockResolvedValue(credential);
	return credentials;
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
	const error = await promise.then(
		() => undefined,
		(reason) => reason
	);
	expect(error).toBeInstanceOf(HttpException);
	return (error as HttpException).getStatus();
}

describe('Activepieces — a tenant pinned to its own project', () => {
	beforeAll(() => Logger.overrideLogger(false));
	beforeEach(() => mockCurrentTenantId.mockReturnValue('tenant-a'));

	describe('connections', () => {
		function connectionService(connection: { id: string; projectIds: string[] }) {
			const http = {
				get: jest.fn(() => of({ data: connection })),
				post: jest.fn(() => of({ data: { ...connection, id: 'conn-new', projectIds: ['proj-a'] } })),
				delete: jest.fn(() => of({ data: undefined }))
			};
			const integrationTenantService = {
				findOneByOptions: jest.fn().mockResolvedValue({
					id: 'it-1',
					tenantId: 'tenant-a',
					settings: [{ settingsName: ActivepiecesSettingName.CONNECTION_ID, settingsValue: connection.id }]
				}),
				find: jest.fn().mockResolvedValue([]),
				create: jest.fn().mockResolvedValue({ id: 'it-1' })
			};
			const integrationService = { findOneByOptions: jest.fn().mockResolvedValue({ id: 'integration-1' }) };
			const integrationSettingService = { saveMany: jest.fn().mockResolvedValue([]) };
			const service = new ActivepiecesService(
				http as any,
				{} as any,
				integrationService as any,
				integrationTenantService as any,
				integrationSettingService as any,
				credentialsFor(PINNED)
			);
			return { service, http };
		}

		it("refuses to return another project's connection read by id", async () => {
			const { service } = connectionService({ id: 'conn-b', projectIds: ['proj-b'] });

			expect(await statusOf(service.getConnection('it-1'))).toBe(404);
		});

		it("returns the tenant's own connection", async () => {
			const { service } = connectionService({ id: 'conn-a', projectIds: ['proj-a'] });

			await expect(service.getConnection('it-1')).resolves.toEqual({ id: 'conn-a', projectIds: ['proj-a'] });
		});

		it("never deletes another project's connection", async () => {
			const { service, http } = connectionService({ id: 'conn-b', projectIds: ['proj-b'] });

			expect(await statusOf(service.deleteConnection('it-1'))).toBe(404);
			expect(http.delete).not.toHaveBeenCalled();
		});

		it("deletes the tenant's own connection", async () => {
			const { service, http } = connectionService({ id: 'conn-a', projectIds: ['proj-a'] });

			await expect(service.deleteConnection('it-1')).resolves.toBe(true);
			expect(http.delete).toHaveBeenCalledWith(`${ACTIVEPIECES_CONNECTIONS_URL}/conn-a`, expect.anything());
		});

		it("lists the tenant's own project, refusing another one the client names", async () => {
			const { service, http } = connectionService({ id: 'conn-a', projectIds: ['proj-a'] });
			http.get.mockImplementation(() =>
				of({
					data: {
						data: [
							{ id: 'conn-a', projectIds: ['proj-a'] },
							{ id: 'conn-b', projectIds: ['proj-b'] }
						],
						next: null,
						previous: null
					}
				}) as any
			);

			expect(await statusOf(service.listConnections({ projectId: 'proj-b' }, 'it-1'))).toBe(403);

			const listed = await service.listConnections({}, 'it-1');
			expect(String((http.get.mock.calls[0] as any[])[0])).toContain('projectId=proj-a');
			expect(listed.data.map((connection) => connection.id)).toEqual(['conn-a']);
		});

		it('creates a connection in the tenant project when the client names none', async () => {
			const { service, http } = connectionService({ id: 'conn-a', projectIds: ['proj-a'] });

			await service.upsertConnection({ accessToken: 'gauzy-token' } as any);

			expect((http.post.mock.calls[0] as any[])[1]).toEqual(expect.objectContaining({ projectId: 'proj-a' }));
			expect((http.post.mock.calls[0] as any[])[2].headers.Authorization).toBe('Bearer platform-key');
		});
	});

	describe('MCP servers', () => {
		function mcpService(server: { id: string; projectId: string }) {
			const http = {
				request: jest.fn((config: any) =>
					of({
						data:
							config.method === 'get' && config.url === ACTIVEPIECES_MCP_SERVERS_URL
								? {
										data: [
											{ id: 'mcp-a', name: 'gauzy', projectId: 'proj-a' },
											{ id: 'mcp-b', name: 'gauzy', projectId: 'proj-b' }
										],
										next: null,
										previous: null
								  }
								: server
					})
				)
			};
			const service = new ActivepiecesMcpService(http as any, {} as any, {} as any, credentialsFor(PINNED));
			return { service, http };
		}

		it("refuses to return another project's server read by id", async () => {
			const { service } = mcpService({ id: 'mcp-b', projectId: 'proj-b' });

			expect(await statusOf(service.getMcpServer('mcp-b'))).toBe(404);
		});

		it.each([
			['update', (service: ActivepiecesMcpService) => service.updateMcpServer('mcp-b', { name: 'mine now' })],
			['rotate the token of', (service: ActivepiecesMcpService) => service.rotateMcpServerToken('mcp-b')]
		])("never lets the tenant %s another project's server", async (_label, call) => {
			const { service, http } = mcpService({ id: 'mcp-b', projectId: 'proj-b' });

			expect(await statusOf(call(service))).toBe(404);
			expect(http.request).toHaveBeenCalledTimes(1);
			expect(http.request.mock.calls[0][0]).toEqual(
				expect.objectContaining({ method: 'get', url: `${ACTIVEPIECES_MCP_SERVERS_URL}/mcp-b` })
			);
		});

		it("updates the tenant's own server", async () => {
			const { service, http } = mcpService({ id: 'mcp-a', projectId: 'proj-a' });

			await service.updateMcpServer('mcp-a', { name: 'renamed' });

			expect(http.request.mock.calls.map(([config]: any[]) => config.method)).toEqual(['get', 'post']);
		});

		it("lists the tenant's own project only, refusing another one the client names", async () => {
			const { service, http } = mcpService({ id: 'mcp-a', projectId: 'proj-a' });

			expect(await statusOf(service.listMcpServers({ projectId: 'proj-b' }))).toBe(403);

			const listed = await service.listMcpServers({});
			expect(http.request.mock.calls[0][0].params).toEqual(expect.objectContaining({ projectId: 'proj-a' }));
			expect(listed.data.map((server) => server.id)).toEqual(['mcp-a']);
		});
	});
});
