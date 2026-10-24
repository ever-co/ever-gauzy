/**
 * A plugin setting marked `isEncrypted` (an API key, a token) was returned as entered by the setting reads, which need
 * only PLUGIN_VIEW: every role holds it by default, candidates and viewers included.
 */
const mockGranted = new Set<string>();
jest.mock('@gauzy/core', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	Permissions: () => () => undefined,
	RequestContext: {
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'organization-1',
		hasPermission: (permission: string) => mockGranted.has(permission)
	}
}));
jest.mock('../../application', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../domain', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../shared', () => new Proxy({}, { get: () => class {} }));
// The plugin tenant read below loads the same settings (`GET /plugin-tenants/:id`, relation `settings`).
jest.mock('../../application/plugin-tenant', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../application/plugin-tenant/commands', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../application/plugin-tenant/queries', () => new Proxy({}, { get: () => class {} }));
jest.mock('../../shared/dto', () => new Proxy({}, { get: () => class {} }));

import { PermissionsEnum } from '@gauzy/contracts';
import { PluginSettingController } from './plugin-setting.controller';
import { PluginTenantController } from './plugin-tenant.controller';

describe('plugin setting reads', () => {
	const settings = () => [
		{ id: 'setting-1', key: 'apiKey', value: 'sk-live-secret', isEncrypted: true },
		{ id: 'setting-2', key: 'region', value: 'eu-west-1', isEncrypted: false }
	];
	const queryBus = { execute: jest.fn() };
	const controller = new PluginSettingController({} as any, queryBus as any, {} as any);

	beforeEach(() => {
		mockGranted.clear();
		mockGranted.add(PermissionsEnum.PLUGIN_VIEW);
		queryBus.execute.mockReset();
	});

	describe('without PLUGIN_CONFIGURE', () => {
		it.each([
			['all of a plugin', {}],
			['a category', { category: 'auth' }]
		])('a list of %s leaves out the secret values', async (_, query) => {
			queryBus.execute.mockResolvedValue(settings());

			const read = await controller.findAll('plugin-1', query as any);

			expect(read.map(({ key, value }) => [key, value])).toEqual([
				['apiKey', null],
				['region', 'eu-west-1']
			]);
		});

		it('a read by key leaves out the secret value', async () => {
			queryBus.execute.mockResolvedValue(settings()[0]);

			const [read] = await controller.findAll('plugin-1', { key: 'apiKey' } as any);

			expect(read).toEqual(expect.objectContaining({ key: 'apiKey', isEncrypted: true, value: null }));
		});

		it('a read by id leaves out the secret value', async () => {
			queryBus.execute.mockResolvedValue(settings()[0]);

			expect((await controller.findOne('plugin-1', 'setting-1')).value).toBeNull();
		});
	});

	describe('with PLUGIN_CONFIGURE', () => {
		beforeEach(() => mockGranted.add(PermissionsEnum.PLUGIN_CONFIGURE));

		it('a list returns every value', async () => {
			queryBus.execute.mockResolvedValue(settings());

			const read = await controller.findAll('plugin-1', {} as any);

			expect(read.map(({ value }) => value)).toEqual(['sk-live-secret', 'eu-west-1']);
		});

		it('a read by id returns the value', async () => {
			queryBus.execute.mockResolvedValue(settings()[0]);

			expect((await controller.findOne('plugin-1', 'setting-1')).value).toBe('sk-live-secret');
		});
	});

	it('a missing setting stays missing', async () => {
		queryBus.execute.mockResolvedValue(null);

		expect(await controller.findAll('plugin-1', { key: 'nope' } as any)).toEqual([]);
		expect(await controller.findOne('plugin-1', 'setting-9')).toBeNull();
	});
});

describe('plugin tenant read', () => {
	const pluginTenant = () => ({
		id: 'plugin-tenant-1',
		settings: [
			{ id: 'setting-1', key: 'apiKey', value: 'sk-live-secret', isEncrypted: true },
			{ id: 'setting-2', key: 'region', value: 'eu-west-1', isEncrypted: false }
		]
	});
	const queryBus = { execute: jest.fn() };
	const controller = new PluginTenantController({} as any, queryBus as any);

	beforeEach(() => {
		mockGranted.clear();
		mockGranted.add(PermissionsEnum.PLUGIN_VIEW);
		queryBus.execute.mockReset();
	});

	it('leaves out the secret values of its settings without PLUGIN_CONFIGURE', async () => {
		queryBus.execute.mockResolvedValue(pluginTenant());

		const read = await controller.findOne('plugin-tenant-1');

		expect(read.settings.map(({ key, value }) => [key, value])).toEqual([
			['apiKey', null],
			['region', 'eu-west-1']
		]);
	});

	it('returns them with PLUGIN_CONFIGURE', async () => {
		mockGranted.add(PermissionsEnum.PLUGIN_CONFIGURE);
		queryBus.execute.mockResolvedValue(pluginTenant());

		const read = await controller.findOne('plugin-tenant-1');

		expect(read.settings.map(({ value }) => value)).toEqual(['sk-live-secret', 'eu-west-1']);
	});
});
