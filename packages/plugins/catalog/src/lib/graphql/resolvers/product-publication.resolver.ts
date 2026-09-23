import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter, Observable } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { connectionFromOffsetPage, IConnectionPageSelection, resolveConnectionWindow, EventBus, FeatureFlagGuard, GraphqlConnection, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
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
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('ProductPublication')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ProductPublicationResolver {
	constructor(
		private readonly productChannelService: ProductChannelService,
		private readonly productVariantChannelService: ProductVariantChannelService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists product publication rows.
	 *
	 * @param filterBy The product, the channel and the status the publications are narrowed to.
	 * @param limit The page size, when it is stated the offset way.
	 * @param offset The row to start at, when it is stated the offset way.
	 * @param page The page, when it is stated the cursor way.
	 * @param withDeleted Whether the retired publications are included.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Query('productPublications')
	async productPublications(
		@Args('filter') filterBy: { productId?: ID; channelId?: ID; status?: PublicationStatus } = {},
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<ProductChannel>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.productChannelService.findAll({
			where: { ...filterBy },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return connectionFromOffsetPage<ProductChannel>(listing, skip);
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
		@Args('offset') offset?: number,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<ProductVariantChannel>> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.productVariantChannelService.findAll({
			where: { ...filterBy },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return connectionFromOffsetPage<ProductVariantChannel>(listing, skip);
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
	 * Retires one product publication recoverably, keeping the row.
	 *
	 * The route it mirrors is `DELETE /product-channels/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. `unpublishProduct`
	 * above archives a whole channel set in one call; this is the row's own lifecycle, and it is what a
	 * caller holding one publication identifier reaches — without it the only removal this endpoint
	 * offered for a single row was the hard delete the resolver does not serve at all.
	 *
	 * The permission is the controller's own for the route — `PRODUCTS_DELETE` — because retiring a
	 * publication is what takes a product off a channel.
	 *
	 * @param id The product publication to retire.
	 * @returns The publication, as the soft delete left it.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Mutation('softDeleteProductChannel')
	async softDeleteProductChannel(@Args('id') id: ID): Promise<ProductChannel> {
		return this.productChannelService.softRemove(id);
	}

	/**
	 * Restores a product publication that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /product-channels/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. The row comes
	 * back with the status and the date it was retired under, which is why the route states the deleting
	 * grant rather than the reading one.
	 *
	 * @param id The product publication to restore.
	 * @returns The restored publication.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Mutation('recoverProductChannel')
	async recoverProductChannel(@Args('id') id: ID): Promise<ProductChannel> {
		return this.productChannelService.softRecover(id);
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
	 * Retires one variant publication recoverably, keeping the row.
	 *
	 * The route it mirrors is `DELETE /product-variant-channels/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated.
	 * `unpublishProductVariant` above rewrites the variant's whole publication set; this is the row's own
	 * lifecycle, and it is what a caller holding one publication identifier reaches.
	 *
	 * The permission is the controller's own for the route — `PRODUCTS_DELETE` — because retiring a
	 * publication is what takes a variant off a channel.
	 *
	 * @param id The variant publication to retire.
	 * @returns The publication, as the soft delete left it.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Mutation('softDeleteProductVariantChannel')
	async softDeleteProductVariantChannel(@Args('id') id: ID): Promise<ProductVariantChannel> {
		return this.productVariantChannelService.softRemove(id);
	}

	/**
	 * Restores a variant publication that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /product-variant-channels/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. The row comes
	 * back with the status and the date it was retired under, which is why the route states the deleting
	 * grant rather than the reading one.
	 *
	 * @param id The variant publication to restore.
	 * @returns The restored publication.
	 */
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE))
	@Mutation('recoverProductVariantChannel')
	async recoverProductVariantChannel(@Args('id') id: ID): Promise<ProductVariantChannel> {
		return this.productVariantChannelService.softRecover(id);
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
