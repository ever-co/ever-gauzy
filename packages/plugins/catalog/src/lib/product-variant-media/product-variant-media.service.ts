import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { ImageAsset, ProductVariant, RequestContext } from '@gauzy/core';
import { assertAllInCallerScope, assertInCallerScope, callerScope } from '../catalog.scope';
import { ProductVariantMedia } from './product-variant-media.entity';
import { MikroOrmProductVariantMediaRepository } from './repository/mikro-orm-product-variant-media.repository';
import { TypeOrmProductVariantMediaRepository } from './repository/type-orm-product-variant-media.repository';
import { CatalogCrudService } from '../catalog-crud.service';

/**
 * A variant's gallery.
 *
 * At most one image per variant is the primary one, and "at most one" is enforced here rather than by
 * the caller: setting a new primary clears the previous one in the same transaction, so a gallery can
 * never be left with two thumbnails or with none after an image is detached.
 *
 * **The previous primary is cleared first, in one statement, and only then is the new one set.**
 * `UQ_variant_media_primary` admits one live primary row per variant, and Postgres and SQLite check a
 * unique index per statement. Writing the rows one by one — in the order `find()` returned them, which has
 * no `ORDER BY`, or in the order a caller listed the images — set the new primary while the old one was
 * still set whenever the new row came first, so the write failed on the index and rolled back, depending
 * on row order (R5-07).
 */
@Injectable()
export class ProductVariantMediaService extends CatalogCrudService<ProductVariantMedia> {
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
			where: { variantId, ...callerScope(), organizationId: RequestContext.currentOrganizationId() },
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
	 * @throws NotFoundException When the variant is not the caller's (review R2-19: the gallery used to be read
	 * by `variantId` alone and the images missing from the new set deleted by id, whoever owned them).
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
		await assertInCallerScope(this.typeOrmProductVariantMediaRepository.manager, ProductVariant, variantId, 'variant');
		// The images are the caller's too (SEC-D-04): another tenant's image went into the gallery by its id.
		await assertAllInCallerScope(this.typeOrmProductVariantMediaRepository.manager, ImageAsset, imageAssetIds, 'images', {
			tenantWide: true
		});

		const existing = await this.typeOrmProductVariantMediaRepository.find({
			where: { variantId, ...callerScope() }
		});
		const kept = new Set(imageAssetIds);
		const removed = existing.filter((row) => !kept.has(row.imageAssetId));

		await this.typeOrmProductVariantMediaRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(ProductVariantMedia, removed.map((row) => row.id));
			}

			// Cleared first, so the loop below can set the new primary in any order (R5-07).
			await this.clearPrimary(manager, variantId);

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
	 * Reorders a variant's gallery without changing what it holds.
	 *
	 * The order is written row by row inside one transaction that first reads the gallery: a list that is not
	 * exactly its images, each once, is refused, and nothing is inserted or deleted — so a reorder that overlaps
	 * an attach or a detach can neither drop the image just attached nor bring back the one just detached, which
	 * a reorder written through {@link replaceMedia} did (Greptile on #10887, review sweep R2-G4). The primary
	 * image is left as it is.
	 *
	 * @param variantId The variant whose gallery is reordered.
	 * @param imageAssetIds The gallery's images, in their new order.
	 * @returns The gallery rows after the write.
	 * @throws BadRequestException When the list adds to, drops from or repeats an image of the gallery.
	 * @throws NotFoundException When the variant is not the caller's.
	 */
	public async reorderMedia(variantId: ID, imageAssetIds: ID[]): Promise<ProductVariantMedia[]> {
		const stated = imageAssetIds ?? [];

		await assertInCallerScope(
			this.typeOrmProductVariantMediaRepository.manager,
			ProductVariant,
			variantId,
			'variant'
		);

		await this.typeOrmProductVariantMediaRepository.manager.transaction(async (manager) => {
			const rows = await manager.find(ProductVariantMedia, { where: { variantId, ...callerScope() } as never });
			const byImage = new Map(rows.map((row) => [row.imageAssetId, row]));

			if (
				new Set(stated).size !== stated.length ||
				stated.length !== byImage.size ||
				stated.some((id) => !byImage.has(id))
			) {
				throw new BadRequestException(
					'A reorder states each image of the variant gallery once, and only those. Attach or detach images ' +
						'with attachProductVariantMedia / detachProductVariantMedia.'
				);
			}

			for (const [position, imageAssetId] of stated.entries()) {
				const row = byImage.get(imageAssetId) as ProductVariantMedia;

				if (row.position !== position) {
					await manager.update(ProductVariantMedia, { id: row.id, ...callerScope() } as never, { position });
				}
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
		const rows = await this.typeOrmProductVariantMediaRepository.find({ where: { variantId, ...callerScope() } });
		const target = rows.find((row) => row.imageAssetId === imageAssetId);

		if (!target) {
			throw new NotFoundException('That image is not part of this variant gallery.');
		}

		await this.typeOrmProductVariantMediaRepository.manager.transaction(async (manager) => {
			// Every other primary of the variant is cleared in one statement before the target is set (R5-07).
			// The target is set unconditionally: its `isPrimary` was read before this transaction, and another
			// request may have moved the thumbnail since.
			await this.clearPrimary(manager, variantId, target.id);
			await manager.update(ProductVariantMedia, target.id, { isPrimary: true });
		});

		return this.findByVariant(variantId);
	}

	/**
	 * Clears the variant's primary image in one statement, so the next write can set a new one without the
	 * unique index ever seeing two.
	 *
	 * The rows are selected by predicate rather than by the ids read earlier, so a primary set by another
	 * request since that read is cleared too. Only the live gallery is touched — a soft-deleted row keeps the
	 * flag it was deleted with, which is what a recovery brings back — and only within the caller's scope,
	 * like every other read and write of the gallery.
	 *
	 * @param manager The transaction's entity manager.
	 * @param variantId The variant.
	 * @param exceptId A row to leave as it is: the one about to be set as the primary.
	 */
	private async clearPrimary(manager: EntityManager, variantId: ID, exceptId?: ID): Promise<void> {
		await manager.update(
			ProductVariantMedia,
			{
				variantId,
				isPrimary: true,
				deletedAt: IsNull(),
				...callerScope(),
				...(exceptId ? { id: Not(exceptId) } : {})
			},
			{ isPrimary: false }
		);
	}

	/**
	 * Detaches one image from a variant's gallery.
	 *
	 * @param variantId The variant.
	 * @param imageAssetId The image to detach.
	 * @throws NotFoundException When the image is not in the caller's gallery of the variant — another tenant's
	 * gallery row is answered as one that is not there (review R2-19).
	 */
	public async detach(variantId: ID, imageAssetId: ID): Promise<void> {
		const row = await this.typeOrmProductVariantMediaRepository.findOne({
			where: { variantId, imageAssetId, ...callerScope() }
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
					where: { variantId, ...callerScope() },
					order: { position: 'ASC' }
				});

				if (remaining.length) {
					await manager.update(ProductVariantMedia, remaining[0].id, { isPrimary: true });
				}
			}
		});
	}
}
