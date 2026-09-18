import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IPagination, ID as Id } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { TenantPermissionGuard } from '../shared/guards';
import { ProductOption } from './product-option.entity';
import { ProductOptionService } from './product-option.service';

/** The members `CreateProductOptionInput` declares in the schema. */
export interface ICreateProductOptionInput {
	name: string;
	code?: string;
	groupId?: Id;
	organizationId?: Id;
}

/** The members `UpdateProductOptionInput` declares in the schema. */
export interface IUpdateProductOptionInput {
	id: Id;
	name?: string;
	code?: string;
	groupId?: Id;
	organizationId?: Id;
}

/**
 * The fields an option list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ProductOptionFilter` and
 * `ProductOptionSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * `translations` is in neither. It is a collection of rows rather than a column, and the query
 * protocol compares columns; a filter declared on it would be one the evaluator could not evaluate.
 */
const PRODUCT_OPTION_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	code: 'STRING',
	groupId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PRODUCT_OPTION_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method declares no order of its own and the store answers in its own, so this is
 * not a reproduction of the route's order — there is none to reproduce — but the order that makes a
 * cursor walk total: newest first, with the identifier as the last key so that two rows written in the
 * same millisecond still have one order between them.
 */
const PRODUCT_OPTION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The values a product is offered in, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ProductOptionService` the `/api/product-options` routes
 * call.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered routes
 * carry `TenantPermissionGuard` and no `@Permissions`, so a resolver that demanded one would refuse
 * here a caller the REST route serves — two surfaces of one concept with two scopes is exactly what
 * this delivery exists to prevent. Tightening the resource is a change to make in both places at once,
 * and it is not this delivery's to make.
 *
 * **The group is not served here.** No delivered route reads a group as a resource, so there is no
 * root field for one; the group is reachable as the type `groupId` names, which is stated in the SDL
 * rather than invented as a capability here.
 */
@Resolver('ProductOption')
@UseGuards(TenantPermissionGuard)
export class ProductOptionResolver {
	constructor(private readonly productOptionService: ProductOptionService) {}

	/**
	 * The options of the caller's tenant.
	 */
	@Query('productOptions')
	async productOptions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ProductOption>> {
		const { items }: IPagination<ProductOption> = await this.productOptionService.findAll();

		return buildConnection<ProductOption>({
			rows: items ?? [],
			filterable: PRODUCT_OPTION_FILTERABLE,
			sortable: PRODUCT_OPTION_SORTABLE,
			defaultSort: PRODUCT_OPTION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One option of the caller's tenant.
	 *
	 * An option that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('productOption')
	async productOption(@Args('id', { type: () => ID }) id: Id): Promise<ProductOption | null> {
		try {
			return await this.productOptionService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many options the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its
	 * query string to the store's own `where` and hands it to `countBy`; the connection protocol has
	 * no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential rather than from the
	 * caller, which is what the route's bare call counts too.
	 */
	@Query('productOptionCount')
	async productOptionCount(): Promise<number> {
		return await this.productOptionService.countBy();
	}

	/**
	 * Files an option.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it, so
	 * a caller states which group the option answers for and never which scope it is written into.
	 */
	@Mutation('createProductOption')
	async createProductOption(@Args('input') input: ICreateProductOptionInput): Promise<ProductOption> {
		return await this.productOptionService.create(input as unknown as ProductOption);
	}

	/**
	 * Changes the descriptive facts of an option.
	 *
	 * The delivered service reads the row before it writes it, so a caller naming an option that is not
	 * there is answered with the miss the REST route answers with rather than with a write that creates
	 * one. The identifier is the criterion and is not repeated in the payload, which is the shape the
	 * route itself has: `:id` names the row and the body carries only what changes.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateProductOption` may return.
	 */
	@Mutation('updateProductOption')
	async updateProductOption(@Args('input') input: IUpdateProductOptionInput): Promise<ProductOption> {
		const { id, ...values } = input;

		await this.productOptionService.update(id, values as unknown as QueryDeepPartialEntity<ProductOption>);

		return await this.productOptionService.findOneByIdString(id);
	}

	/**
	 * Removes an option outright.
	 *
	 * The delivered service refuses a row that is not there with the same `404` the REST route answers
	 * with, so a caller that names one is told it is missing rather than that the removal succeeded.
	 */
	@Mutation('deleteProductOption')
	async deleteProductOption(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.productOptionService.delete(id);

		return true;
	}

	/**
	 * Softly removes an option: the row is marked rather than removed, and the restore below reads it
	 * back.
	 */
	@Mutation('softDeleteProductOption')
	async softDeleteProductOption(@Args('id', { type: () => ID }) id: Id): Promise<ProductOption> {
		return await this.productOptionService.softRemove(id);
	}

	/**
	 * Restores an option that was softly removed, clearing the marker the removal set.
	 */
	@Mutation('recoverProductOption')
	async recoverProductOption(@Args('id', { type: () => ID }) id: Id): Promise<ProductOption> {
		return await this.productOptionService.softRecover(id);
	}
}
