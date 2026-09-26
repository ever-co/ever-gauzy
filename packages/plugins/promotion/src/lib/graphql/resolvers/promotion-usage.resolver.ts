import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { ICoupon, IPromotion, IPromotionUsage } from '../../promotion.types';
import { CouponService } from '../../coupon/coupon.service';
import { PromotionService } from '../../promotion/promotion.service';
import { PromotionUsageService } from '../../promotion-usage/promotion-usage.service';
import { toDecimal, toUserError, toWhere } from '../wire';
import {
	IPageInput,
	ISortInput,
	RecoverPromotionUsagePayload,
	SoftDeletePromotionUsagePayload,
	cursorOffset,
	toConnection,
	toOrder,
	toWindow
} from '../types';

/**
 * The column each sortable field of a redemption page names.
 */
const PROMOTION_USAGE_SORT_COLUMNS: Readonly<Record<string, string>> = {
	USED_AT: 'usedAt',
	AMOUNT: 'amount',
	STATUS: 'status',
	CREATED_AT: 'createdAt'
};

/**
 * The redemption ledger over GraphQL.
 *
 * A row here is a fact about an application of a promotion, not a record an operator maintains: the
 * checkout reserves one while the basket is being paid for and registers it when the order is placed,
 * a cancellation or a return moves it to `REVERTED`, and the global, per-customer and per-code limits
 * are counted from these rows. The ledger is therefore written by the operations that own it, through
 * the same service — with one exception, and it is not an edit: `DELETE /:id/soft` and `PUT /:id/recover`
 * are inherited from `CrudController` by this resource's controller, which overrides both to state the
 * permission the base leaves unstated, so the ledger serves a gated withdraw/restore pair over REST
 * that no field of the composed schema answered. Retiring a row takes it out of a count and restoring
 * it puts it back; neither writes an amount, and neither moves a status.
 *
 * A filter that names a promotion goes through the promotion's own usage read, which is the route the
 * REST surface publishes for it and which is what proves the promotion is the caller's before any row
 * is returned; a filter that names nothing walks the ledger of the caller's organization.
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
@Resolver('PromotionUsage')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
export class PromotionUsageResolver {
	constructor(
		private readonly promotionUsageService: PromotionUsageService,
		private readonly promotionService: PromotionService,
		private readonly couponService: CouponService
	) {}

	/**
	 * Lists the applications of the caller's organization.
	 *
	 * @param filter How the listing is narrowed.
	 * @param sort How the listing is ordered.
	 * @param page The cursor window, when the caller walks one.
	 * @param limit The page size, when the caller states one instead.
	 * @param offset The offset, when the caller states one instead.
	 * @returns One page of applications.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Query('promotionUsages')
	async promotionUsages(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('sort') sort?: ISortInput,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const where = toWhere(filter);
		const order = toOrder(sort, PROMOTION_USAGE_SORT_COLUMNS);
		const options = {
			...(Object.keys(where).length ? { where } : {}),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset),
			...(withDeleted ? { withDeleted: true } : {})
		};
		const promotionId = where.promotionId as ID | undefined;
		// A filter that names a promotion is read through the promotion's own usage route, which is the
		// read the REST surface publishes for it and which is what proves the promotion is the caller's
		// before any row is returned.
		const result = promotionId
			? await this.promotionService.findUsage(promotionId, options)
			: await this.promotionUsageService.findUsages(options);

		return toConnection(result, cursorOffset(page, offset));
	}

	/**
	 * Retires one application recoverably, keeping the counters it was counted in.
	 *
	 * The route it mirrors is `DELETE /promotion-usages/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base leaves unstated. The row is
	 * retired rather than reversed: a reversal is `REVERTED`, which is a status the returns path writes,
	 * while this pair decides only whether the row is part of the ledger a report reads.
	 *
	 * The permission is the route's own, `PROMOTIONS_DELETE`, and not the class-level view grant.
	 *
	 * @param id The application to retire.
	 * @returns The payload, carrying the row as the soft delete left it.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('softDeletePromotionUsage')
	async softDeletePromotionUsage(@Args('id') id: ID): Promise<SoftDeletePromotionUsagePayload> {
		try {
			return { usage: await this.promotionUsageService.softRemove(id), operation: null, userErrors: [] };
		} catch (error) {
			return { usage: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores an application that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /promotion-usages/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base leaves unstated. A restored row
	 * counts towards the global, per-customer and per-code limits again, which is why the route states
	 * the destructive grant rather than the view one.
	 *
	 * @param id The application to restore.
	 * @returns The payload, carrying the restored row.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('recoverPromotionUsage')
	async recoverPromotionUsage(@Args('id') id: ID): Promise<RecoverPromotionUsagePayload> {
		try {
			return { usage: await this.promotionUsageService.softRecover(id), operation: null, userErrors: [] };
		} catch (error) {
			return { usage: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * The promotion one application belongs to.
	 *
	 * @param usage The row being read.
	 * @returns The promotion, or null when it has since been removed.
	 */
	@ResolveField('promotion')
	async promotion(@Parent() usage: IPromotionUsage): Promise<IPromotion | null> {
		if (usage.promotion) {
			return usage.promotion;
		}

		try {
			return await this.promotionService.findPromotionOrFail(usage.promotionId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The code the application came from, when it came from one.
	 *
	 * @param usage The row being read.
	 * @returns The coupon, or null for an automatic application.
	 */
	@ResolveField('coupon')
	async coupon(@Parent() usage: IPromotionUsage): Promise<ICoupon | null> {
		if (usage.coupon) {
			return usage.coupon;
		}

		if (!usage.couponId) {
			return null;
		}

		try {
			return await this.couponService.findCouponOrFail(usage.couponId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The discount the application granted.
	 *
	 * The column is `numeric(20,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered as an exact decimal here
	 * rather than exposed as a float.
	 *
	 * @param usage The row being read.
	 * @returns The amount.
	 */
	@ResolveField('amount')
	amount(@Parent() usage: IPromotionUsage): DecimalString {
		return toDecimal(usage.amount) ?? '0.000000';
	}
}
