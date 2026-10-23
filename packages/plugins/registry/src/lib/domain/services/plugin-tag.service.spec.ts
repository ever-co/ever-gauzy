// `@gauzy/core`, the entity and the repositories drag in the entity graph. The service only needs the caller from
// the request context, the ORM enum, and a base class that answers TypeORM as the registry's own does.
const mockContext = { tenantId: 'tenant-a' as string | null, organizationId: null as string | null };
jest.mock('@gauzy/core', () => ({
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: {
		currentTenantId: () => mockContext.tenantId,
		currentOrganizationId: () => mockContext.organizationId
	}
}));
jest.mock('./registry-crud.service', () => ({
	RegistryTenantAwareCrudService: class {
		readonly ormType = 'typeorm';
		constructor(
			readonly typeOrmRepository: unknown,
			readonly mikroOrmRepository: unknown
		) {}
	}
}));
jest.mock('../entities/plugin-tag.entity', () => ({ PluginTag: class PluginTag {} }));
jest.mock('../repositories/mikro-orm-plugin-tag.repository', () => ({ MikroOrmPluginTagRepository: class {} }));
jest.mock('../repositories/type-orm-plugin-tag.repository', () => ({ TypeOrmPluginTagRepository: class {} }));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { PluginTagService } from './plugin-tag.service';

const PLUGIN = '22222222-2222-4222-8222-222222222222';
const TAG = '33333333-3333-4333-8333-333333333333';

/** A service over a recording TypeORM repository; `findAll` answers no existing rows, `create` echoes. */
function service() {
	const repository = { delete: jest.fn(async (_where: unknown) => ({ affected: 2 })) };
	const instance = new PluginTagService(repository as any, {} as any);
	const findAll = jest.fn(async (_options: unknown) => ({ items: [] as { tagId: string }[], total: 0 }));
	const create = jest.fn(async (entity: Record<string, unknown>) => ({ id: 'created', ...entity }));
	Object.assign(instance, { findAll, create });
	return { instance, repository, findAll, create };
}

describe('PluginTagService tenant scoping', () => {
	beforeEach(() => {
		mockContext.tenantId = 'tenant-a';
		mockContext.organizationId = null;
	});

	describe('bulkDelete', () => {
		it('deletes within the caller’s tenant when the payload states none', async () => {
			const { instance, repository } = service();

			await expect(instance.bulkDelete({ pluginId: PLUGIN })).resolves.toBe(2);

			expect(repository.delete).toHaveBeenCalledWith({ tenantId: 'tenant-a', pluginId: PLUGIN });
		});

		it('accepts a stated tenant only when it is the caller’s own', async () => {
			const { instance, repository } = service();

			await instance.bulkDelete({ pluginId: PLUGIN, tenantId: 'tenant-a' });

			expect(repository.delete).toHaveBeenCalledWith({ tenantId: 'tenant-a', pluginId: PLUGIN });
		});

		it('refuses a payload that names another tenant, and deletes nothing', async () => {
			const { instance, repository } = service();

			await expect(instance.bulkDelete({ pluginId: PLUGIN, tenantId: 'tenant-b' })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(repository.delete).not.toHaveBeenCalled();
		});

		it('refuses a request that carries no tenant', async () => {
			mockContext.tenantId = null;
			const { instance, repository } = service();

			await expect(instance.bulkDelete({ pluginId: PLUGIN })).rejects.toBeInstanceOf(ForbiddenException);
			expect(repository.delete).not.toHaveBeenCalled();
		});

		it.each([
			['nothing at all', {}],
			['only an organization', { organizationId: 'org-a' }],
			['tag ids without the plugin they belong to', { tagIds: [TAG] }],
			['an empty id list', { ids: [] }]
		])('refuses a payload that names %s, rather than emptying the tenant', async (_label, input) => {
			const { instance, repository } = service();

			await expect(instance.bulkDelete(input as any)).rejects.toBeInstanceOf(BadRequestException);
			expect(repository.delete).not.toHaveBeenCalled();
		});

		it('scopes a delete by relationship ids to the caller’s tenant', async () => {
			const { instance, repository } = service();

			await instance.bulkDelete({ ids: ['rel-1', 'rel-2'] });

			expect(repository.delete).toHaveBeenCalledWith({ tenantId: 'tenant-a', id: In(['rel-1', 'rel-2']) });
		});
	});

	describe('bulkCreate', () => {
		it('files the relationships into the caller’s tenant when the payload states none', async () => {
			const { instance, findAll, create } = service();

			await instance.bulkCreate({ pluginId: PLUGIN, tagIds: [TAG] });

			expect(findAll).toHaveBeenCalledWith({
				where: { pluginId: PLUGIN, tagId: In([TAG]), tenantId: 'tenant-a' }
			});
			expect(create).toHaveBeenCalledWith({
				pluginId: PLUGIN,
				tagId: TAG,
				tenantId: 'tenant-a',
				organizationId: null
			});
		});

		it('refuses a payload that names another tenant, and creates nothing', async () => {
			const { instance, create } = service();

			await expect(
				instance.bulkCreate({ pluginId: PLUGIN, tagIds: [TAG], tenantId: 'tenant-b' })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});
	});

	describe('replacePluginTags', () => {
		it('removes and re-files only the caller’s tenant’s tags of the plugin when the payload states no tenant', async () => {
			const { instance, repository, create } = service();

			await instance.replacePluginTags(PLUGIN, [TAG]);

			// Before, an omitted tenant left the delete unscoped: every tenant's tags of the plugin went.
			expect(repository.delete).toHaveBeenCalledWith({ tenantId: 'tenant-a', pluginId: PLUGIN });
			expect(create).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }));
		});

		it('refuses to replace another tenant’s tags, and deletes nothing', async () => {
			const { instance, repository } = service();

			await expect(instance.replacePluginTags(PLUGIN, [TAG], 'tenant-b')).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(repository.delete).not.toHaveBeenCalled();
		});
	});
});
