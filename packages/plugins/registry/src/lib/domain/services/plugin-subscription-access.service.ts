import {
	ID,
	IPluginAccess,
	IUser,
	PluginScope,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '@gauzy/contracts';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import { PluginSubscriptionPlanService } from './plugin-subscription-plan.service';
import { PluginSubscriptionService } from './plugin-subscription.service';
import { PluginTenantService } from './plugin-tenant.service';

/**
 * Interface for access validation specifications following Specification pattern
 */
interface IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean;
	getFailureReason(): string;
}

/**
 * Context object for access validation
 */
interface IAccessValidationContext {
	pluginId: ID;
	tenantId: ID;
	organizationId?: ID;
	userId?: ID;
	user?: IUser;
	userRoles?: any[];
	pluginTenant?: IPluginTenant;
	subscription?: IPluginSubscription;
}

/**
 * Context for subscription finding operations
 */
interface ISubscriptionFindContext {
	pluginId: ID;
	tenantId: ID;
	organizationId?: ID;
	userId?: ID;
	activeOnly?: boolean;
}

/**
 * Enhanced access context interface with richer domain information
 */
interface ISubscriptionAccessContext {
	hasAccess: boolean;
	subscription: IPluginSubscription | null;
	pluginTenant: IPluginTenant | null;
	accessLevel: PluginScope | null;
	canAssign: boolean;
	canActivate: boolean;
	canManage: boolean;
	requiresSubscription: boolean;
	denialReasons: string[];
	quotaInfo?: IQuotaInformation;
}

/**
 * Quota information interface
 */
interface IQuotaInformation {
	installationUsage: number;
	installationLimit: number | null;
	userUsage: number;
	userLimit: number | null;
	quotaExceeded: boolean;
	installationUtilization: number;
	userUtilization: number;
}

/**
 * Plugin enabled specification - checks if plugin is enabled for tenant
 * Note: If no pluginTenant exists yet, we allow access (will be created on first use)
 */
class PluginEnabledSpecification implements IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean {
		// If no pluginTenant configuration exists, allow access (default behavior)
		if (!context.pluginTenant) return true;
		return context.pluginTenant.isAvailable();
	}

	getFailureReason(): string {
		return 'Plugin is not enabled for this tenant';
	}
}

/**
 * Plugin approval specification - checks if plugin is approved when required
 * Note: If no pluginTenant exists yet, we allow access (no approval required by default)
 */
class PluginApprovalSpecification implements IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean {
		// If no pluginTenant configuration exists, no approval is required
		if (!context.pluginTenant) return true;

		// If approval is not required, specification is satisfied
		if (!context.pluginTenant.needsApprovalForInstallation()) {
			return true;
		}

		// If approval is required, check if it's approved
		return context.pluginTenant.isApproved();
	}

	getFailureReason(): string {
		return 'Plugin requires approval and has not been approved yet';
	}
}

/**
 * User access specification - checks user-specific permissions
 */
class UserAccessSpecification implements IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean {
		if (!context.pluginTenant || !context.userId) return true;

		// Use the domain method from PluginTenant entity
		return context.pluginTenant.hasUserAccess(context.userId, context.userRoles || []);
	}

	getFailureReason(): string {
		return 'User is explicitly denied access or not in allowed list';
	}
}

/**
 * Quota availability specification - uses entity domain logic
 */
class QuotaAvailabilitySpecification implements IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean {
		if (!context.pluginTenant) return true;

		// Use domain methods from PluginTenant entity
		return (
			context.pluginTenant.canInstallMore() && (context.userId ? context.pluginTenant.canAddMoreUsers() : true)
		);
	}

	getFailureReason(): string {
		return 'Installation or user quota has been exceeded';
	}
}

/**
 * Composite access validator using Specification pattern
 */
class AccessValidator {
	private readonly specifications: IAccessSpecification[] = [
		new PluginEnabledSpecification(),
		new PluginApprovalSpecification(),
		new UserAccessSpecification(),
		new QuotaAvailabilitySpecification()
	];

	/**
	 * Validates all access specifications
	 */
	validate(context: IAccessValidationContext): { isValid: boolean; failureReasons: string[] } {
		const failureReasons: string[] = [];

		for (const spec of this.specifications) {
			if (!spec.isSatisfiedBy(context)) {
				failureReasons.push(spec.getFailureReason());
			}
		}

		return {
			isValid: failureReasons.length === 0,
			failureReasons
		};
	}
}

/**
 * Factory for creating subscription access contexts
 * Enhanced with domain logic from entities
 */
class SubscriptionAccessContextFactory {
	private readonly accessValidator = new AccessValidator();

	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Creates access context for free plugins using entity domain logic
	 */
	async createFreeAccessContext(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID,
		userRoles?: any[]
	): Promise<ISubscriptionAccessContext> {
		// Get or create plugin tenant configuration
		const pluginTenant = await this.getOrCreatePluginTenant(pluginId, tenantId, organizationId);

		const context: IAccessValidationContext = {
			pluginId,
			tenantId,
			organizationId,
			userId,
			userRoles,
			pluginTenant
		};

		const validation = this.accessValidator.validate(context);

		if (!validation.isValid) {
			return {
				hasAccess: false,
				subscription: null,
				pluginTenant,
				accessLevel: null,
				canAssign: false,
				canActivate: false,
				canManage: false,
				requiresSubscription: false,
				denialReasons: validation.failureReasons
			};
		}

		return {
			hasAccess: true,
			subscription: null,
			pluginTenant,
			accessLevel: pluginTenant?.scope || null,
			canAssign: pluginTenant ? await this.determineAssignmentPermissions(pluginTenant.id, null, userId) : false,
			canActivate: await this.determineActivationPermissions(pluginTenant, null, userId),
			canManage: await this.determineManagementPermissions(pluginTenant, null, userId),
			requiresSubscription: false,
			denialReasons: [],
			quotaInfo: this.calculateQuotaInfo(pluginTenant)
		};
	}

	/**
	 * Creates access context for paid plugins using entity domain logic
	 */
	async createPaidAccessContext(
		subscription: IPluginSubscription | null,
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID,
		userRoles?: any[]
	): Promise<ISubscriptionAccessContext> {
		const pluginTenant = await this.getOrCreatePluginTenant(pluginId, tenantId, organizationId);

		const context: IAccessValidationContext = {
			pluginId,
			tenantId,
			organizationId,
			userId,
			userRoles,
			pluginTenant,
			subscription
		};

		const validation = this.accessValidator.validate(context);
		const subscriptionValid = subscription ? subscription.isSubscriptionActive : false;

		// Additional subscription validity check
		if (subscription && !subscriptionValid) {
			validation.failureReasons.push('Subscription is not active or has expired');
		}

		const hasAccess = validation.isValid && subscriptionValid;
		const accessLevel = subscription?.scope || pluginTenant?.scope || null;

		return {
			hasAccess,
			subscription,
			pluginTenant,
			accessLevel,
			canAssign:
				hasAccess && pluginTenant
					? await this.determineAssignmentPermissions(pluginTenant.id, subscription, userId)
					: false,
			canActivate: hasAccess
				? await this.determineActivationPermissions(pluginTenant, subscription, userId)
				: false,
			canManage: hasAccess
				? await this.determineManagementPermissions(pluginTenant, subscription, userId)
				: false,
			requiresSubscription: true,
			denialReasons: validation.failureReasons,
			quotaInfo: this.calculateQuotaInfo(pluginTenant)
		};
	}

	/**
	 * Get or create plugin tenant using service
	 */
	private async getOrCreatePluginTenant(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID
	): Promise<IPluginTenant | null> {
		try {
			const existing = await this.pluginTenantService.findByPluginAndTenant(pluginId, tenantId, organizationId);

			if (existing) return existing;

			// Create with default settings if not found
			const pluginTenantId = await this.pluginTenantService.findOrCreate({ pluginId, tenantId, organizationId });
			return await this.pluginTenantService.findOneByIdString(pluginTenantId);
		} catch {
			return null;
		}
	}

	/**
	 * Determine assignment permissions using entity domain logic
	 */
	private async determineAssignmentPermissions(
		pluginTenantId: ID,
		subscription: IPluginSubscription | null,
		userId?: ID
	): Promise<boolean> {
		if (!pluginTenantId || !userId) return false;

		const { record: pluginTenant, success } = await this.pluginTenantService.findOneOrFailByIdString(
			pluginTenantId,
			{
				relations: ['allowedUsers', 'deniedUsers', 'allowedRoles']
			}
		);

		if (!success) return false;

		// Check if subscription allows assignment using entity method
		const subscriptionAllowsAssignment = subscription ? subscription.hasAssignmentPermissions() : false;

		// Check if plugin tenant scope allows assignment
		const tenantScopeAllowsAssignment =
			pluginTenant.scope === PluginScope.TENANT || pluginTenant.scope === PluginScope.ORGANIZATION;

		// User must have access to the plugin tenant
		const userHasAccess = pluginTenant.hasUserAccess(userId, []);

		return subscriptionAllowsAssignment && tenantScopeAllowsAssignment && userHasAccess;
	}

	/**
	 * Determine activation permissions using entity domain logic
	 */
	private async determineActivationPermissions(
		pluginTenant: IPluginTenant | null,
		subscription: IPluginSubscription | null,
		userId?: ID
	): Promise<boolean> {
		if (!userId) return false;

		// Check if subscription can be activated using entity method
		if (subscription) {
			const isDirectSubscriber = subscription.subscriberId === userId;
			const isParentSubscription = !subscription.isInherited();
			return (isDirectSubscriber || isParentSubscription) && subscription.isSubscriptionActive;
		}

		// For free plugins, check if user has access to plugin tenant
		return pluginTenant ? pluginTenant.hasUserAccess(userId, []) : false;
	}

	/**
	 * Determine management permissions using entity domain logic
	 */
	private async determineManagementPermissions(
		pluginTenant: IPluginTenant | null,
		subscription: IPluginSubscription | null,
		userId?: ID
	): Promise<boolean> {
		if (!userId) return false;

		// Check if user can manage subscription using entity method
		if (subscription) {
			return subscription.canBeManagedByUser(userId);
		}

		// For free plugins, check if user has administrative access
		return pluginTenant ? pluginTenant.hasUserAccess(userId, []) : false;
	}

	/**
	 * Calculate quota information using entity virtual properties
	 */
	private calculateQuotaInfo(pluginTenant: IPluginTenant | null): IQuotaInformation | undefined {
		if (!pluginTenant) return undefined;

		return {
			installationUsage: pluginTenant.currentInstallations || 0,
			installationLimit: pluginTenant.maxInstallations,
			userUsage: pluginTenant.currentActiveUsers || 0,
			userLimit: pluginTenant.maxActiveUsers,
			quotaExceeded: pluginTenant.isQuotaExceeded,
			installationUtilization: pluginTenant.installationUtilization,
			userUtilization: pluginTenant.userUtilization
		};
	}
}

/**
 * Domain service for plugin access management following SOLID principles
 *
 * SOLID Compliance:
 * - SRP: Single responsibility for plugin access validation
 * - OCP: Open for extension via strategies and specifications
 * - ISP: Interfaces are focused and specific to their purpose
 * - DIP: Depends on abstractions (interfaces) not concretions
 */
@Injectable()
export class PluginSubscriptionAccessService {
	private readonly accessContextFactory: SubscriptionAccessContextFactory;

	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginTenantService: PluginTenantService
	) {
		// Initialize context factory
		this.accessContextFactory = new SubscriptionAccessContextFactory(this.pluginTenantService);
	}

	/**
	 * Find subscription by context parameters
	 * Simplified finder that queries the subscription service directly without scope filtering
	 */
	private async findSubscriptionByContext(context: ISubscriptionFindContext): Promise<IPluginSubscription | null> {
		try {
			const whereOptions: FindOptionsWhere<IPluginSubscription> = {
				pluginId: context.pluginId,
				tenantId: context.tenantId
			};

			// Add optional filters if provided
			if (context.organizationId) {
				whereOptions.organizationId = context.organizationId;
			}

			if (context.userId) {
				whereOptions.subscriberId = context.userId;
			} else {
				// If no user ID is provided, we are looking for organization/tenant level subscriptions
				// We should exclude user-specific subscriptions (which have a subscriberId)
				// However, some org subscriptions might have a subscriberId (the purchaser), so we rely on scope
				whereOptions.scope = In([PluginScope.ORGANIZATION, PluginScope.TENANT]);
			}

			if (context.activeOnly !== false) {
				whereOptions.status = In([
					PluginSubscriptionStatus.ACTIVE,
					PluginSubscriptionStatus.TRIAL,
					PluginSubscriptionStatus.PENDING
				]);
			}

			const subscription = await this.pluginSubscriptionService.findOneOrFailByWhereOptions(whereOptions);
			return subscription.success ? subscription.record : null;
		} catch {
			return null;
		}
	}

	/**
	 * Validate if a user has access to a plugin based on their subscription
	 * This checks for subscriptions assigned to this specific user
	 * Note: For full access validation including org/tenant subscriptions, use validatePluginAccess()
	 */
	async validatePluginUserAccess(pluginId: ID, tenantId: ID, userId?: ID): Promise<boolean> {
		if (!userId || !tenantId) return false;

		try {
			const subscription = await this.findSubscriptionByContext({
				pluginId,
				tenantId,
				userId,
				activeOnly: true
			});

			return subscription ? subscription.grantsAccessToUser(userId) : false;
		} catch {
			return false;
		}
	}

	/**
	 * Validate if a user has access to a plugin based on their subscriptions
	 * Uses entity domain logic and specifications pattern
	 */
	async validatePluginAccess(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<boolean> {
		try {
			// Check if plugin requires subscription plans first
			const requiresSubscription = await this.requiresSubscription(pluginId);

			if (!requiresSubscription) {
				// For free plugins, validate through PluginTenant only
				const freeContext = await this.accessContextFactory.createFreeAccessContext(
					pluginId,
					tenantId,
					organizationId,
					userId
				);
				return freeContext.hasAccess;
			}

			// For paid plugins, validate subscription + plugin tenant access
			const subscription = await this.findSubscriptionByContext({
				pluginId,
				tenantId,
				organizationId,
				userId,
				activeOnly: true
			});

			const paidContext = await this.accessContextFactory.createPaidAccessContext(
				subscription,
				pluginId,
				tenantId,
				organizationId,
				userId
			);

			return paidContext.hasAccess;
		} catch (error) {
			// Log error and deny access for safety
			console.error('Error validating plugin access:', error);
			return false;
		}
	}

	/**
	 * Validate if a user can access a plugin, throwing an exception if not
	 * Enhanced error messaging using domain logic
	 */
	async requirePluginAccess(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<void> {
		const accessStatus = await this.getPluginAccessStatus(pluginId, tenantId, organizationId, userId);

		if (!accessStatus.hasAccess) {
			const reasons =
				accessStatus.denialReasons.length > 0 ? accessStatus.denialReasons.join('; ') : 'Access denied';

			throw new ForbiddenException(`Plugin access denied: ${reasons}`);
		}
	}

	/**
	 * Find the applicable subscription for a user
	 * Searches for a subscription matching the provided context parameters
	 */
	async findApplicableSubscription(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<IPluginSubscription | null> {
		return this.findSubscriptionByContext({
			pluginId,
			tenantId,
			organizationId,
			userId,
			activeOnly: true
		});
	}

	/**
	 * Check if a user can assign plugin subscriptions to other users
	 * Enhanced with entity domain logic
	 */
	async canAssignSubscriptions(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<boolean> {
		try {
			const subscription = await this.findApplicableSubscription(pluginId, tenantId, organizationId);

			if (!subscription) return false;

			// Use entity domain method for assignment validation
			return subscription.canAssignToUsers() && subscription.canBeManagedByUser(userId || '', organizationId);
		} catch {
			return false;
		}
	}

	/**
	 * Validate if a user can assign plugin subscriptions, throwing an exception if not
	 * Enhanced error messaging
	 */
	async requireAssignmentPermission(pluginId: ID, tenantId: ID, organizationId?: ID, userId?: ID): Promise<void> {
		const canAssign = await this.canAssignSubscriptions(pluginId, tenantId, organizationId, userId);

		if (!canAssign) {
			throw new ForbiddenException(
				'Assignment permission denied. You need an active organization or tenant-level subscription with assignment privileges.'
			);
		}
	}

	/**
	 * Determine the appropriate subscription scope based on subscription type and plan
	 * Enhanced with domain logic
	 */
	determineSubscriptionScope(subscriptionType: PluginSubscriptionType, requestedScope: PluginScope): PluginScope {
		// Use business rules for scope determination
		switch (subscriptionType) {
			case PluginSubscriptionType.FREE:
				return PluginScope.USER; // Free plugins always user scope
			case PluginSubscriptionType.TRIAL:
				// Trial respects requested scope but defaults to user
				return requestedScope || PluginScope.USER;
			default:
				// Paid plans respect the requested scope
				return requestedScope;
		}
	}

	/**
	 * Determine the initial subscription status based on subscription type
	 * Enhanced with business rules
	 */
	determineInitialStatus(subscriptionType: PluginSubscriptionType): PluginSubscriptionStatus {
		// Use business rules for status determination
		const statusMap = new Map([
			[PluginSubscriptionType.FREE, PluginSubscriptionStatus.ACTIVE],
			[PluginSubscriptionType.TRIAL, PluginSubscriptionStatus.TRIAL],
			[PluginSubscriptionType.BASIC, PluginSubscriptionStatus.PENDING],
			[PluginSubscriptionType.PREMIUM, PluginSubscriptionStatus.PENDING],
			[PluginSubscriptionType.ENTERPRISE, PluginSubscriptionStatus.PENDING]
		]);

		return statusMap.get(subscriptionType) || PluginSubscriptionStatus.PENDING;
	}

	/**
	 * Check if plugin requires a subscription (has paid plans)
	 * Delegates to plan service following DIP
	 */
	async requiresSubscription(pluginId: ID): Promise<boolean> {
		return this.pluginSubscriptionPlanService.isSubscriptionRequired(pluginId);
	}

	/**
	 * Get subscription details for a plugin and user
	 * Enhanced with comprehensive domain information
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
		const requiresSubscription = await this.requiresSubscription(pluginId);

		if (!requiresSubscription) {
			return this.accessContextFactory.createFreeAccessContext(pluginId, tenantId, organizationId, userId);
		}

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
	 * Get comprehensive plugin access status including PluginTenant controls
	 * Enhanced with rich domain information
	 */
	async getPluginAccessStatus(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<{
		hasAccess: boolean;
		subscription: IPluginSubscription | null;
		pluginTenant: IPluginTenant | null;
		accessLevel: PluginScope | null;
		canAssign: boolean;
		canActivate: boolean;
		canManage: boolean;
		requiresSubscription: boolean;
		denialReasons: string[];
		quotaInfo?: IQuotaInformation;
	}> {
		try {
			const requiresSubscription = await this.requiresSubscription(pluginId);

			if (!requiresSubscription) {
				return await this.accessContextFactory.createFreeAccessContext(
					pluginId,
					tenantId,
					organizationId,
					userId
				);
			}

			const subscription = await this.findApplicableSubscription(pluginId, tenantId, organizationId, userId);
			return await this.accessContextFactory.createPaidAccessContext(
				subscription,
				pluginId,
				tenantId,
				organizationId,
				userId
			);
		} catch (error) {
			// Return safe denial state on error
			return {
				hasAccess: false,
				subscription: null,
				pluginTenant: null,
				accessLevel: null,
				canAssign: false,
				canActivate: false,
				canManage: false,
				requiresSubscription: false,
				denialReasons: [`System error: ${error.message}`],
				quotaInfo: undefined
			};
		}
	}

	/**
	 * Check if user can install the plugin (considering quotas and permissions)
	 * Enhanced with entity domain logic
	 */
	async canUserInstallPlugin(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<{ canInstall: boolean; reason?: string }> {
		const accessStatus = await this.getPluginAccessStatus(pluginId, tenantId, organizationId, userId);

		if (!accessStatus.hasAccess) {
			return {
				canInstall: false,
				reason: accessStatus.denialReasons.join('; ') || 'Access denied'
			};
		}

		// Use entity domain logic for installation validation
		const pluginTenant = accessStatus.pluginTenant;

		if (pluginTenant) {
			// Check quota using entity method
			if (!pluginTenant.canInstallMore()) {
				return {
					canInstall: false,
					reason: 'Installation quota exceeded'
				};
			}

			// Check approval using entity method
			if (pluginTenant.needsApprovalForInstallation() && !pluginTenant.isApproved()) {
				return {
					canInstall: false,
					reason: 'Plugin installation requires approval'
				};
			}
		}

		return { canInstall: true };
	}

	/**
	 * Update plugin tenant usage counters
	 * Enhanced with entity domain methods and validation
	 */
	async updatePluginTenantUsage(
		pluginId: ID,
		tenantId: ID,
		action: 'install' | 'uninstall' | 'activate' | 'deactivate',
		organizationId?: ID
	): Promise<void> {
		try {
			const pluginTenant = await this.pluginTenantService.findByPluginAndTenant(
				pluginId,
				tenantId,
				organizationId
			);

			if (!pluginTenant) {
				throw new Error('Plugin tenant configuration not found');
			}

			// Use entity domain methods for safe counter updates
			switch (action) {
				case 'install':
					pluginTenant.incrementInstallations();
					break;
				case 'uninstall':
					pluginTenant.decrementInstallations();
					break;
				case 'activate':
					pluginTenant.incrementActiveUsers();
					break;
				case 'deactivate':
					pluginTenant.decrementActiveUsers();
					break;
			}

			// Save the updated entity
			await this.pluginTenantService.update(pluginTenant.id, {
				currentInstallations: pluginTenant.currentInstallations,
				currentActiveUsers: pluginTenant.currentActiveUsers
			});
		} catch (error) {
			console.error(`Failed to update plugin tenant usage for ${action}:`, error);
			// Don't throw error to avoid breaking the main flow
		}
	}
}
