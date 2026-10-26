// `@gauzy/core` drags in the entity graph; the guard only asks the request context for the caller's grants.
const mockGrants = new Set<string>();
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		hasPermission: (permission: string) => mockGrants.has(permission),
		currentTenantId: () => 'tenant-a',
		currentOrganizationId: () => null
	}
}));
jest.mock('../../domain', () => ({
	PluginService: class PluginService {},
	PluginTenantService: class PluginTenantService {},
	PluginTenant: { create: (params: object) => ({ ...params }) }
}));

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { CreatePluginTenantCommand } from './commands/create-plugin-tenant.command';
import { UpdatePluginTenantCommand } from './commands/update-plugin-tenant.command';
import { CreatePluginTenantCommandHandler } from './commands/handlers/create-plugin-tenant.handler';
import { UpdatePluginTenantCommandHandler } from './commands/handlers/update-plugin-tenant.handler';
import { assertMayChangeAccessFlags, NEW_PLUGIN_TENANT_ACCESS_FLAGS } from './plugin-tenant-access-flags';

/**
 * `PATCH /plugin-tenants/:id/enable`, `/disable` and `/approval` state their own grants, but `POST` and
 * `PUT /plugin-tenants/:id` (PLUGIN_CONFIGURE, which DATA_ENTRY holds) wrote the same flags:
 * `PUT { "enabled": true, "requiresApproval": false }` turned a plugin on and dropped its approval with neither.
 */
describe('plugin-tenant access flags', () => {
	const STORED = { id: 'pt-1', enabled: false, requiresApproval: true, isMandatory: false };

	const holding = (...grants: PermissionsEnum[]) => {
		mockGrants.clear();
		grants.forEach((grant) => mockGrants.add(grant));
	};

	describe('assertMayChangeAccessFlags', () => {
		it('refuses turning a plugin on without PLUGIN_ENABLE, and off without PLUGIN_DISABLE', () => {
			holding(PermissionsEnum.PLUGIN_CONFIGURE);

			expect(() => assertMayChangeAccessFlags({ enabled: true }, STORED)).toThrow(ForbiddenException);
			expect(() => assertMayChangeAccessFlags({ enabled: false }, { ...STORED, enabled: true })).toThrow(
				ForbiddenException
			);

			holding(PermissionsEnum.PLUGIN_ENABLE);
			expect(() => assertMayChangeAccessFlags({ enabled: true }, STORED)).not.toThrow();
		});

		it('refuses dropping approval or making it mandatory without PLUGIN_RESTRICT', () => {
			holding(PermissionsEnum.PLUGIN_CONFIGURE, PermissionsEnum.PLUGIN_ENABLE, PermissionsEnum.PLUGIN_DISABLE);

			expect(() => assertMayChangeAccessFlags({ requiresApproval: false }, STORED)).toThrow(ForbiddenException);
			expect(() => assertMayChangeAccessFlags({ isMandatory: true }, STORED)).toThrow(ForbiddenException);

			holding(PermissionsEnum.PLUGIN_RESTRICT);
			expect(() =>
				assertMayChangeAccessFlags({ requiresApproval: false, isMandatory: true }, STORED)
			).not.toThrow();
		});

		it('lets an edit leave the flags out or resend them unchanged', () => {
			holding(PermissionsEnum.PLUGIN_CONFIGURE);

			expect(() => assertMayChangeAccessFlags({}, STORED)).not.toThrow();
			expect(() =>
				assertMayChangeAccessFlags({ enabled: false, requiresApproval: true, isMandatory: false }, STORED)
			).not.toThrow();
		});
	});

	describe('PUT /plugin-tenants/:id', () => {
		it('refuses the bypass, and writes nothing', async () => {
			holding(PermissionsEnum.PLUGIN_CONFIGURE);
			const service = { findOneByIdString: jest.fn(async () => STORED), update: jest.fn() };
			const handler = new UpdatePluginTenantCommandHandler(service as any);

			await expect(
				handler.execute(
					new UpdatePluginTenantCommand('pt-1', { enabled: true, requiresApproval: false } as any)
				)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(service.update).not.toHaveBeenCalled();
		});

		it('still saves a configuration edit that resends the flags unchanged', async () => {
			holding(PermissionsEnum.PLUGIN_CONFIGURE);
			const service = { findOneByIdString: jest.fn(async () => STORED), update: jest.fn() };
			const handler = new UpdatePluginTenantCommandHandler(service as any);

			await handler.execute(new UpdatePluginTenantCommand('pt-1', { ...STORED, maxActiveUsers: 10 } as any));
			expect(service.update).toHaveBeenCalledTimes(1);
		});
	});

	describe('POST /plugin-tenants', () => {
		it('refuses a new installation that skips approval without PLUGIN_RESTRICT, before any lookup', async () => {
			holding(PermissionsEnum.PLUGIN_CONFIGURE);
			const plugins = { findOneByIdString: jest.fn() };
			const handler = new CreatePluginTenantCommandHandler({} as any, plugins as any);

			await expect(
				handler.execute(new CreatePluginTenantCommand({ pluginId: 'plugin-1', requiresApproval: false } as any))
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(plugins.findOneByIdString).not.toHaveBeenCalled();
		});

		it('treats the defaults of a new installation as unchanged', () => {
			holding(PermissionsEnum.PLUGIN_CONFIGURE);

			expect(() => assertMayChangeAccessFlags({ enabled: true }, NEW_PLUGIN_TENANT_ACCESS_FLAGS)).not.toThrow();
		});
	});
});
