import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IImageAsset,
	IPagination,
	IProductCreateInput,
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
import { RequestContext } from '../core/context/request-context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Product } from './product.entity';
import { ProductService } from './product.service';
import { ProductCreateCommand, ProductDeleteCommand, ProductUpdateCommand } from './commands';

/** One translation as `ProductTranslationInput` declares it. */
export interface IProductTranslationInput {
	languageCode: string;
	name: string;
	description?: string;
}

/** One option translation as `ProductOptionTranslationInput` declares it. */
export interface IProductOptionTranslationInput {
	languageCode: string;
	name: string;
	description?: string;
}

/** One option-group translation as `ProductOptionGroupTranslationInput` declares it. */
export interface IProductOptionGroupTranslationInput {
	languageCode: string;
	name: string;
}

/** One option as `ProductOptionInput` declares it. */
export interface IProductOptionInput {
	id?: Id;
	name: string;
	code?: string;
	translations?: IProductOptionTranslationInput[];
}

/** One option group as `ProductOptionGroupInput` declares it. */
export interface IProductOptionGroupInput {
	id?: Id;
	name: string;
	options?: IProductOptionInput[];
	translations?: IProductOptionGroupTranslationInput[];
}

/** The members `CreateProductInput` declares in the schema. */
export interface ICreateProductInput {
	code: string;
	organizationId?: Id;
	enabled?: boolean;
	imageUrl?: string;
	featuredImageId?: Id;
	productTypeId?: Id;
	productCategoryId?: Id;
	tagIds?: Id[];
	translations?: IProductTranslationInput[];
	optionGroupCreateInputs: IProductOptionGroupInput[];
}

/** The members `UpdateProductInput` declares in the schema. */
export interface IUpdateProductInput {
	id: Id;
	productTypeId?: Id;
	productCategoryId?: Id;
	tagIds?: Id[];
	translations?: IProductTranslationInput[];
	optionGroupCreateInputs: IProductOptionGroupInput[];
	optionGroupUpdateInputs?: IProductOptionGroupInput[];
	optionGroupDeleteInputs?: IProductOptionGroupInput[];
	optionDeleteInputs?: IProductOptionInput[];
}

/**
 * The fields a product list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ProductFilter` and `ProductSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `name` and `description` are declared although they are not columns, because the delivered list
 * read merges the translation for the requested language onto the row before it answers: they are on
 * the rows this evaluator narrows, and a catalogue that cannot select on a name cannot answer the
 * question it exists for.
 */
const PRODUCT_FILTERABLE = {
	id: 'ID',
	code: 'STRING',
	enabled: 'BOOLEAN',
	imageUrl: 'STRING',
	name: 'STRING',
	description: 'STRING',
	featuredImageId: 'ID',
	productTypeId: 'ID',
	productCategoryId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PRODUCT_SORTABLE = ['createdAt', 'updatedAt', 'code', 'name', 'enabled'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a filter and takes the
 * rows as they come back — so the connection applies the platform's own: newest first, with the
 * identifier as the last key so that two rows written in the same millisecond still have one order
 * between them, which is what makes a cursor walk over them stable.
 */
const PRODUCT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The catalogue's sellable thing over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ProductService` method or dispatches the same command
 * the `/api/products` routes reach, under the same guard chain and the same permissions. A client
 * that reaches a capability over one protocol is not given a narrower or a wider one than the client
 * that reaches it over the other.
 *
 * **The guard stack is the controller's, field by field.** The delivered controller carries
 * `TenantPermissionGuard` on the class and `PermissionGuard` with `PermissionsEnum.ORG_INVENTORY_VIEW`
 * or `ORG_INVENTORY_PRODUCT_EDIT` on each of its own routes, so this resolver carries the tenant
 * guard on the class and the same permission guard with the same permission on the fields that
 * mirror those routes. The two lifecycle fields — the soft removal and the recovery the controller
 * inherits from the CRUD base — mirror routes that carry *no* permission, so they carry none either:
 * a field that demanded one would refuse here a caller the REST route serves, and tightening the
 * resource is a change to make in both places at once.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Product')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ProductResolver {
	constructor(private readonly productService: ProductService, private readonly commandBus: CommandBus) {}

	/**
	 * The products of the caller's tenant, newest first.
	 */
	@Query('products')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async products(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('language', { type: () => String, nullable: true }) language?: string
	): Promise<GraphqlConnection<Product>> {
		// The same read the list route performs, and the same fallback its `language` header decorator
		// applies: without a stated language the rows are answered in the platform's default one, which
		// is also what the delivered `local/:langCode` sibling states in its path.
		const { items } = (await this.productService.findProducts(
			{},
			(language ?? LanguagesEnum.ENGLISH) as LanguagesEnum
		)) as IPagination<Product>;

		return buildConnection<Product>({
			rows: items ?? [],
			filterable: PRODUCT_FILTERABLE,
			sortable: PRODUCT_SORTABLE,
			defaultSort: PRODUCT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One product, or `null` when there is none.
	 *
	 * A product that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 *
	 * A stated language is not a preference but the selection of the other delivered read: the two
	 * routes by id differ in exactly that, so a request that states one is served by the method its
	 * route calls, and a request that states none by the other.
	 */
	@Query('product')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async product(
		@Args('id', { type: () => ID }) id: Id,
		@Args('language', { type: () => String, nullable: true }) language?: string
	): Promise<Product | null> {
		try {
			return language
				? ((await this.productService.findByIdTranslated(language, id)) as Product)
				: await this.productService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many products the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same scope: the tenant is read from the
	 * credential rather than stated by the caller, and the service narrows by it a second time.
	 */
	@Query('productCount')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async productCount(): Promise<number> {
		return await this.productService.count({ where: { tenantId: RequestContext.currentTenantId() } });
	}

	/**
	 * Records a product.
	 *
	 * The same command the create route dispatches, with the payload the delivered handler reads:
	 * the row's own members as they are stated, the tags as the identifiers the pivot is written
	 * from, and the option groups the handler stores with their options and translations.
	 */
	@Mutation('createProduct')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async createProduct(@Args('input') input: ICreateProductInput): Promise<Product> {
		return await this.commandBus.execute(new ProductCreateCommand(this.createPayload(input)));
	}

	/**
	 * Changes the facts of a product that exists.
	 *
	 * The delivered edit is not the create with the same members: it reads the row and writes the
	 * product type, the category, the tags, the translations and the option groups it is given, so
	 * the payload states the type and the category where that handler reads them and leaves a member
	 * the caller did not state undefined rather than empty — an empty list is the instruction to
	 * clear what is there, which is a different request from saying nothing about it.
	 *
	 * The identifier is carried in both places the delivered route carries it, the path and the body,
	 * because the handler reads the body's: the field states one identifier and neither reading is
	 * left undefined.
	 */
	@Mutation('updateProduct')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async updateProduct(@Args('input') input: IUpdateProductInput): Promise<Product> {
		const payload = {
			id: input.id,
			type: input.productTypeId ? { id: input.productTypeId } : undefined,
			category: input.productCategoryId ? { id: input.productCategoryId } : undefined,
			tags: input.tagIds ? input.tagIds.map((id) => ({ id })) : undefined,
			translations: input.translations,
			optionGroupCreateInputs: input.optionGroupCreateInputs,
			optionGroupUpdateInputs: input.optionGroupUpdateInputs,
			optionGroupDeleteInputs: input.optionGroupDeleteInputs,
			optionDeleteInputs: input.optionDeleteInputs
		} as unknown as IProductCreateInput;

		return await this.commandBus.execute(new ProductUpdateCommand(input.id, payload));
	}

	/**
	 * Removes a product, with the rows only it explains.
	 *
	 * The same command the REST route dispatches, so the two surfaces remove the same set — a
	 * product's variants are never left behind without the setting and price rows that make them
	 * priceable and sellable.
	 */
	@Mutation('deleteProduct')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async deleteProduct(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.commandBus.execute(new ProductDeleteCommand(id));

		return true;
	}

	/**
	 * Withdraws a product without removing the row.
	 *
	 * No permission is stated because the delivered route states none: the soft removal is inherited
	 * from the CRUD base, where the controller's own tenant guard is the whole of its scope, and a
	 * resolver that demanded more would refuse a caller the REST route serves. The delivered route
	 * declares no query parameter of its own and passes the service the empty option list that
	 * leaves, so the field states none either.
	 */
	@Mutation('softDeleteProduct')
	async softDeleteProduct(@Args('id', { type: () => ID }) id: Id): Promise<Product> {
		return await this.productService.softRemove(id);
	}

	/**
	 * Puts a withdrawn product back. Unpermissioned for the same reason the withdrawal above is: the
	 * delivered route carries no permission to mirror.
	 */
	@Mutation('recoverProduct')
	async recoverProduct(@Args('id', { type: () => ID }) id: Id): Promise<Product> {
		return await this.productService.softRecover(id);
	}

	/**
	 * Adds images to the product's gallery.
	 *
	 * An image is named by its asset identifier because that is what the delivered write stores: the
	 * gallery is a set of memberships, so the asset besides the identifier is never read. Each
	 * identifier is handed over as the asset row the membership points at, which is the shape the
	 * service reads.
	 */
	@Mutation('addProductGalleryImages')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async addProductGalleryImages(
		@Args('productId', { type: () => ID }) productId: Id,
		@Args('imageIds', { type: () => [ID] }) imageIds: Id[]
	): Promise<Product> {
		return await this.productService.addGalleryImages(
			productId,
			(imageIds ?? []).map((id) => ({ id }) as IImageAsset)
		);
	}

	/**
	 * Makes one image the product's cover.
	 */
	@Mutation('setProductAsFeatured')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async setProductAsFeatured(
		@Args('productId', { type: () => ID }) productId: Id,
		@Args('imageId', { type: () => ID }) imageId: Id
	): Promise<Product> {
		return await this.productService.setAsFeatured(productId, { id: imageId } as IImageAsset);
	}

	/**
	 * Takes one image out of the product's gallery. The service refuses an image a variant of this
	 * product carries, which is the same refusal the REST route answers.
	 */
	@Mutation('deleteProductGalleryImage')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async deleteProductGalleryImage(
		@Args('productId', { type: () => ID }) productId: Id,
		@Args('imageId', { type: () => ID }) imageId: Id
	): Promise<Product> {
		return await this.productService.deleteGalleryImage(productId, imageId);
	}

	/**
	 * Withdraws the product's cover. The asset itself is kept.
	 */
	@Mutation('deleteProductFeaturedImage')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async deleteProductFeaturedImage(@Args('productId', { type: () => ID }) productId: Id): Promise<Product> {
		return await this.productService.deleteFeaturedImage(productId);
	}

	/**
	 * The payload the delivered create handler reads.
	 *
	 * The tenant is deliberately not among the members: the service stamps the caller's own tenant
	 * onto the row and overwrites whatever the payload states, so stating one would promise a scope
	 * the write refuses. The organization is carried because the delivered route takes it from the
	 * body and the write stores it.
	 */
	private createPayload(input: ICreateProductInput): IProductCreateInput {
		return {
			code: input.code,
			organizationId: input.organizationId,
			enabled: input.enabled,
			imageUrl: input.imageUrl,
			featuredImageId: input.featuredImageId,
			productTypeId: input.productTypeId,
			productCategoryId: input.productCategoryId,
			tags: input.tagIds ? input.tagIds.map((id) => ({ id })) : undefined,
			translations: input.translations,
			optionGroupCreateInputs: input.optionGroupCreateInputs
		} as unknown as IProductCreateInput;
	}
}
