import { BadRequestException, Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TagProductVariant } from './tag-product-variant.entity';
import { MikroOrmTagProductVariantRepository } from './repository/mikro-orm-tag-product-variant.repository';
import { TypeOrmTagProductVariantRepository } from './repository/type-orm-tag-product-variant.repository';

/**
 * Variant-level facets.
 *
 * The pivot has no soft-delete column, deliberately: a soft-deleted join row would still be found by
 * every existing tag query on the platform, which does not know this table exists. Removal is
 * therefore a hard delete of the pair, and replacing a variant's facets deletes the pairs that are no
 * longer requested inside the same transaction that inserts the new ones.
 */
@Injectable()
export class TagProductVariantService extends TenantAwareCrudService<TagProductVariant> {
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
			where: { productVariantId: variantId, organizationId: RequestContext.currentOrganizationId() },
			relations: ['tag']
		});
	}

	/**
	 * Replaces a variant's facets with the requested set.
	 *
	 * @param variantId The variant whose facets are being written.
	 * @param tagIds The complete set of facet values the variant should carry.
	 * @returns The facet rows after the write.
	 * @throws BadRequestException When a facet value is listed twice.
	 */
	public async replaceTags(variantId: ID, tagIds: ID[]): Promise<TagProductVariant[]> {
		if (new Set(tagIds).size !== tagIds.length) {
			throw new BadRequestException('A facet value may be attached to a variant only once.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		const existing = await this.typeOrmTagProductVariantRepository.find({
			where: { productVariantId: variantId }
		});
		const kept = new Set(tagIds);
		const removed = existing.filter((row) => !kept.has(row.tagId));

		await this.typeOrmTagProductVariantRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(TagProductVariant, removed.map((row) => row.id));
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
	 * @param variantId The variant.
	 * @param tagId The facet value to detach.
	 */
	public async detach(variantId: ID, tagId: ID): Promise<void> {
		await this.typeOrmTagProductVariantRepository.delete({ productVariantId: variantId, tagId });
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
