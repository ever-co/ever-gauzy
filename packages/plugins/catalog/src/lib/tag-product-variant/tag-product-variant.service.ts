import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { ProductVariant, RequestContext, Tag } from '@gauzy/core';
import { assertAllInCallerScope, assertInCallerScope, callerScope } from '../catalog.scope';
import { TagProductVariant } from './tag-product-variant.entity';
import { MikroOrmTagProductVariantRepository } from './repository/mikro-orm-tag-product-variant.repository';
import { TypeOrmTagProductVariantRepository } from './repository/type-orm-tag-product-variant.repository';
import { CatalogCrudService } from '../catalog-crud.service';

/**
 * Variant-level facets.
 *
 * Removal through the set writes is a hard delete of the pair: replacing a variant's facets deletes the pairs
 * that are no longer requested inside the same transaction that inserts the new ones. A facet row can also be
 * retired recoverably — the inherited `DELETE /tag-product-variants/:id/soft` and `softDeleteTagProductVariant`
 * — and the pair's unique index, `UQ_tag_product_variant`, is not partial on `deletedAt`: a retired row still
 * holds its pair. Attaching that facet value again therefore restores the retired row rather than inserting a
 * second one the index refuses (review R2-24 (d)).
 */
@Injectable()
export class TagProductVariantService extends CatalogCrudService<TagProductVariant> {
	constructor(
		readonly typeOrmTagProductVariantRepository: TypeOrmTagProductVariantRepository,
		readonly mikroOrmTagProductVariantRepository: MikroOrmTagProductVariantRepository
	) {
		super(typeOrmTagProductVariantRepository, mikroOrmTagProductVariantRepository);
	}

	/**
	 * Reads the facets of one variant.
	 *
	 * @param variantId The variant to read.
	 * @returns The facet rows of the variant.
	 */
	public async findByVariant(variantId: ID): Promise<TagProductVariant[]> {
		return this.typeOrmTagProductVariantRepository.find({
			where: { productVariantId: variantId, ...callerScope(), organizationId: RequestContext.currentOrganizationId() },
			relations: { tag: true }
		});
	}

	/**
	 * Attaches one facet value to a variant — `POST /tag-product-variants`.
	 *
	 * A pair whose row was retired recoverably is restored and answered, because the pair's unique index still
	 * holds it and a second row is refused by the database (R2-24 (d)); a pair that is already attached is refused
	 * by name rather than by the constraint.
	 *
	 * @param entity The pair to attach.
	 * @returns The attached facet row.
	 * @throws BadRequestException When the variant already carries the facet value.
	 */
	public async create(entity: DeepPartial<TagProductVariant>): Promise<TagProductVariant> {
		const productVariantId = entity?.productVariantId ?? entity?.productVariant?.id;
		const tagId = entity?.tagId ?? entity?.tag?.id;

		if (productVariantId && tagId) {
			const existing = await this.typeOrmTagProductVariantRepository.findOne({
				where: { productVariantId, tagId, ...callerScope() },
				withDeleted: true
			});

			if (existing && !existing.deletedAt) {
				throw new BadRequestException('The variant already carries that facet value.');
			}

			if (existing) {
				// A retired pair is restored only between a variant and a facet value the caller may still use: a
				// retired variant or tag, or another tenant's, is refused as `replaceTags` refuses it.
				await assertInCallerScope(
					this.typeOrmTagProductVariantRepository.manager,
					ProductVariant,
					productVariantId,
					'variant'
				);
				await assertAllInCallerScope(
					this.typeOrmTagProductVariantRepository.manager,
					Tag,
					[tagId],
					'facet values',
					{
						tenantWide: true,
						global: true
					}
				);
				await this.typeOrmTagProductVariantRepository.restore(existing.id);

				return this.findOneByIdString(existing.id);
			}
		}

		return super.create(entity);
	}

	/**
	 * Replaces a variant's facets with the requested set.
	 *
	 * @param variantId The variant whose facets are being written.
	 * @param tagIds The complete set of facet values the variant should carry.
	 * @returns The facet rows after the write.
	 * @throws BadRequestException When a facet value is listed twice.
	 * @throws NotFoundException When the variant is not the caller's (review R2-19: the facets used to be read by
	 * `productVariantId` alone and the ones missing from the new set deleted by id, whoever owned them).
	 */
	public async replaceTags(variantId: ID, tagIds: ID[]): Promise<TagProductVariant[]> {
		if (new Set(tagIds).size !== tagIds.length) {
			throw new BadRequestException('A facet value may be attached to a variant only once.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		await assertInCallerScope(this.typeOrmTagProductVariantRepository.manager, ProductVariant, variantId, 'variant');
		// The facet values are the caller's, the tenant's or the installation's (SEC-D-04): another tenant's tag went in
		// by its id and was read back with the variant's facets.
		await assertAllInCallerScope(this.typeOrmTagProductVariantRepository.manager, Tag, tagIds, 'facet values', {
			tenantWide: true,
			global: true
		});

		// The retired rows are read too: a retired pair still holds `UQ_tag_product_variant`, so a requested facet
		// value whose row is retired is restored, where inserting it again failed on the index (R2-24 (d)).
		const existing = await this.typeOrmTagProductVariantRepository.find({
			where: { productVariantId: variantId, ...callerScope() },
			withDeleted: true
		});
		const kept = new Set(tagIds);
		const removed = existing.filter((row) => !row.deletedAt && !kept.has(row.tagId));
		const restored = existing.filter((row) => row.deletedAt && kept.has(row.tagId));

		await this.typeOrmTagProductVariantRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(TagProductVariant, removed.map((row) => row.id));
			}

			if (restored.length) {
				await manager.restore(
					TagProductVariant,
					restored.map((row) => row.id)
				);
			}

			for (const tagId of tagIds) {
				if (existing.some((row) => row.tagId === tagId)) {
					continue;
				}

				await manager.insert(TagProductVariant, {
					productVariantId: variantId,
					tagId,
					organizationId,
					tenantId
				});
			}
		});

		return this.findByVariant(variantId);
	}

	/**
	 * Detaches one facet value from a variant.
	 *
	 * The delete is narrowed to the caller's tenant and organization, so it can only ever remove a facet row of
	 * the caller's own; one of another tenant is left where it is (review R2-19).
	 *
	 * @param variantId The variant.
	 * @param tagId The facet value to detach.
	 */
	public async detach(variantId: ID, tagId: ID): Promise<void> {
		await this.typeOrmTagProductVariantRepository.delete({ productVariantId: variantId, tagId, ...callerScope() });
	}

	/**
	 * Lists the variants that carry every one of the requested facet values.
	 *
	 * The intersection is what makes a facet filter mean what a buyer expects: asking for "colour = red
	 * AND size = M" has to return the variants that are both, not the union of the two.
	 *
	 * @param tagIds The facet values to require.
	 * @returns The matching variant ids, or an empty list when no facet value was requested.
	 */
	public async findVariantsWithAllTags(tagIds: ID[]): Promise<ID[]> {
		if (!tagIds.length) {
			return [];
		}

		const rows = await this.typeOrmTagProductVariantRepository.find({
			where: { organizationId: RequestContext.currentOrganizationId() }
		});

		const matches = new Map<ID, number>();

		for (const row of rows) {
			if (tagIds.includes(row.tagId)) {
				matches.set(row.productVariantId, (matches.get(row.productVariantId) ?? 0) + 1);
			}
		}

		return [...matches.entries()]
			.filter(([, count]) => count === new Set(tagIds).size)
			.map(([variantId]) => variantId);
	}
}
