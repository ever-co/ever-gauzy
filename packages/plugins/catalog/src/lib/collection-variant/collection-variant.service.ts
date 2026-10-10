import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { Collection } from '../collection/collection.entity';
import { CollectionVariant } from './collection-variant.entity';
import { MikroOrmCollectionVariantRepository } from './repository/mikro-orm-collection-variant.repository';
import { TypeOrmCollectionVariantRepository } from './repository/type-orm-collection-variant.repository';

/**
 * The caller's tenant and organization as criteria, each only when the credential states it: a key present with an
 * undefined value is a criterion the two ORMs read differently.
 */
function callerScope(): { tenantId?: ID; organizationId?: ID } {
	const tenantId = RequestContext.currentTenantId();
	const organizationId = RequestContext.currentOrganizationId();

	return { ...(tenantId ? { tenantId } : {}), ...(organizationId ? { organizationId } : {}) };
}

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
			where: { collectionId, ...callerScope(), organizationId: RequestContext.currentOrganizationId() },
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
	 * **The write is the caller's collection's, and only its rows.** The collection is read inside the caller's
	 * tenant and organization first, and a collection that is not the caller's is answered as one that does not
	 * exist; the membership rows the set is diffed against are read inside the same scope. Before this, the
	 * existing rows were read by `collectionId` alone and the ones missing from the new set were deleted by id,
	 * so a caller naming another tenant's collection rewrote that tenant's shelf.
	 *
	 * @throws BadRequestException When the same variant is listed twice.
	 * @throws NotFoundException When the collection is not the caller's.
	 */
	public async replaceVariants(collectionId: ID, variantIds: ID[]): Promise<CollectionVariant[]> {
		if (new Set(variantIds).size !== variantIds.length) {
			throw new BadRequestException('A variant may appear only once in a collection.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		await this.assertCollectionInScope(collectionId);

		const existing = await this.typeOrmCollectionVariantRepository.find({
			where: { collectionId, ...callerScope() }
		});
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
	 * Curates variants into a collection, appending the ones it does not already hold after its current set.
	 *
	 * This is the set write expressed as an addition — the `addCollectionVariants` field the schema declares — so it
	 * reaches storage through {@link replaceVariants} and inherits its transaction, its scope check and its
	 * refusal of another tenant's collection: the current set is kept in its order, and each named variant that
	 * is not a member yet is appended once, in the order the caller stated it. A variant named twice, or already a
	 * member, is not an error; the call states what the collection should contain, and it does.
	 *
	 * @param collectionId The collection whose membership is being extended.
	 * @param variantIds The variants to curate into it.
	 * @returns The membership rows after the write.
	 * @throws NotFoundException When the collection is not the caller's.
	 */
	public async addVariants(collectionId: ID, variantIds: ID[]): Promise<CollectionVariant[]> {
		await this.assertCollectionInScope(collectionId);

		const current = (await this.findByCollection(collectionId)).map((row) => row.variantId);
		const additions = [...new Set(variantIds ?? [])].filter((variantId) => !current.includes(variantId));

		return this.replaceVariants(collectionId, [...current, ...additions]);
	}

	/**
	 * Removes variants from a collection's manual set, keeping the order of the variants that stay.
	 *
	 * The set write expressed as a removal — the `removeCollectionVariants` field the schema declares — through
	 * {@link replaceVariants}, with the same scope check. A named variant that is not a member is ignored, as the
	 * product-level removal ignores one.
	 *
	 * @param collectionId The collection whose membership is being reduced.
	 * @param variantIds The variants to take out of it.
	 * @returns The membership rows after the write.
	 * @throws NotFoundException When the collection is not the caller's.
	 */
	public async removeVariants(collectionId: ID, variantIds: ID[]): Promise<CollectionVariant[]> {
		await this.assertCollectionInScope(collectionId);

		const removed = new Set(variantIds ?? []);
		const current = (await this.findByCollection(collectionId)).map((row) => row.variantId);

		return this.replaceVariants(
			collectionId,
			current.filter((variantId) => !removed.has(variantId))
		);
	}

	/**
	 * Refuses a collection that is not the caller's, answering it as one that does not exist.
	 *
	 * @param collectionId The collection a set write names.
	 * @throws NotFoundException When no collection of that id is in the caller's tenant and organization.
	 */
	private async assertCollectionInScope(collectionId: ID): Promise<void> {
		const collection = await this.typeOrmCollectionVariantRepository.manager.findOne(Collection, {
			where: { id: collectionId, ...callerScope() } as any
		});

		if (!collection) {
			throw new NotFoundException('The collection was not found.');
		}
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
