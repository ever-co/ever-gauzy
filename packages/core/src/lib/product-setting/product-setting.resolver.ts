import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IPagination, IProductVariantSetting, ID as Id } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { ProductVariantSettingService } from './product-setting.service';

/** The members `CreateProductVariantSettingInput` declares in the schema. */
export interface ICreateProductVariantSettingInput {
	productVariantId?: Id;
	organizationId?: Id;
	isSubscription?: boolean;
	isPurchaseAutomatically?: boolean;
	canBeSold?: boolean;
	canBePurchased?: boolean;
	canBeCharged?: boolean;
	canBeRented?: boolean;
	isEquipment?: boolean;
	trackInventory?: boolean;
}

/** The members `UpdateProductVariantSettingInput` declares in the schema. */
export interface IUpdateProductVariantSettingInput extends ICreateProductVariantSettingInput {
	id: Id;
}

/**
 * The fields a setting list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ProductVariantSettingFilter` and
 * `ProductVariantSettingSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every flag is a `BOOLEAN` rather than a `NUMBER`: a flag compared as a number would let `2` select
 * the rows that carry it, which is a question no caller means to ask.
 */
const PRODUCT_VARIANT_SETTING_FILTERABLE = {
	id: 'ID',
	isSubscription: 'BOOLEAN',
	isPurchaseAutomatically: 'BOOLEAN',
	canBeSold: 'BOOLEAN',
	canBePurchased: 'BOOLEAN',
	canBeCharged: 'BOOLEAN',
	canBeRented: 'BOOLEAN',
	isEquipment: 'BOOLEAN',
	trackInventory: 'BOOLEAN',
	productVariantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PRODUCT_VARIANT_SETTING_SORTABLE = [
	'createdAt',
	'updatedAt',
	'isSubscription',
	'isPurchaseAutomatically',
	'canBeSold',
	'canBePurchased',
	'canBeCharged',
	'canBeRented',
	'isEquipment',
	'trackInventory'
] as const;

/**
 * The order this connection means: newest first, with the identifier as the last key so that two
 * rows written in the same millisecond still have one order between them.
 *
 * The delivered list method fixes no order of its own — it is the platform's own `findAll`, which
 * hands back whatever the store returned — so the order is stated here rather than reproduced from
 * it, and it is stated because a cursor names a row by its position in a total order: without one,
 * a walk over these rows could not resume at all.
 */
const PRODUCT_VARIANT_SETTING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The capability record of a variant over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ProductVariantSettingService` the
 * `/api/product-variant-settings` routes reach. The controller declares no handler of its own, so
 * the routes mirrored here are the ones the platform mounts for every resource — the list, the one
 * row, the creation, the edit, the removal, the soft removal and the restore — and the delivery
 * mirrors all of them rather than the subset a domain handler would have named.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered
 * routes carry `TenantPermissionGuard` and no `@Permissions`, so a resolver that demanded one would
 * refuse here a caller the REST route serves — two surfaces of one concept with two scopes is
 * exactly what this delivery exists to prevent. Tightening the resource is a change to make in both
 * places at once, and it is not this delivery's to make.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('ProductVariantSetting')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ProductVariantSettingResolver {
	constructor(private readonly productVariantSettingService: ProductVariantSettingService) {}

	/**
	 * The settings of the caller's tenant.
	 */
	@Query('productVariantSettings')
	async productVariantSettings(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<IProductVariantSetting>> {
		const { items }: IPagination<IProductVariantSetting> = await this.productVariantSettingService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<IProductVariantSetting>({
			rows: items ?? [],
			filterable: PRODUCT_VARIANT_SETTING_FILTERABLE,
			sortable: PRODUCT_VARIANT_SETTING_SORTABLE,
			defaultSort: PRODUCT_VARIANT_SETTING_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One setting of the caller's tenant.
	 *
	 * A setting that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('productVariantSetting')
	async productVariantSetting(@Args('id', { type: () => ID }) id: Id): Promise<IProductVariantSetting | null> {
		try {
			return await this.productVariantSettingService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many settings the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its
	 * query string to the store's own `where` and hands it to `countBy`; the connection protocol has
	 * no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential rather than from the
	 * caller, which is what the route's bare call counts too.
	 */
	@Query('productVariantSettingCount')
	async productVariantSettingCount(): Promise<number> {
		return await this.productVariantSettingService.countBy();
	}

	/**
	 * Opens a capability record.
	 *
	 * The input is handed to the same `create` the REST route hands its body to, and that method is
	 * what stamps the tenant of the credential onto the row: a caller states which variant and which
	 * capabilities, never which tenant, so a row cannot be written into a scope the caller is not
	 * acting in.
	 */
	@Mutation('createProductVariantSetting')
	async createProductVariantSetting(
		@Args('input') input: ICreateProductVariantSettingInput
	): Promise<IProductVariantSetting> {
		return await this.productVariantSettingService.create(input);
	}

	/**
	 * Changes the capabilities a variant is recorded under.
	 *
	 * The service reads the row before it writes it, so a caller naming a setting that is not there
	 * is answered with the missing row rather than with a write that silently changes nothing — the
	 * same refusal the REST route gets from the same call.
	 *
	 * The field answers with the row read back rather than with the update result. The delivered
	 * route answers with the platform's `UpdateResult`, whose one member a caller reads is the count
	 * of rows the write reached, and that count is not a GraphQL scalar this schema declares;
	 * answering with the row is the same operation stated in the shape a client reads next anyway.
	 */
	@Mutation('updateProductVariantSetting')
	async updateProductVariantSetting(
		@Args('input') input: IUpdateProductVariantSettingInput
	): Promise<IProductVariantSetting> {
		await this.productVariantSettingService.update(input.id, input);

		return await this.productVariantSettingService.findOneByIdString(input.id);
	}

	/**
	 * Removes a setting outright.
	 *
	 * The delivered route answers with the deletion result; the field answers with the fact of the
	 * removal, which is the one member of that result a caller reads. A setting that was not there
	 * is a miss the service raises before this line rather than a `false` answered from it.
	 */
	@Mutation('deleteProductVariantSetting')
	async deleteProductVariantSetting(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.productVariantSettingService.delete(id);

		return true;
	}

	/**
	 * Softly removes a setting: the row stays, marked as removed.
	 *
	 * The same service method the REST route calls, so the two surfaces mark the same row and answer
	 * with the same row afterwards. The route passes the empty options array its variadic parameter
	 * collects; no options is what that array states, so none are passed here.
	 */
	@Mutation('softDeleteProductVariantSetting')
	async softDeleteProductVariantSetting(
		@Args('id', { type: () => ID }) id: Id
	): Promise<IProductVariantSetting> {
		return await this.productVariantSettingService.softRemove(id);
	}

	/**
	 * Restores a setting that was softly removed.
	 */
	@Mutation('recoverProductVariantSetting')
	async recoverProductVariantSetting(
		@Args('id', { type: () => ID }) id: Id
	): Promise<IProductVariantSetting> {
		return await this.productVariantSettingService.softRecover(id);
	}
}
