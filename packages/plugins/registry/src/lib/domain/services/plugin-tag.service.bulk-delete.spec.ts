// `@gauzy/core` and the entities drag in the whole graph; the service only needs the request's tenant.
const mockContext = { tenantId: 'tenant-a' as string | null };
jest.mock('@gauzy/core', () => ({
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: {
		currentTenantId: () => mockContext.tenantId,
		currentOrganizationId: () => 'organization-a'
	}
}));
jest.mock('./registry-crud.service', () => ({
	RegistryTenantAwareCrudService: class {
		get ormType() {
			return 'typeorm';
		}
	}
}));
jest.mock('../entities/plugin-tag.entity', () => ({ PluginTag: class PluginTag {} }));
jest.mock('../repositories/mikro-orm-plugin-tag.repository', () => ({}));
jest.mock('../repositories/type-orm-plugin-tag.repository', () => ({}));

import { BadRequestException } from '@nestjs/common';
import { PluginTagService } from './plugin-tag.service';

/**
 * `DELETE /plugin-tags/batch` and `PUT /plugins/:pluginId/tags` delete plugin-tag relationships on the repository,
 * past the base service's tenant scope, with the tenant the request body named: another tenant's, or none, which
 * removed the plugin's tags in every tenant.
 */
describe('PluginTagService.bulkDelete', () => {
	let deleted: Array<Record<string, unknown>>;
	let service: PluginTagService;

	beforeEach(() => {
		mockContext.tenantId = 'tenant-a';
		deleted = [];
		const repository = {
			delete: jest.fn(async (where: Record<string, unknown>) => (deleted.push(where), { affected: 1 }))
		};
		service = new PluginTagService(repository as any, {} as any);
	});

	it('deletes in the caller’s tenant when the input names none', async () => {
		await service.bulkDelete({ pluginId: 'plugin-1' });

		expect(deleted).toEqual([{ pluginId: 'plugin-1', tenantId: 'tenant-a' }]);
	});

	it('deletes in the caller’s tenant when the input names another', async () => {
		await service.bulkDelete({ ids: ['relationship-b'], tenantId: 'tenant-b' } as any);

		expect(deleted).toEqual([expect.objectContaining({ tenantId: 'tenant-a' })]);
	});

	it('keeps an organization filter as a narrowing', async () => {
		await service.bulkDelete({ tagId: 'tag-1', organizationId: 'organization-a' });

		expect(deleted).toEqual([{ tagId: 'tag-1', tenantId: 'tenant-a', organizationId: 'organization-a' }]);
	});

	it('refuses input that selects nothing, rather than delete the whole tenant’s relationships', async () => {
		await expect(service.bulkDelete({ tenantId: 'tenant-a' } as any)).rejects.toThrow(BadRequestException);
		expect(deleted).toEqual([]);
	});

	it('deletes nothing without a tenant in the request', async () => {
		mockContext.tenantId = null;

		expect(await service.bulkDelete({ pluginId: 'plugin-1' })).toBe(0);
		expect(deleted).toEqual([]);
	});

	it('replacing a plugin’s tags clears them in the caller’s tenant only', async () => {
		jest.spyOn(service, 'bulkCreate').mockResolvedValue({ created: 0, existing: 0, pluginTags: [] } as any);

		await service.replacePluginTags('plugin-1', ['tag-1'], 'tenant-b');

		expect(deleted).toEqual([{ pluginId: 'plugin-1', tenantId: 'tenant-a' }]);
	});
});
