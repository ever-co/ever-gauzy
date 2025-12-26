import {
	ID,
	PluginScope,
	IPluginSubscription as PluginSubscriptionModel,
	IPluginSubscriptionPlan as PluginSubscriptionPlanModel,
	PluginSubscriptionStatus
} from '@gauzy/contracts';

/**
 * Interface for plugin subscription plans
 */
export interface IPluginSubscriptionPlan extends PluginSubscriptionPlanModel {
	// ==========================================
	// COMPUTED PROPERTIES AND HELPER METHODS
	// ==========================================

	/**
	 * Check if the plan is free
	 */
	readonly isFree: boolean;

	/**
	 * Check if the plan offers a trial
	 */
	readonly hasTrial: boolean;

	/**
	 * Get the effective price (with discount applied)
	 */
	readonly effectivePrice: number;

	/**
	 * Get discount amount
	 */
	readonly discountAmount: number;

	/**
	 * Get total price including setup fee
	 */
	readonly totalPrice: number;

	/**
	 * Check if plan has any limitations
	 */
	readonly hasLimitations: boolean;

	/**
	 * Get formatted price string
	 */
	getFormattedPrice(): string;

	/**
	 * Get billing period display text
	 */
	getBillingPeriodText(): string;
}

/**
 * Interface for plugin subscriptions
 */
export interface IPluginSubscription extends PluginSubscriptionModel {
	/**
	 * Check if the subscription is currently active
	 */
	get isSubscriptionActive(): boolean;

	/**
	 * Check if the subscription is expired
	 */
	get isExpired(): boolean;

	/**
	 * Check if the subscription is in trial period
	 */
	get isInTrial(): boolean;

	/**
	 * Get days remaining until expiration
	 */
	get daysUntilExpiration(): number | null;

	/**
	 * Check if subscription is expiring soon (within 7 days by default)
	 */
	get isExpiringSoon(): boolean;

	/**
	 * Get next billing date from pending billings
	 * This is a computed property that looks at the billing records
	 */
	get nextBillingDate(): Date | null;

	/**
	 * Check if billing is due
	 * This checks if there are any pending billings that are due
	 */
	get isBillingDue(): boolean;

	// ==========================================
	// DOMAIN VALIDATION METHODS
	// ==========================================

	/**
	 * Validates if the subscription can be activated
	 */
	canBeActivated?(): boolean;

	/**
	 * Validates if the subscription can be suspended
	 */
	canBeSuspended?(): boolean;

	/**
	 * Validates if the subscription can be cancelled
	 */
	canBeCancelled?(): boolean;

	/**
	 * Validates if the subscription can be renewed
	 */
	canBeRenewed?(): boolean;

	/**
	 * Validates if the subscription can be upgraded
	 */
	canBeUpgraded?(): boolean;

	/**
	 * Validates if the subscription can be downgraded
	 */
	canBeDowngraded?(): boolean;

	/**
	 * Validates if trial can be extended
	 */
	canExtendTrial?(): boolean;

	/**
	 * Validates if child subscriptions can be created from this subscription
	 */
	canCreateChildSubscriptions?(): boolean;

	/**
	 * Validates if this is a valid parent subscription
	 */
	isValidParentSubscription?(): boolean;

	/**
	 * Validates assignment permissions based on scope
	 */
	hasAssignmentPermissions?(): boolean;

	// ==========================================
	// DOMAIN LIFECYCLE METHODS
	// ==========================================

	/**
	 * Activates the subscription
	 */
	activate?(): IPluginSubscription;

	/**
	 * Suspends the subscription
	 */
	suspend?(reason?: string): IPluginSubscription;

	/**
	 * Cancels the subscription
	 */
	cancel?(reason?: string): IPluginSubscription;

	/**
	 * Expires the subscription
	 */
	expire?(): IPluginSubscription;

	/**
	 * Renews the subscription with new end date
	 */
	renew?(newEndDate: Date): IPluginSubscription;

	/**
	 * Extends trial period
	 */
	extendTrial?(additionalDays: number, extendedBy?: string): IPluginSubscription;

	/**
	 * Upgrades subscription to new plan
	 */
	upgradeToPlan?(newPlanId: string): IPluginSubscription;

	/**
	 * Downgrades subscription to new plan
	 */
	downgradeToPlan?(newPlanId: string): IPluginSubscription;

	// ==========================================
	// DOMAIN PERMISSION METHODS
	// ==========================================

	/**
	 * Checks if this subscription grants access to a specific user
	 */
	grantsAccessToUser?(userId: string, organizationId?: string): boolean;

	/**
	 * Checks if this subscription allows creating child subscriptions
	 */
	allowsChildCreation?(): boolean;

	/**
	 * Checks if user can manage this subscription
	 */
	canBeManagedByUser?(userId: string, organizationId?: string): boolean;

	/**
	 * Checks if subscription is inherited (child subscription)
	 */
	isInherited?(): boolean;

	/**
	 * Checks if this subscription can assign access to other users
	 */
	canAssignToUsers?(): boolean;

	/**
	 * Gets the effective scope for permission checking
	 */
	getEffectiveScope?(): PluginScope;

	/**
	 * Checks if subscription grants elevated permissions
	 */
	hasElevatedPermissions?(): boolean;

	// ==========================================
	// DOMAIN CALCULATION METHODS
	// ==========================================

	/**
	 * Calculates the next billing date based on billing period
	 */
	calculateNextBillingDate?(billingPeriod: string): Date;

	/**
	 * Calculates remaining subscription time in days
	 */
	calculateRemainingDays?(): number;

	/**
	 * Calculates prorated amount for upgrades/downgrades
	 */
	calculateProratedAmount?(oldPrice: number, newPrice: number): number;

	/**
	 * Calculates usage percentage of current subscription period
	 */
	calculateUsagePercentage?(): number;

	/**
	 * Calculates credit amount for downgrade or cancellation
	 */
	calculateCreditAmount?(pricePerPeriod: number): number;

	/**
	 * Determines if subscription qualifies for refund
	 */
	qualifiesForRefund?(refundPolicyDays?: number): boolean;

	/**
	 * Calculates renewal price with potential discounts
	 */
	calculateRenewalPrice?(basePrice: number, loyaltyDiscountPercentage?: number): number;

	// ==========================================
	// DOMAIN SPECIFICATION METHODS
	// ==========================================

	/**
	 * Specification to check if subscription is active and accessible
	 */
	isActiveAndAccessible?(): boolean;

	/**
	 * Specification to check if subscription is eligible for upgrade
	 */
	isEligibleForUpgrade?(planId?: string): boolean;

	/**
	 * Specification to check if subscription is eligible for downgrade
	 */
	isEligibleForDowngrade?(planId?: string): boolean;
}

/**
 * Static methods interface for PluginSubscription factory and specification methods
 */
export interface IPluginSubscriptionStatics {
	/**
	 * Creates a free subscription for immediate access
	 */
	createFreeSubscription(
		pluginId: string,
		pluginTenantId: string,
		tenantId: string,
		subscriberId?: string,
		organizationId?: string
	): IPluginSubscription;

	/**
	 * Creates a trial subscription
	 */
	createTrialSubscription(
		pluginId: string,
		pluginTenantId: string,
		tenantId: string,
		planId: string,
		trialDays: number,
		scope: PluginScope,
		subscriberId?: string,
		organizationId?: string
	): IPluginSubscription;

	/**
	 * Creates a paid subscription
	 */
	createPaidSubscription(
		pluginId: string,
		pluginTenantId: string,
		tenantId: string,
		planId: string,
		scope: PluginScope,
		endDate: Date,
		subscriberId?: string,
		organizationId?: string,
		paymentMethod?: string
	): IPluginSubscription;

	/**
	 * Creates a child subscription from a parent subscription
	 */
	createChildSubscription(parentSubscription: IPluginSubscription, subscriberId: string): IPluginSubscription;

	/**
	 * Specification to check if subscription is active and accessible
	 */
	isActiveAndAccessible(subscription: IPluginSubscription): boolean;

	/**
	 * Specification to check if subscription is expiring soon
	 */
	isExpiringSoon(subscription: IPluginSubscription, warningDays?: number): boolean;

	/**
	 * Specification to check if subscription requires payment attention
	 */
	requiresPaymentAttention(subscription: IPluginSubscription): boolean;

	/**
	 * Specification to check if subscription is eligible for renewal
	 */
	isEligibleForRenewal(subscription: IPluginSubscription): boolean;

	/**
	 * Specification to check if subscription can manage users
	 */
	canManageUsers(subscription: IPluginSubscription): boolean;

	/**
	 * Specification to check if subscription is a billable subscription
	 */
	isBillable(subscription: IPluginSubscription): boolean;

	/**
	 * Specification to check if subscription grants premium features
	 */
	grantsPremiumFeatures(subscription: IPluginSubscription): boolean;

	/**
	 * Specification to check if subscription is inherited from parent
	 */
	isInherited(subscription: IPluginSubscription): boolean;

	/**
	 * Specification to check if subscription needs billing attention
	 */
	needsBillingAttention(subscription: IPluginSubscription): boolean;
}

/**
 * Interface for creating plugin subscriptions
 */
export interface IPluginSubscriptionCreateInput {
	// Core subscription details
	status: PluginSubscriptionStatus;
	scope: PluginScope;
	startDate: Date;
	endDate?: Date;
	trialEndDate?: Date;
	autoRenew: boolean;

	// Cancellation details
	cancelledAt?: Date;
	cancellationReason?: string;

	// Metadata
	metadata?: Record<string, any>;

	// External subscription ID
	externalSubscriptionId?: string;

	// Relationships
	pluginId: ID;
	pluginTenantId: ID;
	subscriberId?: ID;
	planId?: ID;

	// Parent-child subscription hierarchy
	parentId?: ID;

	// Base entity fields
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * Interface for updating plugin subscriptions
 */
export interface IPluginSubscriptionUpdateInput
	extends Partial<Omit<IPluginSubscriptionCreateInput, 'pluginId' | 'pluginTenantId' | 'billings'>> {}

/**
 * Interface for finding plugin subscriptions
 */
export interface IPluginSubscriptionFindInput
	extends Partial<Pick<IPluginSubscription, 'status' | 'scope' | 'pluginId' | 'pluginTenantId' | 'subscriberId'>> {}

/**
 * Interface for subscription purchase request
 */
export interface IPluginSubscriptionPurchaseInput {
	pluginId: ID;
	planId?: ID;
	scope: PluginScope;
	autoRenew: boolean;
	paymentMethod?: string;
	promoCode?: string;
	metadata?: Record<string, any>;
}

/**
 * Interface for creating plugin subscription plans
 */
export interface IPluginSubscriptionPlanCreateInput
	extends Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'plugin' | 'createdBy' | 'subscriptions'> {
	pluginId: ID;
	createdById?: ID;
}

/**
 * Interface for updating plugin subscription plans
 */
export interface IPluginSubscriptionPlanUpdateInput
	extends Partial<Omit<IPluginSubscriptionPlanCreateInput, 'pluginId'>> {}

/**
 * Interface for finding plugin subscription plans
 */
export interface IPluginSubscriptionPlanFindInput
	extends Partial<
		Pick<
			IPluginSubscriptionPlan,
			'type' | 'isActive' | 'pluginId' | 'isPopular' | 'isRecommended' | 'billingPeriod'
		>
	> {}
