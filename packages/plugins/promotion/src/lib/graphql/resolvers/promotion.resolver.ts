import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { EventBus, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { PromotionPermission } from '../../promotion.permissions';
import { ICampaign, ICoupon, IPromotion, IPromotionAction, IPromotionUsage } from '../../promotion.types';
import { PromotionChangedEvent } from '../../events';
import { PromotionService } from '../../promotion/promotion.service';
import { PromotionActionService } from '../../promotion-action/promotion-action.service';
import { PromotionUsageService } from '../../promotion-usage/promotion-usage.service';
import { CouponService } from '../../coupon/coupon.service';
import { CampaignService } from '../../campaign/campaign.service';
import { toDecimal, toUserError, toWhere } from '../wire';
import {
	ActivatePromotionPayload,
	CreatePromotionPayload,
	DeletePromotionPayload,
	ExpirePromotionPayload,
	ICreatePromotionInput,
	IPageInput,
	IPromotionChangedPayload,
	ISortInput,
	IUpdatePromotionInput,
	UpdatePromotionPayload,
	cursorOffset,
	toAsyncIterable,
	toConnection,
	toOrder,
	toWindow
} from '../types';

/**
 * The column each sortable field of a promotion page names.
 *
 * The schema names a field the way a client reads it and the repository orders by the column it is
 * stored in, so the mapping is declared once here rather than at every call site. A field the table
 * does not name orders nothing, and the service's own default then applies.
 */
const PROMOTION_SORT_COLUMNS: Readonly<Record<string, string>> = {
	CODE: 'code',
	TITLE: 'title',
	TYPE: 'type',
	STATUS: 'status',
	PRIORITY: 'priority',
	STARTS_AT: 'startsAt',
	ENDS_AT: 'endsAt',
	USAGE_COUNT: 'usageCount',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * Promotions over GraphQL.
 *
 * The resolver is an adapter over the service the REST controller uses: it resolves the same
 * permissions, calls the same methods and answers with the same rows, so a GraphQL caller and a REST
 * caller cannot drift apart. Nothing about a promotion is decided here — the lifecycle rules live in
 * the service, and this file only says what the two protocols call each of them.
 *
 * Two conventions are worth stating. A **write answers with a payload**: the promotion it changed and
 * the outcomes the caller can act on, because "this code is already in use" is a successful operation
 * with a documented result rather than a transport failure. And the **action set is replaced, never
 * merged**: an action's position is part of its meaning, so an update that states actions states all
 * of them.
 */
@Resolver('Promotion')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
export class PromotionResolver {
	constructor(
		private readonly promotionService: PromotionService,
		private readonly promotionActionService: PromotionActionService,
		private readonly promotionUsageService: PromotionUsageService,
		private readonly couponService: CouponService,
		private readonly campaignService: CampaignService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists the promotions of the caller's organization.
	 *
	 * @param filter How the listing is narrowed, one equality per member.
	 * @param sort How the listing is ordered.
	 * @param page The cursor window, when the caller walks one.
	 * @param limit The page size, when the caller states one instead.
	 * @param offset The offset, when the caller states one instead.
	 * @returns One page of promotions.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Query('promotions')
	async promotions(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('sort') sort?: ISortInput,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	) {
		const order = toOrder(sort, PROMOTION_SORT_COLUMNS);
		const result = await this.promotionService.findPromotions({
			where: toWhere(filter),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset)
		});

		return toConnection(result, cursorOffset(page, offset));
	}

	/**
	 * Reads one promotion by id.
	 *
	 * @param id The promotion to read.
	 * @returns The promotion, or null when it is not the caller's.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Query('promotion')
	async promotion(@Args('id') id: ID): Promise<IPromotion | null> {
		try {
			return await this.promotionService.findPromotionOrFail(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a promotion in draft.
	 *
	 * @param input The offer to create, with its action set when it has one.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_CREATE as PermissionsEnum)
	@Mutation('createPromotion')
	async createPromotion(@Args('input') input: ICreatePromotionInput): Promise<CreatePromotionPayload> {
		try {
			return { promotion: await this.promotionService.createPromotion(input), operation: null, userErrors: [] };
		} catch (error) {
			return { promotion: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Changes the editable fields of a promotion. The status is moved by the activation and expiry
	 * mutations, so a change made here never silently starts or stops an offer.
	 *
	 * @param id The promotion to change.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Mutation('updatePromotion')
	async updatePromotion(
		@Args('id') id: ID,
		@Args('input') input: IUpdatePromotionInput
	): Promise<UpdatePromotionPayload> {
		try {
			const { actions, ...changes } = input;
			const promotion = await this.promotionService.updatePromotion(id, changes);

			if (actions?.length) {
				await this.promotionService.replaceActions(id, actions);
			}

			return { promotion, operation: null, userErrors: [] };
		} catch (error) {
			return { promotion: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deletes a promotion.
	 *
	 * The promotion is read through the scoped finder before it is removed, because that read is what
	 * proves it belongs to the caller and it is what the payload reports as deleted.
	 *
	 * @param id The promotion to delete.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('deletePromotion')
	async deletePromotion(@Args('id') id: ID): Promise<DeletePromotionPayload> {
		try {
			const promotion = await this.promotionService.findPromotionOrFail(id);
			await this.promotionService.delete(id);

			return { promotion, operation: null, userErrors: [] };
		} catch (error) {
			return { promotion: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Starts a promotion, so its rules may match.
	 *
	 * @param id The promotion to start.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Mutation('activatePromotion')
	async activatePromotion(@Args('id') id: ID): Promise<ActivatePromotionPayload> {
		try {
			return { promotion: await this.promotionService.activate(id), operation: null, userErrors: [] };
		} catch (error) {
			return { promotion: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Closes a promotion before its window ends.
	 *
	 * Expiry is a state change and not a deletion: the promotion keeps its counters and its ledger, so
	 * last month's campaign can still be reported on. The reason the schema carries is not passed on —
	 * the service keeps no reason of its own, and an operator's explanation belongs with the activity
	 * that recorded it, which is where the REST surface leaves it too.
	 *
	 * @param id The promotion to close.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Mutation('expirePromotion')
	async expirePromotion(@Args('id') id: ID): Promise<ExpirePromotionPayload> {
		try {
			return { promotion: await this.promotionService.expire(id), operation: null, userErrors: [] };
		} catch (error) {
			return { promotion: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Streams the promotions that change, optionally narrowed to one promotion.
	 *
	 * The stream is the domain's own event stream rather than a second, transport-shaped copy of it:
	 * a subscriber that caches a promotion set purges on this event, so a promotion that expired stops
	 * applying at the instant it expired.
	 *
	 * @param promotionId The promotion to narrow the stream to, when the caller wants one.
	 * @returns The stream.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Subscription('promotionChanged')
	promotionChanged(@Args('promotionId') promotionId?: ID): AsyncIterable<IPromotionChangedPayload> {
		const source = this.eventBus.ofType(PromotionChangedEvent);

		return toAsyncIterable(promotionId ? source.pipe(filter((event) => event.promotionId === promotionId)) : source);
	}

	/**
	 * The campaign whose window and budget bound the promotion.
	 *
	 * @param promotion The promotion being read.
	 * @returns The campaign, or null when the promotion is not bounded by one.
	 */
	@ResolveField('campaign')
	async campaign(@Parent() promotion: IPromotion): Promise<ICampaign | null> {
		if (promotion.campaign) {
			return promotion.campaign;
		}

		if (!promotion.campaignId) {
			return null;
		}

		try {
			return await this.campaignService.findCampaignOrFail(promotion.campaignId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The effect of the offer, in application order.
	 *
	 * @param promotion The promotion being read.
	 * @returns The actions.
	 */
	@ResolveField('actions')
	async actions(@Parent() promotion: IPromotion): Promise<IPromotionAction[]> {
		if (Array.isArray(promotion.actions)) {
			return promotion.actions;
		}

		return await this.promotionActionService.findByPromotion(promotion.id);
	}

	/**
	 * The codes that grant the promotion.
	 *
	 * @param promotion The promotion being read.
	 * @returns The coupons.
	 */
	@ResolveField('coupons')
	async coupons(@Parent() promotion: IPromotion): Promise<ICoupon[]> {
		if (Array.isArray(promotion.coupons)) {
			return promotion.coupons;
		}

		const page = await this.couponService.findCoupons({ where: { promotionId: promotion.id } });

		return page.items;
	}

	/**
	 * The promotion's applications, as reservations and registrations.
	 *
	 * @param promotion The promotion being read.
	 * @returns The usage rows, most recent first.
	 */
	@ResolveField('usages')
	async usages(@Parent() promotion: IPromotion): Promise<IPromotionUsage[]> {
		if (Array.isArray(promotion.usages)) {
			return promotion.usages;
		}

		const page = await this.promotionUsageService.findByPromotion(promotion.id);

		return page.items;
	}

	/**
	 * The inline budget of a promotion that has no campaign.
	 *
	 * The column is `numeric(20,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered as an exact decimal here
	 * rather than exposed as a float.
	 *
	 * @param promotion The promotion being read.
	 * @returns The amount, or null when the promotion has no inline budget.
	 */
	@ResolveField('budgetAmount')
	budgetAmount(@Parent() promotion: IPromotion): DecimalString | null {
		return toDecimal(promotion.budgetAmount);
	}

	/**
	 * The consumption of the inline budget. The column is `NOT NULL DEFAULT 0`, so a value that did
	 * not arrive is the zero the column holds rather than a null the schema cannot carry.
	 *
	 * @param promotion The promotion being read.
	 * @returns The amount.
	 */
	@ResolveField('budgetSpent')
	budgetSpent(@Parent() promotion: IPromotion): DecimalString {
		return toDecimal(promotion.budgetSpent) ?? '0.000000';
	}
}
