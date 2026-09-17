import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { PromotionPermission } from '../../promotion.permissions';
import { ICoupon, IPromotion, IPromotionUsage } from '../../promotion.types';
import { CouponService } from '../../coupon/coupon.service';
import { PromotionService } from '../../promotion/promotion.service';
import { PromotionUsageService } from '../../promotion-usage/promotion-usage.service';
import { toDecimal, toWhere } from '../wire';
import { IPageInput, ISortInput, cursorOffset, toConnection, toOrder, toWindow } from '../types';

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
 * are counted from these rows. There is therefore no mutation on this resolver — the ledger is written
 * by the operations that own it, through the same service.
 *
 * A filter that names a promotion goes through the promotion's own usage read, which is the route the
 * REST surface publishes for it and which is what proves the promotion is the caller's before any row
 * is returned; a filter that names nothing walks the ledger of the caller's organization.
 */
@Resolver('PromotionUsage')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
		@Args('offset') offset?: number
	) {
		const where = toWhere(filter);
		const order = toOrder(sort, PROMOTION_USAGE_SORT_COLUMNS);
		const options = {
			...(Object.keys(where).length ? { where } : {}),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset)
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
