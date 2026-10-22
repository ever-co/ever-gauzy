/**
 * The plugin subscription, version and source lists are scoped to the caller's tenant at their root, but a relation is
 * joined without that scope: `relations[]=plugin.settings`, `plugin.pluginTenants.allowedUsers` or
 * `plugin.subscriptions.subscriber` on any of them loaded those rows for every tenant that uses the plugin.
 */
jest.mock('@gauzy/core', () => ({
	BaseQueryDTO: class BaseQueryDTO {},
	FileStorage: class FileStorage {},
	FileStorageFactory: { create: () => ({}) },
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	Permissions: () => () => undefined,
	RequestContext: {
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'organization-1',
		currentUserId: () => 'user-1'
	},
	UseValidationPipe: () => () => undefined,
	UUIDValidationPipe: class UUIDValidationPipe {},
	documentUploadFileFilter: () => undefined
}));
jest.mock('../../application', () => {
	const query = (name: string) =>
		class {
			readonly name = name;
			readonly args: unknown[];
			constructor(...args: unknown[]) {
				this.args = args;
			}
		};
	return new Proxy({} as Record<string, unknown>, {
		get: (cache, name: string) => (cache[name] ??= query(name))
	});
});
jest.mock('../../core', () => ({
	LazyAnyFileInterceptor: () => class LazyAnyFileInterceptor {},
	PluginOwnerGuard: class PluginOwnerGuard {}
}));
jest.mock('../../domain', () => ({
	PluginSubscription: class PluginSubscription {},
	PluginVersion: class PluginVersion {}
}));
jest.mock('../../shared', () => ({
	CreatePluginSourceDTO: class CreatePluginSourceDTO {},
	FileDTO: class FileDTO {},
	PluginSourceDTO: class PluginSourceDTO {},
	PluginSubscriptionQueryDTO: class PluginSubscriptionQueryDTO {},
	PluginVersionDTO: class PluginVersionDTO {},
	PurchasePluginSubscriptionDTO: class PurchasePluginSubscriptionDTO {},
	UpdatePluginSubscriptionDTO: class UpdatePluginSubscriptionDTO {},
	UpdatePluginVersionDTO: class UpdatePluginVersionDTO {}
}));
jest.mock('../storage', () => ({
	GauzyStorageProvider: class GauzyStorageProvider {},
	UploadedPluginStorage: () => () => undefined
}));

import { PluginSourceController } from './plugin-source.controller';
import { PluginSubscriptionController } from './plugin-subscription.controller';
import { PluginVersionController } from './plugin-version.controller';

/** Relations that reach other tenants' rows through the plugin. */
const CROSS_TENANT = [
	'plugin.settings',
	'plugin.pluginTenants',
	'plugin.pluginTenants.allowedUsers',
	'plugin.subscriptions.subscriber',
	'plugin.subscriptions.billings',
	'installations',
	'version.plugin.subscriptions'
];

describe('the signed-in plugin list reads', () => {
	const queryBus = { execute: jest.fn(async (query: unknown) => query) };

	beforeEach(() => queryBus.execute.mockClear());

	it('GET /plugins/:pluginId/subscriptions loads the four relations the list shows, nothing joined further', async () => {
		const controller = new PluginSubscriptionController(queryBus as any, queryBus as any);

		await controller.findAll('plugin-1', {} as any, undefined, undefined, undefined, [...CROSS_TENANT, 'plan']);

		const query = queryBus.execute.mock.calls[0][0] as any;
		expect(query.name).toBe('GetPluginSubscriptionsBySubscriberIdQuery');
		expect([...new Set(query.args[1])].sort()).toEqual(['plan', 'plugin', 'pluginTenant', 'subscriber']);
	});

	it('GET /plugins/:pluginId/versions loads the plugin and sources only, filters on version columns only', async () => {
		const controller = new PluginVersionController(queryBus as any, queryBus as any);

		await controller.findAllVersions('plugin-1', {
			relations: ['sources', 'plugin', ...CROSS_TENANT],
			where: { number: '1.0.0', installations: { installedById: 'someone' } },
			take: 5
		} as any);

		const [id, params] = (queryBus.execute.mock.calls[0][0] as any).args;
		expect(id).toBe('plugin-1');
		expect(params).toEqual({ relations: ['sources', 'plugin'], where: { number: '1.0.0' }, take: 5 });
	});

	it('GET /plugins/:pluginId/versions/:versionId/sources loads its version and plugin only', async () => {
		const controller = new PluginSourceController(queryBus as any, queryBus as any);

		await controller.findAllSources('plugin-1', 'version-1', {
			relations: { version: { plugin: { settings: 'true' } } },
			where: { version: { plugin: { pluginTenants: { tenantId: 'tenant-2' } } } }
		} as any);

		const [, , params] = (queryBus.execute.mock.calls[0][0] as any).args;
		expect(params).toEqual({ relations: ['version', 'version.plugin'], where: undefined });
	});
});
