import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { CollectionVariant } from './collection-variant.entity';
import { MikroOrmCollectionVariantRepository } from './repository/mikro-orm-collection-variant.repository';
import { TypeOrmCollectionVariantRepository } from './repository/type-orm-collection-variant.repository';

/**
 * Manual membership of variants in a collection, with the same set-replacement semantics as the
 * product-level membership: a "last sizes" shelf is reordered and restocked as a whole.
 */
@Injectable()
export class CollectionVariantService extends TenantAwareCrudService<CollectionVariant> {
	constructor(
		readonly typeOrmCollectionVariantRepository: TypeOrmCollectionVariantRepository,
		readonly mikroOrmCollectionVariantRepository: MikroOrmCollectionVariantRepository
	) {
		super(typeOrmCollectionVariantRepository, mikroOrmCollectionVariantRepository);
	}

	/**
	 * Lists the variant membership rows of one collection in their declared order.
	 *
	 * @param collectionId The collection to read.
	 * @returns The membership rows, ordered by position and then by the instant each was added.
	 */
	public async findByCollection(collectionId: ID): Promise<CollectionVariant[]> {
		return this.typeOrmCollectionVariantRepository.find({
			where: { collectionId, organizationId: RequestContext.currentOrganizationId() },
			relations: { variant: true },
			order: { position: 'ASC', addedAt: 'ASC' }
		});
	}

	/**
	 * Replaces the manual variant set of one collection.
	 *
	 * @param collectionId The collection whose membership is being written.
	 * @param variantIds The complete set of variant ids the collection should contain, in order.
	 * @returns The membership rows after the write.
	 * @throws BadRequestException When the same variant is listed twice.
	 */
	public async replaceVariants(collectionId: ID, variantIds: ID[]): Promise<CollectionVariant[]> {
		if (new Set(variantIds).size !== variantIds.length) {
			throw new BadRequestException('A variant may appear only once in a collection.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		const existing = await this.typeOrmCollectionVariantRepository.find({ where: { collectionId } });
		const kept = new Set(variantIds);
		const removed = existing.filter((row) => !kept.has(row.variantId));

		await this.typeOrmCollectionVariantRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(CollectionVariant, removed.map((row) => row.id));
			}

			for (const [position, variantId] of variantIds.entries()) {
				const row = existing.find((candidate) => candidate.variantId === variantId);

				if (row) {
					if (row.position !== position) {
						await manager.update(CollectionVariant, row.id, { position });
					}

					continue;
				}

				await manager.insert(CollectionVariant, {
					collectionId,
					variantId,
					position,
					organizationId,
					tenantId
				});
			}
		});

		return this.findByCollection(collectionId);
	}

	/**
	 * Removes one variant from a collection.
	 *
	 * @param collectionId The collection.
	 * @param variantId The variant to remove.
	 * @throws NotFoundException When the variant is not a member of the collection.
	 */
	public async removeVariant(collectionId: ID, variantId: ID): Promise<void> {
		const row = await this.typeOrmCollectionVariantRepository.findOne({ where: { collectionId, variantId } });

		if (!row) {
			throw new NotFoundException('That variant is not a member of this collection.');
		}

		await this.typeOrmCollectionVariantRepository.delete(row.id);
	}

	/**
	 * Curates one variant into a collection, appending it after the current last position.
	 *
	 * @param entity The membership to create.
	 * @returns The persisted membership row.
	 */
	public async create(entity: DeepPartial<CollectionVariant>): Promise<CollectionVariant> {
		const last = await this.typeOrmCollectionVariantRepository.findOne({
			where: { collectionId: entity.collectionId },
			order: { position: 'DESC' }
		});

		return super.create({
			position: last ? last.position + 1 : 0,
			addedAt: new Date(),
			...entity
		});
	}
}
