import { ID } from '@gauzy/contracts';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import {
	IPluginSubscription,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '../../shared/models/plugin-subscription.model';
import { PluginSubscriptionPlanService } from './plugin-subscription-plan.service';
import { PluginSubscriptionService } from './plugin-subscription.service';

/**
 * Centralized service for handling plugin subscription access validation and scope management.
 * Follows Single Responsibility Principle (SRP) by focusing only on access control logic.
 * Follows Open/Closed Principle (OCP) by allowing extension through methods without modifying core logic.
 */
@Injectable()
export class PluginSubscriptionAccessService {
	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService
	) {}

	/**
	 * Validate if a user has access to a plugin based on their subscriptions.
	 * Checks subscriptions at user, organization, and tenant levels.
	 *
	 * @param pluginId - The plugin ID to check access for
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @param userId - Optional user ID
	 * @returns Promise<boolean> indicating if the user has access
	 */
	async validatePluginAccess(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<boolean> {
		// Check if plugin has any subscription plans
		const hasPlans = await this.pluginSubscriptionPlanService.hasPlans(pluginId);

		// If plugin has no plans, it's free for all users
		if (!hasPlans) {
			return true;
		}

		// Check for active subscriptions in order of specificity: user -> organization -> tenant
		const subscription = await this.findApplicableSubscription(pluginId, tenantId, organizationId, userId);

		return !!subscription && this.isSubscriptionValid(subscription);
	}

	/**
	 * Validate if a user can access a plugin, throwing an exception if not.
	 *
	 * @param pluginId - The plugin ID to check access for
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @param userId - Optional user ID
	 * @throws ForbiddenException if user does not have access
	 */
	async requirePluginAccess(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<void> {
		const hasAccess = await this.validatePluginAccess(pluginId, tenantId, organizationId, userId);

		if (!hasAccess) {
			throw new ForbiddenException(
				'You do not have an active subscription to access this plugin. Please purchase a subscription.'
			);
		}
	}

	/**
	 * Find the most specific applicable subscription for a user.
	 * Priority: USER scope > ORGANIZATION scope > TENANT scope
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @param userId - Optional user ID
	 * @returns The most applicable subscription or null
	 */
	async findApplicableSubscription(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<IPluginSubscription | null> {
		// 1. Check for user-level subscription (highest priority)
		if (userId) {
			const userSubscription = await this.pluginSubscriptionService.findActiveSubscription(
				pluginId,
				tenantId,
				organizationId,
				userId
			);
			if (userSubscription && this.isSubscriptionValid(userSubscription)) {
				return userSubscription;
			}
		}

		// 2. Check for organization-level subscription
		if (organizationId) {
			const orgSubscription = await this.findOrganizationSubscription(pluginId, tenantId, organizationId);
			if (orgSubscription && this.isSubscriptionValid(orgSubscription)) {
				return orgSubscription;
			}
		}

		// 3. Check for tenant-level subscription (lowest priority)
		const tenantSubscription = await this.findTenantSubscription(pluginId, tenantId);
		if (tenantSubscription && this.isSubscriptionValid(tenantSubscription)) {
			return tenantSubscription;
		}

		return null;
	}

	/**
	 * Check if a user can assign plugin subscriptions to other users.
	 * User must have an organization or tenant-level subscription.
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @param userId - The user ID attempting to assign
	 * @returns Promise<boolean> indicating if user can assign subscriptions
	 */
	async canAssignSubscriptions(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<boolean> {
		// Find the subscription owned by the organization or tenant
		const subscription = await this.findApplicableSubscription(pluginId, tenantId, organizationId);

		if (!subscription || !this.isSubscriptionValid(subscription)) {
			return false;
		}

		// Can only assign if subscription is at ORGANIZATION or TENANT scope
		return subscription.scope === PluginScope.ORGANIZATION || subscription.scope === PluginScope.TENANT;
	}

	/**
	 * Validate if a user can assign plugin subscriptions, throwing an exception if not.
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @param userId - The user ID attempting to assign
	 * @throws ForbiddenException if user cannot assign subscriptions
	 */
	async requireAssignmentPermission(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<void> {
		const canAssign = await this.canAssignSubscriptions(pluginId, tenantId, organizationId, userId);

		if (!canAssign) {
			throw new ForbiddenException(
				'You do not have permission to assign this plugin to other users. An active organization or tenant-level subscription is required.'
			);
		}
	}

	/**
	 * Determine the appropriate subscription scope based on subscription type and plan.
	 * Free plans automatically use USER scope for immediate access.
	 * Paid plans respect the requested scope.
	 *
	 * @param subscriptionType - The subscription type
	 * @param requestedScope - The requested scope from purchase
	 * @returns The determined subscription scope
	 */
	determineSubscriptionScope(subscriptionType: PluginSubscriptionType, requestedScope: PluginScope): PluginScope {
		// Free plans always use USER scope for immediate individual access
		if (subscriptionType === PluginSubscriptionType.FREE) {
			return PluginScope.USER;
		}

		// Paid plans respect the requested scope
		return requestedScope;
	}

	/**
	 * Determine the initial subscription status based on subscription type.
	 * Free plans are immediately ACTIVE.
	 * Paid plans start as PENDING until payment is confirmed.
	 *
	 * @param subscriptionType - The subscription type
	 * @returns The initial subscription status
	 */
	determineInitialStatus(subscriptionType: PluginSubscriptionType): PluginSubscriptionStatus {
		// Free plans are immediately active
		if (subscriptionType === PluginSubscriptionType.FREE) {
			return PluginSubscriptionStatus.ACTIVE;
		}

		// Trial plans start as TRIAL
		if (subscriptionType === PluginSubscriptionType.TRIAL) {
			return PluginSubscriptionStatus.TRIAL;
		}

		// Paid plans start as PENDING until payment confirmation
		return PluginSubscriptionStatus.PENDING;
	}

	/**
	 * Check if plugin requires a subscription (has paid plans).
	 *
	 * @param pluginId - The plugin ID
	 * @returns Promise<boolean> indicating if plugin requires subscription
	 */
	async requiresSubscription(pluginId: ID): Promise<boolean> {
		return await this.pluginSubscriptionPlanService.hasPlans(pluginId);
	}

	/**
	 * Get subscription details for a plugin and user.
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @param userId - Optional user ID
	 * @returns Subscription details including access level and subscription info
	 */
	async getSubscriptionDetails(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<{
		hasAccess: boolean;
		subscription: IPluginSubscription | null;
		accessLevel: PluginScope | null;
		canAssign: boolean;
		requiresSubscription: boolean;
	}> {
		const requiresSub = await this.requiresSubscription(pluginId);
		const subscription = requiresSub
			? await this.findApplicableSubscription(pluginId, tenantId, organizationId, userId)
			: null;
		const hasAccess = requiresSub ? !!subscription && this.isSubscriptionValid(subscription) : true;
		const canAssign = requiresSub
			? await this.canAssignSubscriptions(pluginId, tenantId, organizationId, userId)
			: false;

		return {
			hasAccess,
			subscription,
			accessLevel: subscription?.scope || null,
			canAssign,
			requiresSubscription: requiresSub
		};
	}

	/**
	 * Check if a subscription is currently valid and active.
	 * Private helper method for internal validation logic.
	 *
	 * @param subscription - The subscription to validate
	 * @returns boolean indicating if subscription is valid
	 */
	private isSubscriptionValid(subscription: IPluginSubscription): boolean {
		// Check if subscription is in a valid status
		const validStatuses = [PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL];
		if (!validStatuses.includes(subscription.status)) {
			return false;
		}

		// Check if subscription has expired
		if (subscription.endDate && subscription.endDate <= new Date()) {
			return false;
		}

		// Check if trial has expired
		if (
			subscription.status === PluginSubscriptionStatus.TRIAL &&
			subscription.trialEndDate &&
			subscription.trialEndDate <= new Date()
		) {
			return false;
		}

		return true;
	}

	/**
	 * Find organization-level subscription (excludes user-level subscriptions).
	 * Private helper method.
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID
	 * @returns Organization subscription or null
	 */
	private async findOrganizationSubscription(
		pluginId: ID,
		tenantId: ID,
		organizationId: ID
	): Promise<IPluginSubscription | null> {
		try {
			return await this.pluginSubscriptionService.findOneByWhereOptions({
				pluginId,
				tenantId,
				organizationId,
				scope: PluginScope.ORGANIZATION,
				status: PluginSubscriptionStatus.ACTIVE
			});
		} catch {
			return null;
		}
	}

	/**
	 * Find tenant-level subscription (excludes org and user-level subscriptions).
	 * Private helper method.
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @returns Tenant subscription or null
	 */
	private async findTenantSubscription(pluginId: ID, tenantId: ID): Promise<IPluginSubscription | null> {
		try {
			return await this.pluginSubscriptionService.findOneByWhereOptions({
				pluginId,
				tenantId,
				scope: PluginScope.TENANT,
				status: PluginSubscriptionStatus.ACTIVE
			});
		} catch {
			return null;
		}
	}
}
