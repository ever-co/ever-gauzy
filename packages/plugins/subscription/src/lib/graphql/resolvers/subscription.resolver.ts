import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { SubscriptionPermissions } from '../../subscription.permissions';
import {
	ISubscription,
	ISubscriptionBilling,
	ISubscriptionItem,
	ISubscriptionBillingOutcome
} from '../../subscription.types';
import { Subscription } from '../../subscription/subscription.entity';
import { SubscriptionService } from '../../subscription/subscription.service';
import { SubscriptionPlan } from '../../subscription-plan/subscription-plan.entity';
import { SubscriptionPlanService } from '../../subscription-plan/subscription-plan.service';
import { SubscriptionItem } from '../../subscription-item/subscription-item.entity';
import { SubscriptionItemService } from '../../subscription-item/subscription-item.service';
import { SubscriptionBilling } from '../../subscription-billing/subscription-billing.entity';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The subscription filter, as the schema declares it. */
interface ISubscriptionFilter {
	status?: string;
	planId?: ID;
	customerId?: ID;
	originOrderId?: ID;
	currency?: string;
}

/** One recurring line as the schema declares it. */
interface ISubscriptionItemArgs {
	variantId: ID;
	quantity?: string;
	unitPrice?: string;
	position?: number;
}

/** The request that puts a customer on a plan. */
interface ICreateSubscriptionArgs {
	planId: ID;
	customerId: ID;
	originOrderId?: ID;
	quantity?: string;
	currency?: string;
	items?: ISubscriptionItemArgs[];
	paymentAccountHolderId?: ID;
	paymentMethodTokenId?: ID;
	activate?: boolean;
	startTrial?: boolean;
	discountPercentage?: string;
	metadata?: Record<string, unknown>;
}

/** The fields a subscription's caller may move. */
interface IUpdateSubscriptionArgs {
	paymentAccountHolderId?: ID;
	paymentMethodTokenId?: ID;
	quantity?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Subscriptions over GraphQL.
 *
 * The lifecycle and the billing entry points are the same service calls the REST controller makes, so
 * a subscription paused over GraphQL and one paused over REST take the same transition from the same
 * allowed-from state. The two fields a change can produce — a proration's settlement and a cycle's
 * outcome — are returned whole rather than reduced to a status, because the arithmetic that produced
 * them is what a caller has to show a customer.
 */
@Resolver('CustomerSubscription')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
export class SubscriptionResolver {
	constructor(
		private readonly subscriptionService: SubscriptionService,
		private readonly subscriptionPlanService: SubscriptionPlanService,
		private readonly subscriptionItemService: SubscriptionItemService
	) {}

	/**
	 * Lists subscriptions.
	 *
	 * @param filter The subscription filter.
	 * @param page The page.
	 * @returns One page of subscriptions.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptions')
	async subscriptions(@Args('filter') filter?: ISubscriptionFilter, @Args('page') page?: IPageSelection) {
		const { skip, take } = resolvePageWindow(page);
		const where: FindOptionsWhere<Subscription> = {};

		if (filter?.status) {
			where.status = filter.status as any;
		}

		if (filter?.planId) {
			where.planId = filter.planId;
		}

		if (filter?.customerId) {
			where.customerId = filter.customerId;
		}

		if (filter?.originOrderId) {
			where.originOrderId = filter.originOrderId;
		}

		if (filter?.currency) {
			where.currency = filter.currency;
		}

		const result = await this.subscriptionService.findAll({
			where,
			skip,
			take,
			order: { createdAt: 'DESC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one subscription.
	 *
	 * @param id The subscription.
	 * @returns The subscription, or null when it is not the caller's.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscription')
	async subscription(@Args('id') id: ID): Promise<Subscription | null> {
		try {
			return await this.subscriptionService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Starts a subscription on a plan.
	 *
	 * @param input The request.
	 * @returns The payload, with the subscription or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_CREATE)
	@Mutation('createSubscription')
	async createSubscription(@Args('input') input: ICreateSubscriptionArgs) {
		try {
			return { subscription: await this.subscriptionService.createSubscription(input as any), userErrors: [] };
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Moves a subscription's payer, quantity or metadata.
	 *
	 * @param id The subscription.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('updateSubscription')
	async updateSubscription(@Args('id') id: ID, @Args('input') input: IUpdateSubscriptionArgs) {
		try {
			await this.subscriptionService.update(id, input as any);

			return { subscription: await this.subscriptionService.findOneDetailed(id), userErrors: [] };
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Activates a pending subscription.
	 *
	 * @param id The subscription.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('activateSubscription')
	async activateSubscription(@Args('id') id: ID) {
		try {
			return { subscription: await this.subscriptionService.activate(id), userErrors: [] };
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Pauses a subscription.
	 *
	 * @param id The subscription.
	 * @param input Until when, and why.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('pauseSubscription')
	async pauseSubscription(@Args('id') id: ID, @Args('input') input?: { until?: Date; reason?: string }) {
		try {
			return {
				subscription: await this.subscriptionService.pause(id, { until: input?.until, reason: input?.reason }),
				userErrors: []
			};
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resumes a paused subscription.
	 *
	 * @param id The subscription.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('resumeSubscription')
	async resumeSubscription(@Args('id') id: ID) {
		try {
			return { subscription: await this.subscriptionService.resume(id), userErrors: [] };
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels a subscription.
	 *
	 * @param id The subscription.
	 * @param input Why, and whether it ends now.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('cancelSubscription')
	async cancelSubscription(@Args('id') id: ID, @Args('input') input?: { reason?: string; immediate?: boolean }) {
		try {
			return {
				subscription: await this.subscriptionService.cancel(id, {
					reason: input?.reason,
					immediate: input?.immediate
				}),
				userErrors: []
			};
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Expires a subscription.
	 *
	 * @param id The subscription.
	 * @param input Why.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('expireSubscription')
	async expireSubscription(@Args('id') id: ID, @Args('input') input?: { reason?: string }) {
		try {
			return { subscription: await this.subscriptionService.expire(id, input?.reason), userErrors: [] };
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Moves a subscription to another plan.
	 *
	 * @param id The subscription.
	 * @param input The plan, the quantity and when the change takes effect.
	 * @returns The payload, carrying what the change settled.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('changeSubscriptionPlan')
	async changeSubscriptionPlan(
		@Args('id') id: ID,
		@Args('input') input: { planId: ID; quantity?: string; effective?: 'IMMEDIATE' | 'NEXT_PERIOD'; note?: string }
	) {
		try {
			return { ...(await this.subscriptionService.changePlan(id, input as any)), userErrors: [] };
		} catch (error) {
			return {
				subscription: null,
				credit: '0',
				charge: '0',
				net: '0',
				settlement: 'WAIVED',
				currency: 'USD',
				userErrors: [toUserError(error)]
			};
		}
	}

	/**
	 * Adds a recurring line mid-cycle.
	 *
	 * @param id The subscription.
	 * @param input The line.
	 * @returns The payload, carrying what the change settled.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('addSubscriptionItem')
	async addSubscriptionItem(@Args('id') id: ID, @Args('input') input: ISubscriptionItemArgs) {
		try {
			return { ...(await this.subscriptionService.addItem(id, input as any)), userErrors: [] };
		} catch (error) {
			return this.failedChange(error);
		}
	}

	/**
	 * Changes a recurring line's quantity mid-cycle.
	 *
	 * @param id The subscription.
	 * @param variantId The variant whose line is changing.
	 * @param quantity The new quantity.
	 * @returns The payload, carrying what the change settled.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('changeSubscriptionItemQuantity')
	async changeSubscriptionItemQuantity(
		@Args('id') id: ID,
		@Args('variantId') variantId: ID,
		@Args('quantity') quantity: string
	) {
		try {
			return { ...(await this.subscriptionService.changeItemQuantity(id, variantId, quantity)), userErrors: [] };
		} catch (error) {
			return this.failedChange(error);
		}
	}

	/**
	 * Removes a recurring line mid-cycle.
	 *
	 * @param id The subscription.
	 * @param variantId The variant whose line is being removed.
	 * @returns The payload, carrying what the change settled.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('removeSubscriptionItem')
	async removeSubscriptionItem(@Args('id') id: ID, @Args('variantId') variantId: ID) {
		try {
			return { ...(await this.subscriptionService.removeItem(id, variantId)), userErrors: [] };
		} catch (error) {
			return this.failedChange(error);
		}
	}

	/**
	 * Bills one cycle of one subscription.
	 *
	 * @param id The subscription.
	 * @param input The instant to bill against.
	 * @returns The payload, carrying what the cycle did.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Mutation('billSubscription')
	async billSubscription(@Args('id') id: ID, @Args('input') input?: { asOf?: Date }) {
		try {
			const outcome = await this.subscriptionService.billCycle(id, { asOf: input?.asOf, manual: true });

			return { ...outcome, userErrors: [] };
		} catch (error) {
			return {
				subscriptionId: id,
				billingId: null,
				status: 'FAILED',
				replayed: false,
				orderId: null,
				amount: null,
				currency: null,
				periodStart: null,
				periodEnd: null,
				nextRetryAt: null,
				errorCode: toUserError(error).code,
				message: (error as Error).message,
				userErrors: [toUserError(error)]
			};
		}
	}

	/**
	 * Runs a billing pass.
	 *
	 * @param input The instant to run against, how many subscriptions one pass may take, and an
	 * optional single subscription to restrict it to.
	 * @returns The payload, carrying what the pass did.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Mutation('runSubscriptionBilling')
	async runSubscriptionBilling(
		@Args('input') input?: { subscriptionId?: ID; limit?: number; asOf?: Date }
	) {
		try {
			const run = await this.subscriptionService.runBilling({
				asOf: input?.asOf,
				limit: input?.limit,
				subscriptionId: input?.subscriptionId
			});

			return {
				...run,
				results: run.results.map((outcome: ISubscriptionBillingOutcome) => ({ ...outcome, userErrors: [] })),
				userErrors: []
			};
		} catch (error) {
			return { examined: 0, billed: 0, failed: 0, skipped: 0, results: [], userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves a subscription's recurring lines.
	 *
	 * @param subscription The subscription being read.
	 * @returns The lines.
	 */
	@ResolveField('items')
	async items(@Parent() subscription: ISubscription): Promise<SubscriptionItem[]> {
		if (Array.isArray((subscription as Subscription).items)) {
			return (subscription as Subscription).items as SubscriptionItem[];
		}

		return await this.subscriptionItemService.findForSubscription(subscription.id);
	}

	/**
	 * Resolves a subscription's billing history.
	 *
	 * @param subscription The subscription being read.
	 * @returns The cycles, newest period first.
	 */
	@ResolveField('billings')
	async billings(@Parent() subscription: ISubscription): Promise<SubscriptionBilling[]> {
		if (Array.isArray((subscription as Subscription).billings)) {
			return (subscription as Subscription).billings as SubscriptionBilling[];
		}

		return await this.subscriptionService.findBillings(subscription.id);
	}

	/**
	 * Resolves the plan a subscription is on.
	 *
	 * Resolved from the cause rather than stored on the subscription, so a plan that has since been
	 * deactivated still answers what the subscription was sold on.
	 *
	 * @param subscription The subscription being read.
	 * @returns The plan, or null when it is not readable.
	 */
	@ResolveField('plan')
	async plan(@Parent() subscription: ISubscription): Promise<SubscriptionPlan | null> {
		try {
			return await this.subscriptionPlanService.findOneScoped(subscription.planId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * @param error The error a change was refused with.
	 * @returns A change payload that carries nothing but the refusal.
	 */
	private failedChange(error: unknown) {
		return {
			subscription: null,
			credit: '0',
			charge: '0',
			net: '0',
			settlement: 'WAIVED',
			currency: 'USD',
			userErrors: [toUserError(error)]
		};
	}
}
