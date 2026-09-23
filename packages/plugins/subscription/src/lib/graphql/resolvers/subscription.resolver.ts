import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { SubscriptionPermissions } from '../../subscription.permissions';
import {
	ISubscription,
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
 *
 * The two conventions the controller adopts are adopted here with the same scope names, so the two
 * protocols answer a retry, a missing version and a stale version identically. A GraphQL operation
 * always travels over `POST`, so a query states `write: false` explicitly — nothing about the
 * transport says it — and the version a caller read rides beside the input, because one request may
 * select several mutations and a header could not say which of them it belongs to. The version the
 * guard accepted is read back off the operation's own request, so the write is predicated on exactly
 * the version the guard compared.
 *
 * Every mutating field here declares the scope its route declares and honours a key presented under
 * it; only billing a cycle requires one, because a route that started demanding a key would refuse
 * every caller it already has.
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
@Resolver('CustomerSubscription')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of subscriptions.
	 */
	@Versioned({ resource: SubscriptionService, write: false })
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptions')
	async subscriptions(
		@Args('filter') filter?: ISubscriptionFilter,
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
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
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one subscription.
	 *
	 * @param id The subscription.
	 * @returns The subscription, or null when it is not the caller's.
	 */
	@Versioned({ resource: SubscriptionService, write: false })
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
	 * No version is required of the caller — there is no subscription to have read yet — and the created
	 * subscription's version is published in the payload, which is what the writes that follow it state
	 * back.
	 *
	 * @param input The request.
	 * @returns The payload, with the subscription or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_CREATE)
	@Idempotent({ scope: 'subscription.create', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService, required: false })
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
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.update', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('updateSubscription')
	async updateSubscription(
		@Args('id') id: ID,
		@Args('input') input: IUpdateSubscriptionArgs,
		@Context() context: any
	) {
		try {
			return {
				subscription: await this.subscriptionService.applyChanges(
					id,
					input as any,
					versionExpectationOf(context?.req)
				),
				userErrors: []
			};
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Activates a pending subscription.
	 *
	 * @param id The subscription.
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.activate', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('activateSubscription')
	async activateSubscription(@Args('id') id: ID, @Context() context: any) {
		try {
			return {
				subscription: await this.subscriptionService.activate(id, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Pauses a subscription.
	 *
	 * @param id The subscription.
	 * @param input Until when, and why.
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.pause', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('pauseSubscription')
	async pauseSubscription(
		@Args('id') id: ID,
		@Args('input') input: { until?: Date; reason?: string } | undefined,
		@Context() context: any
	) {
		try {
			return {
				subscription: await this.subscriptionService.pause(
					id,
					{ until: input?.until, reason: input?.reason },
					versionExpectationOf(context?.req)
				),
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
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.resume', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('resumeSubscription')
	async resumeSubscription(@Args('id') id: ID, @Context() context: any) {
		try {
			return {
				subscription: await this.subscriptionService.resume(
					id,
					undefined,
					versionExpectationOf(context?.req)
				),
				userErrors: []
			};
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels a subscription.
	 *
	 * @param id The subscription.
	 * @param input Why, and whether it ends now.
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.cancel', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('cancelSubscription')
	async cancelSubscription(
		@Args('id') id: ID,
		@Args('input') input: { reason?: string; immediate?: boolean } | undefined,
		@Context() context: any
	) {
		try {
			return {
				subscription: await this.subscriptionService.cancel(
					id,
					{
						reason: input?.reason,
						immediate: input?.immediate
					},
					versionExpectationOf(context?.req)
				),
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
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.expire', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('expireSubscription')
	async expireSubscription(
		@Args('id') id: ID,
		@Args('input') input: { reason?: string } | undefined,
		@Context() context: any
	) {
		try {
			return {
				subscription: await this.subscriptionService.expire(
					id,
					input?.reason,
					versionExpectationOf(context?.req)
				),
				userErrors: []
			};
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Moves a subscription to another plan.
	 *
	 * A plan change charges the prorated difference through the ordinary order path, which is the
	 * strongest case in this plugin for a retry key: a client that loses the payload cannot tell whether
	 * the difference was collected, and a second attempt under the same key is answered from the record
	 * of the first rather than charging the customer twice for the same remainder of the period.
	 *
	 * @param id The subscription.
	 * @param input The plan, the quantity and when the change takes effect.
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload, carrying what the change settled.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.plan.change', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('changeSubscriptionPlan')
	async changeSubscriptionPlan(
		@Args('id') id: ID,
		@Args('input') input: { planId: ID; quantity?: string; effective?: 'IMMEDIATE' | 'NEXT_PERIOD'; note?: string },
		@Context() context: any
	) {
		try {
			return {
				...(await this.subscriptionService.changePlan(id, input as any, versionExpectationOf(context?.req))),
				userErrors: []
			};
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
	 * Adding a line charges the prorated difference for the remainder of the period, so this mutation is
	 * the other strong case for a retry key: a lost payload leaves a client unable to tell whether the
	 * line it asked for was added and charged, and a retry under the same key is answered from the record
	 * of the first attempt.
	 *
	 * @param id The subscription.
	 * @param input The line.
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload, carrying what the change settled.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.item.add', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('addSubscriptionItem')
	async addSubscriptionItem(
		@Args('id') id: ID,
		@Args('input') input: ISubscriptionItemArgs,
		@Context() context: any
	) {
		try {
			return {
				...(await this.subscriptionService.addItem(id, input as any, versionExpectationOf(context?.req))),
				userErrors: []
			};
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
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload, carrying what the change settled.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Idempotent({ scope: 'subscription.item.change_quantity', required: false, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('changeSubscriptionItemQuantity')
	async changeSubscriptionItemQuantity(
		@Args('id') id: ID,
		@Args('variantId') variantId: ID,
		@Args('quantity') quantity: string,
		@Context() context: any
	) {
		try {
			return {
				...(await this.subscriptionService.changeItemQuantity(
					id,
					variantId,
					quantity,
					versionExpectationOf(context?.req)
				)),
				userErrors: []
			};
		} catch (error) {
			return this.failedChange(error);
		}
	}

	/**
	 * Removes a recurring line mid-cycle.
	 *
	 * The removal takes the line's row away rather than writing the subscription, so no version of the
	 * subscription is stated and the write the removal does make to it — the proration it records — is
	 * predicated on the version the row holds.
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
	 * Retires a subscription recoverably, keeping its lines and its billing history as the record of
	 * what was sold.
	 *
	 * The route it mirrors is `DELETE /subscriptions/:id/soft`, inherited from `CrudController`. The
	 * controller overrides it only to state `SUBSCRIPTIONS_EDIT`, because the inherited route carries no
	 * permission metadata and `PermissionGuard` (`shared/guards/permission.guard.ts`) answers `true` from
	 * its `isEmpty` branch to that empty pair — leaving nothing but the class-level `SUBSCRIPTIONS_VIEW`
	 * in front of it. The field states the route's own grant for the same reason: a caller allowed to
	 * read a subscription must not thereby be allowed to take it out of every read, and a field that
	 * left the act to the class would reopen on this surface exactly the gap the override closes on the
	 * other.
	 *
	 * @param id The subscription to retire.
	 * @returns The payload, with the retired subscription or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('softDeleteSubscription')
	async softDeleteSubscription(@Args('id') id: ID) {
		try {
			return { subscription: await this.subscriptionService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a soft-deleted subscription.
	 *
	 * The route it mirrors is `PUT /subscriptions/:id/recover`, whose override states the same
	 * `SUBSCRIPTIONS_EDIT` its soft-delete sibling states — restoring a subscription puts it back into
	 * billing, which is the same blast radius read the other way. Without this field a subscription
	 * retired over GraphQL could only be brought back over REST, so the two surfaces of one lifecycle
	 * disagreed about which of them could finish it.
	 *
	 * @param id The subscription to restore.
	 * @returns The payload, with the restored subscription or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('recoverSubscription')
	async recoverSubscription(@Args('id') id: ID) {
		try {
			return { subscription: await this.subscriptionService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { subscription: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Bills one cycle of one subscription.
	 *
	 * A retry presents the same key and is answered from the record of the first attempt, so a lost
	 * response never bills a period twice.
	 *
	 * @param id The subscription.
	 * @param input The instant to bill against.
	 * @param context The operation context, which carries the version the caller read the subscription at.
	 * @returns The payload, carrying what the cycle did.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Idempotent({ scope: 'subscription.bill', required: true, resourceType: 'subscription' })
	@Versioned({ resource: SubscriptionService })
	@Mutation('billSubscription')
	async billSubscription(
		@Args('id') id: ID,
		@Args('input') input: { asOf?: Date } | undefined,
		@Context() context: any
	) {
		try {
			const outcome = await this.subscriptionService.billCycle(
				id,
				{ asOf: input?.asOf, manual: true },
				versionExpectationOf(context?.req)
			);

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
