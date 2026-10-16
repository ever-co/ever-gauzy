import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService, assertPlainReferencesNotForeign } from '@gauzy/core';
import { PUBLICATION_REFERENCES } from '../catalog.references';
import { assertInCallerScope, callerScope } from '../catalog.scope';
import { PublicationStatus } from '../catalog.types';
import { Collection } from '../collection/collection.entity';
import { CollectionChannel } from './collection-channel.entity';
import { MikroOrmCollectionChannelRepository } from './repository/mikro-orm-collection-channel.repository';
import { TypeOrmCollectionChannelRepository } from './repository/type-orm-collection-channel.repository';

/**
 * Where each collection is shown.
 *
 * A collection's own lifecycle and its publication are two different statements, and the read path
 * needs both: a collection is visible on a channel only when this row is `ACTIVE`, the collection's own
 * status is `ACTIVE` and its window contains the moment. The service therefore never treats an
 * `ACTIVE` publication row as sufficient on its own.
 */
@Injectable()
export class CollectionChannelService extends TenantAwareCrudService<CollectionChannel> {
	constructor(
		readonly typeOrmCollectionChannelRepository: TypeOrmCollectionChannelRepository,
		readonly mikroOrmCollectionChannelRepository: MikroOrmCollectionChannelRepository
	) {
		super(typeOrmCollectionChannelRepository, mikroOrmCollectionChannelRepository);
	}

	/**
	 * Refuses publication rows, or a change to one, naming a channel of another tenant (`catalog.references.ts`).
	 *
	 * @param payloads The row or rows, or the change set, about to be written.
	 * @throws ForbiddenException when a channel belongs to another tenant.
	 */
	private async assertChannelNotForeign(payloads: unknown): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmCollectionChannelRepository.manager,
			payloads,
			PUBLICATION_REFERENCES,
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Creates a collection publication row, refusing a channel of another tenant.
	 *
	 * @param entity The row to create.
	 * @returns The created row.
	 */
	public async create(entity: DeepPartial<CollectionChannel>): Promise<CollectionChannel> {
		await this.assertChannelNotForeign(entity);

		return super.create(entity);
	}

	/**
	 * Changes a collection publication row, refusing a change that points it at a channel of another tenant.
	 *
	 * @param id The row, or the conditions that select the rows to change.
	 * @param partialEntity The fields to change.
	 * @returns The update result, as the base class answers it.
	 */
	public async update(
		id: ID | FindOptionsWhere<CollectionChannel>,
		partialEntity: QueryDeepPartialEntity<CollectionChannel>
	): Promise<CollectionChannel | UpdateResult> {
		await this.assertChannelNotForeign(partialEntity);

		return super.update(id, partialEntity);
	}

	/**
	 * Reads the publication rows of one collection.
	 *
	 * @param collectionId The collection to read.
	 * @returns The publication rows of the collection.
	 */
	public async findByCollection(collectionId: ID): Promise<CollectionChannel[]> {
		return this.typeOrmCollectionChannelRepository.find({
			where: { collectionId, ...callerScope(), organizationId: RequestContext.currentOrganizationId() },
			order: { createdAt: 'ASC' }
		});
	}

	/**
	 * Replaces the publication set of one collection.
	 *
	 * A row that becomes `ACTIVE` for the first time is stamped with the instant it did so; the stamp is
	 * never cleared on a later withdrawal, so the history of when a shelf first went live survives.
	 *
	 * **The write is the caller's collection's, and only its rows** (review R2-19), as the collection
	 * membership services already require: the collection is read inside the caller's tenant and organization
	 * first, and the rows the set is diffed against are read inside the same scope. Before this a caller naming
	 * another tenant's collection deleted that tenant's channel rows.
	 *
	 * @param collectionId The collection whose publications are being written.
	 * @param items The complete set of channel publications.
	 * @returns The publication rows after the write.
	 * @throws BadRequestException When a channel is listed twice.
	 * @throws NotFoundException When the collection is not the caller's.
	 */
	public async replaceChannels(
		collectionId: ID,
		items: Array<{ channelId: ID; status: PublicationStatus; publishedAt?: Date }>
	): Promise<CollectionChannel[]> {
		const channelIds = items.map((item) => item.channelId);

		if (new Set(channelIds).size !== channelIds.length) {
			throw new BadRequestException('A channel may be listed only once per collection.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		await assertInCallerScope(this.typeOrmCollectionChannelRepository.manager, Collection, collectionId, 'collection');
		await this.assertChannelNotForeign(items);

		const existing = await this.typeOrmCollectionChannelRepository.find({
			where: { collectionId, ...callerScope() }
		});
		const kept = new Set(channelIds);
		const removed = existing.filter((row) => !kept.has(row.channelId));

		await this.typeOrmCollectionChannelRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(CollectionChannel, removed.map((row) => row.id));
			}

			for (const item of items) {
				const row = existing.find((candidate) => candidate.channelId === item.channelId);
				const publishedAt =
					item.status === PublicationStatus.ACTIVE
						? row?.publishedAt ?? item.publishedAt ?? new Date()
						: row?.publishedAt;

				if (row) {
					await manager.update(CollectionChannel, row.id, { status: item.status, publishedAt });
					continue;
				}

				await manager.insert(CollectionChannel, {
					collectionId,
					channelId: item.channelId,
					status: item.status,
					publishedAt,
					organizationId,
					tenantId
				});
			}
		});

		return this.findByCollection(collectionId);
	}
}
