/**
 * The web app's Zapier pages called routes the API did not serve: `PUT /integration/zapier/settings` (the settings
 * form's save; `POST /settings` starts a new integration with a new OAuth state, it is no update) and
 * `GET /integration/zapier/oauth/config`. Both are served now: the update changes the integration of the caller's
 * organization only, and the OAuth configuration never carries the client secret.
 */
const mockCurrentTenantId = jest.fn();
const mockCurrentOrganizationId = jest.fn();
const mockAssertMembership = jest.fn();

// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). Every name it
// gives this file is replaced by a stand-in usable as a class, a decorator factory or a helper.
jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		// Called as a decorator factory: hand back a no-op decorator
		return new.target ? undefined : () => undefined;
	}
	return new Proxy(
		{
			DEFAULT_ENTITY_SETTINGS: [],
			PROJECT_TIED_ENTITIES: [],
			RequestContext: {
				currentTenantId: () => mockCurrentTenantId(),
				currentOrganizationId: () => mockCurrentOrganizationId()
			},
			assertCurrentUserBelongsToOrganization: (...args: unknown[]) => mockAssertMembership(...args)
		} as Record<string, unknown>,
		{
			get: (target, name: string) => (name in target ? target[name] : name === '__esModule' ? true : stub)
		}
	);
});
// The dialect decides how the settings writes are serialized: a row lock, or this process's queue
const mockRowLockDialect = jest.fn(() => false);
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => mockRowLockDialect(),
	isMySQL: () => false
}));

import { BadRequestException, ForbiddenException, NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IntegrationEnum } from '@gauzy/contracts';
import { ZapierService } from './zapier.service';
import { ZapierController } from './zapier.controller';
import { ZAPIER_OAUTH_SCOPES, ZAPIER_WEBHOOK_URL_MAX_LENGTH } from './zapier.config';

const INTEGRATION_ID = '7c5d1f3e-1d6a-4c55-9a0e-0f3e2a1b4c5d';
const ORGANIZATION_A = '2f1b6a0e-5c4d-4e3f-8a9b-0c1d2e3f4a5b';
const ORGANIZATION_B = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';

describe('Zapier settings update and OAuth configuration', () => {
	const integration = (settings: Record<string, unknown>[] = []) => ({
		id: INTEGRATION_ID,
		tenantId: 'tenant-1',
		organizationId: 'organization-1',
		settings
	});

	type Row = Record<string, any>;

	const build = ({
		found = integration() as unknown,
		stored = [] as Row[],
		zapierConfig = {} as Record<string, string>
	}: { found?: unknown; stored?: Row[]; zapierConfig?: Record<string, string> } = {}) => {
		// The integration's settings rows, as the transaction reads and writes them
		const rows: Row[] = stored.map((row) => ({ integrationId: INTEGRATION_ID, tenantId: 'tenant-1', ...row }));
		const bounded = (row: Row, where: Row) =>
			row['integrationId'] === where['integrationId'] && row['tenantId'] === where['tenantId'];
		const repository = {
			find: jest.fn(async ({ where }: { where: Row }) => {
				// Yields, as a database round trip does: two unserialized saves would both read before either writes
				await new Promise((resolve) => setImmediate(resolve));
				return rows.filter(
					(row) => bounded(row, where) && where['settingsName'].value.includes(row['settingsName'])
				);
			}),
			update: jest.fn(async (where: Row, patch: Row) => {
				const hit = rows.filter((row) => bounded(row, where) && row['settingsName'] === where['settingsName']);
				hit.forEach((row) => Object.assign(row, patch));
				return { affected: hit.length };
			}),
			save: jest.fn(async (row: Row) => {
				rows.push({ ...row });
				return row;
			})
		};
		const lock: Record<string, jest.Mock> = {
			select: jest.fn(),
			from: jest.fn(),
			where: jest.fn(),
			setLock: jest.fn(),
			getRawOne: jest.fn().mockResolvedValue({ id: INTEGRATION_ID })
		};
		['select', 'from', 'where', 'setLock'].forEach((step) => lock[step].mockReturnValue(lock));
		const transactionManager = {
			createQueryBuilder: jest.fn(() => lock),
			getRepository: jest.fn(() => repository)
		};
		const integrationTenantService = {
			// Both the update's lookup and the read after it go through `findOneByOptions`
			findOneByOptions: jest.fn(async () => {
				if (found instanceof Error) {
					throw found;
				}
				return found;
			}),
			findAll: jest.fn(async () => ({ items: found ? [found] : [], total: found ? 1 : 0 }))
		};
		const config = { get: jest.fn().mockReturnValue(zapierConfig) };
		const manager = {};
		const dataSource = {
			manager,
			transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(transactionManager))
		};
		const service = new ZapierService(
			{} as any,
			{} as any,
			{ typeOrmIntegrationSettingRepository: { target: 'IntegrationSetting' } } as any,
			{} as any,
			integrationTenantService as any,
			config as any,
			dataSource as any
		);
		jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		return { service, rows, repository, lock, dataSource, integrationTenantService, manager };
	};

	beforeEach(() => {
		mockCurrentTenantId.mockReturnValue('tenant-1');
		mockCurrentOrganizationId.mockReturnValue('organization-1');
		mockAssertMembership.mockResolvedValue(undefined);
		mockRowLockDialect.mockReturnValue(false);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('PUT /settings', () => {
		it('is served, next to the POST that starts an integration', () => {
			const handler = ZapierController.prototype.updateSettings;
			expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/settings');
			expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.PUT);
			expect(Reflect.getMetadata(METHOD_METADATA, ZapierController.prototype.initializeIntegration)).toBe(
				RequestMethod.POST
			);
		});

		it('updates the stored settings of the organization’s integration and answers them', async () => {
			const { service, rows, repository, integrationTenantService, manager } = build({
				stored: [
					{ id: 'setting-enabled', settingsName: 'is_enabled', settingsValue: 'false' },
					{ id: 'setting-url', settingsName: 'zapier_webhook_url', settingsValue: 'https://old.example.com' }
				]
			});

			await service.updateIntegrationSettings(
				{ isEnabled: true, webhookUrl: ' https://hooks.example.com/catch/1/abc ' },
				'organization-1'
			);

			expect(integrationTenantService.findOneByOptions.mock.calls[0][0]).toEqual(
				expect.objectContaining({
					where: expect.objectContaining({ tenantId: 'tenant-1', organizationId: 'organization-1' })
				})
			);
			expect(mockAssertMembership).toHaveBeenCalledWith(manager, 'organization-1');
			expect(repository.update).toHaveBeenCalledWith(
				{ integrationId: INTEGRATION_ID, tenantId: 'tenant-1', settingsName: 'is_enabled' },
				{ settingsValue: 'true' }
			);
			expect(repository.update).toHaveBeenCalledWith(
				{ integrationId: INTEGRATION_ID, tenantId: 'tenant-1', settingsName: 'zapier_webhook_url' },
				{ settingsValue: 'https://hooks.example.com/catch/1/abc' }
			);
			expect(repository.save).not.toHaveBeenCalled();
			expect(rows.map((row) => row['settingsValue'])).toEqual(['true', 'https://hooks.example.com/catch/1/abc']);
		});

		it('keeps the stored webhook URL when the body leaves it out', async () => {
			const { service, rows, repository } = build({
				stored: [
					{ settingsName: 'is_enabled', settingsValue: 'true' },
					{ settingsName: 'zapier_webhook_url', settingsValue: 'https://hooks.example.com/catch/1/abc' }
				]
			});

			await service.updateIntegrationSettings({ isEnabled: false });

			expect(repository.update).toHaveBeenCalledTimes(1);
			expect(rows).toEqual([
				expect.objectContaining({ settingsName: 'is_enabled', settingsValue: 'false' }),
				expect.objectContaining({
					settingsName: 'zapier_webhook_url',
					settingsValue: 'https://hooks.example.com/catch/1/abc'
				})
			]);
		});

		it('gives every stored row of a name the value, an earlier duplicate included', async () => {
			const { service, rows, repository } = build({
				stored: [
					{ settingsName: 'is_enabled', settingsValue: 'false' },
					{ settingsName: 'is_enabled', settingsValue: 'false' }
				]
			});

			await service.updateIntegrationSettings({ isEnabled: true });

			expect(repository.save).not.toHaveBeenCalled();
			expect(rows.map((row) => row['settingsValue'])).toEqual(['true', 'true']);
		});

		it('on Postgres and MySQL, locks the integration’s row before it reads the settings, in one transaction', async () => {
			mockRowLockDialect.mockReturnValue(true);
			const { service, repository, lock, dataSource } = build();

			await service.updateIntegrationSettings({ isEnabled: true, webhookUrl: '' });

			expect(dataSource.transaction).toHaveBeenCalledTimes(1);
			expect(lock['from']).toHaveBeenCalledWith('integration_tenant', 'integration');
			expect(lock['where']).toHaveBeenCalledWith('integration.id = :integrationId', {
				integrationId: INTEGRATION_ID
			});
			expect(lock['setLock']).toHaveBeenCalledWith('pessimistic_write');
			expect(lock['getRawOne'].mock.invocationCallOrder[0]).toBeLessThan(
				repository.find.mock.invocationCallOrder[0]
			);
		});

		it('on the embedded dialect, two simultaneous first saves insert each setting once', async () => {
			const { service, rows, lock } = build();

			await Promise.all([
				service.updateIntegrationSettings({
					isEnabled: true,
					webhookUrl: 'https://hooks.example.com/catch/1/a'
				}),
				service.updateIntegrationSettings({
					isEnabled: false,
					webhookUrl: 'https://hooks.example.com/catch/1/b'
				})
			]);

			expect(lock['setLock']).not.toHaveBeenCalled();
			expect(rows.map((row) => [row['settingsName'], row['settingsValue']])).toEqual([
				['is_enabled', 'false'],
				['zapier_webhook_url', 'https://hooks.example.com/catch/1/b']
			]);
		});

		it('refuses a webhook URL longer than the MySQL column holds, before any write', async () => {
			const { service, dataSource } = build();
			const webhookUrl = `https://hooks.example.com/${'a'.repeat(ZAPIER_WEBHOOK_URL_MAX_LENGTH)}`;

			await expect(service.updateIntegrationSettings({ isEnabled: true, webhookUrl })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(dataSource.transaction).not.toHaveBeenCalled();
		});

		it('creates the settings the integration does not hold yet, in its tenant and organization', async () => {
			const { service, repository } = build();

			await service.updateIntegrationSettings({ isEnabled: false, webhookUrl: null });

			expect(repository.save).toHaveBeenCalledWith({
				settingsName: 'is_enabled',
				settingsValue: 'false',
				tenantId: 'tenant-1',
				organizationId: 'organization-1',
				integrationId: INTEGRATION_ID
			});
			expect(repository.save).toHaveBeenCalledWith(
				expect.objectContaining({ settingsName: 'zapier_webhook_url', settingsValue: '' })
			);
		});

		it('takes the organization from the query, else from the Organization-Id header the web app sends', async () => {
			const updateIntegrationSettings = jest.fn().mockResolvedValue({});
			const controller = new ZapierController({ updateIntegrationSettings } as any);
			const body = { isEnabled: true, webhookUrl: null };

			await controller.updateSettings(body, ORGANIZATION_A, ORGANIZATION_B);
			await controller.updateSettings(body, undefined, ` ${ORGANIZATION_B} `);
			await controller.updateSettings(body, '', undefined);

			expect(updateIntegrationSettings.mock.calls).toEqual([
				[body, ORGANIZATION_A],
				[body, ORGANIZATION_B],
				[body, undefined]
			]);
		});

		it.each([
			['a repeated query parameter', [ORGANIZATION_A, ORGANIZATION_B], undefined],
			['a malformed query value', 'organization-1', undefined],
			['a malformed header', undefined, 'not-a-uuid']
		])('answers 400 for %s, before any lookup', async (_label, query, header) => {
			const updateIntegrationSettings = jest.fn();
			const controller = new ZapierController({ updateIntegrationSettings } as any);

			await expect(controller.updateSettings({ isEnabled: true }, query as any, header)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(updateIntegrationSettings).not.toHaveBeenCalled();
		});

		it('looks the integration up in the named organization, never in the user’s last one', async () => {
			mockCurrentOrganizationId.mockReturnValue('organization-last');
			const { service, integrationTenantService } = build();

			await service.updateIntegrationSettings({ isEnabled: true }, 'organization-9');
			await service.updateIntegrationSettings({ isEnabled: true });

			expect(integrationTenantService.findOneByOptions.mock.calls[0][0].where).toEqual(
				expect.objectContaining({ organizationId: 'organization-9' })
			);
			// Without an organization: the tenant's only integration, through `findAll`
			expect(integrationTenantService.findAll).toHaveBeenCalledWith(
				expect.objectContaining({ where: expect.not.objectContaining({ organizationId: expect.anything() }) })
			);
		});

		it('refuses a caller who is not a member of the integration’s organization, before writing', async () => {
			mockAssertMembership.mockRejectedValue(new ForbiddenException());
			const { service, repository } = build();

			await expect(service.updateIntegrationSettings({ isEnabled: true })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(repository.update).not.toHaveBeenCalled();
			expect(repository.save).not.toHaveBeenCalled();
		});

		it('answers 404 when the organization has no Zapier integration', async () => {
			const { service, repository } = build({ found: new NotFoundException() });

			await expect(
				service.updateIntegrationSettings({ isEnabled: true }, 'organization-1')
			).rejects.toBeInstanceOf(NotFoundException);
			expect(repository.save).not.toHaveBeenCalled();
		});

		it('refuses several integrations when no organization is known', async () => {
			const { service, integrationTenantService } = build();
			integrationTenantService.findAll.mockResolvedValue({ items: [integration(), integration()], total: 2 });

			await expect(service.updateIntegrationSettings({ isEnabled: true })).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it.each([
			['plain HTTP', 'http://hooks.example.com/catch'],
			['a loopback host', 'https://127.0.0.1/catch'],
			['the cloud metadata address', 'https://169.254.169.254/latest/meta-data'],
			['embedded credentials', 'https://user:secret@hooks.example.com/catch']
		])('refuses a webhook URL with %s, before any lookup', async (_label, webhookUrl) => {
			const { service, integrationTenantService } = build();

			await expect(service.updateIntegrationSettings({ isEnabled: true, webhookUrl })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(integrationTenantService.findOneByOptions).not.toHaveBeenCalled();
		});

		it('refuses a body without a boolean isEnabled', async () => {
			const { service } = build();

			await expect(service.updateIntegrationSettings({ isEnabled: 'yes' } as any)).rejects.toBeInstanceOf(
				BadRequestException
			);
		});

		it('reads the saved webhook URL back on GET /settings', async () => {
			const { service } = build({
				found: integration([
					{ settingsName: 'is_enabled', settingsValue: 'true' },
					{ settingsName: 'zapier_webhook_url', settingsValue: 'https://hooks.example.com/catch/1/abc' }
				])
			});

			await expect(service.getIntegrationSettings()).resolves.toEqual(
				expect.objectContaining({ isEnabled: true, webhookUrl: 'https://hooks.example.com/catch/1/abc' })
			);
		});
	});

	describe('GET /settings, scoped to an organization the caller belongs to', () => {
		it('passes the organization of the query, else of the header, and refuses a malformed one', async () => {
			const getIntegrationSettingsForCurrentUser = jest.fn().mockResolvedValue({});
			const controller = new ZapierController({ getIntegrationSettingsForCurrentUser } as any);

			await controller.getSettings(ORGANIZATION_A, ORGANIZATION_B);
			await controller.getSettings(undefined, ORGANIZATION_B);
			await controller.getSettings();
			await expect(controller.getSettings([ORGANIZATION_A, ORGANIZATION_B])).rejects.toBeInstanceOf(
				BadRequestException
			);

			expect(getIntegrationSettingsForCurrentUser.mock.calls).toEqual([
				[ORGANIZATION_A],
				[ORGANIZATION_B],
				[undefined]
			]);
		});

		it('reads the named organization’s integration, after checking the caller belongs to it', async () => {
			const { service, integrationTenantService, manager } = build({
				found: integration([
					{ settingsName: 'is_enabled', settingsValue: 'true' },
					{ settingsName: 'zapier_webhook_url', settingsValue: 'https://hooks.example.com/catch/1/abc' }
				])
			});

			await expect(service.getIntegrationSettingsForCurrentUser(ORGANIZATION_A)).resolves.toEqual(
				expect.objectContaining({ isEnabled: true, webhookUrl: 'https://hooks.example.com/catch/1/abc' })
			);
			expect(mockAssertMembership).toHaveBeenCalledWith(manager, ORGANIZATION_A);
			expect(integrationTenantService.findOneByOptions.mock.calls[0][0].where).toEqual(
				expect.objectContaining({ tenantId: 'tenant-1', organizationId: ORGANIZATION_A })
			);
		});

		it('refuses a caller outside the named organization, before reading anything', async () => {
			mockAssertMembership.mockRejectedValue(new ForbiddenException());
			const { service, integrationTenantService } = build();

			await expect(service.getIntegrationSettingsForCurrentUser(ORGANIZATION_A)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(integrationTenantService.findOneByOptions).not.toHaveBeenCalled();
		});

		it("without an organization, answers the tenant's only integration for a member of its organization", async () => {
			const { service, manager } = build();

			await service.getIntegrationSettingsForCurrentUser();
			expect(mockAssertMembership).toHaveBeenCalledWith(manager, 'organization-1');

			// The only integration belongs to an organization the caller is not in: its webhook URL is not answered
			mockAssertMembership.mockRejectedValue(new ForbiddenException());
			await expect(service.getIntegrationSettingsForCurrentUser()).rejects.toBeInstanceOf(ForbiddenException);
		});

		it('refuses several integrations without an organization, and answers the default without one', async () => {
			const several = build();
			several.integrationTenantService.findAll.mockResolvedValue({
				items: [integration(), integration()],
				total: 2
			});
			await expect(several.service.getIntegrationSettingsForCurrentUser()).rejects.toBeInstanceOf(
				BadRequestException
			);

			const none = build({ found: null });
			await expect(none.service.getIntegrationSettingsForCurrentUser()).resolves.toEqual({
				isEnabled: false,
				hasClientCredentials: false,
				hasAccessToken: false,
				hasRefreshToken: false,
				webhookUrl: null
			});
		});
	});

	describe('GET /oauth/config', () => {
		it('is served', () => {
			const handler = ZapierController.prototype.getOAuthConfig;
			expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/oauth/config');
			expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
		});

		it('answers the client ID, redirect URI, post-install URL and scopes, never the client secret', () => {
			const { service } = build({
				zapierConfig: {
					clientId: 'client-id',
					clientSecret: 'client-secret',
					redirectUri: 'https://api.example.com/api/integration/zapier/oauth/callback',
					postInstallUrl: 'https://app.example.com/#/pages/integrations/zapier'
				}
			});

			const config = service.getOAuthConfig();

			expect(config).toEqual({
				clientId: 'client-id',
				redirectUri: 'https://api.example.com/api/integration/zapier/oauth/callback',
				postInstallUrl: 'https://app.example.com/#/pages/integrations/zapier',
				scopes: ZAPIER_OAUTH_SCOPES.split(' ')
			});
			expect(JSON.stringify(config)).not.toContain('client-secret');
		});

		it('answers null for what the server does not configure', () => {
			const { service } = build({ zapierConfig: undefined });

			expect(service.getOAuthConfig()).toEqual(
				expect.objectContaining({ clientId: null, redirectUri: null, postInstallUrl: null })
			);
		});
	});

	describe('findIntegrationForCurrentUser', () => {
		it('reads a Zapier integration of the tenant and checks the caller’s membership', async () => {
			const { service, integrationTenantService, manager } = build();

			await expect(service.findIntegrationForCurrentUser(INTEGRATION_ID)).resolves.toEqual(
				expect.objectContaining({ id: INTEGRATION_ID, organizationId: 'organization-1' })
			);
			expect(integrationTenantService.findOneByOptions).toHaveBeenCalledWith({
				where: { id: INTEGRATION_ID, name: IntegrationEnum.ZAPIER }
			});
			expect(mockAssertMembership).toHaveBeenCalledWith(manager, 'organization-1');
		});

		it('answers 404 for a malformed ID without a lookup, and for a missing integration', async () => {
			const { service, integrationTenantService } = build({ found: new NotFoundException() });

			await expect(service.findIntegrationForCurrentUser('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
			expect(integrationTenantService.findOneByOptions).not.toHaveBeenCalled();
			await expect(service.findIntegrationForCurrentUser(INTEGRATION_ID)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(mockAssertMembership).not.toHaveBeenCalled();
		});
	});
});
