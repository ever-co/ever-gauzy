/**
 * A plugin tenant is the tenant's switch, access list and configuration for one plugin, and its routes and the plugin
 * user assignment routes sat behind the tenant check alone: any member of the tenant could enable, disable, approve
 * or delete it, allow themselves, and read its settings.
 */
const mockDeclared = new Map<string, string[]>();
const mockGranted = new Set<string>();
jest.mock('@gauzy/core', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// Records the grants each handler (or, with no key, each class) states
	Permissions:
		(...permissions: string[]) =>
		(target: any, key?: string) => {
			mockDeclared.set(key ? `${target.constructor.name}.${key}` : target.name, permissions);
		},
	RequestContext: {
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'organization-1',
		hasPermission: (permission: string) => mockGranted.has(permission)
	},
	UUIDValidationPipe: class UUIDValidationPipe {}
}));
jest.mock('../../application', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../application/plugin-tenant', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../application/plugin-tenant/commands', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../application/plugin-tenant/queries', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../shared', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../shared/dto', () => {
	const { PluginTenantBulkOperation } = jest.requireActual('../../shared/dto/plugin-tenant-bulk-operation.dto');
	return new Proxy({ PluginTenantBulkOperation }, { get: (dto, name) => dto[name] ?? class {} });
});

import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PluginTenantBulkOperation } from '../../shared/dto/plugin-tenant-bulk-operation.dto';
import { PluginTenantController } from './plugin-tenant.controller';
import { PluginUserAssignmentController } from './plugin-user-assignment.controller';

describe('plugin tenant grants', () => {
	const guardNames = (controller: Function) =>
		(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []).map((guard: Function) => guard.name);

	it.each([PluginTenantController, PluginUserAssignmentController])('%p runs the permission guard', (controller) => {
		expect(guardNames(controller)).toEqual(['TenantPermissionGuard', 'PermissionGuard']);
	});

	it.each([
		['create', PermissionsEnum.PLUGIN_CONFIGURE],
		['findAll', PermissionsEnum.PLUGIN_CONFIGURE],
		['getStatistics', PermissionsEnum.PLUGIN_VIEW],
		['findByPlugin', PermissionsEnum.PLUGIN_CONFIGURE],
		['findByTenant', PermissionsEnum.PLUGIN_CONFIGURE],
		['checkAccess', PermissionsEnum.PLUGIN_VIEW],
		['findOne', PermissionsEnum.PLUGIN_CONFIGURE],
		['getQuotaInfo', PermissionsEnum.PLUGIN_VIEW],
		['getPluginTenantUsers', PermissionsEnum.PLUGIN_CONFIGURE],
		['managePluginTenantUsers', PermissionsEnum.PLUGIN_CONFIGURE],
		['update', PermissionsEnum.PLUGIN_CONFIGURE],
		['updateConfiguration', PermissionsEnum.PLUGIN_CONFIGURE],
		['enable', PermissionsEnum.PLUGIN_ENABLE],
		['disable', PermissionsEnum.PLUGIN_DISABLE],
		['updateApproval', PermissionsEnum.PLUGIN_RESTRICT],
		['remove', PermissionsEnum.PLUGIN_DELETE]
	])('PluginTenantController.%s states %s', (route, grant) => {
		expect(mockDeclared.get(`PluginTenantController.${route}`)).toEqual([grant]);
	});

	it('every plugin tenant route states a grant', () => {
		const routes = Object.getOwnPropertyNames(PluginTenantController.prototype).filter(
			(name) => name !== 'constructor'
		);
		expect(routes.filter((route) => !mockDeclared.has(`PluginTenantController.${route}`))).toEqual([]);
	});

	it('the plugin user assignment routes need PLUGIN_CONFIGURE', () => {
		expect(mockDeclared.get('PluginUserAssignmentController')).toEqual([PermissionsEnum.PLUGIN_CONFIGURE]);
	});

	describe('operations with more than one grant', () => {
		const commandBus = { execute: jest.fn().mockResolvedValue('done') };
		const controller = new PluginTenantController(commandBus as any, {} as any);

		beforeEach(() => {
			mockGranted.clear();
			commandBus.execute.mockClear();
		});

		it.each([
			[PluginTenantBulkOperation.ENABLE, PermissionsEnum.PLUGIN_ENABLE],
			[PluginTenantBulkOperation.DISABLE, PermissionsEnum.PLUGIN_DISABLE],
			[PluginTenantBulkOperation.APPROVE, PermissionsEnum.PLUGIN_RESTRICT],
			[PluginTenantBulkOperation.REVOKE, PermissionsEnum.PLUGIN_RESTRICT],
			[PluginTenantBulkOperation.DELETE, PermissionsEnum.PLUGIN_DELETE]
		])('a bulk %s needs %s', async (operation, grant) => {
			const others = [
				PermissionsEnum.PLUGIN_ENABLE,
				PermissionsEnum.PLUGIN_DISABLE,
				PermissionsEnum.PLUGIN_RESTRICT,
				PermissionsEnum.PLUGIN_DELETE
			].filter((permission) => permission !== grant);
			others.forEach((permission) => mockGranted.add(permission));

			await expect(controller.bulkUpdate({ pluginTenantIds: ['pt-1'], operation } as any)).rejects.toThrow(
				ForbiddenException
			);
			expect(commandBus.execute).not.toHaveBeenCalled();

			mockGranted.add(grant);
			await expect(controller.bulkUpdate({ pluginTenantIds: ['pt-1'], operation } as any)).resolves.toBe('done');
		});

		it('refuses a bulk operation it does not know', async () => {
			mockGranted.add(PermissionsEnum.PLUGIN_DELETE);
			await expect(
				controller.bulkUpdate({ pluginTenantIds: ['pt-1'], operation: 'purge' } as any)
			).rejects.toThrow(ForbiddenException);
		});

		it('approving and switching the plugin on at once also needs PLUGIN_ENABLE', async () => {
			mockGranted.add(PermissionsEnum.PLUGIN_RESTRICT);
			const approval = { pluginTenantId: 'pt-1', approved: true, enableImmediately: true };

			await expect(controller.updateApproval(approval as any)).rejects.toThrow(ForbiddenException);
			await expect(controller.updateApproval({ ...approval, enableImmediately: false } as any)).resolves.toBe(
				'done'
			);

			mockGranted.add(PermissionsEnum.PLUGIN_ENABLE);
			await expect(controller.updateApproval(approval as any)).resolves.toBe('done');
		});
	});
});
