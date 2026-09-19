import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IPagination,
	IProductCategoryTranslatable,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryCreateCommand } from './commands';

/**
 * One language's copy of a category's descriptive facts, as `ProductCategoryTranslationInput` declares
 * it.
 */
export interface IProductCategoryTranslationInput {
	languageCode: string;
	name: string;
	description?: string;
}

/** The members `CreateProductCategoryInput` declares in the schema. */
export interface ICreateProductCategoryInput {
	organizationId: Id;
	translations?: IProductCategoryTranslationInput[];
	imageId?: Id;
	imageUrl?: string;
	parentId?: Id;
	slug?: string;
	sortOrder?: number;
	isFeatured?: boolean;
	status?: string;
	metadata?: Record<string, unknown>;
}

/** The members `UpdateProductCategoryInput` declares in the schema. */
export interface IUpdateProductCategoryInput extends ICreateProductCategoryInput {
	id: Id;
}

/**
 * The fields a category list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ProductCategoryFilter` and
 * `ProductCategorySortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `name` and `description` are here because the delivered reader merges the requested language onto
 * the row before this resolver sees it, which is what makes narrowing a storefront's taxonomy by the
 * name in one language a read this surface can actually answer.
 */
const PRODUCT_CATEGORY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	imageUrl: 'STRING',
	imageId: 'ID',
	parentId: 'ID',
	slug: 'STRING',
	sortOrder: 'NUMBER',
	isFeatured: 'BOOLEAN',
	status: 'STRING',
	metadata: 'JSON',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PRODUCT_CATEGORY_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'slug',
	'sortOrder',
	'status',
	'isFeatured'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list method applies no order of its own — it reads the filtered set and leaves it in
 * the store's — so this is a decision the connection has to make rather than one it reproduces:
 * `sortOrder` ascending first, because that column is what the taxonomy's sibling ordering *is*, then
 * newest first, then the identifier, which is the key that makes the order total and a cursor walk
 * over it stable.
 */
const PRODUCT_CATEGORY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'sortOrder', direction: 'ASC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The product taxonomy over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ProductCategoryService` and the same command the
 * `/api/product-categories` routes reach.
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
@Resolver('ProductCategory')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
export class ProductCategoryResolver {
	constructor(
		private readonly productCategoryService: ProductCategoryService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The categories of the caller's tenant, in the taxonomy's own sibling order.
	 */
	@Query('productCategories')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW)
	async productCategories(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ProductCategory>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const options = {} as BaseQueryDTO<ProductCategory>;
		const { items }: IPagination<ProductCategory> =
			await this.productCategoryService.findProductCategories(options, this.languageOfTheCaller());

		return buildConnection<ProductCategory>({
			rows: items ?? [],
			filterable: PRODUCT_CATEGORY_FILTERABLE,
			sortable: PRODUCT_CATEGORY_SORTABLE,
			defaultSort: PRODUCT_CATEGORY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One category of the caller's tenant.
	 *
	 * A category that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('productCategory')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
	async productCategory(@Args('id', { type: () => ID }) id: Id): Promise<ProductCategory | null> {
		try {
			return await this.productCategoryService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many categories the caller's tenant has.
	 */
	@Query('productCategoryCount')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW)
	async productCategoryCount(): Promise<number> {
		return await this.productCategoryService.countBy();
	}

	/**
	 * Files a category.
	 *
	 * The write is dispatched as the same command the REST route dispatches, and it carries the same
	 * language: the handler merges the translation the caller's own language names onto the row it
	 * answers with, so the two surfaces return the same text for the same caller.
	 */
	@Mutation('createProductCategory')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
	async createProductCategory(@Args('input') input: ICreateProductCategoryInput): Promise<ProductCategory> {
		return await this.commandBus.execute(
			new ProductCategoryCreateCommand(
				input as unknown as IProductCategoryTranslatable,
				this.languageOfTheCaller()
			)
		);
	}

	/**
	 * Replaces a category.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a category of another tenant, or one that is not there, is answered with the miss rather
	 * than with a write that recreates the row under an identifier it does not own.
	 */
	@Mutation('updateProductCategory')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
	async updateProductCategory(@Args('input') input: IUpdateProductCategoryInput): Promise<ProductCategory> {
		return await this.productCategoryService.updateProductCategory(input.id, input as unknown as ProductCategory);
	}

	/**
	 * Removes a category outright, with the translation rows that belong to it.
	 */
	@Mutation('deleteProductCategory')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
	async deleteProductCategory(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.productCategoryService.delete(id);

		return true;
	}

	/**
	 * Withdraws a category without removing it.
	 */
	@Mutation('softDeleteProductCategory')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
	async softDeleteProductCategory(@Args('id', { type: () => ID }) id: Id): Promise<ProductCategory> {
		return await this.productCategoryService.softRemove(id);
	}

	/**
	 * Puts a withdrawn category back.
	 */
	@Mutation('recoverProductCategory')
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
	async recoverProductCategory(@Args('id', { type: () => ID }) id: Id): Promise<ProductCategory> {
		return await this.productCategoryService.softRecover(id);
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
