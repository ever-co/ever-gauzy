import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { SubscriptionFeatures } from '../../subscription.features';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SubscriptionBilling } from '../../subscription-billing/subscription-billing.entity';
import { SubscriptionBillingService } from '../../subscription-billing/subscription-billing.service';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The billing filter, as the schema declares it. */
interface ISubscriptionBillingFilter {
	status?: string;
	subscriptionId?: ID;
	orderId?: ID;
}

/**
 * Billing cycles over GraphQL.
 *
 * The history is readable under the view permission and every write is under the bill permission,
 * because the writes are the ones that move money or decide not to. A cycle's attempt history is
 * written by the billing run and is not editable from either surface.
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
 *
 * **The plugin's own gate stands beside it.** The class also declares `SubscriptionFeatures.SUBSCRIPTION`
 * (`FEATURE_SUBSCRIPTION`), the code every subscription REST controller declares with `@FeatureFlag`, so a
 * tenant that switched subscription off is refused here exactly as its routes refuse it — rather than
 * finding every write the routes withhold still served over GraphQL. The two codes are two questions, both
 * of which must be answered yes: the endpoint is on, and the capability is on. The platform's decorator
 * accumulates the codes stated on one target and `FeatureFlagGuard` requires every one of them.
 */
@Resolver('SubscriptionBilling')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(SubscriptionFeatures.SUBSCRIPTION)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
export class SubscriptionBillingResolver {
	constructor(private readonly subscriptionBillingService: SubscriptionBillingService) {}

	/**
	 * Lists billing cycles.
	 *
	 * @param filter The billing filter.
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of cycles.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionBillings')
	async subscriptionBillings(
		@Args('filter') filter?: ISubscriptionBillingFilter,
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolvePageWindow(page);
		const where: FindOptionsWhere<SubscriptionBilling> = {};

		if (filter?.status) {
			where.status = filter.status as any;
		}

		if (filter?.subscriptionId) {
			where.subscriptionId = filter.subscriptionId;
		}

		if (filter?.orderId) {
			where.orderId = filter.orderId;
		}

		const result = await this.subscriptionBillingService.findAll({
			where,
			skip,
			take,
			order: { periodStart: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one billing cycle.
	 *
	 * @param id The cycle.
	 * @returns The cycle, or null when it is not the caller's.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionBilling')
	async subscriptionBilling(@Args('id') id: ID): Promise<SubscriptionBilling | null> {
		try {
			return await this.subscriptionBillingService.findOneScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Opens a billing cycle by hand, for a backfill.
	 *
	 * @param input The cycle.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Mutation('createSubscriptionBilling')
	async createSubscriptionBilling(
		@Args('input')
		input: {
			subscriptionId: ID;
			periodStart: Date;
			periodEnd: Date;
			amount: string;
			currency: string;
			dueAt?: Date;
		}
	) {
		try {
			return { subscriptionBilling: await this.subscriptionBillingService.createPending(input as any), userErrors: [] };
		} catch (error) {
			return { subscriptionBilling: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Corrects a billing cycle that has not been charged.
	 *
	 * @param id The cycle.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Mutation('updateSubscriptionBilling')
	async updateSubscriptionBilling(
		@Args('id') id: ID,
		@Args('input') input: { amount?: string; dueAt?: Date; metadata?: Record<string, unknown> }
	) {
		try {
			await this.subscriptionBillingService.update(id, input as any);

			return { subscriptionBilling: await this.subscriptionBillingService.findOneScoped(id), userErrors: [] };
		} catch (error) {
			return { subscriptionBilling: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Records that a cycle's money arrived.
	 *
	 * @param id The cycle.
	 * @param input When it settled, and a note.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Mutation('paySubscriptionBilling')
	async paySubscriptionBilling(@Args('id') id: ID, @Args('input') input?: { paidAt?: Date; note?: string }) {
		try {
			return {
				subscriptionBilling: await this.subscriptionBillingService.markPaid(id, { paidAt: input?.paidAt }),
				userErrors: []
			};
		} catch (error) {
			return { subscriptionBilling: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Records that a cycle was deliberately not charged.
	 *
	 * @param id The cycle.
	 * @param input Why it was waived.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Mutation('waiveSubscriptionBilling')
	async waiveSubscriptionBilling(@Args('id') id: ID, @Args('input') input: { reason: string }) {
		try {
			return {
				subscriptionBilling: await this.subscriptionBillingService.markWaived(id, { reason: input.reason }),
				userErrors: []
			};
		} catch (error) {
			return { subscriptionBilling: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Records that a paid cycle was refunded.
	 *
	 * @param id The cycle.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_BILL)
	@Mutation('refundSubscriptionBilling')
	async refundSubscriptionBilling(@Args('id') id: ID) {
		try {
			return { subscriptionBilling: await this.subscriptionBillingService.markRefunded(id), userErrors: [] };
		} catch (error) {
			return { subscriptionBilling: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a billing cycle recoverably.
	 *
	 * The route it mirrors is `DELETE /subscription-billings/:id/soft`, inherited from `CrudController`
	 * and overridden by this plugin's controller only to state a permission: the inherited route carries
	 * none, so `PermissionGuard` (`shared/guards/permission.guard.ts`) answered `true` from its `isEmpty`
	 * branch and the class-level `SUBSCRIPTIONS_VIEW` alone stood in front of it.
	 *
	 * The field states the route's own `SUBSCRIPTIONS_EDIT` and not the class's `BILL` grant, for the
	 * reason the controller's override states it: the plugin draws the line at what moves money, and a
	 * cycle retired out of the history is a record removed rather than a charge made. A cycle's money is
	 * still paid, waived and refunded under `SUBSCRIPTIONS_BILL`, exactly as before.
	 *
	 * @param id The cycle to retire.
	 * @returns The payload, with the retired cycle or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('softDeleteSubscriptionBilling')
	async softDeleteSubscriptionBilling(@Args('id') id: ID) {
		try {
			return { subscriptionBilling: await this.subscriptionBillingService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { subscriptionBilling: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a soft-deleted billing cycle.
	 *
	 * The route it mirrors is `PUT /subscription-billings/:id/recover`, whose override states the same
	 * `SUBSCRIPTIONS_EDIT` the soft delete states: putting a cycle back is the inverse of taking it out,
	 * and both decide what the history shows rather than what is charged — which is why neither takes
	 * the billing grant.
	 *
	 * @param id The cycle to restore.
	 * @returns The payload, with the restored cycle or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('recoverSubscriptionBilling')
	async recoverSubscriptionBilling(@Args('id') id: ID) {
		try {
			return { subscriptionBilling: await this.subscriptionBillingService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { subscriptionBilling: null, userErrors: [toUserError(error)] };
		}
	}
}
