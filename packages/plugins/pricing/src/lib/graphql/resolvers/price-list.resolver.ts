import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere, In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../../pricing.permissions';
import { PriceList } from '../../price-list/price-list.entity';
import { PriceListService } from '../../price-list/price-list.service';
import {
	ICreatePriceListInput,
	IDeletePriceListPayload,
	IPageInput,
	IPriceListFilter,
	IPriceListSort,
	IResolvePriceInput,
	IUpdatePriceListInput,
	PriceListConnection,
	PriceListSortField,
	ResolvedPrice
} from '../graphql.types';
import { readConnection } from '../pagination';

/**
 * Price lists over GraphQL.
 *
 * A thin adapter over the service the REST controller uses: the same permissions, the same methods,
 * the same rows. The lifecycle transitions are mutations rather than a status field on the update
 * input because they are acts — publishing a list and withdrawing one are things an operator does,
 * and each is worth naming in an audit trail.
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
@Resolver('PriceList')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_VIEW))
export class PriceListResolver {
	constructor(private readonly priceListService: PriceListService) {}

	/**
	 * Lists the price lists of the caller's organization.
	 *
	 * @param filter How to narrow the list.
	 * @param sort How to order it.
	 * @param page The cursor window, when one is asked for.
	 * @param limit The page size, when one is asked for.
	 * @param offset The offset, when one is asked for.
	 * @returns The page and its boundary.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_VIEW))
	@Query('priceLists')
	async priceLists(
		@Args('filter') filter?: IPriceListFilter,
		@Args('sort') sort?: IPriceListSort,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<PriceListConnection> {
		return await readConnection(page, limit, offset, (window) =>
			this.priceListService.findAll({
				where: this.whereOf(filter),
				order: this.orderOf(sort),
				take: window.take,
				skip: window.skip,
				...(withDeleted ? { withDeleted: true } : {})
			})
		);
	}

	/**
	 * Reads one price list.
	 *
	 * @param id The list to read.
	 * @returns The list.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_VIEW))
	@Query('priceList')
	async priceList(@Args('id') id: ID): Promise<PriceList> {
		return await this.priceListService.findOneByIdString(id);
	}

	/**
	 * Creates a price list.
	 *
	 * @param input The list to create.
	 * @returns The created list.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_CREATE))
	@Mutation('createPriceList')
	async createPriceList(@Args('input') input: ICreatePriceListInput): Promise<PriceList> {
		return await this.priceListService.createOne(input);
	}

	/**
	 * Updates a price list.
	 *
	 * @param input The list to update and the fields to change.
	 * @returns The list, as it now stands.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_EDIT))
	@Mutation('updatePriceList')
	async updatePriceList(@Args('input') input: IUpdatePriceListInput): Promise<PriceList> {
		const { id, ...changes } = input;

		await this.priceListService.updateOne(id, changes);

		// Read back rather than answering with the update result: the caller asked for the list, and a
		// response assembled from the payload it sent would not show what the write actually stored.
		return await this.priceListService.findOneByIdString(id);
	}

	/**
	 * Deletes a price list.
	 *
	 * @param id The list to delete.
	 * @param force Whether the removal is a hard delete, which also cascades the list's prices.
	 * @returns What the deletion did.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_DELETE))
	@Mutation('deletePriceList')
	async deletePriceList(@Args('id') id: ID, @Args('force') force?: boolean): Promise<IDeletePriceListPayload> {
		await this.priceListService.deletePriceList(id, { force: force === true });

		return { id, deleted: true, hard: force === true };
	}

	/**
	 * Soft-deletes a price list, keeping it and the prices it carries queryable.
	 *
	 * The route it mirrors is `DELETE /price-lists/:id/soft`, inherited from `CrudController`, and the
	 * field is the same capability stated for this protocol: **a caller must not have to choose a
	 * protocol to retire a list recoverably.** The alternative was a hard delete, which cascades the
	 * list's prices and is exactly the operation the soft route exists to avoid.
	 *
	 * The permission is the route's own — `PRICE_LISTS_DELETE` — and not the class-level view grant,
	 * because `CrudController.softRemove` states no permission of its own and PATCHing a list out of
	 * the storefront's reach is a destructive act the view grant must not carry.
	 *
	 * @param id The list to soft delete.
	 * @returns The soft-deleted list.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_DELETE))
	@Mutation('softDeletePriceList')
	async softDeletePriceList(@Args('id') id: ID): Promise<PriceList> {
		return await this.priceListService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted price list.
	 *
	 * The route it mirrors is `PUT /price-lists/:id/recover`, inherited from `CrudController`. Without
	 * this field a list retired over GraphQL could only be brought back over REST, so the two surfaces
	 * of one lifecycle disagreed about which of them could complete it.
	 *
	 * The permission is the route's own — `PRICE_LISTS_DELETE` — because a restored list becomes
	 * eligible for resolution again, which is the same destructive blast radius read the other way.
	 *
	 * @param id The list to restore.
	 * @returns The restored list.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_DELETE))
	@Mutation('recoverPriceList')
	async recoverPriceList(@Args('id') id: ID): Promise<PriceList> {
		return await this.priceListService.softRecover(id);
	}

	/**
	 * Publishes a built price list.
	 *
	 * @param id The list to activate.
	 * @returns The list, as it now stands.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_EDIT))
	@Mutation('activatePriceList')
	async activatePriceList(@Args('id') id: ID): Promise<PriceList> {
		return await this.priceListService.activate(id);
	}

	/**
	 * Withdraws a price list without deleting it.
	 *
	 * @param id The list to withdraw.
	 * @returns The list, as it now stands.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_EDIT))
	@Mutation('expirePriceList')
	async expirePriceList(@Args('id') id: ID): Promise<PriceList> {
		return await this.priceListService.expire(id);
	}

	/**
	 * Dry-runs one price list against a context, writing nothing.
	 *
	 * The route it mirrors is `POST /price-lists/:id/simulate`, and the resolution is the storefront's
	 * own, restricted to the list named and run against a context the caller states rather than one
	 * taken from its session — so a draft list can be previewed before it is published, which is the
	 * whole point of the capability.
	 *
	 * Nothing is written: no price, no status, no counter. The permission is therefore `SIMULATE` and
	 * not `EDIT`, because an analyst allowed to answer "what would this list charge" must not thereby
	 * be allowed to change what the storefront charges — the same split the route states.
	 *
	 * The context is `ResolvePriceInput`, which is the route's body DTO member for member: the two
	 * surfaces ask one question, so they accept one shape. The members are read out individually, as
	 * `resolvePrice` reads them, so a member the schema adds without the service accepting it is a
	 * compile error here rather than an argument silently dropped.
	 *
	 * @param id The list to simulate.
	 * @param input The context to price against.
	 * @returns One resolution per variant the list prices.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRICE_LISTS_SIMULATE))
	@Mutation('simulatePriceList')
	async simulatePriceList(@Args('id') id: ID, @Args('input') input: IResolvePriceInput): Promise<ResolvedPrice[]> {
		return await this.priceListService.simulate(id, {
			variantIds: input.variantIds,
			currency: input.currency,
			quantity: input.quantity,
			date: input.date,
			channelId: input.channelId,
			regionId: input.regionId,
			customerId: input.customerId,
			customerGroupIds: input.customerGroupIds
		});
	}

	/**
	 * @param filter The GraphQL filter.
	 * @returns The equivalent row predicate.
	 */
	private whereOf(filter?: IPriceListFilter): FindOptionsWhere<PriceList> {
		const where: FindOptionsWhere<PriceList> = {};

		if (!filter) {
			return where;
		}

		if (filter.ids?.length) {
			where.id = In(filter.ids);
		}

		if (filter.code) {
			where.code = filter.code;
		}

		if (filter.name) {
			where.name = filter.name;
		}

		if (filter.type) {
			where.type = filter.type;
		}

		if (filter.status) {
			where.status = filter.status;
		}

		if (filter.currency) {
			where.currency = filter.currency.toUpperCase();
		}

		if (filter.channelId) {
			where.channelId = filter.channelId;
		}

		if (filter.customerGroupId) {
			where.customerGroupId = filter.customerGroupId;
		}

		if (filter.regionId) {
			where.regionId = filter.regionId;
		}

		if (filter.isTaxInclusive !== undefined) {
			where.isTaxInclusive = filter.isTaxInclusive;
		}

		return where;
	}

	/**
	 * @param sort The GraphQL sort.
	 * @returns The equivalent ordering. The default is the operator's own priority, highest first,
	 * because that is the order a list is read in when nothing else is asked for.
	 */
	private orderOf(sort?: IPriceListSort): Record<string, 'ASC' | 'DESC'> {
		const direction = sort?.direction;

		switch (sort?.field) {
			case PriceListSortField.NAME:
				return { name: direction ?? 'ASC' };
			case PriceListSortField.CODE:
				return { code: direction ?? 'ASC' };
			case PriceListSortField.PRIORITY:
				return { priority: direction ?? 'DESC' };
			case PriceListSortField.STATUS:
				return { status: direction ?? 'ASC' };
			case PriceListSortField.STARTS_AT:
				return { startsAt: direction ?? 'DESC' };
			case PriceListSortField.ENDS_AT:
				return { endsAt: direction ?? 'DESC' };
			case PriceListSortField.CREATED_AT:
				return { createdAt: direction ?? 'DESC' };
			case PriceListSortField.UPDATED_AT:
				return { updatedAt: direction ?? 'DESC' };
			default:
				return { priority: 'DESC', createdAt: 'DESC' };
		}
	}
}
