// cspell:ignore Fplatforms
/**
 * Activepieces replaced its MCP API in November 2025 ("MCP 2.0"): the named servers listed and read by id at
 * `/v1/mcp-servers` gave way to one MCP server per project, at `/v1/projects/:projectId/mcp-server` (`GET` reads it,
 * `POST` updates its `disabledTools`, `POST …/rotate` rotates its token). The plugin still called the old routes. It
 * now calls the new ones (the old ones stay behind `GAUZY_ACTIVEPIECES_MCP_API=legacy`), keeping the tenant's project
 * pinned and the by-id ownership checks of #11410.
 *
 * Both APIs accept only user tokens (`securityAccess.project([PrincipalType.USER], …)`), never an API key: MCP works
 * in the `project_token` mode, and with a tenant's own key only when it is a user token. Any other credential is
 * refused here with 400 and an explanation, before anything is sent.
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
import { of, throwError } from 'rxjs';
import { ActivepiecesConnectionMode } from '@gauzy/contracts';
import { ACTIVEPIECES_MCP_SERVERS_URL, ACTIVEPIECES_PROJECTS_URL } from './activepieces.config';
import { ActivepiecesCredentialsService, IActivepiecesCredential } from './activepieces-credentials.service';
import {
	ActivepiecesMcpService,
	isActivepiecesApiKey,
	MCP_NEEDS_USER_TOKEN,
	projectMcpServerUpdate,
	projectMcpServerUrl
} from './activepieces-mcp.service';
import { ActivepiecesPlatformService } from './activepieces-platform.service';

const USER_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.user-token.signature';
const PROJECT_A_SERVER_URL = `${ACTIVEPIECES_PROJECTS_URL}/proj-a/mcp-server`;

/** A project token of the tenant's own project: a user token, pinned. */
const PROJECT_TOKEN: IActivepiecesCredential = {
	mode: ActivepiecesConnectionMode.PROJECT_TOKEN,
	token: USER_TOKEN,
	projectId: 'proj-a',
	enforceProject: true
};
/** The installation's API key, pinned to the tenant's own project. */
const PLATFORM_PROJECT: IActivepiecesCredential = {
	mode: ActivepiecesConnectionMode.PLATFORM_PROJECT,
	token: 'sk-platform-key',
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
/** The tenant's own key, an API key. */
const OWN_API_KEY: IActivepiecesCredential = { ...OWN_USER_TOKEN, token: 'sk-tenant-key' };

/** The project's one server, as `GET /v1/projects/:projectId/mcp-server` answers it. */
const server = (overrides: Record<string, unknown> = {}) => ({
	id: 'mcp-a',
	created: '2026-10-01T00:00:00.000Z',
	updated: '2026-10-01T00:00:00.000Z',
	platformId: 'platform-1',
	projectId: 'proj-a',
	type: 'PROJECT',
	token: 'mcp-token',
	disabledTools: [],
	flows: [],
	platformDisabledTools: [],
	...overrides
});

function system(
	credential: IActivepiecesCredential,
	{
		answer = server(),
		mcpApi = 'v2',
		projectTokens = true
	}: { answer?: unknown; mcpApi?: 'v2' | 'legacy'; projectTokens?: boolean } = {}
) {
	const credentials = new ActivepiecesCredentialsService({} as any, {} as any, {} as any, {} as any, {} as any);
	jest.spyOn(credentials, 'resolve').mockResolvedValue(credential);
	jest.spyOn(credentials, 'operatorSettings').mockReturnValue({
		platformApiKey: 'sk-platform-key',
		signingKeyId: projectTokens ? 'key-1' : '',
		signingPrivateKey: projectTokens ? 'pem' : '',
		tenantProjectsEnabled: true,
		externalIdPrefix: 'gauzy-tenant-',
		mcpApi
	});
	const http = {
		request: jest.fn((config: any) =>
			of({ data: config.method === 'get' ? answer : { ...server(), ...config.data } })
		)
	};
	const service = new ActivepiecesMcpService(http as any, {} as any, {} as any, credentials);
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

describe('Activepieces MCP 2.0 — the project’s one MCP server', () => {
	beforeAll(() => Logger.overrideLogger(false));
	beforeEach(() => mockCurrentTenantId.mockReturnValue('tenant-a'));
	afterEach(() => jest.restoreAllMocks());

	it('lists the server of the tenant’s own project, under its project token', async () => {
		const { service, calls } = system(PROJECT_TOKEN);

		const listed = await service.listMcpServers({});

		expect(calls()).toEqual([
			expect.objectContaining({
				method: 'get',
				url: PROJECT_A_SERVER_URL,
				headers: expect.objectContaining({ Authorization: `Bearer ${USER_TOKEN}` })
			})
		]);
		// No call to the routes Activepieces removed.
		expect(calls().some((config) => String(config.url).startsWith(ACTIVEPIECES_MCP_SERVERS_URL))).toBe(false);
		expect(listed).toEqual({ data: [server()], next: null, previous: null });
	});

	it('refuses another project the client names (403), and sends nothing', async () => {
		const { service, http } = system(PROJECT_TOKEN);

		expect((await refusal(service.listMcpServers({ projectId: 'proj-b' }))).getStatus()).toBe(403);
		expect(http.request).not.toHaveBeenCalled();
	});

	it('answers as missing (404) a server Activepieces states is in another project', async () => {
		const { service } = system(PROJECT_TOKEN, { answer: server({ projectId: 'proj-b' }) });

		expect((await refusal(service.listMcpServers({}))).getStatus()).toBe(404);
		expect((await refusal(service.getMcpServer('mcp-a'))).getStatus()).toBe(404);
	});

	it('reads a server by id through its project, and answers any other id as missing (404)', async () => {
		const { service, calls } = system(PROJECT_TOKEN);

		expect(await service.getMcpServer('mcp-a')).toEqual(server());
		expect((await refusal(service.getMcpServer('mcp-other'))).getStatus()).toBe(404);
		expect(calls().map((config) => [config.method, config.url])).toEqual([
			['get', PROJECT_A_SERVER_URL],
			['get', PROJECT_A_SERVER_URL]
		]);
	});

	it('updates the server’s disabledTools: reads it first, then posts the one setting MCP 2.0 has', async () => {
		const { service, calls } = system(PROJECT_TOKEN);

		const updated = await service.updateMcpServer('mcp-a', { disabledTools: ['ap_list_flows'] } as any);

		expect(calls().map((config) => [config.method, config.url, config.data])).toEqual([
			['get', PROJECT_A_SERVER_URL, undefined],
			['post', PROJECT_A_SERVER_URL, { disabledTools: ['ap_list_flows'] }]
		]);
		expect(updated.disabledTools).toEqual(['ap_list_flows']);
	});

	it.each([
		[
			'update',
			(service: ActivepiecesMcpService) => service.updateMcpServer('mcp-other', { disabledTools: [] } as any)
		],
		['rotate the token of', (service: ActivepiecesMcpService) => service.rotateMcpServerToken('mcp-other')]
	])('never lets the tenant %s a server it did not name: 404 after the read, nothing posted', async (_, call) => {
		const { service, calls } = system(PROJECT_TOKEN);

		expect((await refusal(call(service))).getStatus()).toBe(404);
		expect(calls().map((config) => config.method)).toEqual(['get']);
	});

	it('refuses a name or a tool list (400) before anything is sent: an MCP 2.0 server has neither', async () => {
		const { service, http } = system(PROJECT_TOKEN);

		for (const update of [{ name: 'renamed' }, { tools: [{ id: 'tool-1' }] }]) {
			expect((await refusal(service.updateMcpServer('mcp-a', update as any))).getStatus()).toBe(400);
		}
		expect(http.request).not.toHaveBeenCalled();
	});

	it('rotates the token of the project’s server', async () => {
		const { service, calls } = system(PROJECT_TOKEN);

		await service.rotateMcpServerToken('mcp-a');

		expect(calls().map((config) => [config.method, config.url])).toEqual([
			['get', PROJECT_A_SERVER_URL],
			['post', `${PROJECT_A_SERVER_URL}/rotate`]
		]);
	});

	it('answers the tenant’s servers as the server of its project (MCP 2.0 servers carry no name)', async () => {
		const { service } = system(PROJECT_TOKEN);

		expect(await service.getTenantMcpServers()).toEqual([server()]);
	});

	it('answers Activepieces’ refusal of the credential as 502, never as a 401/403 of this API', async () => {
		const { service, http } = system(PROJECT_TOKEN);
		for (const status of [401, 403]) {
			http.request.mockReturnValueOnce(throwError(() => ({ message: 'refused', response: { status } })) as any);

			const error = await refusal(service.listMcpServers({}));

			expect(error.getStatus()).toBe(502);
			expect(error.message).toContain('accept only a user token');
		}
	});
});

describe('Activepieces MCP — the connection modes that cannot use it', () => {
	beforeAll(() => Logger.overrideLogger(false));
	beforeEach(() => mockCurrentTenantId.mockReturnValue('tenant-a'));
	afterEach(() => jest.restoreAllMocks());

	const calls: Array<[string, (service: ActivepiecesMcpService) => Promise<unknown>]> = [
		['lists', (service) => service.listMcpServers({})],
		['reads', (service) => service.getMcpServer('mcp-a')],
		['updates', (service) => service.updateMcpServer('mcp-a', { disabledTools: [] } as any)],
		['rotates', (service) => service.rotateMcpServerToken('mcp-a')],
		['lists the tenant’s', (service) => service.getTenantMcpServers()]
	];

	it.each(calls)(
		'%s nothing under the installation’s API key (platform_project): 400, and nothing sent',
		async (_, call) => {
			for (const mcpApi of ['v2', 'legacy'] as const) {
				const { service, http } = system(PLATFORM_PROJECT, { mcpApi });

				const error = await refusal(call(service));

				expect(error.getStatus()).toBe(400);
				expect(error.message).toContain(MCP_NEEDS_USER_TOKEN);
				expect(error.message).toContain('platform_project');
				expect(http.request).not.toHaveBeenCalled();
			}
		}
	);

	it('names the mode that would work: project_token when the installation offers it, else a user token', async () => {
		const offered = await refusal(system(PLATFORM_PROJECT).service.listMcpServers({}));
		const notOffered = await refusal(system(PLATFORM_PROJECT, { projectTokens: false }).service.listMcpServers({}));

		expect(offered.message).toContain('project_token connection mode');
		expect(notOffered.message).toContain('user token of your own');
	});

	it.each(calls)('%s nothing with the tenant’s own API key: 400, and nothing sent', async (_, call) => {
		const { service, http } = system(OWN_API_KEY);

		const error = await refusal(call(service));

		expect(error.getStatus()).toBe(400);
		expect(error.message).toContain('API key');
		expect(http.request).not.toHaveBeenCalled();
	});

	it('works with the tenant’s own user token, in the project the client names (required then)', async () => {
		const { service, calls: sent } = system(OWN_USER_TOKEN, { answer: server({ projectId: 'own-project' }) });

		expect((await refusal(service.getMcpServer('mcp-a'))).getStatus()).toBe(400);
		expect(await service.getMcpServer('mcp-a', 'own-project')).toEqual(server({ projectId: 'own-project' }));
		expect(sent().map((config) => config.url)).toEqual([`${ACTIVEPIECES_PROJECTS_URL}/own-project/mcp-server`]);
	});
});

describe('Activepieces MCP 2.0 — URLs and bodies', () => {
	it('encodes the project into the URL, and refuses an empty one or one of dots', () => {
		expect(projectMcpServerUrl('proj-a')).toBe(PROJECT_A_SERVER_URL);
		expect(projectMcpServerUrl('../../platforms/p')).toBe(
			`${ACTIVEPIECES_PROJECTS_URL}/..%2F..%2Fplatforms%2Fp/mcp-server`
		);
		for (const id of ['', ' ', '.', '..']) {
			expect(() => projectMcpServerUrl(id)).toThrow(HttpException);
		}
	});

	it('tells an Activepieces API key (sk-…) from a user token', () => {
		expect(isActivepiecesApiKey('sk-abc')).toBe(true);
		expect(isActivepiecesApiKey(' sk-abc')).toBe(true);
		expect(isActivepiecesApiKey(USER_TOKEN)).toBe(false);
		expect(isActivepiecesApiKey(undefined)).toBe(false);
	});

	it('sends disabledTools alone, and nothing for an empty update', () => {
		expect(projectMcpServerUpdate({ disabledTools: ['a'] } as any)).toEqual({ disabledTools: ['a'] });
		expect(projectMcpServerUpdate({} as any)).toEqual({});
		expect(() => projectMcpServerUpdate({ name: 'x' } as any)).toThrow(HttpException);
	});
});

describe('Activepieces MCP — the legacy routes stay behind GAUZY_ACTIVEPIECES_MCP_API=legacy', () => {
	beforeAll(() => Logger.overrideLogger(false));
	beforeEach(() => mockCurrentTenantId.mockReturnValue('tenant-a'));
	afterEach(() => jest.restoreAllMocks());

	it('lists through /v1/mcp-servers, filtered to the pinned project', async () => {
		const { service, calls } = system(PROJECT_TOKEN, {
			mcpApi: 'legacy',
			answer: {
				data: [
					{ id: 'mcp-a', name: 'gauzy', projectId: 'proj-a' },
					{ id: 'mcp-b', name: 'gauzy', projectId: 'proj-b' }
				],
				next: null,
				previous: null
			}
		});

		const listed = await service.listMcpServers({});

		expect(calls()[0]).toEqual(
			expect.objectContaining({ url: ACTIVEPIECES_MCP_SERVERS_URL, params: { projectId: 'proj-a' } })
		);
		expect(listed.data.map((s) => s.id)).toEqual(['mcp-a']);
	});

	it('refuses disabledTools, an MCP 2.0 setting, before anything is sent', async () => {
		const { service, http } = system(PROJECT_TOKEN, { mcpApi: 'legacy' });

		expect((await refusal(service.updateMcpServer('mcp-a', { disabledTools: [] } as any))).getStatus()).toBe(400);
		expect(http.request).not.toHaveBeenCalled();
	});
});

describe('Activepieces MCP — the operator’s read of a project’s server', () => {
	beforeAll(() => Logger.overrideLogger(false));
	afterEach(() => jest.restoreAllMocks());

	function platform(platformApiKey: string, mcpApi: 'v2' | 'legacy' = 'v2') {
		const credentials = {
			operatorSettings: () => ({ platformApiKey, externalIdPrefix: 'gauzy-tenant-', mcpApi }),
			requestActivepieces: jest.fn(async (..._args: unknown[]) => server({ projectId: undefined }))
		};
		return { service: new ActivepiecesPlatformService(credentials as any), credentials };
	}

	it('refuses (400) an installation key that is an API key, which no MCP route accepts, and sends nothing', async () => {
		const { service, credentials } = platform('sk-platform-key');

		const error = await refusal(service.listMcpServers({ projectId: 'proj-a' } as any));

		expect(error.getStatus()).toBe(400);
		expect(error.message).toContain(MCP_NEEDS_USER_TOKEN);
		expect(credentials.requestActivepieces).not.toHaveBeenCalled();
	});

	it('reads the project’s one server through MCP 2.0 with a user token', async () => {
		const { service, credentials } = platform(USER_TOKEN);

		const listed = await service.listMcpServers({ projectId: 'proj-a' } as any);

		expect(credentials.requestActivepieces).toHaveBeenCalledWith(
			'get',
			PROJECT_A_SERVER_URL,
			USER_TOKEN,
			'read the MCP server of the project'
		);
		expect(listed).toEqual({ data: [server()], next: null, previous: null });
	});

	it('lists through the legacy route when the installation says so', async () => {
		const { service, credentials } = platform(USER_TOKEN, 'legacy');

		await service.listMcpServers({ projectId: 'proj-a' } as any);

		expect(credentials.requestActivepieces.mock.calls[0][1]).toBe(ACTIVEPIECES_MCP_SERVERS_URL);
	});
});
