import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SubscriptionPlan } from '../../subscription-plan/subscription-plan.entity';
import { SubscriptionPlanService } from '../../subscription-plan/subscription-plan.service';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The plan filter, as the schema declares it. */
interface ISubscriptionPlanFilter {
	code?: string;
	isActive?: boolean;
	billingPeriod?: string;
	productId?: ID;
	variantId?: ID;
}

/** The plan as it is created. */
interface ICreateSubscriptionPlanArgs {
	name: string;
	code: string;
	currency: string;
	description?: string;
	productId?: ID;
	variantId?: ID;
	billingPeriod?: string;
	billingInterval?: number;
	maxBillingCycles?: number;
	trialDays?: number;
	setupFee?: string;
	discountPercentage?: string;
	metadata?: Record<string, unknown>;
}

/** The plan as it is updated. */
interface IUpdateSubscriptionPlanArgs extends Partial<ICreateSubscriptionPlanArgs> {
	isActive?: boolean;
}

/**
 * Plans over GraphQL.
 *
 * The resolvers call the same service the REST controller calls, so a plan created here and one
 * created over REST obey the same code check, the same cadence validation and the same
 * don't-strand-a-subscriber rule, and the two surfaces cannot drift. Authorisation is unchanged: the
 * guards run on the HTTP request that carried the operation, exactly as they do for a REST call.
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
@Resolver('SubscriptionPlan')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
export class SubscriptionPlanResolver {
	constructor(private readonly subscriptionPlanService: SubscriptionPlanService) {}

	/**
	 * Lists plans.
	 *
	 * @param filter The plan filter.
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of plans.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionPlans')
	async subscriptionPlans(
		@Args('filter') filter?: ISubscriptionPlanFilter,
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolvePageWindow(page);
		const where: FindOptionsWhere<SubscriptionPlan> = {};

		if (filter?.code) {
			where.code = filter.code;
		}

		if (filter?.isActive !== undefined) {
			where.isActive = filter.isActive;
		}

		if (filter?.billingPeriod) {
			where.billingPeriod = filter.billingPeriod as any;
		}

		if (filter?.productId) {
			where.productId = filter.productId;
		}

		if (filter?.variantId) {
			where.variantId = filter.variantId;
		}

		const result = await this.subscriptionPlanService.findAll({
			where,
			skip,
			take,
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one plan.
	 *
	 * @param id The plan.
	 * @returns The plan, or null when it is not the caller's.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionPlan')
	async subscriptionPlan(@Args('id') id: ID): Promise<SubscriptionPlan | null> {
		try {
			return await this.subscriptionPlanService.findOneScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Reads one plan by its code.
	 *
	 * @param code The plan code.
	 * @returns The plan, or null when the organization has no such code.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionPlanByCode')
	async subscriptionPlanByCode(@Args('code') code: string): Promise<SubscriptionPlan | null> {
		return await this.subscriptionPlanService.findByCode(code);
	}

	/**
	 * Creates a plan.
	 *
	 * @param input The plan.
	 * @returns The payload, with the plan or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_CREATE)
	@Mutation('createSubscriptionPlan')
	async createSubscriptionPlan(@Args('input') input: ICreateSubscriptionPlanArgs) {
		try {
			return { subscriptionPlan: await this.subscriptionPlanService.create(input as any), userErrors: [] };
		} catch (error) {
			return { subscriptionPlan: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Updates a plan.
	 *
	 * @param id The plan.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('updateSubscriptionPlan')
	async updateSubscriptionPlan(@Args('id') id: ID, @Args('input') input: IUpdateSubscriptionPlanArgs) {
		try {
			return { subscriptionPlan: await this.subscriptionPlanService.updatePlan(id, input as any), userErrors: [] };
		} catch (error) {
			return { subscriptionPlan: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deactivates a plan.
	 *
	 * @param id The plan.
	 * @returns The payload, carrying the deactivated plan's id.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('deleteSubscriptionPlan')
	async deleteSubscriptionPlan(@Args('id') id: ID) {
		try {
			await this.subscriptionPlanService.updatePlan(id, { isActive: false } as any);
			await this.subscriptionPlanService.softRemove(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a plan recoverably.
	 *
	 * The route it mirrors is `DELETE /subscription-plans/:id/soft`, inherited from `CrudController` and
	 * overridden by this plugin's controller only to state a permission: the inherited route declares
	 * none, so `PermissionGuard` (`shared/guards/permission.guard.ts`) answered `true` from its `isEmpty`
	 * branch and the class-level `SUBSCRIPTIONS_VIEW` was all that stood in front of it. The field states
	 * the route's own `SUBSCRIPTIONS_EDIT`, because retiring a plan is what `deleteSubscriptionPlan`
	 * above already is — the same act, without the deactivation that precedes it.
	 *
	 * It answers the plan rather than an id, unlike its `deleteSubscriptionPlan` sibling: the service
	 * returns the retired row here, and a payload assembled from the argument the caller sent would tell
	 * it nothing about what the write stored.
	 *
	 * @param id The plan to retire.
	 * @returns The payload, with the retired plan or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('softDeleteSubscriptionPlan')
	async softDeleteSubscriptionPlan(@Args('id') id: ID) {
		try {
			return { subscriptionPlan: await this.subscriptionPlanService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { subscriptionPlan: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Puts a retired plan back on offer.
	 *
	 * The route it mirrors is `PUT /subscription-plans/:id/recover`, whose override states the same
	 * `SUBSCRIPTIONS_EDIT` the soft delete states: a plan that is offered again is one a new subscription
	 * can be sold on, so the grant is the one that decides what may be sold rather than the one that
	 * reads it.
	 *
	 * @param id The plan to restore.
	 * @returns The payload, with the restored plan or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('recoverSubscriptionPlan')
	async recoverSubscriptionPlan(@Args('id') id: ID) {
		try {
			return { subscriptionPlan: await this.subscriptionPlanService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { subscriptionPlan: null, userErrors: [toUserError(error)] };
		}
	}
}
