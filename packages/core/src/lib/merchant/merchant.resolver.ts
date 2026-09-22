import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Merchant } from './merchant.entity';
import { MerchantService } from './merchant.service';

/** The members `CreateMerchantInput` declares in the schema. */
export interface ICreateMerchantInput {
	organizationId: Id;
	name: string;
	code: string;
	email: string;
	phone?: string;
	description?: string;
	active?: boolean;
	currency?: string;
	contactId?: Id;
	logoId?: Id;
	tagIds?: Id[];
	warehouseIds?: Id[];
}

/** The members `UpdateMerchantInput` declares in the schema. */
export interface IUpdateMerchantInput extends ICreateMerchantInput {
	id: Id;
}

/**
 * The fields a store list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `MerchantFilter` and `MerchantSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * The two pivot relations are in neither. A many-to-many is a join rather than a column, and the rows
 * the connection is handed carry no member for it: a filter naming `tags` would be a filter that
 * silently selects nothing. A store is read by its own columns here and its pivot rows from the
 * domains that own them.
 */
const MERCHANT_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	name: 'STRING',
	code: 'STRING',
	email: 'STRING',
	phone: 'STRING',
	description: 'STRING',
	active: 'BOOLEAN',
	currency: 'STRING',
	contactId: 'ID',
	logoId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const MERCHANT_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code', 'email'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store the criterion and takes
 * the rows as they come back, which differs between installations and is not stable enough for a
 * cursor to walk — so this is a decision the connection has to make rather than one it reproduces:
 * newest first, because a store list is a directory that grows, then the identifier, which is the key
 * that makes the order total.
 */
const MERCHANT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The store over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `MerchantService` the `/api/merchants` routes call.
 *
 * **The guard chain and the class permission are the controller's.** `MerchantController` carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `ORG_INVENTORY_PRODUCT_EDIT`
 * there, so this class carries the same two guards, the gate below, and that permission. The four
 * reads state the view permission their own routes state; the creation, the edit, the removal and the
 * two lifecycle moves state the class's edit one, which is what their routes run under. Tidying that
 * split — either way — would give one protocol a scope the other does not have.
 *
 * **The two pivots are written, never read.** `tags` and `warehouses` are many-to-many relations, so
 * the row holds no identifier for either and the delivered reads answer them only when a REST caller
 * names them in `relations`. The create and the edit state them as identifier lists, because that is
 * the write the delivered body performs — it hands the service whole relation arrays and the store
 * persists the pivot rows — and the GraphQL spelling of the same write is the identifiers of the rows
 * to attach. Reading them back is the job of the domains that own them.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('Merchant')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
export class MerchantResolver {
	constructor(private readonly merchantService: MerchantService) {}

	/**
	 * The stores of the caller's tenant, newest first.
	 */
	@Query('merchants')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async merchants(
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
	): Promise<GraphqlConnection<Merchant>> {
		// The delivered list route hands the service the query DTO it bound from the query string. This
		// surface has no query string to bind, so the read runs with the route's own defaults for an
		// unstated request — no criterion, no relations, no page — and the connection protocol's
		// `filter` narrows the rows the service returns. The tenant is applied to the criterion by the
		// service, from the credential rather than from the caller.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<Merchant>;
		const { items }: IPagination<Merchant> = await this.merchantService.findAll(options);

		return buildConnection<Merchant>({
			rows: items ?? [],
			filterable: MERCHANT_FILTERABLE,
			sortable: MERCHANT_SORTABLE,
			defaultSort: MERCHANT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One store of the caller's tenant.
	 *
	 * A store that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('merchant')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async merchant(@Args('id', { type: () => ID }) id: Id): Promise<Merchant | null> {
		try {
			return (await this.merchantService.findById(id)) as Merchant;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many stores the caller's tenant holds.
	 *
	 * The same call the count route makes: the service applies the caller's own tenant to the
	 * criterion from the credential, so the bare call counts the rows the route counts when it is
	 * given no options.
	 */
	@Query('merchantCount')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async merchantCount(): Promise<number> {
		return await this.merchantService.countBy();
	}

	/**
	 * Files a store through the same service method the delivered create route calls.
	 *
	 * The tenant is the credential's: the service stamps it, so a caller states which organization the
	 * row is filed under and never which tenant it is written into.
	 */
	@Mutation('createMerchant')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async createMerchant(@Args('input') input: ICreateMerchantInput): Promise<Merchant> {
		return (await this.merchantService.create(input as unknown as Merchant)) as Merchant;
	}

	/**
	 * Changes a store through the same service method the delivered edit route calls.
	 *
	 * The delivered method answers the row it saved, so the field answers it directly rather than
	 * reading it back: `MerchantService.update` saves the stated columns beside the path identifier
	 * and answers the persisted row, which is already the answer a GraphQL field owes its caller.
	 */
	@Mutation('updateMerchant')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async updateMerchant(@Args('input') input: IUpdateMerchantInput): Promise<Merchant> {
		const { id, ...values } = input;

		return (await this.merchantService.update(id, values as unknown as Merchant)) as Merchant;
	}

	/**
	 * Removes a store outright.
	 *
	 * The delivered service refuses a row that is not there with the same `404` the REST route answers
	 * with, so a caller that names one is told it is missing rather than that the removal succeeded.
	 */
	@Mutation('deleteMerchant')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async deleteMerchant(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.merchantService.delete(id);

		return true;
	}

	/**
	 * Withdraws a store: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteMerchant')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async softDeleteMerchant(@Args('id', { type: () => ID }) id: Id): Promise<Merchant> {
		return await this.merchantService.softRemove(id);
	}

	/**
	 * Puts a withdrawn store back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverMerchant')
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	async recoverMerchant(@Args('id', { type: () => ID }) id: Id): Promise<Merchant> {
		return await this.merchantService.softRecover(id);
	}
}
