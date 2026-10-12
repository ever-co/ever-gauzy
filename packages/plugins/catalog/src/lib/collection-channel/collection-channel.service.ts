import { BadRequestException, Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { PublicationStatus } from '../catalog.types';
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
	 * Reads the publication rows of one collection.
	 *
	 * @param collectionId The collection to read.
	 * @returns The publication rows of the collection.
	 */
	public async findByCollection(collectionId: ID): Promise<CollectionChannel[]> {
		return this.typeOrmCollectionChannelRepository.find({
			where: { collectionId, organizationId: RequestContext.currentOrganizationId() },
			order: { createdAt: 'ASC' }
		});
	}

	/**
	 * Replaces the publication set of one collection.
	 *
	 * A row that becomes `ACTIVE` for the first time is stamped with the instant it did so; the stamp is
	 * never cleared on a later withdrawal, so the history of when a shelf first went live survives.
	 *
	 * @param collectionId The collection whose publications are being written.
	 * @param items The complete set of channel publications.
	 * @returns The publication rows after the write.
	 * @throws BadRequestException When a channel is listed twice.
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

		const existing = await this.typeOrmCollectionChannelRepository.find({ where: { collectionId } });
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
