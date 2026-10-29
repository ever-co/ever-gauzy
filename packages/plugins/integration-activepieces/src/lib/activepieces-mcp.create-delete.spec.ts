/**
 * The web app's Activepieces service created and deleted MCP servers at `POST /integration/activepieces/mcp-server/:id`
 * and `DELETE /integration/activepieces/mcp-server/:id/:serverId`, which the API did not serve. They are served next to
 * the other MCP routes now, as `POST /integration/activepieces/mcp` and `DELETE /integration/activepieces/mcp/:serverId`:
 *
 * - on the legacy MCP API (`GAUZY_ACTIVEPIECES_MCP_API=legacy`) they call Activepieces' `POST /v1/mcp-servers`
 *   (`{ name, projectId }`) and `DELETE /v1/mcp-servers/:id`, in the tenant's own project when the credential pins one;
 * - under MCP 2.0 (the default) a project has exactly one server, created with it and never deleted, so both are refused
 *   with 400 and an explanation before anything is sent.
 */
const mockCurrentTenantId = jest.fn();

jest.mock('@gauzy/core', () => {
	const { SetMetadata } = jest.requireActual('@nestjs/common');
	const { PERMISSIONS_METADATA } = jest.requireActual('@gauzy/constants');
	return {
		RequestContext: { currentTenantId: () => mockCurrentTenantId() },
		IntegrationService: class {},
		IntegrationSettingService: class {},
		IntegrationTenantService: class {},
		TenantOrganizationBaseDTO: class {},
		TenantPermissionGuard: class {},
		PermissionGuard: class {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		UUIDValidationPipe: class {}
	};
});
jest.mock('@gauzy/config', () => ({ ConfigService: class {} }));

import { HttpException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { of } from 'rxjs';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ActivepiecesConnectionMode, PermissionsEnum } from '@gauzy/contracts';
import { ACTIVEPIECES_MCP_SERVERS_URL } from './activepieces.config';
import { ActivepiecesCredentialsService, IActivepiecesCredential } from './activepieces-credentials.service';
import { ActivepiecesMcpService, MCP_NEEDS_USER_TOKEN, MCP_ONE_SERVER_PER_PROJECT } from './activepieces-mcp.service';
import { ActivepiecesMcpController } from './activepieces-mcp.controller';

const USER_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.user-token.signature';

/** A project token of the tenant's own project: a user token, pinned. */
const PROJECT_TOKEN: IActivepiecesCredential = {
	mode: ActivepiecesConnectionMode.PROJECT_TOKEN,
	token: USER_TOKEN,
	projectId: 'proj-a',
	enforceProject: true
};
/** The tenant's own key, a user token: no project pinned. */
const OWN_USER_TOKEN: IActivepiecesCredential = {
	mode: ActivepiecesConnectionMode.TENANT_API_KEY,
	token: USER_TOKEN,
	projectId: null,
	enforceProject: false
};
/** The installation's API key, pinned to the tenant's own project. */
const PLATFORM_PROJECT: IActivepiecesCredential = {
	mode: ActivepiecesConnectionMode.PLATFORM_PROJECT,
	token: 'sk-platform-key',
	projectId: 'proj-a',
	enforceProject: true
};

/** A legacy server, as `/v1/mcp-servers` answers it. */
const legacyServer = (overrides: Record<string, unknown> = {}) => ({
	id: 'mcp-1',
	created: '2026-10-01T00:00:00.000Z',
	updated: '2026-10-01T00:00:00.000Z',
	projectId: 'proj-a',
	name: 'Gauzy tools',
	token: 'mcp-token',
	tools: [],
	...overrides
});

function system(
	credential: IActivepiecesCredential,
	{ answer = legacyServer(), mcpApi = 'legacy' }: { answer?: unknown; mcpApi?: 'v2' | 'legacy' } = {}
) {
	const credentials = new ActivepiecesCredentialsService({} as any, {} as any, {} as any, {} as any, {} as any);
	jest.spyOn(credentials, 'resolve').mockResolvedValue(credential);
	jest.spyOn(credentials, 'operatorSettings').mockReturnValue({
		platformApiKey: 'sk-platform-key',
		signingKeyId: 'key-1',
		signingPrivateKey: 'pem',
		tenantProjectsEnabled: true,
		externalIdPrefix: 'gauzy-tenant-',
		mcpApi
	});
	const http = {
		request: jest.fn((config: any) =>
			of({
				data: config.method === 'delete' ? '' : config.method === 'get' ? answer : { ...answer, ...config.data }
			})
		)
	};
	const service = new ActivepiecesMcpService(http as any, {} as any, {} as any, credentials);
	jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
	jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
	return { service, http, calls: () => http.request.mock.calls.map(([config]: any[]) => config) };
}

async function refusal(promise: Promise<unknown>): Promise<HttpException> {
	const error = await promise.then(
		() => undefined,
		(reason) => reason
	);
	expect(error).toBeInstanceOf(HttpException);
	return error as HttpException;
}

describe('Activepieces MCP server create and delete', () => {
	beforeEach(() => mockCurrentTenantId.mockReturnValue('tenant-1'));
	afterEach(() => jest.restoreAllMocks());

	describe('the routes', () => {
		it.each([
			['createMcpServer', '/', RequestMethod.POST, PermissionsEnum.INTEGRATION_ADD],
			['deleteMcpServer', '/:serverId', RequestMethod.DELETE, PermissionsEnum.INTEGRATION_DELETE]
		])('%s is served at %s, with its permission', (handler, path, method, permission) => {
			const route = (ActivepiecesMcpController.prototype as any)[handler];
			expect(Reflect.getMetadata(PATH_METADATA, route)).toBe(path);
			expect(Reflect.getMetadata(METHOD_METADATA, route)).toBe(method);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, route)).toEqual([permission]);
		});

		it('answers the created server without its token', async () => {
			const { service } = system(PROJECT_TOKEN);
			const controller = new ActivepiecesMcpController(service);

			const created = await controller.createMcpServer({ name: 'Gauzy tools' }, {});

			expect(created).toEqual(expect.objectContaining({ id: 'mcp-1', name: 'Gauzy tools', projectId: 'proj-a' }));
			expect(created).not.toHaveProperty('token');
		});
	});

	describe('under MCP 2.0 (the default)', () => {
		it('refuses to create a server, sending nothing', async () => {
			const { service, http } = system(PROJECT_TOKEN, { mcpApi: 'v2' });

			const error = await refusal(service.createMcpServer({ name: 'Gauzy tools' }));

			expect(error.getStatus()).toBe(400);
			expect(error.message).toContain(MCP_ONE_SERVER_PER_PROJECT);
			expect(http.request).not.toHaveBeenCalled();
		});

		it('refuses to delete the project’s server, sending nothing', async () => {
			const { service, http } = system(PROJECT_TOKEN, { mcpApi: 'v2' });

			const error = await refusal(service.deleteMcpServer('mcp-1'));

			expect(error.getStatus()).toBe(400);
			expect(error.message).toContain(MCP_ONE_SERVER_PER_PROJECT);
			expect(http.request).not.toHaveBeenCalled();
		});
	});

	describe('on the legacy MCP API', () => {
		it("creates the server from its name, in the tenant's own project", async () => {
			const { service, calls } = system(PROJECT_TOKEN);

			await expect(service.createMcpServer({ name: '  Gauzy tools  ' })).resolves.toEqual(
				expect.objectContaining({ id: 'mcp-1', projectId: 'proj-a' })
			);
			expect(calls()).toEqual([
				expect.objectContaining({
					method: 'post',
					url: ACTIVEPIECES_MCP_SERVERS_URL,
					data: { name: 'Gauzy tools', projectId: 'proj-a' },
					headers: expect.objectContaining({ Authorization: `Bearer ${USER_TOKEN}` })
				})
			]);
		});

		it("lists a server it created in the tenant's pinned project, whatever its name", async () => {
			const { service, http } = system(PROJECT_TOKEN);
			const created = await service.createMcpServer({ name: 'Team tools' });
			http.request.mockImplementation((config: any) =>
				of({
					data:
						config.url === ACTIVEPIECES_MCP_SERVERS_URL
							? { data: [created, legacyServer({ id: 'mcp-other', projectId: 'proj-b' })], next: null }
							: created
				})
			);

			expect((await service.getTenantMcpServers()).map(({ id, name }) => [id, name])).toEqual([
				['mcp-1', 'Team tools']
			]);
		});

		it('refuses another project than the pinned one, sending nothing', async () => {
			const { service, http } = system(PROJECT_TOKEN);

			const error = await refusal(service.createMcpServer({ name: 'Gauzy tools' }, 'proj-b'));

			expect(error.getStatus()).toBe(403);
			expect(http.request).not.toHaveBeenCalled();
		});

		it("creates the server in the project the client names with the tenant's own key", async () => {
			const { service, calls } = system(OWN_USER_TOKEN, { answer: legacyServer({ projectId: 'proj-x' }) });

			await service.createMcpServer({ name: 'Gauzy tools' }, 'proj-x');

			expect(calls()[0].data).toEqual({ name: 'Gauzy tools', projectId: 'proj-x' });
		});

		it('refuses a server without a name, or one linked to an agent, sending nothing', async () => {
			const { service, http } = system(PROJECT_TOKEN);

			expect((await refusal(service.createMcpServer({ name: '   ' }))).getStatus()).toBe(400);
			expect(
				(await refusal(service.createMcpServer({ name: 'Gauzy tools', agentId: 'agent-1' }))).getStatus()
			).toBe(400);
			expect(http.request).not.toHaveBeenCalled();
		});

		it('refuses the installation’s API key, which Activepieces refuses on its MCP routes, sending nothing', async () => {
			const { service, http } = system(PLATFORM_PROJECT);

			const error = await refusal(service.createMcpServer({ name: 'Gauzy tools' }));

			expect(error.getStatus()).toBe(400);
			expect(error.message).toContain(MCP_NEEDS_USER_TOKEN);
			expect(http.request).not.toHaveBeenCalled();
		});

		it("deletes a server of the tenant's own project, after reading it", async () => {
			const { service, calls } = system(PROJECT_TOKEN);

			await expect(service.deleteMcpServer('mcp-1')).resolves.toBeUndefined();

			expect(calls().map(({ method, url }: any) => [method, url])).toEqual([
				['get', `${ACTIVEPIECES_MCP_SERVERS_URL}/mcp-1`],
				['delete', `${ACTIVEPIECES_MCP_SERVERS_URL}/mcp-1`]
			]);
		});

		it('answers a server of another project as missing, deleting nothing', async () => {
			const { service, calls } = system(PROJECT_TOKEN, { answer: legacyServer({ projectId: 'proj-b' }) });

			expect((await refusal(service.deleteMcpServer('mcp-1'))).getStatus()).toBe(404);
			expect(calls().map(({ method }: any) => method)).toEqual(['get']);
		});

		it('encodes the server id, and refuses one that is only dots', async () => {
			const { service, calls } = system(OWN_USER_TOKEN);

			await service.deleteMcpServer('../../projects');
			expect(calls()[0].url).toBe(`${ACTIVEPIECES_MCP_SERVERS_URL}/..%2F..%2Fprojects`);

			expect((await refusal(service.deleteMcpServer('..'))).getStatus()).toBe(400);
		});
	});
});
