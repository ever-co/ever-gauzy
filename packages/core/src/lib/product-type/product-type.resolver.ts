import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, IProductTypeTranslatable, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { ProductType } from './product-type.entity';
import { ProductTypeService } from './product-type.service';
import { ProductTypeCreateCommand } from './commands';

/**
 * One language's copy of a type's descriptive facts, as `ProductTypeTranslationInput` declares it.
 */
export interface IProductTypeTranslationInput {
	languageCode: string;
	name: string;
	description?: string;
}

/** The members `CreateProductTypeInput` declares in the schema. */
export interface ICreateProductTypeInput {
	organizationId: Id;
	translations?: IProductTypeTranslationInput[];
	icon?: string;
}

/** The members `UpdateProductTypeInput` declares in the schema. */
export interface IUpdateProductTypeInput extends ICreateProductTypeInput {
	id: Id;
}

/**
 * The fields a product type list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ProductTypeFilter` and `ProductTypeSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable
 * in the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `name` and `description` are here because the delivered reader merges the requested language onto
 * the row before this resolver sees it, which is what makes narrowing a back-office list by the name
 * in one language a read this surface can actually answer.
 */
const PRODUCT_TYPE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	icon: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PRODUCT_TYPE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'icon'] as const;

/**
 * The order the delivered list method means: newest first, with the identifier as the last key so that
 * two rows written in the same millisecond still have one order between them — which is what makes a
 * cursor walk over them stable.
 *
 * The delivered method applies no order of its own, so this is the order the connection chooses rather
 * than one it reproduces. The type list is a small vocabulary an operator reads as a whole, so the
 * order that helps is the one that puts the row just declared at the top.
 */
const PRODUCT_TYPE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The product types over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ProductTypeService` and the same command the
 * `/api/product-types` routes reach.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards, and the class-level edit permission — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. The node query is the case that reads oddly and is nevertheless the parity: the delivered
 * `GET /:id` is inherited without a permission of its own, so it runs under the controller's
 * class-level edit permission, and this field states the same one.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('ProductType')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
export class ProductTypeResolver {
	constructor(
		private readonly productTypeService: ProductTypeService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The product types of the caller's tenant.
	 */
	@Query('productTypes')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	async productTypes(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ProductType>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const options = {} as BaseQueryDTO<ProductType>;
		const { items }: IPagination<ProductType> = await this.productTypeService.findProductTypes(
			options,
			this.languageOfTheCaller()
		);

		return buildConnection<ProductType>({
			rows: items ?? [],
			filterable: PRODUCT_TYPE_FILTERABLE,
			sortable: PRODUCT_TYPE_SORTABLE,
			defaultSort: PRODUCT_TYPE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One product type of the caller's tenant.
	 *
	 * A type that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('productType')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
	async productType(@Args('id', { type: () => ID }) id: Id): Promise<ProductType | null> {
		try {
			return await this.productTypeService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many product types the caller's tenant has.
	 */
	@Query('productTypeCount')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	async productTypeCount(): Promise<number> {
		return await this.productTypeService.countBy();
	}

	/**
	 * Declares a type.
	 *
	 * The write is dispatched as the same command the REST route dispatches, and it carries the same
	 * language: the handler merges the translation the caller's own language names onto the row it
	 * answers with, so the two surfaces return the same text for the same caller.
	 */
	@Mutation('createProductType')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
	async createProductType(@Args('input') input: ICreateProductTypeInput): Promise<ProductType> {
		return await this.commandBus.execute(
			new ProductTypeCreateCommand(input as unknown as IProductTypeTranslatable, this.languageOfTheCaller())
		);
	}

	/**
	 * Replaces a type.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a type of another tenant, or one that is not there, is answered with the miss rather than
	 * with a write that recreates the row under an identifier it does not own.
	 */
	@Mutation('updateProductType')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
	async updateProductType(@Args('input') input: IUpdateProductTypeInput): Promise<ProductType> {
		return await this.productTypeService.updateProductType(input.id, input as unknown as ProductType);
	}

	/**
	 * Removes a type outright, with the translation rows that belong to it.
	 */
	@Mutation('deleteProductType')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
	async deleteProductType(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.productTypeService.delete(id);

		return true;
	}

	/**
	 * Withdraws a type without removing it.
	 */
	@Mutation('softDeleteProductType')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
	async softDeleteProductType(@Args('id', { type: () => ID }) id: Id): Promise<ProductType> {
		return await this.productTypeService.softRemove(id);
	}

	/**
	 * Puts a withdrawn type back.
	 */
	@Mutation('recoverProductType')
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
	async recoverProductType(@Args('id', { type: () => ID }) id: Id): Promise<ProductType> {
		return await this.productTypeService.softRecover(id);
	}

	/**
	 * The language the delivered reader merges a translation for.
	 *
	 * The controller reads the `language` request header (its `LanguageDecorator`, which defaults to
	 * English) and passes the i18n fallback beside it; that fallback is never reached, because the
	 * decorator has already answered by the time it is consulted. `RequestContext.getLanguageCode()`
	 * reads the same header off the same request — the bootstrap mounts the request context on the
	 * GraphQL endpoint as well as on the prefixed routes — so a caller asking the same question over
	 * either protocol is answered in the same language. Without a request it answers English, which is
	 * the decorator's own default.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}
}
