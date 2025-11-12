import { ID, IPluginAccess } from '@gauzy/contracts';
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
 * Strategy interface for finding subscriptions at different scopes
 */
interface ISubscriptionFinderStrategy {
	findSubscription(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<IPluginSubscription | null>;
}

/**
 * Access context interface for subscription access details
 */
interface ISubscriptionAccessContext {
	hasAccess: boolean;
	subscription: IPluginSubscription | null;
	accessLevel: PluginScope | null;
	canAssign: boolean;
	canActivate: boolean;
	requiresSubscription: boolean;
}

/**
 * Factory for creating subscription access contexts
 */
class SubscriptionAccessContextFactory {
	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService
	) {}

	/**
	 * Creates access context for free plugins (no subscription required)
	 */
	async createFreeAccessContext(pluginId: ID, userId?: ID): Promise<ISubscriptionAccessContext> {
		const canActivate = await this.validateUserAssignment(pluginId, userId);
		return {
			hasAccess: true,
			subscription: null,
			accessLevel: null,
			canAssign: false,
			canActivate,
			requiresSubscription: false
		};
	}

	/**
	 * Creates access context for paid plugins with subscription
	 */
	async createPaidAccessContext(
		subscription: IPluginSubscription | null,
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<ISubscriptionAccessContext> {
		const isValidSubscription = subscription
			? (this.pluginSubscriptionService as any).isSubscriptionActive(subscription)
			: false;

		const hasAccess = isValidSubscription;
		const accessLevel = subscription?.scope || null;

		// Calculate assignment permissions
		const canAssign = hasAccess
			? await this.canAssignSubscriptions(subscription, pluginId, tenantId, organizationId, userId)
			: false;

		// Calculate activation permissions
		const hasUserAssignment = await this.validateUserAssignment(pluginId, userId);
		const ownsSubscription = subscription ? !subscription.parent : false;
		const canActivate = (hasUserAssignment || ownsSubscription) && hasAccess;

		return {
			hasAccess,
			subscription,
			accessLevel,
			canAssign,
			canActivate,
			requiresSubscription: true
		};
	}

	/**
	 * Validate if user has assignment access to the plugin
	 */
	private async validateUserAssignment(pluginId: ID, userId?: ID): Promise<boolean> {
		if (!userId) return false;
		const subscription = await this.pluginSubscriptionService.findActiveSubscription(pluginId, userId);
		return !!subscription;
	}

	/**
	 * Check if user can assign subscriptions based on subscription scope
	 */
	public async canAssignSubscriptions(
		subscription: IPluginSubscription | null,
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<boolean> {
		if (!subscription) return false;

		// Can only assign if subscription is at ORGANIZATION or TENANT scope
		return subscription.scope === PluginScope.ORGANIZATION || subscription.scope === PluginScope.TENANT;
	}
}

/**
 * Strategy for finding user-level subscriptions
 */
class UserSubscriptionFinder implements ISubscriptionFinderStrategy {
	constructor(private readonly subscriptionService: PluginSubscriptionService) {}

	async findSubscription(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<IPluginSubscription | null> {
		if (!userId) return null;

		return this.subscriptionService.findActiveSubscription(pluginId, tenantId, organizationId, userId);
	}
}

/**
 * Strategy for finding organization-level subscriptions
 */
class OrganizationSubscriptionFinder implements ISubscriptionFinderStrategy {
	constructor(private readonly subscriptionService: PluginSubscriptionService) {}

	async findSubscription(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<IPluginSubscription | null> {
		if (!organizationId) return null;

		// Use the existing hasPluginAccess method to find organization subscriptions
		const hasAccess = await this.subscriptionService.hasPluginAccess(pluginId, tenantId, organizationId);

		if (hasAccess) {
			// Find the actual subscription with organization scope
			try {
				const subscription = await this.subscriptionService.findOneByWhereOptions({
					pluginId,
					tenantId,
					organizationId,
					scope: PluginScope.ORGANIZATION,
					status: PluginSubscriptionStatus.ACTIVE
				});
				return subscription;
			} catch {
				return null;
			}
		}

		return null;
	}
}

/**
 * Strategy for finding tenant-level subscriptions
 */
class TenantSubscriptionFinder implements ISubscriptionFinderStrategy {
	constructor(private readonly subscriptionService: PluginSubscriptionService) {}

	async findSubscription(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<IPluginSubscription | null> {
		// Use the existing hasPluginAccess method to find tenant subscriptions
		const hasAccess = await this.subscriptionService.hasPluginAccess(pluginId, tenantId);

		if (hasAccess) {
			// Find the actual subscription with tenant scope
			try {
				const subscription = await this.subscriptionService.findOneByWhereOptions({
					pluginId,
					tenantId,
					scope: PluginScope.TENANT,
					status: PluginSubscriptionStatus.ACTIVE
				});
				return subscription;
			} catch {
				return null;
			}
		}

		return null;
	}
}

/**
 * Centralized service for handling plugin subscription access validation and scope management.
 * Follows Single Responsibility Principle (SRP) by focusing only on access control logic.
 * Follows Open/Closed Principle (OCP) by allowing extension through methods without modifying core logic.
 * Uses Strategy pattern for subscription finding to eliminate code duplication.
 * Uses Factory pattern for access context creation.
 */
@Injectable()
export class PluginSubscriptionAccessService {
	private readonly userFinder: ISubscriptionFinderStrategy;
	private readonly organizationFinder: ISubscriptionFinderStrategy;
	private readonly tenantFinder: ISubscriptionFinderStrategy;
	private readonly accessContextFactory: SubscriptionAccessContextFactory;

	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService
	) {
		// Initialize strategy instances
		this.userFinder = new UserSubscriptionFinder(this.pluginSubscriptionService);
		this.organizationFinder = new OrganizationSubscriptionFinder(this.pluginSubscriptionService);
		this.tenantFinder = new TenantSubscriptionFinder(this.pluginSubscriptionService);

		// Initialize factory
		this.accessContextFactory = new SubscriptionAccessContextFactory(
			this.pluginSubscriptionService,
			this.pluginSubscriptionPlanService
		);
	}

	/**
	 * Validate if a user has access to a plugin based on their assignments.
	 *
	 * @param pluginId - The plugin ID to check access for
	 * @param userId - The user ID
	 * @returns Promise<boolean> indicating if the user has access
	 */
	async validatePluginUserAccess(pluginId: ID, userId?: ID): Promise<boolean> {
		const subscription = await this.pluginSubscriptionService.findActiveSubscription(pluginId, userId);
		return !!subscription;
	}

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
	 * Uses Strategy pattern to eliminate code duplication.
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
		const userSubscription = await this.userFinder.findSubscription(pluginId, tenantId, organizationId, userId);
		if (userSubscription && this.isSubscriptionValid(userSubscription)) {
			return userSubscription;
		}

		// 2. Check for organization-level subscription
		const orgSubscription = await this.organizationFinder.findSubscription(
			pluginId,
			tenantId,
			organizationId,
			userId
		);
		if (orgSubscription && this.isSubscriptionValid(orgSubscription)) {
			return orgSubscription;
		}

		// 3. Check for tenant-level subscription (lowest priority)
		const tenantSubscription = await this.tenantFinder.findSubscription(pluginId, tenantId, organizationId, userId);
		if (tenantSubscription && this.isSubscriptionValid(tenantSubscription)) {
			return tenantSubscription;
		}

		return null;
	}

	/**
	 * Check if a user can assign plugin subscriptions to other users.
	 * Delegates to the access context factory for logic reuse.
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

		// Delegate to factory logic for consistency
		return this.accessContextFactory.canAssignSubscriptions(
			subscription,
			pluginId,
			tenantId,
			organizationId,
			userId
		);
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
	 * Delegates to PluginSubscriptionPlanService to avoid duplication.
	 *
	 * @param pluginId - The plugin ID
	 * @returns Promise<boolean> indicating if plugin requires subscription
	 */
	async requiresSubscription(pluginId: ID): Promise<boolean> {
		return this.pluginSubscriptionPlanService.hasPlans(pluginId);
	}

	/**
	 * Get subscription details for a plugin and user.
	 * Provides comprehensive access information using Factory pattern for context creation.
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
	): Promise<
		Omit<IPluginAccess, 'subscription' | 'accessLevel'> & {
			subscription: IPluginSubscription | null;
			accessLevel: PluginScope | null;
		}
	> {
		// Check if plugin requires a subscription (has paid plans)
		const requiresSubscription = await this.requiresSubscription(pluginId);

		// Use factory to create appropriate access context
		if (!requiresSubscription) {
			return this.accessContextFactory.createFreeAccessContext(pluginId, userId);
		}

		// Find applicable subscription for paid plugins
		const subscription = await this.findApplicableSubscription(pluginId, tenantId, organizationId, userId);

		return this.accessContextFactory.createPaidAccessContext(
			subscription,
			pluginId,
			tenantId,
			organizationId,
			userId
		);
	}

	/**
	 * Check if a subscription is currently valid and active.
	 * Delegates to PluginSubscriptionService to avoid code duplication.
	 *
	 * @param subscription - The subscription to validate
	 * @returns boolean indicating if subscription is valid
	 */
	private isSubscriptionValid(subscription: IPluginSubscription): boolean {
		// Delegate to the existing method in PluginSubscriptionService to avoid duplication
		return (this.pluginSubscriptionService as any).isSubscriptionActive(subscription);
	}
}
