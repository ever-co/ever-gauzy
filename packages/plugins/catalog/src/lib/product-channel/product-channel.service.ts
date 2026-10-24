import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { EventBus, Product, RequestContext, assertPlainReferencesNotForeign } from '@gauzy/core';
import { PUBLICATION_REFERENCES } from '../catalog.references';
import { assertInCallerScope, callerScope } from '../catalog.scope';
import { PublicationStatus } from '../catalog.types';
import { ProductPublishedEvent, ProductUnpublishedEvent } from '../events';
import { ProductChannel } from './product-channel.entity';
import { MikroOrmProductChannelRepository } from './repository/mikro-orm-product-channel.repository';
import { TypeOrmProductChannelRepository } from './repository/type-orm-product-channel.repository';
import { CatalogCrudService } from '../catalog-crud.service';

/**
 * Publication of products on channels.
 *
 * The listing gate is the reason this service exists rather than the product service: a product is
 * served on a channel only when its publication row is `ACTIVE` **and** the product's own lifecycle is
 * `ACTIVE` **and** the product is enabled. The publication row grants; it never overrides.
 */
@Injectable()
export class ProductChannelService extends CatalogCrudService<ProductChannel> {
	constructor(
		readonly typeOrmProductChannelRepository: TypeOrmProductChannelRepository,
		readonly mikroOrmProductChannelRepository: MikroOrmProductChannelRepository,
		private readonly eventBus: EventBus
	) {
		super(typeOrmProductChannelRepository, mikroOrmProductChannelRepository);
	}

	/**
	 * Refuses publication rows, or a change to one, naming a channel of another tenant (`catalog.references.ts`).
	 *
	 * @param payloads The row or rows, or the change set, about to be written.
	 * @throws ForbiddenException when a channel belongs to another tenant.
	 */
	private async assertChannelNotForeign(payloads: unknown): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmProductChannelRepository.manager,
			payloads,
			PUBLICATION_REFERENCES,
			RequestContext.currentTenantId()
		);
	}

	/**
	 * Creates a product publication row, refusing a channel of another tenant.
	 *
	 * @param entity The row to create.
	 * @returns The created row.
	 */
	public async create(entity: DeepPartial<ProductChannel>): Promise<ProductChannel> {
		await this.assertChannelNotForeign(entity);

		return super.create(entity);
	}

	/**
	 * Changes a product publication row, refusing a change that points it at a channel of another tenant.
	 *
	 * @param id The row, or the conditions that select the rows to change.
	 * @param partialEntity The fields to change.
	 * @returns The update result, as the base class answers it.
	 */
	public async update(
		id: ID | FindOptionsWhere<ProductChannel>,
		partialEntity: QueryDeepPartialEntity<ProductChannel>
	): Promise<ProductChannel | UpdateResult> {
		await this.assertChannelNotForeign(partialEntity);

		return super.update(id, partialEntity);
	}

	/**
	 * Reads the publication rows of one product.
	 *
	 * @param productId The product to read.
	 * @returns The publication rows of the product.
	 */
	public async findByProduct(productId: ID): Promise<ProductChannel[]> {
		return this.typeOrmProductChannelRepository.find({
			where: { productId, ...callerScope(), organizationId: RequestContext.currentOrganizationId() },
			order: { sortOrder: 'ASC' }
		});
	}

	/**
	 * Publishes or withdraws a product on a set of channels.
	 *
	 * The first transition to `ACTIVE` stamps `publishedAt` and no later transition clears it;
	 * `unpublishedAt` is maintained as the exact complement, non-null while the row is not `ACTIVE`.
	 *
	 * **The product has to be the caller's, and only its rows are written** (review R2-20). The rows used to be
	 * read by `productId` alone and updated by id, so a caller naming another tenant's product archived that
	 * tenant's live listing — and was answered `[]`, because the read-back is scoped, so the write was invisible.
	 *
	 * @param productId The product being published.
	 * @param channelIds The channels the operation applies to.
	 * @param status The publication state to move to.
	 * @param moment The instant to stamp, defaulting to now.
	 * @returns The publication rows after the write.
	 * @throws BadRequestException When no channel is named.
	 * @throws NotFoundException When the product is not the caller's.
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
		await assertInCallerScope(this.typeOrmProductChannelRepository.manager, Product, productId, 'product');
		await this.assertChannelNotForeign(channelIds.map((channelId) => ({ channelId })));

		const existing = await this.typeOrmProductChannelRepository.find({ where: { productId, ...callerScope() } });

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
			where: { productId, channelId, status: PublicationStatus.ACTIVE, ...callerScope() }
		});

		return count > 0;
	}
}
