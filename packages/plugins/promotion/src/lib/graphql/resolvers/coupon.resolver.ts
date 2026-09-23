import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { EventBus, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { ICoupon, IPromotion, IPromotionUsage } from '../../promotion.types';
import { CouponRedeemedEvent } from '../../events';
import { CouponService } from '../../coupon/coupon.service';
import { PromotionService } from '../../promotion/promotion.service';
import { PromotionUsageService } from '../../promotion-usage/promotion-usage.service';
import { toUserError, toWhere } from '../wire';
import {
	CreateCouponBatchPayload,
	CreateCouponPayload,
	DeleteCouponPayload,
	ICouponValidationPayload,
	ICouponRedeemedPayload,
	ICreateCouponBatchInput,
	ICreateCouponInput,
	IPageInput,
	ISortInput,
	IUpdateCouponInput,
	RecoverCouponPayload,
	SoftDeleteCouponPayload,
	UpdateCouponPayload,
	cursorOffset,
	toAsyncIterable,
	toConnection,
	toOrder,
	toWindow
} from '../types';

/**
 * The column each sortable field of a coupon page names.
 */
const COUPON_SORT_COLUMNS: Readonly<Record<string, string>> = {
	CODE: 'code',
	BATCH_ID: 'batchId',
	USAGE_COUNT: 'usageCount',
	STARTS_AT: 'startsAt',
	ENDS_AT: 'endsAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * Coupons over GraphQL.
 *
 * The code is the aggregate here, so the rules that make a code a code are the service's and are not
 * restated: it is normalised to upper case before the uniqueness check, so `save10` and `SAVE10`
 * cannot both exist in one organization, and a redemption is taken by a single conditional statement,
 * so a code with one use left cannot be sold twice by two baskets that both validated successfully.
 *
 * **Validation consumes nothing.** It answers whether a code may be used and why not when it may not,
 * because "invalid code" is not something a customer or an agent can act on, and its `discount` member
 * is left null: the figure belongs to the promotion engine's simulation, and a validation that quietly
 * computed a discount would be a second answer to a question another route already owns.
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
@Resolver('Coupon')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.COUPONS_VIEW as PermissionsEnum)
export class CouponResolver {
	constructor(
		private readonly couponService: CouponService,
		private readonly promotionService: PromotionService,
		private readonly promotionUsageService: PromotionUsageService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists the coupons of the caller's organization.
	 *
	 * @param filter How the listing is narrowed.
	 * @param sort How the listing is ordered.
	 * @param page The cursor window, when the caller walks one.
	 * @param limit The page size, when the caller states one instead.
	 * @param offset The offset, when the caller states one instead.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of coupons.
	 */
	@Permissions(PromotionPermission.COUPONS_VIEW as PermissionsEnum)
	@Query('coupons')
	async coupons(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('sort') sort?: ISortInput,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const order = toOrder(sort, COUPON_SORT_COLUMNS);
		const result = await this.couponService.findCoupons({
			where: toWhere(filter),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset),
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(result, cursorOffset(page, offset));
	}

	/**
	 * Reads one coupon by id.
	 *
	 * @param id The coupon to read.
	 * @returns The coupon, or null when it is not the caller's.
	 */
	@Permissions(PromotionPermission.COUPONS_VIEW as PermissionsEnum)
	@Query('coupon')
	async coupon(@Args('id') id: ID): Promise<ICoupon | null> {
		try {
			return await this.couponService.findCouponOrFail(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Answers whether a code may be used, and why not when it may not. Nothing is consumed.
	 *
	 * @param code The code presented.
	 * @param cartId The basket the code would be applied to. It is carried so that a GraphQL caller
	 * sends the same request the REST route takes; the answer is computed from the coupon's own window
	 * and limits, because a basket is what a redemption — not a validation — is checked against.
	 * @param customerId The customer the code is being checked for.
	 * @returns The answer.
	 */
	@Permissions(PromotionPermission.COUPONS_VIEW as PermissionsEnum)
	@Query('validateCoupon')
	async validateCoupon(
		@Args('code') code: string,
		@Args('cartId') cartId?: ID,
		@Args('customerId') customerId?: ID
	): Promise<ICouponValidationPayload> {
		const result = await this.couponService.validate(code, { customerId });

		return { valid: result.valid, coupon: result.coupon ?? null, reason: result.reason ?? null, discount: null };
	}

	/**
	 * Creates one coupon.
	 *
	 * @param input The coupon to create.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.COUPONS_CREATE as PermissionsEnum)
	@Mutation('createCoupon')
	async createCoupon(@Args('input') input: ICreateCouponInput): Promise<CreateCouponPayload> {
		try {
			return { coupon: await this.couponService.createCoupon(input), operation: null, userErrors: [] };
		} catch (error) {
			return { coupon: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Mints a batch of codes that share one promotion, one window and one set of limits.
	 *
	 * The route it mirrors is `POST /coupons/batch`, and this field is the only door to the capability:
	 * `createCoupon` mints the one code its input names, and a mailing of a thousand codes is one
	 * request here rather than a thousand there. The input is the route's body member for member —
	 * including `code`, which the route's body also declares and which a batch never reads, because
	 * every code it writes is generated from the format.
	 *
	 * The permission is the route's own, `COUPONS_CREATE`. The batch is all-or-nothing: the service
	 * refuses a count outside its range with `COUPON_INVALID`, which reaches the caller as a `userError`
	 * on this payload rather than as a transport failure — the same answer the route's 400 carries.
	 *
	 * @param input The batch request.
	 * @returns The payload, carrying the batch identifier and the counts.
	 */
	@Permissions(PromotionPermission.COUPONS_CREATE as PermissionsEnum)
	@Mutation('createCouponBatch')
	async createCouponBatch(@Args('input') input: ICreateCouponBatchInput): Promise<CreateCouponBatchPayload> {
		try {
			// Handed over as the route hands its body over. The one member the create shape requires and
			// a batch does not is `code`, which the service overwrites for every row it writes: a caller
			// that had to state one would be stating a value nothing reads.
			const batch = await this.couponService.createBatch(input as never);

			return { batch, operation: null, userErrors: [] };
		} catch (error) {
			return { batch: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Changes a coupon's promotion, window or limits.
	 *
	 * @param id The coupon to change.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.COUPONS_EDIT as PermissionsEnum)
	@Mutation('updateCoupon')
	async updateCoupon(@Args('id') id: ID, @Args('input') input: IUpdateCouponInput): Promise<UpdateCouponPayload> {
		try {
			await this.couponService.update(id, input as never);

			return { coupon: await this.couponService.findCouponOrFail(id), operation: null, userErrors: [] };
		} catch (error) {
			return { coupon: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deletes a coupon.
	 *
	 * @param id The coupon to delete.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.COUPONS_DELETE as PermissionsEnum)
	@Mutation('deleteCoupon')
	async deleteCoupon(@Args('id') id: ID): Promise<DeleteCouponPayload> {
		try {
			const coupon = await this.couponService.findCouponOrFail(id);
			await this.couponService.delete(id);

			return { coupon, operation: null, userErrors: [] };
		} catch (error) {
			return { coupon: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a code recoverably, keeping the redemptions it granted.
	 *
	 * The route it mirrors is `DELETE /coupons/:id/soft`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base leaves unstated. A coupon carries its own
	 * usage count and is named by every usage row it produced, so the hard delete the endpoint also
	 * serves leaves those rows pointing at nothing — which is what the soft route exists to avoid.
	 *
	 * The permission is the route's own, `COUPONS_DELETE`, and not the class-level view grant.
	 *
	 * @param id The coupon to retire.
	 * @returns The payload, carrying the coupon as the soft delete left it.
	 */
	@Permissions(PromotionPermission.COUPONS_DELETE as PermissionsEnum)
	@Mutation('softDeleteCoupon')
	async softDeleteCoupon(@Args('id') id: ID): Promise<SoftDeleteCouponPayload> {
		try {
			return { coupon: await this.couponService.softRemove(id), operation: null, userErrors: [] };
		} catch (error) {
			return { coupon: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a coupon that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /coupons/:id/recover`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base leaves unstated. A restored code is
	 * accepted by the checkout again, which is why the route states the destructive grant rather than
	 * the edit one.
	 *
	 * @param id The coupon to restore.
	 * @returns The payload, carrying the restored coupon.
	 */
	@Permissions(PromotionPermission.COUPONS_DELETE as PermissionsEnum)
	@Mutation('recoverCoupon')
	async recoverCoupon(@Args('id') id: ID): Promise<RecoverCouponPayload> {
		try {
			return { coupon: await this.couponService.softRecover(id), operation: null, userErrors: [] };
		} catch (error) {
			return { coupon: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Streams the codes that are redeemed, optionally narrowed to one coupon.
	 *
	 * The event is published only after the conditional statement accepted the use, so a subscriber
	 * never reports a redemption the counter refused.
	 *
	 * @param couponId The coupon to narrow the stream to, when the caller wants one.
	 * @returns The stream.
	 */
	@Permissions(PromotionPermission.COUPONS_VIEW as PermissionsEnum)
	@Subscription('couponRedeemed')
	couponRedeemed(@Args('couponId') couponId?: ID): AsyncIterable<ICouponRedeemedPayload> {
		const source = this.eventBus.ofType(CouponRedeemedEvent);

		return toAsyncIterable(couponId ? source.pipe(filter((event) => event.couponId === couponId)) : source);
	}

	/**
	 * The promotion a redemption of the coupon grants.
	 *
	 * @param coupon The coupon being read.
	 * @returns The promotion, or null when the code is not attached to one yet.
	 */
	@ResolveField('promotion')
	async promotion(@Parent() coupon: ICoupon): Promise<IPromotion | null> {
		if (coupon.promotion) {
			return coupon.promotion;
		}

		if (!coupon.promotionId) {
			return null;
		}

		try {
			return await this.promotionService.findPromotionOrFail(coupon.promotionId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The redemptions the code granted.
	 *
	 * @param coupon The coupon being read.
	 * @returns The usage rows, most recent first.
	 */
	@ResolveField('usages')
	async usages(@Parent() coupon: ICoupon): Promise<IPromotionUsage[]> {
		if (Array.isArray(coupon.usages)) {
			return coupon.usages;
		}

		return await this.promotionUsageService.findByCoupon(coupon.id);
	}
}
