/**
 * The plugin category and tag writes stated no grant: `PermissionGuard` answers `true` to empty metadata, and
 * `PUT /plugin-categories/:id`, `PUT /plugin-tags/:id` and `PUT /plugins/:pluginId/tags` ran no permission guard at
 * all, so any member of a tenant (a candidate or a viewer included) could rename, retag or delete the tenant's plugin
 * categories and tags.
 */
const mockDeclared = new Map<string, string[]>();
jest.mock('@gauzy/core', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// Records the grants each handler states, keyed by `Class.method`
	Permissions:
		(...permissions: string[]) =>
		(target: any, key?: string) => {
			if (key) mockDeclared.set(`${target.constructor.name}.${key}`, permissions);
		},
	UseValidationPipe: () => () => undefined,
	UUIDValidationPipe: class UUIDValidationPipe {}
}));
jest.mock('../../application', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../domain', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../shared', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../domain/entities/plugin-tag.entity', () => ({ PluginTag: class PluginTag {} }));
jest.mock('../../domain/services/plugin-tag.service', () => ({ PluginTagService: class PluginTagService {} }));
jest.mock('../../shared/dto/plugin-tag.dto', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../shared/models/plugin-tag.model', () => ({}));

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PluginCategoryController } from './plugin-category.controller';
import { PluginTagController } from './plugin-tag.controller';
import { PluginTagsController } from './plugin-tag-management.controller';

describe('plugin category and tag grants', () => {
	it.each([
		['PluginCategoryController.create', PermissionsEnum.PLUGIN_CONFIGURE],
		['PluginCategoryController.update', PermissionsEnum.PLUGIN_CONFIGURE],
		['PluginCategoryController.partialUpdate', PermissionsEnum.PLUGIN_CONFIGURE],
		['PluginCategoryController.delete', PermissionsEnum.PLUGIN_DELETE],
		['PluginTagController.create', PermissionsEnum.PLUGIN_CONFIGURE],
		['PluginTagController.update', PermissionsEnum.PLUGIN_CONFIGURE],
		['PluginTagController.batchCreate', PermissionsEnum.PLUGIN_CONFIGURE],
		['PluginTagController.delete', PermissionsEnum.PLUGIN_DELETE],
		['PluginTagController.batchDelete', PermissionsEnum.PLUGIN_DELETE],
		['PluginTagsController.replacePluginTags', PermissionsEnum.PLUGIN_UPDATE]
	])('%s states %s', (route, grant) => {
		expect(mockDeclared.get(route)).toEqual([grant]);
	});

	it.each([
		[PluginCategoryController, 'update'],
		[PluginCategoryController, 'partialUpdate'],
		[PluginCategoryController, 'delete'],
		[PluginTagController, 'create'],
		[PluginTagController, 'update'],
		[PluginTagController, 'delete'],
		[PluginTagController, 'batchCreate'],
		[PluginTagController, 'batchDelete'],
		[PluginTagsController, 'replacePluginTags']
	])('%p.%s runs the permission guard', (controller: Function, route: string) => {
		const guards = Reflect.getMetadata(GUARDS_METADATA, controller.prototype[route]) ?? [];

		expect(guards.map((guard: Function) => guard.name)).toEqual(['TenantPermissionGuard', 'PermissionGuard']);
	});
});
