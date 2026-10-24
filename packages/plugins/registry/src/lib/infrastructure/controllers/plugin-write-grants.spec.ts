/**
 * Publishing a plugin, and writing its versions and sources, is what every tenant's desktop app downloads and runs.
 * `POST /plugins` needed only PLUGIN_CONFIGURE (MANAGER and DATA_ENTRY hold it), and the version and source writes
 * checked the uploader but no grant at all, so an uploader whose role had since been lowered kept publishing releases.
 */
const mockDeclared = new Map<string, string[]>();
jest.mock('@gauzy/core', () => ({
	BaseQueryDTO: class BaseQueryDTO {},
	FileStorage: class FileStorage {},
	FileStorageFactory: { create: () => ({}) },
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// Records the grants each handler states, keyed by `Class.method`
	Permissions:
		(...permissions: string[]) =>
		(target: any, key?: string) => {
			if (key) mockDeclared.set(`${target.constructor.name}.${key}`, permissions);
		},
	RequestContext: { currentUserId: () => 'user-1', currentTenantId: () => 'tenant-1' },
	UseValidationPipe: () => () => undefined,
	UUIDValidationPipe: class UUIDValidationPipe {},
	documentUploadFileFilter: () => undefined
}));
jest.mock('../../application', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../core', () => ({
	LazyAnyFileInterceptor: () => class LazyAnyFileInterceptor {},
	PluginOwnerGuard: class PluginOwnerGuard {}
}));
jest.mock('../../domain', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../shared', () => new Proxy({}, { get: () => class {} }));
jest.mock('../storage', () => ({
	GauzyStorageProvider: class GauzyStorageProvider {},
	UploadedPluginStorage: () => () => undefined
}));

import { PermissionsEnum } from '@gauzy/contracts';
import './plugin-management.controller';
import './plugin-source.controller';
import './plugin-version.controller';

describe('plugin publishing grants', () => {
	it.each([
		['PluginManagementController.create', PermissionsEnum.PLUGIN_PUBLISH],
		['PluginVersionController.createVersion', PermissionsEnum.PLUGIN_UPDATE],
		['PluginVersionController.update', PermissionsEnum.PLUGIN_UPDATE],
		['PluginVersionController.updateStatus', PermissionsEnum.PLUGIN_UPDATE],
		['PluginVersionController.delete', PermissionsEnum.PLUGIN_DELETE],
		['PluginSourceController.create', PermissionsEnum.PLUGIN_UPDATE],
		['PluginSourceController.updateStatus', PermissionsEnum.PLUGIN_UPDATE],
		['PluginSourceController.delete', PermissionsEnum.PLUGIN_DELETE]
	])('%s states %s alone', (route, grant) => {
		expect(mockDeclared.get(route)).toEqual([grant]);
	});
});
