/**
 * How a tenant request reaches Activepieces (decision 13).
 *
 * Activepieces API keys belong to a whole platform. The installation's key used to be the silent fallback of every
 * tenant without a key of its own, unconfined: such a tenant could reach any other tenant's projects. Now a tenant
 * runs under its own key, a project token of its own project, or the installation's key pinned to its own project.
 */
const mockCurrentTenantId = jest.fn();

jest.mock('@gauzy/core', () => ({
	RequestContext: { currentTenantId: () => mockCurrentTenantId() },
	IntegrationService: class {},
	IntegrationSettingService: class {},
	IntegrationTenantService: class {}
}));
jest.mock('@gauzy/config', () => ({ ConfigService: class {} }));

import { BadGatewayException, BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { createVerify, generateKeyPairSync } from 'crypto';
import { of } from 'rxjs';
import { ActivepiecesConnectionMode, ActivepiecesSettingName } from '@gauzy/contracts';
import { ACTIVEPIECES_MANAGED_AUTHN_URL, ACTIVEPIECES_PROJECTS_URL } from './activepieces.config';
import { ActivepiecesCredentialsService, IActivepiecesCredential } from './activepieces-credentials.service';

const TENANT = 'tenant-a';
const HOUR = 60 * 60 * 1000;

type Responder = (config: { method: string; url: string; params?: any; data?: any; headers?: any }) => unknown;

function setup(options: { config?: Record<string, unknown>; rows?: any[]; respond?: Responder } = {}) {
	const http = {
		request: jest.fn((config: any) => of({ data: options.respond ? options.respond(config) : undefined }))
	};
	const config = {
		get: jest.fn(() => ({
			apiKey: '',
			signingKeyId: '',
			signingPrivateKey: '',
			tenantProjectsEnabled: true,
			projectExternalIdPrefix: '',
			...(options.config ?? {})
		}))
	};
	const integrationTenantService = {
		find: jest.fn().mockResolvedValue(options.rows ?? []),
		create: jest.fn().mockResolvedValue({ id: 'it-new' })
	};
	const integrationSettingService = { saveMany: jest.fn().mockResolvedValue([]) };
	const integrationService = {
		findOneByOptions: jest.fn().mockResolvedValue({ id: 'integration-1' }),
		create: jest.fn()
	};
	const service = new ActivepiecesCredentialsService(
		http as any,
		config as any,
		integrationService as any,
		integrationTenantService as any,
		integrationSettingService as any
	);
	return { service, http, integrationTenantService, integrationSettingService };
}

function row(id: string, settings: Record<string, string>, organizationId: string | null = null) {
	return {
		id,
		tenantId: TENANT,
		organizationId,
		settings: Object.entries(settings).map(([settingsName, settingsValue]) => ({ settingsName, settingsValue }))
	};
}

/** An unsigned JWT stating an expiry, as the project token Activepieces issues. */
function tokenExpiringAt(expiresAtMs: number, marker: string): string {
	const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
	return `${part({ alg: 'HS256' })}.${part({ exp: Math.floor(expiresAtMs / 1000), marker })}.signature`;
}

describe('ActivepiecesCredentialsService', () => {
	beforeAll(() => Logger.overrideLogger(false));
	beforeEach(() => mockCurrentTenantId.mockReturnValue(TENANT));
	afterEach(() => jest.restoreAllMocks());

	describe('a tenant without a key of its own, under the installation key', () => {
		it("is pinned to its own project, found by its external id, and never to a project the client names", async () => {
			const { service, http } = setup({
				config: { apiKey: 'platform-key' },
				respond: ({ method, url }) =>
					method === 'get' && url === ACTIVEPIECES_PROJECTS_URL
						? {
								data: [
									// Another tenant's project is never taken, whatever Activepieces answers
									{ id: 'proj-b', externalId: 'gauzy-tenant-tenant-b', created: '2026-01-01' },
									{ id: 'proj-a', externalId: 'gauzy-tenant-tenant-a', created: '2026-02-01' }
								]
						  }
						: undefined
			});

			const credential = await service.resolve();

			expect(credential).toEqual({
				mode: ActivepiecesConnectionMode.PLATFORM_PROJECT,
				token: 'platform-key',
				projectId: 'proj-a',
				enforceProject: true
			});
			expect(http.request).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'get',
					url: ACTIVEPIECES_PROJECTS_URL,
					params: expect.objectContaining({ externalId: 'gauzy-tenant-tenant-a' }),
					headers: expect.objectContaining({ Authorization: 'Bearer platform-key' })
				})
			);

			expect(service.projectFor(credential)).toBe('proj-a');
			expect(service.projectFor(credential, ' proj-a ')).toBe('proj-a');
			expect(() => service.projectFor(credential, 'proj-b')).toThrow(ForbiddenException);
		});

		it('gets a project created once, then reused', async () => {
			const { service, http } = setup({
				config: { apiKey: 'platform-key' },
				respond: ({ method, url }) => {
					if (method === 'get' && url === ACTIVEPIECES_PROJECTS_URL) return { data: [] };
					if (method === 'post' && url === ACTIVEPIECES_PROJECTS_URL) return { id: 'proj-new' };
					return undefined;
				}
			});

			const first = await service.resolve();
			const second = await service.resolve();

			expect(first.projectId).toBe('proj-new');
			expect(second.projectId).toBe('proj-new');
			const creations = http.request.mock.calls.filter(([config]: any[]) => config.method === 'post');
			expect(creations).toHaveLength(1);
			expect(creations[0][0].data).toEqual(expect.objectContaining({ externalId: 'gauzy-tenant-tenant-a' }));
			// Found none, created one, then reused from the cache
			expect(http.request).toHaveBeenCalledTimes(2);
		});

		it.each([
			['a server error (the unique index on the insert)', 500],
			['409 PROJECT_EXTERNAL_ID_ALREADY_EXISTS', 409]
		])(
			'uses the project another API server created at the same moment, when its own create fails with %s',
			async (_label, status) => {
				let lists = 0;
				const { service, http } = setup({ config: { apiKey: 'platform-key' } });
				http.request.mockImplementation((config: any) => {
					if (config.method === 'get' && config.url === ACTIVEPIECES_PROJECTS_URL) {
						lists++;
						// None at first; after the failed create, the other server's project holds the external id
						return of({
							data: { data: lists === 1 ? [] : [{ id: 'proj-other', externalId: 'gauzy-tenant-tenant-a' }] }
						}) as any;
					}
					if (config.method === 'post' && config.url === ACTIVEPIECES_PROJECTS_URL) {
						throw Object.assign(new Error('Request failed'), { response: { status } });
					}
					return of({ data: undefined }) as any;
				});

				const credential = await service.resolve();

				expect(credential.projectId).toBe('proj-other');
				expect(lists).toBe(2);
				// Activepieces keeps one live project per external id: there is no duplicate to rename
				expect(http.request.mock.calls.filter(([config]: any[]) => config.method === 'post')).toHaveLength(1);
			}
		);

		it('answers the failure when the create fails and no project holds the external id', async () => {
			const { service, http } = setup({ config: { apiKey: 'platform-key' } });
			http.request.mockImplementation((config: any) => {
				if (config.method === 'post') {
					throw Object.assign(new Error('Request failed'), { response: { status: 500 } });
				}
				return of({ data: { data: [] } }) as any;
			});

			await expect(service.resolve()).rejects.toBeInstanceOf(BadGatewayException);
		});

		it('names its project with the configured prefix', async () => {
			const { service, http } = setup({
				config: { apiKey: 'platform-key', projectExternalIdPrefix: 'stage-gauzy-' },
				respond: () => ({ data: [{ id: 'proj-s', externalId: 'stage-gauzy-tenant-a' }] })
			});

			expect((await service.resolve()).projectId).toBe('proj-s');
			expect(http.request.mock.calls[0][0].params.externalId).toBe('stage-gauzy-tenant-a');
		});

		it('is not connected when the operator turned tenant projects off, and is not told about the installation key', async () => {
			const { service, http } = setup({ config: { apiKey: 'platform-key', tenantProjectsEnabled: false } });

			const refusal = await service.resolve().catch((error) => error);

			expect(refusal).toBeInstanceOf(BadRequestException);
			expect(refusal.message).not.toContain('GAUZY_ACTIVEPIECES_API_KEY');
			expect(http.request).not.toHaveBeenCalled();
		});

		it('is not connected when the installation has no Activepieces credentials', async () => {
			const { service } = setup();

			await expect(service.resolve()).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe('the mode', () => {
		it("is the tenant's own key when it has one, with no project pinned, as before", async () => {
			const { service, http } = setup({
				config: { apiKey: 'platform-key' },
				rows: [row('it-org', {}, 'org-1'), row('it-1', { [ActivepiecesSettingName.API_KEY]: 'tenant-key' })]
			});

			const credential = await service.resolve({ integrationTenantId: 'it-org' });

			expect(credential).toEqual({
				mode: ActivepiecesConnectionMode.TENANT_API_KEY,
				token: 'tenant-key',
				projectId: null,
				enforceProject: false
			});
			expect(service.projectFor(credential, 'their-project')).toBe('their-project');
			expect(() => service.projectFor(credential)).toThrow(BadRequestException);
			expect(http.request).not.toHaveBeenCalled();
		});

		it('is the one the tenant chose, the installation key pinned to its project even with a key of its own', async () => {
			const { service } = setup({
				config: { apiKey: 'platform-key' },
				rows: [
					row('it-1', {
						[ActivepiecesSettingName.API_KEY]: 'tenant-key',
						[ActivepiecesSettingName.CONNECTION_MODE]: ActivepiecesConnectionMode.PLATFORM_PROJECT
					})
				],
				respond: () => ({ data: [{ id: 'proj-a', externalId: 'gauzy-tenant-tenant-a' }] })
			});

			const credential = await service.resolve();

			expect(credential.mode).toBe(ActivepiecesConnectionMode.PLATFORM_PROJECT);
			expect(credential.projectId).toBe('proj-a');
		});

		it("is never another organization's choice", async () => {
			const { service, http } = setup({
				config: { apiKey: 'platform-key' },
				rows: [
					row('it-a', { [ActivepiecesSettingName.CONNECTION_MODE]: ActivepiecesConnectionMode.PLATFORM_PROJECT }, 'org-a'),
					row('it-b', { [ActivepiecesSettingName.API_KEY]: 'org-b-key' }, 'org-b')
				],
				respond: () => ({ data: [{ id: 'proj-a', externalId: 'gauzy-tenant-tenant-a' }] })
			});

			const organizationB = await service.resolve({ organizationId: 'org-b' });
			const viaRowB = await service.resolve({ integrationTenantId: 'it-b' });
			const organizationA = await service.resolve({ organizationId: 'org-a' });

			expect(organizationB).toEqual(expect.objectContaining({ mode: ActivepiecesConnectionMode.TENANT_API_KEY, token: 'org-b-key' }));
			expect(viaRowB.mode).toBe(ActivepiecesConnectionMode.TENANT_API_KEY);
			expect(organizationA.mode).toBe(ActivepiecesConnectionMode.PLATFORM_PROJECT);
			expect(http.request).toHaveBeenCalledTimes(1);
		});

		it("is saved on the organization's row it is read from, among legacy duplicates", async () => {
			const keyless = row('it-org-1', {}, 'org-1');
			const withKey = row('it-org-2', { [ActivepiecesSettingName.API_KEY]: 'org-key' }, 'org-1');
			const { service, integrationSettingService, integrationTenantService } = setup({
				config: { apiKey: 'platform-key' },
				rows: [keyless, withKey, row('it-tenant', { [ActivepiecesSettingName.CONNECTION_MODE]: 'auto' })]
			});

			await service.setMode(ActivepiecesConnectionMode.PLATFORM_PROJECT, 'org-1');

			expect(integrationSettingService.saveMany).toHaveBeenCalledWith([
				expect.objectContaining({
					settingsName: ActivepiecesSettingName.CONNECTION_MODE,
					settingsValue: ActivepiecesConnectionMode.PLATFORM_PROJECT,
					integration: { id: 'it-org-2' }
				})
			]);
			expect(integrationTenantService.create).not.toHaveBeenCalled();
		});

		it('refuses a chosen mode the installation does not offer', async () => {
			const { service } = setup({
				config: { apiKey: 'platform-key' },
				rows: [row('it-1', { [ActivepiecesSettingName.CONNECTION_MODE]: ActivepiecesConnectionMode.PROJECT_TOKEN })]
			});

			await expect(service.resolve()).rejects.toBeInstanceOf(BadRequestException);
		});

		it('records the pinned project on the tenant row', async () => {
			const { service, integrationSettingService } = setup({
				config: { apiKey: 'platform-key' },
				rows: [row('it-1', {})],
				respond: () => ({ data: [{ id: 'proj-a', externalId: 'gauzy-tenant-tenant-a' }] })
			});

			await service.resolve();

			expect(integrationSettingService.saveMany).toHaveBeenCalledWith([
				expect.objectContaining({
					settingsName: ActivepiecesSettingName.MANAGED_PROJECT_ID,
					settingsValue: 'proj-a',
					integration: { id: 'it-1' }
				})
			]);
		});
	});

	describe('project tokens', () => {
		const { privateKey, publicKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
			publicKeyEncoding: { type: 'spki', format: 'pem' }
		});
		// As an environment variable often carries it: one line, newlines escaped
		const escapedPrivateKey = privateKey.trim().replace(/\n/g, '\\n');

		function tokenSetup(issue: (call: number) => string) {
			let calls = 0;
			return setup({
				config: { apiKey: 'platform-key', signingKeyId: 'signing-key-1', signingPrivateKey: escapedPrivateKey },
				respond: ({ method, url }) =>
					method === 'post' && url === ACTIVEPIECES_MANAGED_AUTHN_URL
						? { token: issue(++calls), projectId: 'proj-a' }
						: undefined
			});
		}

		it("come before the installation key, for the tenant's own project, signed with the platform's signing key", async () => {
			const now = Date.parse('2026-10-24T00:00:00Z');
			jest.spyOn(Date, 'now').mockReturnValue(now);
			const { service, http } = tokenSetup(() => tokenExpiringAt(now + 7 * 24 * HOUR, 'first'));

			const credential: IActivepiecesCredential = await service.resolve();

			expect(credential).toEqual({
				mode: ActivepiecesConnectionMode.PROJECT_TOKEN,
				token: tokenExpiringAt(now + 7 * 24 * HOUR, 'first'),
				projectId: 'proj-a',
				enforceProject: true
			});

			const [{ data, headers }] = http.request.mock.calls[0];
			expect(headers.Authorization).toBeUndefined();
			const [header, claims, signature] = data.externalAccessToken.split('.');
			const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
			expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT', kid: 'signing-key-1' });
			expect(decode(claims)).toEqual(
				expect.objectContaining({
					externalUserId: 'gauzy-tenant-tenant-a',
					externalProjectId: 'gauzy-tenant-tenant-a',
					exp: Math.floor(now / 1000) + 300
				})
			);
			const verified = createVerify('RSA-SHA256')
				.update(`${header}.${claims}`)
				.verify(publicKey, Buffer.from(signature, 'base64url'));
			expect(verified).toBe(true);
		});

		it('are reused while far from expiry, and obtained again near it', async () => {
			const start = Date.parse('2026-10-24T00:00:00Z');
			const now = jest.spyOn(Date, 'now').mockReturnValue(start);
			// The first token expires in 26 hours: still more than a day left one hour later, less than a day three
			// hours later, well before the six-hour reuse limit
			const { service, http } = tokenSetup((call) =>
				call === 1 ? tokenExpiringAt(start + 26 * HOUR, 'first') : tokenExpiringAt(start + 7 * 24 * HOUR, 'second')
			);

			const first = await service.resolve();
			now.mockReturnValue(start + HOUR);
			const reused = await service.resolve();
			now.mockReturnValue(start + 3 * HOUR);
			const renewed = await service.resolve();

			expect(reused.token).toBe(first.token);
			expect(renewed.token).not.toBe(first.token);
			expect(renewed.token).toBe(tokenExpiringAt(start + 7 * 24 * HOUR, 'second'));
			expect(http.request).toHaveBeenCalledTimes(2);
		});

		it('are obtained again after six hours, however long they have left', async () => {
			const start = Date.parse('2026-10-24T00:00:00Z');
			const now = jest.spyOn(Date, 'now').mockReturnValue(start);
			const { service, http } = tokenSetup((call) => tokenExpiringAt(start + 7 * 24 * HOUR, `token-${call}`));

			await service.resolve();
			now.mockReturnValue(start + 7 * HOUR);
			await service.resolve();

			expect(http.request).toHaveBeenCalledTimes(2);
		});

		it('never log the token when Activepieces refuses', async () => {
			const error = jest.spyOn(Logger.prototype, 'error');
			const { service, http } = setup({
				config: { signingKeyId: 'signing-key-1', signingPrivateKey: escapedPrivateKey }
			});
			http.request.mockImplementation(() => {
				throw Object.assign(new Error('Request failed'), {
					response: { status: 401 },
					config: { headers: { Authorization: 'Bearer secret' } }
				});
			});

			await expect(service.resolve()).rejects.toThrow();
			for (const call of error.mock.calls) {
				expect(JSON.stringify(call)).not.toContain('secret');
			}
		});
	});

	describe('resources read by id', () => {
		const pinned: IActivepiecesCredential = {
			mode: ActivepiecesConnectionMode.PLATFORM_PROJECT,
			token: 'platform-key',
			projectId: 'proj-a',
			enforceProject: true
		};
		const own: IActivepiecesCredential = {
			mode: ActivepiecesConnectionMode.TENANT_API_KEY,
			token: 'tenant-key',
			projectId: null,
			enforceProject: false
		};

		it("are refused, as missing, outside the tenant's pinned project", () => {
			const { service } = setup();

			expect(() => service.assertInProject(pinned, 'proj-b', 'MCP server')).toThrow(NotFoundException);
			expect(() => service.assertInProject(pinned, ['proj-b', 'proj-c'], 'Activepieces connection')).toThrow(
				NotFoundException
			);
			expect(() => service.assertInProject(pinned, undefined, 'MCP server')).toThrow(NotFoundException);
			expect(() => service.assertInProject(pinned, ['proj-b', 'proj-a'], 'Activepieces connection')).not.toThrow();
		});

		it("are the tenant's own platform's with its own key", () => {
			const { service } = setup();

			expect(() => service.assertInProject(own, 'proj-b', 'MCP server')).not.toThrow();
		});
	});
});
