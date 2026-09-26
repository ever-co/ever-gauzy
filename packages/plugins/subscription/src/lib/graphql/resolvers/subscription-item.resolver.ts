import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { SubscriptionFeatures } from '../../subscription.features';
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
 *
 * **The plugin's own gate stands beside it.** The class also declares `SubscriptionFeatures.SUBSCRIPTION`
 * (`FEATURE_SUBSCRIPTION`), the code every subscription REST controller declares with `@FeatureFlag`, so a
 * tenant that switched subscription off is refused here exactly as its routes refuse it — rather than
 * finding every write the routes withhold still served over GraphQL. The two codes are two questions, both
 * of which must be answered yes: the endpoint is on, and the capability is on. The platform's decorator
 * accumulates the codes stated on one target and `FeatureFlagGuard` requires every one of them.
 */
@Resolver('SubscriptionItem')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(SubscriptionFeatures.SUBSCRIPTION)
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
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of lines.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_VIEW)
	@Query('subscriptionItems')
	async subscriptionItems(
		@Args('filter') filter?: ISubscriptionItemFilter,
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
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
			order: { position: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
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

	/**
	 * Retires a recurring line recoverably.
	 *
	 * The route it mirrors is `DELETE /subscription-items/:id/soft`, inherited from `CrudController` and
	 * overridden by this plugin's controller only to state a permission, because the inherited route
	 * declares none and `PermissionGuard` (`shared/guards/permission.guard.ts`) answers `true` from its
	 * `isEmpty` branch to that omission. The field states the route's own `SUBSCRIPTIONS_EDIT` — a line
	 * taken out of what the next cycle bills is a change to what the customer is charged, which the
	 * class-level view grant must not carry.
	 *
	 * It answers the line rather than an id, unlike its `deleteSubscriptionItem` sibling, because the
	 * inherited route reaches a different service method: `softRemove` returns the retired row, while
	 * `softDelete` — which the delete field reaches — returns nothing to answer with.
	 *
	 * @param id The line to retire.
	 * @returns The payload, with the retired line or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('softDeleteSubscriptionItem')
	async softDeleteSubscriptionItem(@Args('id') id: ID) {
		try {
			return { subscriptionItem: await this.subscriptionItemService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { subscriptionItem: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a soft-deleted recurring line.
	 *
	 * The route it mirrors is `PUT /subscription-items/:id/recover`, whose override states the same
	 * `SUBSCRIPTIONS_EDIT` the soft delete states. A restored line is one the next cycle bills again, so
	 * the field is the only way a client working over GraphQL can finish the lifecycle its own delete
	 * began — over REST it could, which is the disagreement this closes.
	 *
	 * @param id The line to restore.
	 * @returns The payload, with the restored line or the reason it was refused.
	 */
	@Permissions(SubscriptionPermissions.SUBSCRIPTIONS_EDIT)
	@Mutation('recoverSubscriptionItem')
	async recoverSubscriptionItem(@Args('id') id: ID) {
		try {
			return { subscriptionItem: await this.subscriptionItemService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { subscriptionItem: null, userErrors: [toUserError(error)] };
		}
	}
}
