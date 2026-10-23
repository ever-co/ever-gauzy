/**
 * `GET /plugins`, `GET /plugins/:id` and `GET /plugin-categories/:id` are public and passed the query string's
 * relations (and filters) to the store as they came: any visitor could load every tenant's plugin settings with their
 * values, each tenant's plugin configuration and users, and the subscribers and billings of every subscription.
 */
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));
jest.mock('@gauzy/core', () => ({
	UseValidationPipe: () => () => undefined,
	UUIDValidationPipe: class UUIDValidationPipe {},
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
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
jest.mock('../../domain', () => ({ Plugin: class Plugin {} }));
jest.mock('../../shared', () => ({
	PluginQueryOptions: class PluginQueryOptions {},
	PluginSearchFilterDTO: class PluginSearchFilterDTO {},
	PluginCategoryQueryDTO: class PluginCategoryQueryDTO {},
	CreatePluginCategoryDTO: class CreatePluginCategoryDTO {},
	UpdatePluginCategoryDTO: class UpdatePluginCategoryDTO {}
}));

import { PluginCategoryController } from './plugin-category.controller';
import { PluginController } from './plugin.controller';
import {
	allowedRelations,
	ownColumnFilter,
	PUBLIC_PLUGIN_CATEGORY_RELATIONS,
	PUBLIC_PLUGIN_RELATIONS,
	relationPaths
} from './public-read-options';

const HIDDEN = [
	'settings',
	'pluginTenants',
	'pluginTenants.allowedUsers',
	'subscriptions.subscriber',
	'subscriptions.billings'
];

describe('public read options', () => {
	it('reads relations in every form the query string carries them', () => {
		expect(relationPaths(['versions', 'versions.sources'])).toEqual(['versions', 'versions.sources']);
		expect(relationPaths('category, uploadedBy')).toEqual(['category', 'uploadedBy']);
		expect(relationPaths({ subscriptions: { subscriber: 'true', plan: 'true' }, settings: 'true' })).toEqual([
			'subscriptions',
			'subscriptions.subscriber',
			'subscriptions.plan',
			'settings'
		]);
		expect(relationPaths(undefined)).toEqual([]);
	});

	it('keeps what the marketplace shows and drops settings, plugin tenants, subscribers and billings', () => {
		expect(
			allowedRelations(
				['versions', 'versions.sources', 'subscriptions', 'subscriptions.plan', ...HIDDEN],
				PUBLIC_PLUGIN_RELATIONS
			)
		).toEqual(['versions', 'versions.sources']);
		expect(
			allowedRelations(['settings', 'plugins.settings', 'plugins', 'children'], PUBLIC_PLUGIN_CATEGORY_RELATIONS)
		).toEqual(['plugins', 'children']);
	});

	it('filters on the entity’s own columns only', () => {
		expect(ownColumnFilter({ status: 'ACTIVE', isActive: 'true', settings: { value: 'sk_live_abc' } })).toEqual({
			status: 'ACTIVE',
			isActive: 'true'
		});
		expect(ownColumnFilter({ subscriptions: { tenantId: 'tenant-b' } })).toBeUndefined();
		expect(ownColumnFilter(undefined)).toBeUndefined();
	});
});

describe('the public plugin and category reads', () => {
	const queryBus = { execute: jest.fn(async (query: unknown) => query) };

	beforeEach(() => queryBus.execute.mockClear());

	it('GET /plugins loads only public relations, and filters on plugin columns only', async () => {
		const controller = new PluginController(queryBus as any);

		await controller.findAll({
			relations: { settings: 'true', subscriptions: { subscriber: 'true', billings: 'true' }, versions: 'true' },
			where: { status: 'ACTIVE', settings: { value: 'sk_live_abc' } },
			take: 10
		} as any);

		const [params] = (queryBus.execute.mock.calls[0][0] as any).args;
		expect(params).toEqual({ relations: ['subscriptions', 'versions'], where: { status: 'ACTIVE' }, take: 10 });
	});

	it('GET /plugins?search= hands the same public options to the search', async () => {
		const controller = new PluginController(queryBus as any);

		await controller.findAll({ search: 'crm', relations: ['settings', 'category'] } as any);

		const query = queryBus.execute.mock.calls[0][0] as any;
		expect(query.name).toBe('SearchPluginsQuery');
		expect(query.args[0].relations).toEqual(['category']);
	});

	it('GET /plugins/:id answers the plugin of the path, with public relations only', async () => {
		const controller = new PluginController(queryBus as any);

		await controller.findById('plugin-1', {
			relations: ['versions', 'settings', 'pluginTenants.allowedUsers'],
			where: { id: 'another-plugin' },
			select: ['id', 'name']
		} as any);

		const [id, options] = (queryBus.execute.mock.calls[0][0] as any).args;
		expect(id).toBe('plugin-1');
		expect(options).toEqual({ relations: ['versions'], where: undefined, select: ['id', 'name'] });
	});

	it('GET /plugin-categories/:id never loads settings', async () => {
		const controller = new PluginCategoryController(queryBus as any, queryBus as any);

		await controller.findOne('category-1', ['settings', 'plugins.settings', 'plugins']);

		const [id, relations] = (queryBus.execute.mock.calls[0][0] as any).args;
		expect(id).toBe('category-1');
		expect(relations).toEqual(['plugins']);
	});
});
