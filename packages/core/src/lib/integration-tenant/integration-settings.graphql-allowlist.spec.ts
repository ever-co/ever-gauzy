import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { IntegrationEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { IntegrationSettingResolver } from '../integration-setting/integration-setting.resolver';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationTenantResolver } from './integration-tenant.resolver';
import { IntegrationTenantService } from './integration-tenant.service';

/**
 * The GraphQL twins of the allowlisted integration routes (SEC-E-03, GHSA-4rwq-65wh-45h4).
 *
 * A client may write only the integration settings on the allowlist (the Gauzy AI keys); `installation_id`, OAuth
 * tokens and account / workspace ids are written by the integrations themselves and the server trusts them. The REST
 * routes enforce that — `POST /integration-tenant` checks every stated setting, `PUT /integration-tenant/:id` accepts
 * no settings at all (its DTO whitelist strips them), `PUT /integration-setting/:id` goes through `updateEditableSetting`
 * — and the three GraphQL fields did none of it:
 *
 * - `createIntegrationTenant` planted any setting the caller named;
 * - `updateIntegrationTenant` handed `settings` to `bulkUpdateOrCreate`, which DELETES every setting of the integration
 *   and saves the caller's instead — the server-held tokens gone, the caller's planted;
 * - `updateIntegrationSetting` upserted any row by id through `create`, `settingsName` included.
 *
 * The real services, with the persistence boundary spied: whatever reaches the spy would have been written.
 */

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORGANIZATION_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const INTEGRATION_ID = 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0';
const ROW_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0';
const VICTIM_INSTALLATION_ID = '98765432';

describe('createIntegrationTenant writes only the settings the route lets a client write', () => {
	let resolver: IntegrationTenantResolver;
	let persist: jest.SpyInstance;

	const input = (name: IntegrationEnum, settings: unknown) =>
		({ name, organizationId: ORGANIZATION_ID, settings }) as never;

	beforeEach(() => {
		persist = jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity: any) => entity);
		resolver = new IntegrationTenantResolver(new IntegrationTenantService({} as any, {} as any), {} as any);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		[IntegrationEnum.GITHUB, 'installation_id'],
		[IntegrationEnum.GITHUB, 'access_token'],
		[IntegrationEnum.HUBSTAFF, 'access_token'],
		// A Gauzy AI key name on another provider's integration is not client-writable either.
		[IntegrationEnum.GITHUB, 'apiKey']
	])('refuses %s / %s, and nothing is written', async (provider, settingsName) => {
		// The failure scenario: a tenant admin binds their GitHub integration to another tenant's App installation.
		await expect(
			resolver.createIntegrationTenant(input(provider, [{ settingsName, settingsValue: VICTIM_INSTALLATION_ID }]))
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(persist).not.toHaveBeenCalled();
	});

	it('refuses a server-managed setting riding along with an allowlisted one', async () => {
		await expect(
			resolver.createIntegrationTenant(
				input(IntegrationEnum.GAUZY_AI, [
					{ settingsName: 'apiKey', settingsValue: 'key' },
					{ settingsName: 'access_token', settingsValue: 'planted' }
				])
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(persist).not.toHaveBeenCalled();
	});

	it('refuses settings that are not a list', async () => {
		await expect(
			resolver.createIntegrationTenant(input(IntegrationEnum.GITHUB, { settingsName: 'installation_id' }))
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(persist).not.toHaveBeenCalled();
	});

	it('connects with the allowlisted settings, and with none', async () => {
		await resolver.createIntegrationTenant(
			input(IntegrationEnum.GAUZY_AI, [{ settingsName: 'apiKey', settingsValue: 'key' }])
		);
		await resolver.createIntegrationTenant(input(IntegrationEnum.GITHUB, undefined));

		expect(persist).toHaveBeenCalledTimes(2);
	});
});

describe('updateIntegrationTenant changes the connection, never its settings — as the route', () => {
	let resolver: IntegrationTenantResolver;
	let commandBus: { execute: jest.Mock };

	beforeEach(() => {
		commandBus = { execute: jest.fn().mockResolvedValue({ id: INTEGRATION_ID }) };
		resolver = new IntegrationTenantResolver({} as any, commandBus as any);
	});

	it('refuses settings, before anything is dispatched', async () => {
		// The failure scenario: `bulkUpdateOrCreate` deleted the integration's server-held tokens and saved the caller's.
		await expect(
			resolver.updateIntegrationTenant({
				id: INTEGRATION_ID,
				organizationId: ORGANIZATION_ID,
				settings: [{ settingsName: 'installation_id', settingsValue: VICTIM_INSTALLATION_ID }]
			} as never)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('refuses even the allowlisted keys here: the bulk write would delete every other setting first', async () => {
		await expect(
			resolver.updateIntegrationTenant({
				id: INTEGRATION_ID,
				settings: [{ settingsName: 'apiKey', settingsValue: 'key' }]
			} as never)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('changes the state members, and dispatches no settings', async () => {
		await resolver.updateIntegrationTenant({ id: INTEGRATION_ID, isActive: false, settings: [] } as never);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command.id).toBe(INTEGRATION_ID);
		expect(command.input.isActive).toBe(false);
		expect(command.input.settings).toBeUndefined();
	});
});

describe('updateIntegrationSetting rewrites only an allowlisted value — as the route', () => {
	let service: IntegrationSettingService;
	let resolver: IntegrationSettingResolver;
	let create: jest.SpyInstance;

	const stored = (provider: IntegrationEnum, settingsName: string) => ({
		id: ROW_ID,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		integrationId: INTEGRATION_ID,
		integration: { id: INTEGRATION_ID, name: provider },
		settingsName,
		settingsValue: 'old'
	});

	beforeEach(() => {
		service = new IntegrationSettingService({ metadata: { hasColumnWithPropertyPath: () => true } } as any, {} as any);
		resolver = new IntegrationSettingResolver(service);
		create = jest.spyOn(service, 'create').mockImplementation(async (entity: any) => entity);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a server-managed row, and nothing is written', async () => {
		jest.spyOn(service, 'findOneByIdString').mockResolvedValue(stored(IntegrationEnum.GITHUB, 'installation_id') as any);

		await expect(
			resolver.updateIntegrationSetting({ id: ROW_ID, organizationId: ORGANIZATION_ID, settingsValue: VICTIM_INSTALLATION_ID })
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(create).not.toHaveBeenCalled();
	});

	it('writes only the value of an allowlisted row', async () => {
		jest.spyOn(service, 'findOneByIdString').mockResolvedValue(stored(IntegrationEnum.GAUZY_AI, 'apiKey') as any);

		await resolver.updateIntegrationSetting({ id: ROW_ID, organizationId: ORGANIZATION_ID, settingsValue: 'rotated' });

		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({ id: ROW_ID, settingsValue: 'rotated' });
	});
});
