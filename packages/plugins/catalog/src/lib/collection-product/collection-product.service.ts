import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { CollectionProduct } from './collection-product.entity';
import { MikroOrmCollectionProductRepository } from './repository/mikro-orm-collection-product.repository';
import { TypeOrmCollectionProductRepository } from './repository/type-orm-collection-product.repository';

/**
 * Manual membership of products in a collection.
 *
 * The membership of a collection is replaced as a set rather than edited row by row: a merchandiser
 * reorders a shelf, and an endpoint that adds and removes items one at a time leaves the positions of
 * the untouched rows to be repaired by whoever notices. `replaceProducts` therefore applies the whole
 * requested set — additions, removals and the new positions — inside one transaction.
 */
@Injectable()
export class CollectionProductService extends TenantAwareCrudService<CollectionProduct> {
	constructor(
		readonly typeOrmCollectionProductRepository: TypeOrmCollectionProductRepository,
		readonly mikroOrmCollectionProductRepository: MikroOrmCollectionProductRepository
	) {
		super(typeOrmCollectionProductRepository, mikroOrmCollectionProductRepository);
	}

	/**
	 * Lists the membership rows of one collection in their declared order.
	 *
	 * @param collectionId The collection to read.
	 * @returns The membership rows, ordered by position and then by the instant each was added.
	 */
	public async findByCollection(collectionId: ID): Promise<CollectionProduct[]> {
		return this.typeOrmCollectionProductRepository.find({
			where: { collectionId, organizationId: RequestContext.currentOrganizationId() },
			relations: { product: true },
			order: { position: 'ASC', addedAt: 'ASC' }
		});
	}

	/**
	 * Replaces the manual product set of one collection.
	 *
	 * @param collectionId The collection whose membership is being written.
	 * @param productIds The complete set of product ids the collection should contain, in order.
	 * @returns The membership rows after the write.
	 * @throws BadRequestException When the same product is listed twice, which would make the two
	 * positions ambiguous.
	 */
	public async replaceProducts(collectionId: ID, productIds: ID[]): Promise<CollectionProduct[]> {
		if (new Set(productIds).size !== productIds.length) {
			throw new BadRequestException('A product may appear only once in a collection.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		const existing = await this.typeOrmCollectionProductRepository.find({ where: { collectionId } });
		const kept = new Set(productIds);
		const removed = existing.filter((row) => !kept.has(row.productId));

		await this.typeOrmCollectionProductRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(CollectionProduct, removed.map((row) => row.id));
			}

			for (const [position, productId] of productIds.entries()) {
				const row = existing.find((candidate) => candidate.productId === productId);

				if (row) {
					if (row.position !== position) {
						await manager.update(CollectionProduct, row.id, { position });
					}

					continue;
				}

				await manager.insert(CollectionProduct, {
					collectionId,
					productId,
					position,
					organizationId,
					tenantId
				});
			}
		});

		return this.findByCollection(collectionId);
	}

	/**
	 * Removes one product from a collection.
	 *
	 * @param collectionId The collection.
	 * @param productId The product to remove.
	 * @throws NotFoundException When the product is not a member of the collection.
	 */
	public async removeProduct(collectionId: ID, productId: ID): Promise<void> {
		const row = await this.typeOrmCollectionProductRepository.findOne({ where: { collectionId, productId } });

		if (!row) {
			throw new NotFoundException('That product is not a member of this collection.');
		}

		await this.typeOrmCollectionProductRepository.delete(row.id);
	}

	/**
	 * Curates one product into a collection, appending it after the current last position.
	 *
	 * @param entity The membership to create.
	 * @returns The persisted membership row.
	 */
	public async create(entity: DeepPartial<CollectionProduct>): Promise<CollectionProduct> {
		const last = await this.typeOrmCollectionProductRepository.findOne({
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
