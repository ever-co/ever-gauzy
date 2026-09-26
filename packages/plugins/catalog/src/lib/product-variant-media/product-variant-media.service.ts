import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { ProductVariantMedia } from './product-variant-media.entity';
import { MikroOrmProductVariantMediaRepository } from './repository/mikro-orm-product-variant-media.repository';
import { TypeOrmProductVariantMediaRepository } from './repository/type-orm-product-variant-media.repository';

/**
 * A variant's gallery.
 *
 * At most one image per variant is the primary one, and "at most one" is enforced here rather than by
 * the caller: setting a new primary clears the previous one in the same transaction, so a gallery can
 * never be left with two thumbnails or with none after an image is detached.
 */
@Injectable()
export class ProductVariantMediaService extends TenantAwareCrudService<ProductVariantMedia> {
	constructor(
		readonly typeOrmProductVariantMediaRepository: TypeOrmProductVariantMediaRepository,
		readonly mikroOrmProductVariantMediaRepository: MikroOrmProductVariantMediaRepository
	) {
		super(typeOrmProductVariantMediaRepository, mikroOrmProductVariantMediaRepository);
	}

	/**
	 * Reads the gallery of one variant in display order.
	 *
	 * @param variantId The variant to read.
	 * @returns The gallery rows, ordered by position.
	 */
	public async findByVariant(variantId: ID): Promise<ProductVariantMedia[]> {
		return this.typeOrmProductVariantMediaRepository.find({
			where: { variantId, organizationId: RequestContext.currentOrganizationId() },
			order: { position: 'ASC' }
		});
	}

	/**
	 * Replaces a variant's gallery.
	 *
	 * @param variantId The variant whose gallery is being written.
	 * @param imageAssetIds The complete set of image assets, in gallery order.
	 * @param primaryImageAssetId The thumbnail, which must be one of the set.
	 * @returns The gallery rows after the write.
	 * @throws BadRequestException When an image is listed twice or the primary is not in the set.
	 */
	public async replaceMedia(
		variantId: ID,
		imageAssetIds: ID[],
		primaryImageAssetId?: ID
	): Promise<ProductVariantMedia[]> {
		if (new Set(imageAssetIds).size !== imageAssetIds.length) {
			throw new BadRequestException('An image may appear only once in a variant gallery.');
		}

		if (primaryImageAssetId && !imageAssetIds.includes(primaryImageAssetId)) {
			throw new BadRequestException('The primary image has to be one of the images in the gallery.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		const existing = await this.typeOrmProductVariantMediaRepository.find({ where: { variantId } });
		const kept = new Set(imageAssetIds);
		const removed = existing.filter((row) => !kept.has(row.imageAssetId));

		await this.typeOrmProductVariantMediaRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(ProductVariantMedia, removed.map((row) => row.id));
			}

			for (const [position, imageAssetId] of imageAssetIds.entries()) {
				const isPrimary = primaryImageAssetId ? imageAssetId === primaryImageAssetId : false;
				const row = existing.find((candidate) => candidate.imageAssetId === imageAssetId);

				if (row) {
					await manager.update(ProductVariantMedia, row.id, { position, isPrimary });
					continue;
				}

				await manager.insert(ProductVariantMedia, {
					variantId,
					imageAssetId,
					position,
					isPrimary,
					organizationId,
					tenantId
				});
			}
		});

		return this.findByVariant(variantId);
	}

	/**
	 * Makes one image of a variant's gallery the thumbnail and clears the previous one.
	 *
	 * @param variantId The variant.
	 * @param imageAssetId The image to promote.
	 * @returns The gallery rows after the write.
	 * @throws NotFoundException When the image is not in the variant's gallery.
	 */
	public async setPrimary(variantId: ID, imageAssetId: ID): Promise<ProductVariantMedia[]> {
		const rows = await this.typeOrmProductVariantMediaRepository.find({ where: { variantId } });
		const target = rows.find((row) => row.imageAssetId === imageAssetId);

		if (!target) {
			throw new NotFoundException('That image is not part of this variant gallery.');
		}

		await this.typeOrmProductVariantMediaRepository.manager.transaction(async (manager) => {
			for (const row of rows) {
				const isPrimary = row.id === target.id;

				if (row.isPrimary !== isPrimary) {
					await manager.update(ProductVariantMedia, row.id, { isPrimary });
				}
			}
		});

		return this.findByVariant(variantId);
	}

	/**
	 * Detaches one image from a variant's gallery.
	 *
	 * @param variantId The variant.
	 * @param imageAssetId The image to detach.
	 * @throws NotFoundException When the image is not in the variant's gallery.
	 */
	public async detach(variantId: ID, imageAssetId: ID): Promise<void> {
		const row = await this.typeOrmProductVariantMediaRepository.findOne({
			where: { variantId, imageAssetId }
		});

		if (!row) {
			throw new NotFoundException('That image is not part of this variant gallery.');
		}

		await this.typeOrmProductVariantMediaRepository.manager.transaction(async (manager) => {
			await manager.delete(ProductVariantMedia, row.id);
			// A gallery whose thumbnail was just detached promotes the first remaining image, so a
			// variant is never left without the thumbnail existing screens read.
			if (row.isPrimary) {
				const remaining = await manager.find(ProductVariantMedia, {
					where: { variantId },
					order: { position: 'ASC' }
				});

				if (remaining.length) {
					await manager.update(ProductVariantMedia, remaining[0].id, { isPrimary: true });
				}
			}
		});
	}
}
