import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter, Observable } from 'rxjs';
import { ID, IPagination } from '@gauzy/contracts';
import { EventBus, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../../catalog.permissions';
import { PublicationStatus } from '../../catalog.types';
import { ProductPublishedEvent, ProductUnpublishedEvent } from '../../events';
import { ProductChannel } from '../../product-channel/product-channel.entity';
import { ProductChannelService } from '../../product-channel/product-channel.service';
import { ProductVariantChannel } from '../../product-variant-channel/product-variant-channel.entity';
import { ProductVariantChannelService } from '../../product-variant-channel/product-variant-channel.service';
import { toAsyncIterable } from '../async-iterable';

/**
 * Product and variant publication over GraphQL.
 *
 * Publishing is a set operation rather than a row edit, so the mutations take the channels they apply
 * to. Reading a single publication is a node query because a caller that has just been told a product
 * went live needs to fetch exactly that row.
 */
@Resolver('ProductPublication')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class ProductPublicationResolver {
	constructor(
		private readonly productChannelService: ProductChannelService,
		private readonly productVariantChannelService: ProductVariantChannelService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists product publication rows.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productPublications')
	async productPublications(
		@Args('filter') filterBy: { productId?: ID; channelId?: ID; status?: PublicationStatus } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPagination<ProductChannel>> {
		return this.productChannelService.paginate({
			where: { ...filterBy },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
	}

	/**
	 * Reads one product publication by id.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productPublication')
	async productPublication(@Args('id') id: ID): Promise<ProductChannel> {
		return this.productChannelService.findOneByIdString(id);
	}

	/**
	 * Lists variant publication rows.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productVariantPublications')
	async productVariantPublications(
		@Args('filter') filterBy: { variantId?: ID; channelId?: ID; status?: PublicationStatus } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IPagination<ProductVariantChannel>> {
		return this.productVariantChannelService.paginate({
			where: { ...filterBy },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});
	}

	/**
	 * Publishes a product on one or more channels.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('publishProduct')
	async publishProduct(
		@Args('productId') productId: ID,
		@Args('channelIds') channelIds: ID[],
		@Args('publishedAt') publishedAt?: Date
	): Promise<ProductChannel[]> {
		return this.productChannelService.setPublication(
			productId,
			channelIds,
			PublicationStatus.ACTIVE,
			publishedAt ? new Date(publishedAt) : new Date()
		);
	}

	/**
	 * Withdraws a product from one or more channels.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('unpublishProduct')
	async unpublishProduct(
		@Args('productId') productId: ID,
		@Args('channelIds') channelIds: ID[],
		@Args('unpublishedAt') unpublishedAt?: Date
	): Promise<ProductChannel[]> {
		return this.productChannelService.setPublication(
			productId,
			channelIds,
			PublicationStatus.ARCHIVED,
			unpublishedAt ? new Date(unpublishedAt) : new Date()
		);
	}

	/**
	 * Replaces the publication set of a variant.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('publishProductVariant')
	async publishProductVariant(
		@Args('variantId') variantId: ID,
		@Args('input')
		input: Array<{ channelId: ID; status: PublicationStatus; publishedAt?: Date }>
	): Promise<ProductVariantChannel[]> {
		return this.productVariantChannelService.replacePublications(variantId, input);
	}

	/**
	 * Withdraws a variant from the named channels, keeping its other publications.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Mutation('unpublishProductVariant')
	async unpublishProductVariant(
		@Args('variantId') variantId: ID,
		@Args('channelIds') channelIds: ID[]
	): Promise<ProductVariantChannel[]> {
		const existing = await this.productVariantChannelService.findByVariant(variantId);

		return this.productVariantChannelService.replacePublications(
			variantId,
			existing
				.filter((row) => !channelIds.includes(row.channelId))
				.map((row) => ({ channelId: row.channelId, status: row.status, publishedAt: row.publishedAt }))
		);
	}

	/**
	 * Streams products going live, optionally narrowed to one product or one channel.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Subscription('productPublished')
	productPublished(
		@Args('productId') productId?: ID,
		@Args('channelId') channelId?: ID
	): AsyncIterable<ProductPublishedEvent> {
		return toAsyncIterable(this.filterPublications(this.eventBus.ofType(ProductPublishedEvent), productId, channelId));
	}

	/**
	 * Streams products being withdrawn, optionally narrowed to one product or one channel.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Subscription('productUnpublished')
	productUnpublished(
		@Args('productId') productId?: ID,
		@Args('channelId') channelId?: ID
	): AsyncIterable<ProductUnpublishedEvent> {
		return toAsyncIterable(
			this.filterPublications(this.eventBus.ofType(ProductUnpublishedEvent), productId, channelId)
		);
	}

	/**
	 * @param source The publication event stream.
	 * @param productId An optional product to narrow to.
	 * @param channelId An optional channel to narrow to.
	 * @returns The narrowed stream.
	 */
	private filterPublications<T extends ProductPublishedEvent | ProductUnpublishedEvent>(
		source: Observable<T>,
		productId?: ID,
		channelId?: ID
	): Observable<T> {
		if (productId && channelId) {
			return source.pipe(filter((event) => event.productId === productId && event.channelId === channelId));
		}

		if (productId) {
			return source.pipe(filter((event) => event.productId === productId));
		}

		if (channelId) {
			return source.pipe(filter((event) => event.channelId === channelId));
		}

		return source;
	}
}
