import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { EventBus, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
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
	DeactivatePromotionPayload,
	DeletePromotionPayload,
	ExpirePromotionPayload,
	ICreatePromotionInput,
	IDeactivatePromotionInput,
	IPageInput,
	IPromotionChangedPayload,
	IPromotionSimulationInput,
	IReplacePromotionActionsInput,
	ISortInput,
	IUpdatePromotionInput,
	RecoverPromotionPayload,
	ReplacePromotionActionsPayload,
	SimulatePromotionPayload,
	SoftDeletePromotionPayload,
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
@Resolver('Promotion')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of promotions.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
	@Query('promotions')
	async promotions(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('sort') sort?: ISortInput,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const order = toOrder(sort, PROMOTION_SORT_COLUMNS);
		const result = await this.promotionService.findPromotions({
			where: toWhere(filter),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset),
			...(withDeleted ? { withDeleted: true } : {})
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
	 * Stops a promotion, so its rules no longer match anything.
	 *
	 * The route it mirrors is `POST /promotions/:id/deactivate`. The two are deliberately separate
	 * capabilities and not one field with a status argument: a draft that was never reviewed and an
	 * offer an operator pulled are different facts, and the service is what records which one happened.
	 *
	 * The reason is optional on both surfaces and is not passed to the service, which keeps none — an
	 * operator's explanation belongs with the activity log entry that recorded the act, which is where
	 * the route leaves it too. The permission is the route's own, `PROMOTIONS_EDIT`: stopping an offer
	 * is an edit, and the class-level view grant must not carry it.
	 *
	 * @param id The promotion to stop.
	 * @param input The reason the promotion is being stopped, when the caller states one.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Mutation('deactivatePromotion')
	async deactivatePromotion(
		@Args('id') id: ID,
		@Args('input') input?: IDeactivatePromotionInput
	): Promise<DeactivatePromotionPayload> {
		try {
			return {
				promotion: await this.promotionService.deactivate(id, input?.reason),
				operation: null,
				userErrors: []
			};
		} catch (error) {
			return { promotion: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Replaces the whole action set of a promotion.
	 *
	 * The route it mirrors is `PUT /promotions/:id/actions`, and it replaces rather than merges for the
	 * reason the domain states: an action's position is part of its meaning, so an operator who removes
	 * one has to say where the remaining ones now sit. An empty set is refused by the service with
	 * `PROMOTION_NO_ACTIONS`, which reaches the caller as a `userError` rather than as a transport
	 * failure — the same answer the route's 400 carries, in this protocol's vocabulary.
	 *
	 * The permission is the route's own, `PROMOTIONS_EDIT`.
	 *
	 * @param id The promotion whose actions are replaced.
	 * @param input The new action set.
	 * @returns The payload, carrying the stored actions in application order.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)
	@Mutation('replacePromotionActions')
	async replacePromotionActions(
		@Args('id') id: ID,
		@Args('input') input: IReplacePromotionActionsInput
	): Promise<ReplacePromotionActionsPayload> {
		try {
			return {
				actions: await this.promotionService.replaceActions(id, input.actions as Partial<IPromotionAction>[]),
				operation: null,
				userErrors: []
			};
		} catch (error) {
			return { actions: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Dry-runs one promotion against a basket, writing nothing.
	 *
	 * The route it mirrors is `POST /promotions/:id/simulate`, and it is the evaluation the checkout
	 * runs, restricted to the promotion named: no reservation, no budget consumption, no usage row.
	 * That is what makes it safe to hand to an analyst, which is also why it carries its own permission
	 * — `PROMOTIONS_SIMULATE` and not `PROMOTIONS_EDIT`, exactly as the route states.
	 *
	 * The context is handed to the service unchanged, as the route hands its body: the notices an
	 * exclusion produces are the answer, so re-shaping the context here would be re-shaping the answer.
	 *
	 * @param id The promotion to simulate.
	 * @param input The basket to simulate it against.
	 * @returns The payload, carrying the applications, notices and allocations it would produce.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_SIMULATE as PermissionsEnum)
	@Mutation('simulatePromotion')
	async simulatePromotion(
		@Args('id') id: ID,
		@Args('input') input: IPromotionSimulationInput
	): Promise<SimulatePromotionPayload> {
		try {
			const evaluation = await this.promotionService.simulate(id, input);

			return { result: evaluation.result, allocations: evaluation.allocations, operation: null, userErrors: [] };
		} catch (error) {
			return { result: null, allocations: [], operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a promotion recoverably, keeping its counters and its redemption ledger.
	 *
	 * The route it mirrors is `DELETE /promotions/:id/soft`, inherited from `CrudController`: it states
	 * the destructive grant itself because the base declares no permission metadata of its own, and a
	 * caller that could not retire an offer over GraphQL would have to reach for the hard delete
	 * instead — which is the outcome the soft route exists to avoid.
	 *
	 * The permission is the route's own, `PROMOTIONS_DELETE`.
	 *
	 * @param id The promotion to soft delete.
	 * @returns The payload, carrying the promotion as the soft delete left it.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('softDeletePromotion')
	async softDeletePromotion(@Args('id') id: ID): Promise<SoftDeletePromotionPayload> {
		try {
			return { promotion: await this.promotionService.softRemove(id), operation: null, userErrors: [] };
		} catch (error) {
			return { promotion: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a soft-deleted promotion.
	 *
	 * The route it mirrors is `PUT /promotions/:id/recover`, inherited from `CrudController`. A restored
	 * offer becomes a candidate for every basket its rules match again, which is why the route states
	 * the destructive grant rather than the edit one — and why this field states `PROMOTIONS_DELETE`
	 * too, rather than the class-level view grant that would otherwise be all that is left in front of
	 * it.
	 *
	 * @param id The promotion to restore.
	 * @returns The payload, carrying the restored promotion.
	 */
	@Permissions(PromotionPermission.PROMOTIONS_DELETE as PermissionsEnum)
	@Mutation('recoverPromotion')
	async recoverPromotion(@Args('id') id: ID): Promise<RecoverPromotionPayload> {
		try {
			return { promotion: await this.promotionService.softRecover(id), operation: null, userErrors: [] };
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
