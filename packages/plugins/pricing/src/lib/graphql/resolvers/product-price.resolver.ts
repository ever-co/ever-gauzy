import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere, In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../../pricing.permissions';
import { ProductPrice } from '../../product-price/product-price.entity';
import { ProductPriceService } from '../../product-price/product-price.service';
import {
	IBulkUpsertProductPricesInput,
	IBulkUpsertProductPricesPayload,
	ICreateProductPriceInput,
	IDeleteProductPricePayload,
	IPageInput,
	IProductPriceFilter,
	IProductPriceSort,
	IResolvePriceInput,
	IUpdateProductPriceInput,
	ProductPriceConnection,
	ProductPriceSortField,
	ResolvedPrice
} from '../graphql.types';
import { readConnection } from '../pagination';

/**
 * Product prices over GraphQL.
 *
 * The resolution query lives here beside the writes because they answer one question between them:
 * the writes say what a variant costs, and `resolvePrice` says what that means for a context. A
 * caller that has to reproduce the resolution order to display a price is a caller that will one day
 * display a different one.
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
@Resolver('ProductPrice')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
export class ProductPriceResolver {
	constructor(private readonly productPriceService: ProductPriceService) {}

	/**
	 * Lists the price rows of the caller's organization.
	 *
	 * @param filter How to narrow the rows.
	 * @param sort How to order them.
	 * @param page The cursor window, when one is asked for.
	 * @param limit The page size, when one is asked for.
	 * @param offset The offset, when one is asked for.
	 * @returns The page and its boundary.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
	@Query('productPrices')
	async productPrices(
		@Args('filter') filter?: IProductPriceFilter,
		@Args('sort') sort?: IProductPriceSort,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<ProductPriceConnection> {
		return await readConnection(page, limit, offset, (window) =>
			this.productPriceService.findAll({
				where: this.whereOf(filter),
				order: this.orderOf(sort),
				take: window.take,
				skip: window.skip
			})
		);
	}

	/**
	 * Reads one price row.
	 *
	 * @param id The row to read.
	 * @returns The price row.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
	@Query('productPrice')
	async productPrice(@Args('id') id: ID): Promise<ProductPrice> {
		return await this.productPriceService.findOneByIdString(id);
	}

	/**
	 * Resolves the effective price of each requested variant for one context.
	 *
	 * @param input The context to price against.
	 * @returns One resolution per variant that has a price. A variant with no price at all is omitted
	 * rather than resolved to zero.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
	@Query('resolvePrice')
	async resolvePrice(@Args('input') input: IResolvePriceInput): Promise<ResolvedPrice[]> {
		return await this.productPriceService.resolvePrices({
			variantIds: input.variantIds,
			currency: input.currency,
			quantity: input.quantity,
			channelId: input.channelId,
			regionId: input.regionId,
			customerId: input.customerId,
			customerGroupIds: input.customerGroupIds,
			date: input.date
		});
	}

	/**
	 * Creates a price row.
	 *
	 * @param input The row to create.
	 * @returns The created row.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('createProductPrice')
	async createProductPrice(@Args('input') input: ICreateProductPriceInput): Promise<ProductPrice> {
		return await this.productPriceService.createOne(input);
	}

	/**
	 * Updates a price row.
	 *
	 * @param input The row to update and the fields to change.
	 * @returns The row, as it now stands.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('updateProductPrice')
	async updateProductPrice(@Args('input') input: IUpdateProductPriceInput): Promise<ProductPrice> {
		const { id, ...changes } = input;

		await this.productPriceService.updateOne(id, changes);

		return await this.productPriceService.findOneByIdString(id);
	}

	/**
	 * Deletes a price row.
	 *
	 * @param id The row to delete.
	 * @param force Whether the removal is a hard delete.
	 * @returns What the deletion did.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('deleteProductPrice')
	async deleteProductPrice(
		@Args('id') id: ID,
		@Args('force') force?: boolean
	): Promise<IDeleteProductPricePayload> {
		await this.productPriceService.findOneByIdString(id);

		if (force === true) {
			await this.productPriceService.delete(id);
		} else {
			await this.productPriceService.softDelete(id);
		}

		return { id, deleted: true, hard: force === true };
	}

	/**
	 * Writes a price matrix.
	 *
	 * @param input The rows, the mode and the atomicity flag.
	 * @returns The rows written and the rows refused.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_BULK_EDIT))
	@Mutation('bulkUpsertProductPrices')
	async bulkUpsertProductPrices(
		@Args('input') input: IBulkUpsertProductPricesInput
	): Promise<IBulkUpsertProductPricesPayload> {
		const result = await this.productPriceService.bulkUpsert({
			items: input.items,
			mode: input.mode,
			atomic: input.atomic
		});

		return {
			succeeded: result.succeeded,
			failed: result.failed,
			succeededCount: result.succeeded.length,
			failedCount: result.failed.length
		};
	}

	/**
	 * @param filter The GraphQL filter.
	 * @returns The equivalent row predicate.
	 */
	private whereOf(filter?: IProductPriceFilter): FindOptionsWhere<ProductPrice> {
		const where: FindOptionsWhere<ProductPrice> = {};

		if (!filter) {
			return where;
		}

		if (filter.ids?.length) {
			where.id = In(filter.ids);
		}

		if (filter.variantId) {
			where.variantId = filter.variantId;
		}

		if (filter.variantIds?.length) {
			where.variantId = In(filter.variantIds);
		}

		if (filter.priceListId) {
			where.priceListId = filter.priceListId;
		}

		if (filter.currency) {
			where.currency = filter.currency.toUpperCase();
		}

		if (filter.status) {
			where.status = filter.status;
		}

		if (filter.computeMode) {
			where.computeMode = filter.computeMode;
		}

		if (filter.basePriceListId) {
			where.basePriceListId = filter.basePriceListId;
		}

		return where;
	}

	/**
	 * @param sort The GraphQL sort.
	 * @returns The equivalent ordering. The default is newest first, which is the order a price matrix
	 * is reviewed in.
	 */
	private orderOf(sort?: IProductPriceSort): Record<string, 'ASC' | 'DESC'> {
		const direction = sort?.direction;

		switch (sort?.field) {
			case ProductPriceSortField.AMOUNT:
				return { amount: direction ?? 'ASC' };
			case ProductPriceSortField.MIN_QUANTITY:
				return { minQuantity: direction ?? 'ASC' };
			case ProductPriceSortField.STATUS:
				return { status: direction ?? 'ASC' };
			case ProductPriceSortField.CREATED_AT:
				return { createdAt: direction ?? 'DESC' };
			case ProductPriceSortField.UPDATED_AT:
				return { updatedAt: direction ?? 'DESC' };
			default:
				return { createdAt: 'DESC' };
		}
	}
}
