import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { DecimalString, IPagination, ID as Id } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { TenantPermissionGuard } from '../shared/guards';
import { ProductVariantPrice } from './product-variant-price.entity';
import { ProductVariantPriceService } from './product-variant-price.service';

/** The members `CreateProductVariantPriceInput` declares in the schema. */
export interface ICreateProductVariantPriceInput {
	unitCost?: DecimalString;
	unitCostCurrency?: string;
	retailPrice?: DecimalString;
	retailPriceCurrency?: string;
	productVariantId?: Id;
	organizationId?: Id;
}

/** The members `UpdateProductVariantPriceInput` declares in the schema. */
export interface IUpdateProductVariantPriceInput extends ICreateProductVariantPriceInput {
	id: Id;
}

/**
 * The fields a price list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ProductVariantPriceFilter` and
 * `ProductVariantPriceSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `unitCost` and `retailPrice` are `DECIMAL` rather than `NUMBER`: they are money, and money compared
 * as a floating-point number is money that selects the wrong rows. That the delivered columns are
 * integers changes what a caller writes for an equality and nothing about the family the amount
 * belongs to — see the filter's own note in the SDL.
 */
const PRODUCT_VARIANT_PRICE_FILTERABLE = {
	id: 'ID',
	unitCost: 'DECIMAL',
	unitCostCurrency: 'STRING',
	retailPrice: 'DECIMAL',
	retailPriceCurrency: 'STRING',
	productVariantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PRODUCT_VARIANT_PRICE_SORTABLE = ['createdAt', 'updatedAt', 'unitCost', 'retailPrice'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method declares no order of its own and the store answers in its own, so this is
 * not a reproduction of the route's order — there is none to reproduce — but the order that makes a
 * cursor walk total: newest first, with the identifier as the last key so that two rows written in the
 * same millisecond still have one order between them.
 */
const PRODUCT_VARIANT_PRICE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * What a variant costs and what it is sold for, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ProductVariantPriceService` the
 * `/api/product-variant-price` routes call.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered routes
 * carry `TenantPermissionGuard` and no `@Permissions`, so a resolver that demanded one would refuse
 * here a caller the REST route serves — two surfaces of one concept with two scopes is exactly what
 * this delivery exists to prevent. Tightening the resource is a change to make in both places at once,
 * and it is not this delivery's to make.
 */
@Resolver('ProductVariantPrice')
@UseGuards(TenantPermissionGuard)
export class ProductVariantPriceResolver {
	constructor(private readonly productVariantPriceService: ProductVariantPriceService) {}

	/**
	 * The prices of the caller's tenant.
	 */
	@Query('productVariantPrices')
	async productVariantPrices(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ProductVariantPrice>> {
		const { items }: IPagination<ProductVariantPrice> = await this.productVariantPriceService.findAll();

		return buildConnection<ProductVariantPrice>({
			rows: items ?? [],
			filterable: PRODUCT_VARIANT_PRICE_FILTERABLE,
			sortable: PRODUCT_VARIANT_PRICE_SORTABLE,
			defaultSort: PRODUCT_VARIANT_PRICE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One price of the caller's tenant.
	 *
	 * A price that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('productVariantPrice')
	async productVariantPrice(@Args('id', { type: () => ID }) id: Id): Promise<ProductVariantPrice | null> {
		try {
			return await this.productVariantPriceService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many prices the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its
	 * query string to the store's own `where` and hands it to `countBy`; the connection protocol has
	 * no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential rather than from the
	 * caller, which is what the route's bare call counts too.
	 */
	@Query('productVariantPriceCount')
	async productVariantPriceCount(): Promise<number> {
		return await this.productVariantPriceService.countBy();
	}

	/**
	 * Prices a variant.
	 *
	 * The payload is the input as stated and the tenant is the credential's: the service stamps it, so
	 * a caller states the amount and the currency it is expressed in and never the scope it is written
	 * into.
	 */
	@Mutation('createProductVariantPrice')
	async createProductVariantPrice(
		@Args('input') input: ICreateProductVariantPriceInput
	): Promise<ProductVariantPrice> {
		return await this.productVariantPriceService.create(input as unknown as ProductVariantPrice);
	}

	/**
	 * Changes a price.
	 *
	 * The delivered service reads the row before it writes it, so a caller naming a price that is not
	 * there is answered with the miss the REST route answers with rather than with a write that creates
	 * one. The identifier is the criterion and is not repeated in the payload, which is the shape the
	 * route itself has: `:id` names the row and the body carries only what changes.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateProductVariantPrice` may return.
	 */
	@Mutation('updateProductVariantPrice')
	async updateProductVariantPrice(
		@Args('input') input: IUpdateProductVariantPriceInput
	): Promise<ProductVariantPrice> {
		const { id, ...values } = input;

		await this.productVariantPriceService.update(
			id,
			values as unknown as QueryDeepPartialEntity<ProductVariantPrice>
		);

		return await this.productVariantPriceService.findOneByIdString(id);
	}

	/**
	 * Removes a price outright.
	 *
	 * The delivered service refuses a row that is not there with the same `404` the REST route answers
	 * with, so a caller that names one is told it is missing rather than that the removal succeeded.
	 */
	@Mutation('deleteProductVariantPrice')
	async deleteProductVariantPrice(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.productVariantPriceService.delete(id);

		return true;
	}

	/**
	 * Softly removes a price: the row is marked rather than removed, and the restore below reads it
	 * back.
	 */
	@Mutation('softDeleteProductVariantPrice')
	async softDeleteProductVariantPrice(@Args('id', { type: () => ID }) id: Id): Promise<ProductVariantPrice> {
		return await this.productVariantPriceService.softRemove(id);
	}

	/**
	 * Restores a price that was softly removed, clearing the marker the removal set.
	 */
	@Mutation('recoverProductVariantPrice')
	async recoverProductVariantPrice(@Args('id', { type: () => ID }) id: Id): Promise<ProductVariantPrice> {
		return await this.productVariantPriceService.softRecover(id);
	}
}
