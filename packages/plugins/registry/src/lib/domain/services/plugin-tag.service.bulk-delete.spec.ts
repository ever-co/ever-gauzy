// `@gauzy/core` drags in the whole entity graph: stand-ins are enough for this service method.
const mockContext = { tenantId: 'tenant-1' as string | null };

jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		return new.target ? undefined : () => undefined;
	}
	class TenantAwareCrudService {}
	class CrudService {}
	const target: Record<string, unknown> = {
		TenantAwareCrudService,
		CrudService,
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		RequestContext: {
			currentTenantId: () => mockContext.tenantId,
			currentOrganizationId: () => null
		}
	};
	return new Proxy(target, {
		get: (object, name: string) => (name in object ? object[name] : name === '__esModule' ? true : stub)
	});
});

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PluginTagService } from './plugin-tag.service';

/**
 * `PUT /plugins/:pluginId/tags` (replacePluginTags) and `DELETE /plugin-tags/batch` reach `bulkDelete`, a raw
 * repository delete. It added a tenant only when the request named one, so a request without one deleted the tag rows
 * of every tenant. The tenant is now always the caller's.
 */
describe('PluginTagService.bulkDelete', () => {
	const build = () => {
		const repository = { delete: jest.fn().mockResolvedValue({ affected: 2 }) };
		const service = new PluginTagService(repository as any, {} as any);
		return { service, repository };
	};

	beforeEach(() => {
		mockContext.tenantId = 'tenant-1';
	});

	it("deletes the plugin's tags in the caller's tenant only, when the request names no tenant", async () => {
		const { service, repository } = build();

		await service.bulkDelete({ pluginId: 'plugin-1' });

		expect(repository.delete).toHaveBeenCalledWith({ pluginId: 'plugin-1', tenantId: 'tenant-1' });
	});

	it('ignores a tenant named by the request', async () => {
		const { service, repository } = build();

		await service.bulkDelete({ pluginId: 'plugin-1', tenantId: 'tenant-2' } as any);

		expect(repository.delete).toHaveBeenCalledWith({ pluginId: 'plugin-1', tenantId: 'tenant-1' });
	});

	it('replaces the tags of a plugin in the caller tenant only', async () => {
		const { service, repository } = build();

		await service.replacePluginTags('plugin-1', [], 'tenant-2');

		expect(repository.delete).toHaveBeenCalledWith({ pluginId: 'plugin-1', tenantId: 'tenant-1' });
	});

	it('refuses a delete without criteria rather than emptying the tenant', async () => {
		const { service, repository } = build();

		await expect(service.bulkDelete({})).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.delete).not.toHaveBeenCalled();
	});

	it('deletes nothing without a tenant', async () => {
		mockContext.tenantId = null;
		const { service, repository } = build();

		await expect(service.bulkDelete({ pluginId: 'plugin-1' })).rejects.toBeInstanceOf(ForbiddenException);
		expect(repository.delete).not.toHaveBeenCalled();
	});
});
