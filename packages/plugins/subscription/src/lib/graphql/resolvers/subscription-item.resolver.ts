import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { SubscriptionPermissions } from '../../subscription.permissions';
import { SubscriptionItem } from '../../subscription-item/subscription-item.entity';
import { SubscriptionItemService } from '../../subscription-item/subscription-item.service';
import { SubscriptionService } from '../../subscription/subscription.service';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The item filter, as the schema declares it. */
interface ISubscriptionItemFilter {
	subscriptionId?: ID;
	variantId?: ID;
}

/**
 * Recurring lines over GraphQL.
 *
 * The same service the REST controller calls, with the same rule about which surface owns what: a
 * correction that has no price consequence belongs here, and a change that has one belongs to the
 * subscription's own fields, which settle the remainder of the period.
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
@Resolver('SubscriptionItem')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
export class SubscriptionItemResolver {
	constructor(
		private readonly subscriptionItemService: SubscriptionItemService,
		private readonly subscriptionService: SubscriptionService
	) {}

	/**
	 * Lists recurring lines.
	 *
	 * @param filter The item filter.
	 * @param page The page.
	 * @returns One page of lines.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionItems')
	async subscriptionItems(@Args('filter') filter?: ISubscriptionItemFilter, @Args('page') page?: IPageSelection) {
		const { skip, take } = resolvePageWindow(page);
		const where: FindOptionsWhere<SubscriptionItem> = {};

		if (filter?.subscriptionId) {
			where.subscriptionId = filter.subscriptionId;
		}

		if (filter?.variantId) {
			where.variantId = filter.variantId;
		}

		const result = await this.subscriptionItemService.findAll({
			where,
			skip,
			take,
			order: { position: 'ASC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one recurring line.
	 *
	 * @param id The line.
	 * @returns The line, or null when it is not the caller's.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionItem')
	async subscriptionItem(@Args('id') id: ID): Promise<SubscriptionItem | null> {
		try {
			return await this.subscriptionItemService.findOneScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Adds a recurring line without settling a proration.
	 *
	 * @param input The line.
	 * @returns The payload, with the line or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('createSubscriptionItem')
	async createSubscriptionItem(
		@Args('input') input: { subscriptionId: ID; variantId: ID; quantity?: string; unitPrice?: string; position?: number }
	) {
		try {
			const subscription = await this.subscriptionService.findOneScoped(input.subscriptionId);
			const subscriptionItem = await this.subscriptionItemService.addItem(
				input.subscriptionId,
				input as any,
				subscription.currency,
				subscription.customerId
			);

			return { subscriptionItem, userErrors: [] };
		} catch (error) {
			return { subscriptionItem: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Corrects a recurring line's quantity or price.
	 *
	 * @param id The line.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('updateSubscriptionItem')
	async updateSubscriptionItem(
		@Args('id') id: ID,
		@Args('input') input: { quantity?: string; unitPrice?: string; position?: number; metadata?: Record<string, unknown> }
	) {
		try {
			await this.subscriptionItemService.update(id, input as any);

			return { subscriptionItem: await this.subscriptionItemService.findOneScoped(id), userErrors: [] };
		} catch (error) {
			return { subscriptionItem: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Removes a recurring line, preserving the row as history.
	 *
	 * @param id The line.
	 * @returns The payload, carrying the removed line's id.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('deleteSubscriptionItem')
	async deleteSubscriptionItem(@Args('id') id: ID) {
		try {
			await this.subscriptionItemService.softDelete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}
}
