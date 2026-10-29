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

import { BadRequestException, ForbiddenException, NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IntegrationEnum } from '@gauzy/contracts';
import { ZapierService } from './zapier.service';
import { ZapierController } from './zapier.controller';
import { ZAPIER_OAUTH_SCOPES } from './zapier.config';

const INTEGRATION_ID = '7c5d1f3e-1d6a-4c55-9a0e-0f3e2a1b4c5d';

describe('Zapier settings update and OAuth configuration', () => {
	const integration = (settings: Record<string, unknown>[] = []) => ({
		id: INTEGRATION_ID,
		tenantId: 'tenant-1',
		organizationId: 'organization-1',
		settings
	});

	const build = ({
		found = integration() as unknown,
		zapierConfig = {} as Record<string, string>
	}: { found?: unknown; zapierConfig?: Record<string, string> } = {}) => {
		const repository = {
			update: jest.fn().mockResolvedValue({ affected: 1 }),
			save: jest.fn(async (row: unknown) => row)
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
		const service = new ZapierService(
			{} as any,
			{} as any,
			{ typeOrmIntegrationSettingRepository: repository } as any,
			{} as any,
			integrationTenantService as any,
			config as any,
			{ manager } as any
		);
		jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		return { service, repository, integrationTenantService, manager };
	};

	beforeEach(() => {
		mockCurrentTenantId.mockReturnValue('tenant-1');
		mockCurrentOrganizationId.mockReturnValue('organization-1');
		mockAssertMembership.mockResolvedValue(undefined);
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
			const { service, repository, integrationTenantService, manager } = build({
				found: integration([
					{ id: 'setting-enabled', settingsName: 'is_enabled', settingsValue: 'false' },
					{ id: 'setting-url', settingsName: 'zapier_webhook_url', settingsValue: 'https://old.example.com' }
				])
			});

			await service.updateIntegrationSettings(
				{ isEnabled: true, webhookUrl: ' https://hooks.zapier.com/hooks/catch/1/abc ' },
				'organization-1'
			);

			expect(integrationTenantService.findOneByOptions.mock.calls[0][0]).toEqual(
				expect.objectContaining({
					where: expect.objectContaining({ tenantId: 'tenant-1', organizationId: 'organization-1' })
				})
			);
			expect(mockAssertMembership).toHaveBeenCalledWith(manager, 'organization-1');
			expect(repository.update).toHaveBeenCalledWith(
				{ id: 'setting-enabled', integrationId: INTEGRATION_ID, tenantId: 'tenant-1' },
				{ settingsValue: 'true' }
			);
			expect(repository.update).toHaveBeenCalledWith(
				{ id: 'setting-url', integrationId: INTEGRATION_ID, tenantId: 'tenant-1' },
				{ settingsValue: 'https://hooks.zapier.com/hooks/catch/1/abc' }
			);
			expect(repository.save).not.toHaveBeenCalled();
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

		it('reads the organization from the Organization-Id header when the query names none', async () => {
			mockCurrentOrganizationId.mockReturnValue('organization-9');
			const { service, integrationTenantService } = build();

			await service.updateIntegrationSettings({ isEnabled: true });

			expect(integrationTenantService.findOneByOptions.mock.calls[0][0].where).toEqual(
				expect.objectContaining({ organizationId: 'organization-9' })
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

			await expect(service.updateIntegrationSettings({ isEnabled: true })).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(repository.save).not.toHaveBeenCalled();
		});

		it('refuses several integrations when no organization is known', async () => {
			mockCurrentOrganizationId.mockReturnValue(undefined);
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
					{ settingsName: 'zapier_webhook_url', settingsValue: 'https://hooks.zapier.com/hooks/catch/1/abc' }
				])
			});

			await expect(service.getIntegrationSettings()).resolves.toEqual(
				expect.objectContaining({ isEnabled: true, webhookUrl: 'https://hooks.zapier.com/hooks/catch/1/abc' })
			);
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
