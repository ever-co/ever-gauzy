import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
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
 */
@Resolver('SubscriptionPlan')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
export class SubscriptionPlanResolver {
	constructor(private readonly subscriptionPlanService: SubscriptionPlanService) {}

	/**
	 * Lists plans.
	 *
	 * @param filter The plan filter.
	 * @param page The page.
	 * @returns One page of plans.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionPlans')
	async subscriptionPlans(@Args('filter') filter?: ISubscriptionPlanFilter, @Args('page') page?: IPageSelection) {
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
			order: { createdAt: 'DESC' }
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
}
