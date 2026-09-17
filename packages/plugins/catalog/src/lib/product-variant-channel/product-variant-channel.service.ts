import { BadRequestException, Injectable } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { PublicationStatus } from '../catalog.types';
import { ProductVariantChannel } from './product-variant-channel.entity';
import { MikroOrmProductVariantChannelRepository } from './repository/mikro-orm-product-variant-channel.repository';
import { TypeOrmProductVariantChannelRepository } from './repository/type-orm-product-variant-channel.repository';

/**
 * Publication of variants on channels.
 *
 * Publication here is opt-in: a variant with no rows of its own inherits whatever its product's
 * publication says, so a catalogue that never writes a row sells everything it publishes. A variant is
 * purchasable on a channel only when its own row **and** its product's row are both `ACTIVE`.
 */
@Injectable()
export class ProductVariantChannelService extends TenantAwareCrudService<ProductVariantChannel> {
	constructor(
		readonly typeOrmProductVariantChannelRepository: TypeOrmProductVariantChannelRepository,
		readonly mikroOrmProductVariantChannelRepository: MikroOrmProductVariantChannelRepository
	) {
		super(typeOrmProductVariantChannelRepository, mikroOrmProductVariantChannelRepository);
	}

	/**
	 * Reads the publication rows of one variant.
	 *
	 * @param variantId The variant to read.
	 * @returns The publication rows of the variant.
	 */
	public async findByVariant(variantId: ID): Promise<ProductVariantChannel[]> {
		return this.typeOrmProductVariantChannelRepository.find({
			where: { variantId, organizationId: RequestContext.currentOrganizationId() },
			order: { sortOrder: 'ASC' }
		});
	}

	/**
	 * Replaces the publication set of one variant.
	 *
	 * @param variantId The variant whose publications are being written.
	 * @param items The complete set of channel publications.
	 * @returns The publication rows after the write.
	 * @throws BadRequestException When a channel is listed twice.
	 */
	public async replacePublications(
		variantId: ID,
		items: Array<{ channelId: ID; status: PublicationStatus; publishedAt?: Date }>
	): Promise<ProductVariantChannel[]> {
		const channelIds = items.map((item) => item.channelId);

		if (new Set(channelIds).size !== channelIds.length) {
			throw new BadRequestException('A channel may be listed only once per variant.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		const existing = await this.typeOrmProductVariantChannelRepository.find({ where: { variantId } });
		const kept = new Set(channelIds);
		const removed = existing.filter((row) => !kept.has(row.channelId));

		await this.typeOrmProductVariantChannelRepository.manager.transaction(async (manager) => {
			if (removed.length) {
				await manager.delete(ProductVariantChannel, removed.map((row) => row.id));
			}

			for (const item of items) {
				const row = existing.find((candidate) => candidate.channelId === item.channelId);
				const isActive = item.status === PublicationStatus.ACTIVE;
				const publishedAt = isActive ? row?.publishedAt ?? item.publishedAt ?? new Date() : row?.publishedAt;

				if (row) {
					await manager.update(ProductVariantChannel, row.id, {
						status: item.status,
						publishedAt,
						unpublishedAt: isActive ? null : new Date()
					});

					continue;
				}

				await manager.insert(ProductVariantChannel, {
					variantId,
					channelId: item.channelId,
					status: item.status,
					publishedAt,
					unpublishedAt: isActive ? null : new Date(),
					organizationId,
					tenantId
				});
			}
		});

		return this.findByVariant(variantId);
	}

	/**
	 * @param variantId The variant to test.
	 * @param channelId The channel to test.
	 * @returns True when the variant has no publication rows at all, in which case it inherits its
	 * product's publication, or when it has an `ACTIVE` row for the channel.
	 */
	public async isPurchasableOn(variantId: ID, channelId: ID): Promise<boolean> {
		const rows = await this.typeOrmProductVariantChannelRepository.find({ where: { variantId } });

		if (!rows.length) {
			return true;
		}

		return rows.some((row) => row.channelId === channelId && row.status === PublicationStatus.ACTIVE);
	}
}
