import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IPagination, IProductTranslatable, IProductVariant, IVariantCreateInput, ID as Id } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { TenantPermissionGuard } from '../shared/guards';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantService } from './product-variant.service';
import { ProductVariantCreateCommand, ProductVariantDeleteCommand } from './commands';
import { ProductService } from '../product/product.service';

/** The members `CreateProductVariantsInput` declares in the schema. */
export interface ICreateProductVariantsInput {
	productId: Id;
	optionCombinations: { options: string[] }[];
}

/** The members `UpdateProductVariantInput` declares in the schema. */
export interface IUpdateProductVariantInput {
	id: Id;
	notes?: string;
	quantity?: number;
	taxes?: number;
	billingInvoicingPolicy?: string;
	internalReference?: string;
	enabled?: boolean;
	imageId?: Id;
}

/**
 * The fields a variant list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ProductVariantFilter` and
 * `ProductVariantSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `taxes` is a `DECIMAL` rather than a `NUMBER`: it is a rate, and a rate compared as a
 * floating-point number is a rate that selects the wrong rows.
 */
const PRODUCT_VARIANT_FILTERABLE = {
	id: 'ID',
	notes: 'STRING',
	quantity: 'NUMBER',
	taxes: 'DECIMAL',
	billingInvoicingPolicy: 'STRING',
	internalReference: 'STRING',
	enabled: 'BOOLEAN',
	productId: 'ID',
	imageId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PRODUCT_VARIANT_SORTABLE = ['createdAt', 'updatedAt', 'internalReference', 'quantity', 'enabled'] as const;

/**
 * The order the delivered list method means: newest first, with the identifier as the last key so
 * that two rows written in the same millisecond still have one order between them — which is what
 * makes a cursor walk over them stable.
 */
const PRODUCT_VARIANT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The buyable configurations of the caller's products over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ProductVariantService` and the same commands the
 * `/api/product-variants` routes reach.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered
 * routes carry `TenantPermissionGuard` and no `@Permissions`, so a resolver that demanded one would
 * refuse here a caller the REST route serves — two surfaces of one concept with two scopes is
 * exactly what this delivery exists to prevent. Tightening the resource is a change to make in both
 * places at once, and it is not this delivery's to make.
 */
@Resolver('ProductVariant')
@UseGuards(TenantPermissionGuard)
export class ProductVariantResolver {
	constructor(
		private readonly productVariantService: ProductVariantService,
		private readonly productService: ProductService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The variants of the caller's tenant.
	 */
	@Query('productVariants')
	async productVariants(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IProductVariant>> {
		const { items }: IPagination<IProductVariant> = await this.productVariantService.findAllProductVariants();

		return buildConnection<IProductVariant>({
			rows: items ?? [],
			filterable: PRODUCT_VARIANT_FILTERABLE,
			sortable: PRODUCT_VARIANT_SORTABLE,
			defaultSort: PRODUCT_VARIANT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One variant of the caller's tenant.
	 *
	 * A variant that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('productVariant')
	async productVariant(@Args('id', { type: () => ID }) id: Id): Promise<IProductVariant | null> {
		try {
			return await this.productVariantService.findOne(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Generates one variant per option combination.
	 *
	 * The product is read first, and the scope the generated rows are stamped with is the product's
	 * own: a caller states which product, never which tenant or organization, so a variant cannot be
	 * written into a scope the product it belongs to does not have.
	 */
	@Mutation('createProductVariants')
	async createProductVariants(@Args('input') input: ICreateProductVariantsInput): Promise<IProductVariant[]> {
		const product = await this.productService.findOneByIdString(input.productId);

		const command = new ProductVariantCreateCommand({
			product: {
				id: product.id,
				tenantId: product.tenantId,
				organizationId: product.organizationId
			} as IProductTranslatable,
			optionCombinations: input.optionCombinations ?? []
		} as IVariantCreateInput);

		return await this.commandBus.execute(command);
	}

	/**
	 * Changes the descriptive facts of a variant.
	 */
	@Mutation('updateProductVariant')
	async updateProductVariant(@Args('input') input: IUpdateProductVariantInput): Promise<IProductVariant> {
		// The row is read before it is written, so a caller naming a variant that is not there is
		// answered with the missing row rather than with a write that silently creates one.
		await this.productVariantService.findOneByIdString(input.id);

		return await this.productVariantService.updateVariant(input as unknown as ProductVariant);
	}

	/**
	 * Removes a variant, with the setting and price rows that belong to it.
	 *
	 * The same command the REST route dispatches, so the two surfaces remove the same three rows —
	 * a variant is never left without the rows that make it priceable and sellable.
	 */
	@Mutation('deleteProductVariant')
	async deleteProductVariant(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.commandBus.execute(new ProductVariantDeleteCommand(id));

		return true;
	}

	/**
	 * Withdraws the variant's featured image.
	 */
	@Mutation('deleteProductVariantFeaturedImage')
	async deleteProductVariantFeaturedImage(
		@Args('variantId', { type: () => ID }) variantId: Id
	): Promise<IProductVariant> {
		return await this.productVariantService.deleteFeaturedImage(variantId);
	}
}
