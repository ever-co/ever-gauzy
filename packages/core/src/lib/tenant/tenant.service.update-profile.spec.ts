/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before TenantService (and the repositories it imports) are evaluated.
 */
import '../core/entities/internal';
import { BadRequestException } from '@nestjs/common';
import { ImageAsset } from '../image-asset/image-asset.entity';
import { MultiORMEnum } from '../core/utils';
import { TenantService } from './tenant.service';

/**
 * `PUT /tenant` sets the caller's tenant name and logo. The logo is an image asset id, a bare UUID, so the
 * service must refuse an asset that belongs to another tenant before it links it.
 */

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OWN_IMAGE_ID = '44444444-4444-4444-8444-444444444444';
const FOREIGN_IMAGE_ID = '55555555-5555-4555-8555-555555555555';

/** Image assets by id, with the tenant that owns each. */
const IMAGES: Record<string, string> = {
	[OWN_IMAGE_ID]: TENANT_ID,
	[FOREIGN_IMAGE_ID]: '22222222-2222-4222-8222-222222222222'
};

const ownedBy = (where: { id: string; tenantId: string }) => IMAGES[where.id] === where.tenantId;

function buildService(orm: string = MultiORMEnum.TypeORM) {
	const existsBy = jest.fn(async (where: { id: string; tenantId: string }) => ownedBy(where));
	const getRepository = jest.fn(() => ({ existsBy }));
	const count = jest.fn(async (_entity: unknown, where: { id: string; tenantId: string }) => (ownedBy(where) ? 1 : 0));

	const service: any = Object.create(TenantService.prototype);
	Object.defineProperty(service, 'ormType', { get: () => orm });
	service.typeOrmRepository = { manager: { getRepository } };
	service.mikroOrmRepository = { getEntityManager: () => ({ count }) };
	service.update = jest.fn(async () => ({ affected: 1 }));
	return { service: service as TenantService & { update: jest.Mock }, existsBy, getRepository, count };
}

describe('TenantService.updateProfile — the logo must be an image of the same tenant', () => {
	describe('TypeORM', () => {
		it('links an image asset the tenant owns', async () => {
			const { service, existsBy, getRepository } = buildService();

			await service.updateProfile(TENANT_ID, { name: 'Acme', imageId: OWN_IMAGE_ID });

			expect(getRepository).toHaveBeenCalledWith(ImageAsset);
			expect(existsBy).toHaveBeenCalledWith({ id: OWN_IMAGE_ID, tenantId: TENANT_ID });
			expect(service.update).toHaveBeenCalledWith(TENANT_ID, { name: 'Acme', imageId: OWN_IMAGE_ID });
		});

		it("refuses another tenant's image asset and writes nothing", async () => {
			const { service } = buildService();

			await expect(service.updateProfile(TENANT_ID, { name: 'Acme', imageId: FOREIGN_IMAGE_ID })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(service.update).not.toHaveBeenCalled();
		});

		it('refuses an id that names no image asset', async () => {
			const { service } = buildService();

			await expect(
				service.updateProfile(TENANT_ID, { name: 'Acme', imageId: '66666666-6666-4666-8666-666666666666' })
			).rejects.toBeInstanceOf(BadRequestException);
			expect(service.update).not.toHaveBeenCalled();
		});

		it('clears the logo with null without looking up an image', async () => {
			const { service, existsBy } = buildService();

			await service.updateProfile(TENANT_ID, { name: 'Acme', imageId: null });

			expect(existsBy).not.toHaveBeenCalled();
			expect(service.update).toHaveBeenCalledWith(TENANT_ID, { name: 'Acme', imageId: null });
		});

		it('leaves the logo alone when imageId is omitted', async () => {
			const { service, existsBy } = buildService();

			await service.updateProfile(TENANT_ID, { name: 'Acme' });

			expect(existsBy).not.toHaveBeenCalled();
			expect(service.update).toHaveBeenCalledWith(TENANT_ID, { name: 'Acme' });
		});
	});

	describe('MikroORM', () => {
		it('links an image asset the tenant owns through the relation', async () => {
			const { service, count } = buildService(MultiORMEnum.MikroORM);

			await service.updateProfile(TENANT_ID, { name: 'Acme', imageId: OWN_IMAGE_ID });

			expect(count).toHaveBeenCalledWith(ImageAsset, { id: OWN_IMAGE_ID, tenantId: TENANT_ID });
			expect(service.update).toHaveBeenCalledWith(TENANT_ID, { name: 'Acme', image: OWN_IMAGE_ID });
		});

		it("refuses another tenant's image asset and writes nothing", async () => {
			const { service } = buildService(MultiORMEnum.MikroORM);

			await expect(service.updateProfile(TENANT_ID, { name: 'Acme', imageId: FOREIGN_IMAGE_ID })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(service.update).not.toHaveBeenCalled();
		});
	});
});
