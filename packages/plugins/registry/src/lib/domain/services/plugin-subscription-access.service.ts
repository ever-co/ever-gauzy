import { ID, IPluginAccess, IUser } from '@gauzy/contracts';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import {
	IPluginSubscription,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '../../shared/models/plugin-subscription.model';
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
 * Strategy interface for finding subscriptions at different scopes
 * Enhanced with domain-driven design principles
 */
interface ISubscriptionFinderStrategy {
	readonly scope: PluginScope;
	findSubscription(context: ISubscriptionFindContext): Promise<IPluginSubscription | null>;
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
 */
class PluginEnabledSpecification implements IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean {
		return context.pluginTenant?.isAvailable() || false;
	}

	getFailureReason(): string {
		return 'Plugin is not enabled for this tenant';
	}
}

/**
 * Plugin approval specification - checks if plugin is approved when required
 */
class PluginApprovalSpecification implements IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean {
		if (!context.pluginTenant) return false;

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
 * Subscription validity specification - uses entity domain logic
 */
class SubscriptionValiditySpecification implements IAccessSpecification {
	isSatisfiedBy(context: IAccessValidationContext): boolean {
		if (!context.subscription) return false;

		// Use static domain method from PluginSubscription entity
		return context.subscription.isSubscriptionActive;
	}

	getFailureReason(): string {
		return 'Subscription is not active or has expired';
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
 * Enhanced subscription finder for user scope using entity methods
 */
class UserSubscriptionFinder implements ISubscriptionFinderStrategy {
	readonly scope = PluginScope.USER;

	constructor(private readonly subscriptionService: PluginSubscriptionService) {}

	async findSubscription(context: ISubscriptionFindContext): Promise<IPluginSubscription | null> {
		if (!context.userId) return null;

		try {
			const whereOptions: any = {
				pluginId: context.pluginId,
				tenantId: context.tenantId,
				subscriberId: context.userId,
				scope: PluginScope.USER
			};

			if (context.activeOnly !== false) {
				whereOptions.status = PluginSubscriptionStatus.ACTIVE;
			}

			return await this.subscriptionService.findOneByWhereOptions(whereOptions);
		} catch {
			return null;
		}
	}
}

/**
 * Enhanced organization subscription finder using entity methods
 */
class OrganizationSubscriptionFinder implements ISubscriptionFinderStrategy {
	readonly scope = PluginScope.ORGANIZATION;

	constructor(private readonly subscriptionService: PluginSubscriptionService) {}

	async findSubscription(context: ISubscriptionFindContext): Promise<IPluginSubscription | null> {
		if (!context.organizationId) return null;

		try {
			const whereOptions: any = {
				pluginId: context.pluginId,
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				scope: PluginScope.ORGANIZATION
			};

			if (context.activeOnly !== false) {
				whereOptions.status = PluginSubscriptionStatus.ACTIVE;
			}

			return await this.subscriptionService.findOneByWhereOptions(whereOptions);
		} catch {
			return null;
		}
	}
}

/**
 * Enhanced tenant subscription finder using entity methods
 */
class TenantSubscriptionFinder implements ISubscriptionFinderStrategy {
	readonly scope = PluginScope.TENANT;

	constructor(private readonly subscriptionService: PluginSubscriptionService) {}

	async findSubscription(context: ISubscriptionFindContext): Promise<IPluginSubscription | null> {
		try {
			const whereOptions: any = {
				pluginId: context.pluginId,
				tenantId: context.tenantId,
				scope: PluginScope.TENANT
			};

			if (context.activeOnly !== false) {
				whereOptions.status = PluginSubscriptionStatus.ACTIVE;
			}

			return await this.subscriptionService.findOneByWhereOptions(whereOptions);
		} catch {
			return null;
		}
	}
}

/**
 * Factory for creating subscription access contexts
 * Enhanced with domain logic from entities
 */
class SubscriptionAccessContextFactory {
	private readonly accessValidator = new AccessValidator();

	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginTenantService: PluginTenantService
	) {}

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
			canAssign: await this.determineAssignmentPermissions(pluginTenant, null, userId),
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
			canAssign: hasAccess
				? await this.determineAssignmentPermissions(pluginTenant, subscription, userId)
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
		pluginTenant: IPluginTenant | null,
		subscription: IPluginSubscription | null,
		userId?: ID
	): Promise<boolean> {
		if (!pluginTenant || !userId) return false;

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
			const isParentSubscription = !subscription.isInheritedSubscription();
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
 * Subscription finder registry using Registry pattern
 */
class SubscriptionFinderRegistry {
	private readonly finders = new Map<PluginScope, ISubscriptionFinderStrategy>();

	constructor(
		userFinder: ISubscriptionFinderStrategy,
		organizationFinder: ISubscriptionFinderStrategy,
		tenantFinder: ISubscriptionFinderStrategy
	) {
		this.finders.set(PluginScope.USER, userFinder);
		this.finders.set(PluginScope.ORGANIZATION, organizationFinder);
		this.finders.set(PluginScope.TENANT, tenantFinder);
	}

	/**
	 * Find subscriptions in priority order using Chain of Responsibility pattern
	 */
	async findApplicableSubscription(context: ISubscriptionFindContext): Promise<IPluginSubscription | null> {
		// Priority order: USER > ORGANIZATION > TENANT
		const priorityOrder = [PluginScope.USER, PluginScope.ORGANIZATION, PluginScope.TENANT];

		for (const scope of priorityOrder) {
			const finder = this.finders.get(scope);
			if (!finder) continue;

			const subscription = await finder.findSubscription(context);
			if (subscription && subscription.isSubscriptionActive) {
				return subscription;
			}
		}

		return null;
	}

	/**
	 * Find subscription by specific scope
	 */
	async findSubscriptionByScope(
		scope: PluginScope,
		context: ISubscriptionFindContext
	): Promise<IPluginSubscription | null> {
		const finder = this.finders.get(scope);
		return finder ? await finder.findSubscription(context) : null;
	}
}

/**
 * Domain service for plugin access management following SOLID principles
 *
 * SOLID Compliance:
 * - SRP: Single responsibility for plugin access validation
 * - OCP: Open for extension via strategies and specifications
 * - LSP: All strategies implement the same interface contract
 * - ISP: Interfaces are focused and specific to their purpose
 * - DIP: Depends on abstractions (interfaces) not concretions
 */
@Injectable()
export class PluginSubscriptionAccessService {
	private readonly subscriptionFinders: SubscriptionFinderRegistry;
	private readonly accessContextFactory: SubscriptionAccessContextFactory;

	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly pluginTenantService: PluginTenantService
	) {
		// Initialize strategy registry using Factory pattern
		this.subscriptionFinders = new SubscriptionFinderRegistry(
			new UserSubscriptionFinder(this.pluginSubscriptionService),
			new OrganizationSubscriptionFinder(this.pluginSubscriptionService),
			new TenantSubscriptionFinder(this.pluginSubscriptionService)
		);

		// Initialize context factory
		this.accessContextFactory = new SubscriptionAccessContextFactory(
			this.pluginSubscriptionService,
			this.pluginTenantService
		);
	}

	/**
	 * Validate if a user has access to a plugin based on their assignments
	 * Enhanced with entity domain logic
	 */
	async validatePluginUserAccess(pluginId: ID, userId?: ID): Promise<boolean> {
		if (!userId) return false;

		try {
			const context: ISubscriptionFindContext = {
				pluginId,
				tenantId: '', // Will be resolved from user context
				userId,
				activeOnly: true
			};

			// Use entity static method for validation
			const subscription = await this.subscriptionFinders.findSubscriptionByScope(PluginScope.USER, context);
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
			const context: ISubscriptionFindContext = {
				pluginId,
				tenantId,
				organizationId,
				userId,
				activeOnly: true
			};

			const subscription = await this.subscriptionFinders.findApplicableSubscription(context);
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
	 * Find the most specific applicable subscription for a user
	 * Enhanced with Chain of Responsibility pattern
	 */
	async findApplicableSubscription(
		pluginId: ID,
		tenantId: ID,
		organizationId?: ID,
		userId?: ID
	): Promise<IPluginSubscription | null> {
		const context: ISubscriptionFindContext = {
			pluginId,
			tenantId,
			organizationId,
			userId,
			activeOnly: true
		};

		return this.subscriptionFinders.findApplicableSubscription(context);
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
		return this.pluginSubscriptionPlanService.hasPlans(pluginId);
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
