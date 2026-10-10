import { BadRequestException, Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { EventBus, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { PublicationStatus } from '../catalog.types';
import { ProductPublishedEvent, ProductUnpublishedEvent } from '../events';
import { ProductChannel } from './product-channel.entity';
import { MikroOrmProductChannelRepository } from './repository/mikro-orm-product-channel.repository';
import { TypeOrmProductChannelRepository } from './repository/type-orm-product-channel.repository';

/**
 * Publication of products on channels.
 *
 * The listing gate is the reason this service exists rather than the product service: a product is
 * served on a channel only when its publication row is `ACTIVE` **and** the product's own lifecycle is
 * `ACTIVE` **and** the product is enabled. The publication row grants; it never overrides.
 */
@Injectable()
export class ProductChannelService extends TenantAwareCrudService<ProductChannel> {
	constructor(
		readonly typeOrmProductChannelRepository: TypeOrmProductChannelRepository,
		readonly mikroOrmProductChannelRepository: MikroOrmProductChannelRepository,
		private readonly eventBus: EventBus
	) {
		super(typeOrmProductChannelRepository, mikroOrmProductChannelRepository);
	}

	/**
	 * Reads the publication rows of one product.
	 *
	 * @param productId The product to read.
	 * @returns The publication rows of the product.
	 */
	public async findByProduct(productId: ID): Promise<ProductChannel[]> {
		return this.typeOrmProductChannelRepository.find({
			where: { productId, organizationId: RequestContext.currentOrganizationId() },
			order: { sortOrder: 'ASC' }
		});
	}

	/**
	 * Publishes or withdraws a product on a set of channels.
	 *
	 * The first transition to `ACTIVE` stamps `publishedAt` and no later transition clears it;
	 * `unpublishedAt` is maintained as the exact complement, non-null while the row is not `ACTIVE`.
	 *
	 * @param productId The product being published.
	 * @param channelIds The channels the operation applies to.
	 * @param status The publication state to move to.
	 * @param moment The instant to stamp, defaulting to now.
	 * @returns The publication rows after the write.
	 * @throws BadRequestException When no channel is named.
	 */
	public async setPublication(
		productId: ID,
		channelIds: ID[],
		status: PublicationStatus,
		moment: Date = new Date()
	): Promise<ProductChannel[]> {
		if (!channelIds.length) {
			throw new BadRequestException('At least one channel is required to change a publication.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		const existing = await this.typeOrmProductChannelRepository.find({ where: { productId } });

		await this.typeOrmProductChannelRepository.manager.transaction(async (manager) => {
			for (const channelId of channelIds) {
				const row = existing.find((candidate) => candidate.channelId === channelId);
				const isActive = status === PublicationStatus.ACTIVE;
				const patch = {
					status,
					publishedAt: isActive ? row?.publishedAt ?? moment : row?.publishedAt,
					unpublishedAt: isActive ? null : moment
				};

				if (row) {
					await manager.update(ProductChannel, row.id, patch);
					continue;
				}

				await manager.insert(ProductChannel, {
					productId,
					channelId,
					...patch,
					organizationId,
					tenantId
				});
			}
		});

		const publications = await this.findByProduct(productId);

		for (const publication of publications.filter((row) => channelIds.includes(row.channelId))) {
			await this.eventBus.publish(
				status === PublicationStatus.ACTIVE
					? ProductPublishedEvent.from(publication)
					: ProductUnpublishedEvent.from(publication)
			);
		}

		return publications;
	}

	/**
	 * @param productId The product to test.
	 * @param channelId The channel to test.
	 * @returns True when the product has an `ACTIVE` publication row on that channel.
	 */
	public async isPublishedOn(productId: ID, channelId: ID): Promise<boolean> {
		const count = await this.typeOrmProductChannelRepository.count({
			where: { productId, channelId, status: PublicationStatus.ACTIVE }
		});

		return count > 0;
	}
}
