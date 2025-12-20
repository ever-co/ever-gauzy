import { isMySQL, isPostgres } from '@gauzy/config';
import {
	IPluginSubscriptionPlan,
	IUser,
	PluginBillingStatus,
	PluginScope,
	PluginSubscriptionStatus
} from '@gauzy/contracts';
import {
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf
} from 'class-validator';
import { Index, JoinColumn, Relation, RelationId, Tree, TreeChildren, TreeParent } from 'typeorm';
import type { IPluginBilling } from '../../shared/models';
import type { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import type { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import type { IPlugin } from '../../shared/models/plugin.model';
import { PluginBilling } from './plugin-billing.entity';
import { PluginSubscriptionPlan } from './plugin-subscription-plan.entity';
import { PluginTenant } from './plugin-tenant.entity';
import { Plugin } from './plugin.entity';

@MultiORMEntity('plugin_subscriptions')
@Tree('closure-table')
@Index(['pluginId', 'tenantId', 'organizationId'], { unique: false })
@Index(['subscriberId', 'tenantId'], { unique: false })
@Index(['status', 'endDate'], { unique: false })
@Index(['status', 'tenantId'], { unique: false })
@Index(['pluginId', 'subscriberId', 'tenantId'], {
	unique: true,
	where: '"subscriberId" IS NOT NULL'
})
@Index(['planId'], { unique: false })
@Index(['externalSubscriptionId'], { unique: false })
@Index(['parentId'], { unique: false })
@Index(['scope', 'tenantId'], { unique: false })
export class PluginSubscription extends TenantOrganizationBaseEntity implements IPluginSubscription {
	@ApiProperty({ enum: PluginSubscriptionStatus, description: 'Subscription status' })
	@IsEnum(PluginSubscriptionStatus, { message: 'Invalid subscription status' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginSubscriptionStatus,
		default: PluginSubscriptionStatus.PENDING
	})
	status: PluginSubscriptionStatus;

	@ApiProperty({ enum: PluginScope, description: 'Subscription scope' })
	@IsEnum(PluginScope, { message: 'Invalid plugin scope' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginScope, default: PluginScope.TENANT })
	scope: PluginScope;

	@ApiProperty({ type: Date, description: 'Start date of subscription' })
	@IsDate({ message: 'Start date must be a valid date' })
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	startDate: Date;

	@ApiPropertyOptional({ type: Date, description: 'End date of subscription' })
	@IsOptional()
	@IsDate({ message: 'End date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiPropertyOptional({ type: Date, description: 'Trial end date' })
	@IsOptional()
	@IsDate({ message: 'Trial end date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	trialEndDate?: Date;

	@ApiProperty({ type: Boolean, description: 'Whether auto-renewal is enabled' })
	@IsBoolean({ message: 'autoRenew must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: true })
	autoRenew: boolean;

	@ApiPropertyOptional({ type: Date, description: 'Cancellation date' })
	@IsOptional()
	@IsDate({ message: 'Cancelled date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	cancelledAt?: Date;

	@ApiPropertyOptional({ type: String, description: 'Cancellation reason' })
	@IsOptional()
	@IsString({ message: 'Cancellation reason must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	cancellationReason?: string;

	@ApiPropertyOptional({ type: Object, description: 'Subscription metadata for additional data' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be an object' })
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	metadata?: Record<string, any>;

	@ApiPropertyOptional({ type: String, description: 'External subscription ID from payment provider' })
	@IsOptional()
	@IsString({ message: 'External subscription ID must be a string' })
	@MultiORMColumn({ type: 'varchar', nullable: true })
	externalSubscriptionId?: string;

	/*
	 * Plugin relationship - Enhanced with proper constraints
	 */
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: false, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.plugin)
	pluginId: string;

	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.subscriptions, {
		onDelete: 'CASCADE',
		nullable: false,
		eager: false
	})
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/*
	 * Plugin Tenant relationship - Enhanced with proper constraints
	 */
	@ApiProperty({ type: String, description: 'Plugin Tenant ID' })
	@IsNotEmpty({ message: 'Plugin Tenant ID is required' })
	@IsUUID(4, { message: 'Plugin Tenant ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: false, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.pluginTenant)
	pluginTenantId: string;

	@MultiORMManyToOne(() => PluginTenant, (pluginTenant) => pluginTenant.subscriptions, {
		onDelete: 'CASCADE',
		nullable: false,
		eager: false
	})
	@JoinColumn()
	pluginTenant: Relation<IPluginTenant>;

	/*
	 * Subscription Plan relationship
	 */
	@ApiPropertyOptional({ type: String, description: 'Subscription plan ID' })
	@IsOptional()
	@IsUUID(4, { message: 'Plan ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.plan)
	planId?: string;

	@MultiORMManyToOne(() => PluginSubscriptionPlan, (plan) => plan.subscriptions, {
		onDelete: 'SET NULL',
		nullable: true,
		eager: false
	})
	@JoinColumn()
	plan?: Relation<IPluginSubscriptionPlan>;

	/*
	 * Subscriber (User) relationship - Enhanced for user-level subscriptions
	 */
	@ApiPropertyOptional({ type: String, description: 'Subscriber user ID for user-specific subscriptions' })
	@IsOptional()
	@IsUUID(4, { message: 'Subscriber ID must be a valid UUID' })
	@ValidateIf((object, value) => value !== null)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.subscriber)
	subscriberId?: string;

	@MultiORMManyToOne(() => User, {
		onDelete: 'SET NULL',
		nullable: true,
		eager: false
	})
	@JoinColumn()
	subscriber?: Relation<IUser>;

	/*
	 * Parent-Child Subscription Relationships
	 * Used for hierarchical subscription management where tenant/organization subscriptions
	 * can have child user subscriptions created through assignment
	 */

	/**
	 * Parent subscription ID - References the tenant/organization subscription that spawned this user subscription
	 * Only set for user subscriptions created through assignment from a parent subscription
	 */
	@ApiPropertyOptional({ type: String, description: 'Parent subscription ID for hierarchical subscriptions' })
	@IsOptional()
	@IsUUID(4, { message: 'Parent subscription ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((subscription: PluginSubscription) => subscription.parent)
	parentId?: string;

	/**
	 * Parent subscription relationship
	 * The tenant/organization subscription that this user subscription was derived from
	 */
	@ApiPropertyOptional({
		type: () => PluginSubscription,
		description: 'Parent subscription (for subscriptions created through assignment)'
	})
	@TreeParent()
	@JoinColumn()
	parent?: Relation<IPluginSubscription>;

	/**
	 * Child subscriptions relationship
	 * User subscriptions that were created through assignment from this tenant/organization subscription
	 */
	@ApiPropertyOptional({
		type: () => [PluginSubscription],
		description: 'Child subscriptions (user subscriptions created through assignment)'
	})
	@TreeChildren({ cascade: true })
	children?: Relation<IPluginSubscription[]>;

	@ApiPropertyOptional({ type: () => Array, description: 'Plugin billings for this subscription' })
	@MultiORMOneToMany(() => PluginBilling, (billing) => billing.subscription, {
		onDelete: 'CASCADE'
	})
	billings?: Relation<IPluginBilling[]>;
	/*
	 * Payment relationships - will be added when Payment entity is available
	 * @MultiORMOneToMany(() => Payment, (payment) => payment.pluginSubscription, { onDelete: 'SET NULL' })
	 * payments?: IPayment[];
	 */

	/**
	 * Check if the subscription is currently active
	 */
	get isSubscriptionActive(): boolean {
		return (
			[
				PluginSubscriptionStatus.ACTIVE,
				PluginSubscriptionStatus.TRIAL,
				PluginSubscriptionStatus.PENDING
			].includes(this.status) &&
			(!this.endDate || this.endDate > new Date())
		);
	}

	/**
	 * Check if the subscription is expired
	 */
	get isExpired(): boolean {
		return this.endDate ? this.endDate <= new Date() : false;
	}

	/**
	 * Check if the subscription is in trial period
	 */
	get isInTrial(): boolean {
		return this.trialEndDate ? this.trialEndDate > new Date() : false;
	}

	/**
	 * Check if the subscription is expiring soon (within 7 days)
	 */
	get isExpiringSoon(): boolean {
		if (!this.endDate) return false;
		const sevenDaysFromNow = new Date();
		sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
		return this.endDate <= sevenDaysFromNow && this.endDate > new Date();
	}

	/**
	 * Get days remaining until expiration
	 */
	get daysUntilExpiration(): number | null {
		if (!this.endDate) return null;
		const now = new Date();
		const timeDiff = this.endDate.getTime() - now.getTime();
		return Math.ceil(timeDiff / (1000 * 3600 * 24));
	}

	/**
	 * Get next billing date from pending billings
	 * This is a computed property that looks at the billing records
	 */
	get nextBillingDate(): Date | null {
		if (!this.billings || this.billings.length === 0) return null;

		const pendingBillings = this.billings
			.filter((b) => b.status === PluginBillingStatus.PENDING && b.dueDate > new Date())
			.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

		return pendingBillings.length > 0 ? pendingBillings[0].dueDate : null;
	}

	/**
	 * Check if billing is due
	 * This checks if there are any pending billings that are due
	 */
	get isBillingDue(): boolean {
		if (!this.billings || this.billings.length === 0) return false;

		const now = new Date();
		return this.billings.some((b) => b.status === 'pending' && b.dueDate <= now);
	}

	// ==========================================
	// DOMAIN VALIDATION METHODS
	// ==========================================

	/**
	 * Validates if the subscription can be activated
	 * Domain method to encapsulate business rules
	 */
	canBeActivated(): boolean {
		return [
			PluginSubscriptionStatus.PENDING,
			PluginSubscriptionStatus.SUSPENDED,
			PluginSubscriptionStatus.TRIAL
		].includes(this.status);
	}

	/**
	 * Validates if the subscription can be suspended
	 */
	canBeSuspended(): boolean {
		return [PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL].includes(this.status);
	}

	/**
	 * Validates if the subscription can be cancelled
	 */
	canBeCancelled(): boolean {
		return this.status !== PluginSubscriptionStatus.CANCELLED;
	}

	/**
	 * Validates if the subscription can be renewed
	 */
	canBeRenewed(): boolean {
		return (
			[PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.EXPIRED].includes(this.status) && this.autoRenew
		);
	}

	/**
	 * Validates if the subscription can be upgraded
	 */
	canBeUpgraded(): boolean {
		return this.status === PluginSubscriptionStatus.ACTIVE && !!this.planId && !this.isInherited();
	}

	/**
	 * Validates if the subscription can be downgraded
	 */
	canBeDowngraded(): boolean {
		return this.status === PluginSubscriptionStatus.ACTIVE && !!this.planId && !this.isInherited();
	}

	/**
	 * Validates if trial can be extended
	 */
	canExtendTrial(): boolean {
		return (
			this.status === PluginSubscriptionStatus.TRIAL &&
			this.trialEndDate &&
			this.trialEndDate > new Date() &&
			!this.isInherited()
		);
	}

	/**
	 * Validates if child subscriptions can be created from this subscription
	 */
	canCreateChildSubscriptions(): boolean {
		return (
			this.status === PluginSubscriptionStatus.ACTIVE &&
			[PluginScope.TENANT, PluginScope.ORGANIZATION].includes(this.scope) &&
			!this.isInherited()
		);
	}

	/**
	 * Validates if this is a valid parent subscription
	 */
	isValidParentSubscription(): boolean {
		return (
			[PluginScope.TENANT, PluginScope.ORGANIZATION].includes(this.scope) &&
			[PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL].includes(this.status)
		);
	}

	/**
	 * Validates assignment permissions based on scope
	 */
	hasAssignmentPermissions(): boolean {
		return [PluginScope.ORGANIZATION, PluginScope.TENANT].includes(this.scope) && this.isSubscriptionActive;
	}

	// ==========================================
	// DOMAIN LIFECYCLE METHODS
	// ==========================================

	/**
	 * Activates the subscription
	 * Returns the updated subscription with new status
	 */
	activate(): PluginSubscription {
		if (!this.canBeActivated()) {
			throw new Error(`Cannot activate subscription in ${this.status} status`);
		}

		this.status = PluginSubscriptionStatus.ACTIVE;
		this.updatedAt = new Date();
		return this;
	}

	/**
	 * Suspends the subscription
	 */
	suspend(reason?: string): PluginSubscription {
		if (!this.canBeSuspended()) {
			throw new Error(`Cannot suspend subscription in ${this.status} status`);
		}

		this.status = PluginSubscriptionStatus.SUSPENDED;
		if (reason) {
			this.metadata = {
				...this.metadata,
				suspensionReason: reason,
				suspendedAt: new Date().toISOString()
			};
		}
		this.updatedAt = new Date();
		return this;
	}

	/**
	 * Cancels the subscription
	 */
	cancel(reason?: string): PluginSubscription {
		if (!this.canBeCancelled()) {
			throw new Error('Cannot cancel subscription that is already cancelled');
		}

		this.status = PluginSubscriptionStatus.CANCELLED;
		this.planId = null;
		this.cancelledAt = new Date();
		this.cancellationReason = reason;
		this.autoRenew = false;
		this.updatedAt = new Date();

		this.pluginTenant.removeAllowedUser(this.subscriberId);

		return this;
	}

	/**
	 * Expires the subscription
	 */
	expire(): PluginSubscription {
		this.status = PluginSubscriptionStatus.EXPIRED;
		this.updatedAt = new Date();
		return this;
	}

	/**
	 * Renews the subscription with new end date
	 */
	renew(newEndDate: Date): PluginSubscription {
		if (!this.canBeRenewed()) {
			throw new Error(`Cannot renew subscription in ${this.status} status`);
		}

		this.status = PluginSubscriptionStatus.ACTIVE;
		this.endDate = newEndDate;
		this.metadata = {
			...this.metadata,
			lastRenewalDate: new Date().toISOString()
		};
		this.updatedAt = new Date();
		return this;
	}

	/**
	 * Extends trial period
	 */
	extendTrial(additionalDays: number, extendedBy?: string): PluginSubscription {
		if (!this.canExtendTrial()) {
			throw new Error('Cannot extend trial for this subscription');
		}

		const currentTrialEnd = this.trialEndDate || new Date();
		const newTrialEnd = new Date(currentTrialEnd);
		newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays);

		this.trialEndDate = newTrialEnd;
		this.metadata = {
			...this.metadata,
			trialExtended: true,
			extensionDays: additionalDays,
			extendedAt: new Date().toISOString(),
			...(extendedBy && { extendedBy })
		};
		this.updatedAt = new Date();
		return this;
	}

	/**
	 * Upgrades subscription to new plan
	 */
	upgradeToPlan(newPlanId: string): PluginSubscription {
		if (!this.canBeUpgraded()) {
			throw new Error('Cannot upgrade subscription in current state');
		}

		this.metadata = {
			...this.metadata,
			previousPlanId: this.planId,
			upgradedAt: new Date().toISOString(),
			upgradeReason: 'user_requested'
		};
		this.planId = newPlanId;
		this.updatedAt = new Date();
		return this;
	}

	/**
	 * Downgrades subscription to new plan
	 */
	downgradeToPlan(newPlanId: string): PluginSubscription {
		if (!this.canBeDowngraded()) {
			throw new Error('Cannot downgrade subscription in current state');
		}

		this.metadata = {
			...this.metadata,
			previousPlanId: this.planId,
			downgradedAt: new Date().toISOString(),
			downgradeReason: 'user_requested'
		};
		this.planId = newPlanId;
		this.updatedAt = new Date();
		return this;
	}

	// ==========================================
	// DOMAIN PERMISSION METHODS
	// ==========================================

	/**
	 * Checks if this subscription grants access to a specific user
	 * Implements scope-based access control logic
	 */
	grantsAccessToUser(userId: string, organizationId?: string): boolean {
		if (!this.isSubscriptionActive) return false;

		switch (this.scope) {
			case PluginScope.USER:
				return this.subscriberId === userId;

			case PluginScope.ORGANIZATION:
				return this.organizationId === organizationId;

			case PluginScope.TENANT:
				// Tenant scope grants access to all users in the tenant
				return true;

			default:
				return false;
		}
	}

	/**
	 * Checks if this subscription allows creating child subscriptions
	 */
	allowsChildCreation(): boolean {
		return this.canCreateChildSubscriptions() && !this.parent;
	}

	/**
	 * Checks if user can manage this subscription (cancel, upgrade, etc.)
	 */
	canBeManagedByUser(userId: string, organizationId?: string): boolean {
		if (!userId) return false;

		// User scope subscriptions cannot be managed by others
		if (this.scope === PluginScope.USER) {
			return this.subscriberId === userId && !this.parentId;
		}

		// For organization scope, check if user belongs to the organization
		if (this.scope === PluginScope.ORGANIZATION) {
			return this.organizationId === organizationId;
		}

		// For tenant scope, organization admins can manage
		if (this.scope === PluginScope.TENANT) {
			return !!organizationId; // Assume organization presence indicates admin rights
		}

		return false;
	}

	/**
	 * Checks if subscription is inherited (child subscription)
	 */
	isInherited(): boolean {
		return !!this.parentId;
	}

	/**
	 * Checks if this subscription can assign access to other users
	 */
	canAssignToUsers(): boolean {
		return this.hasAssignmentPermissions() && !this.isInherited();
	}

	/**
	 * Gets the effective scope for permission checking
	 * Takes into account parent-child relationships
	 */
	getEffectiveScope(): PluginScope {
		if (this.parent && this.parent.scope) {
			return this.parent.scope;
		}
		return this.scope;
	}

	/**
	 * Checks if subscription grants elevated permissions
	 */
	hasElevatedPermissions(): boolean {
		return [PluginScope.ORGANIZATION, PluginScope.TENANT].includes(this.getEffectiveScope());
	}

	// ==========================================
	// DOMAIN FACTORY METHODS
	// ==========================================

	/**
	 * Creates a free subscription for immediate access
	 * Static factory method following Factory pattern
	 */
	static createFreeSubscription(
		pluginId: string,
		pluginTenantId: string,
		tenantId: string,
		subscriberId?: string,
		organizationId?: string
	): PluginSubscription {
		const subscription = new PluginSubscription();

		subscription.pluginId = pluginId;
		subscription.pluginTenantId = pluginTenantId;
		subscription.tenantId = tenantId;
		subscription.organizationId = organizationId;
		subscription.subscriberId = subscriberId;

		subscription.status = PluginSubscriptionStatus.ACTIVE;
		subscription.scope = PluginScope.USER; // Free subscriptions are user-scoped
		subscription.startDate = new Date();
		subscription.autoRenew = false; // Free subscriptions don't auto-renew

		subscription.metadata = {
			isFree: true,
			createdAt: new Date().toISOString(),
			subscriptionType: 'free'
		};

		return subscription;
	}

	/**
	 * Creates a trial subscription
	 */
	static createTrialSubscription(
		pluginId: string,
		pluginTenantId: string,
		tenantId: string,
		planId: string,
		trialDays: number,
		scope: PluginScope,
		subscriberId?: string,
		organizationId?: string
	): PluginSubscription {
		const subscription = new PluginSubscription();

		subscription.pluginId = pluginId;
		subscription.pluginTenantId = pluginTenantId;
		subscription.tenantId = tenantId;
		subscription.organizationId = organizationId;
		subscription.subscriberId = subscriberId;
		subscription.planId = planId;

		subscription.status = PluginSubscriptionStatus.TRIAL;
		subscription.scope = scope;
		subscription.startDate = new Date();
		subscription.autoRenew = true;

		// Calculate trial end date
		const trialEndDate = new Date();
		trialEndDate.setDate(trialEndDate.getDate() + trialDays);
		subscription.trialEndDate = trialEndDate;

		subscription.metadata = {
			isTrial: true,
			trialDays,
			createdAt: new Date().toISOString(),
			subscriptionType: 'trial'
		};

		return subscription;
	}

	/**
	 * Creates a paid subscription
	 */
	static createPaidSubscription(
		pluginId: string,
		pluginTenantId: string,
		tenantId: string,
		planId: string,
		scope: PluginScope,
		endDate: Date,
		subscriberId?: string,
		organizationId?: string,
		paymentMethod?: string
	): PluginSubscription {
		const subscription = new PluginSubscription();

		subscription.pluginId = pluginId;
		subscription.pluginTenantId = pluginTenantId;
		subscription.tenantId = tenantId;
		subscription.organizationId = organizationId;
		subscription.subscriberId = subscriberId;
		subscription.planId = planId;

		subscription.status = PluginSubscriptionStatus.PENDING; // Awaiting payment
		subscription.scope = scope;
		subscription.startDate = new Date();
		subscription.endDate = endDate;
		subscription.autoRenew = true;

		subscription.metadata = {
			isPaid: true,
			paymentMethod,
			createdAt: new Date().toISOString(),
			subscriptionType: 'paid'
		};

		return subscription;
	}

	/**
	 * Creates a child subscription from a parent subscription
	 */
	static createChildSubscription(parentSubscription: IPluginSubscription, subscriberId: string): PluginSubscription {
		// Validate parent subscription can create children
		const canCreate =
			[
				PluginSubscriptionStatus.ACTIVE,
				PluginSubscriptionStatus.TRIAL,
				PluginSubscriptionStatus.PENDING
			].includes(parentSubscription.status) &&
			[PluginScope.TENANT, PluginScope.ORGANIZATION].includes(parentSubscription.scope);

		if (!canCreate) {
			throw new Error('Cannot create child subscription from parent');
		}

		const subscription = new PluginSubscription();

		subscription.pluginId = parentSubscription.pluginId;
		subscription.pluginTenantId = parentSubscription.pluginTenantId;
		subscription.tenantId = parentSubscription.tenantId;
		subscription.organizationId = parentSubscription.organizationId;
		subscription.subscriberId = subscriberId;
		subscription.planId = parentSubscription.planId;
		subscription.parentId = parentSubscription.id;

		subscription.status = PluginSubscriptionStatus.ACTIVE; // Inherit from parent
		subscription.scope = PluginScope.USER; // Child subscriptions are always user-scoped
		subscription.startDate = new Date();
		subscription.endDate = parentSubscription.endDate;
		subscription.trialEndDate = parentSubscription.trialEndDate;
		subscription.autoRenew = false; // Children don't auto-renew independently

		subscription.metadata = {
			createdFrom: 'assignment',
			parentSubscriptionId: parentSubscription.id,
			assignedAt: new Date().toISOString(),
			subscriptionType: 'child'
		};

		return subscription;
	}

	// ==========================================
	// DOMAIN CALCULATION METHODS
	// ==========================================

	/**
	 * Calculates the next billing date based on billing period
	 */
	calculateNextBillingDate(billingPeriod: string): Date {
		const currentDate = this.endDate || new Date();
		const nextDate = new Date(currentDate);

		switch (billingPeriod.toLowerCase()) {
			case 'monthly':
				nextDate.setMonth(nextDate.getMonth() + 1);
				break;
			case 'yearly':
				nextDate.setFullYear(nextDate.getFullYear() + 1);
				break;
			case 'quarterly':
				nextDate.setMonth(nextDate.getMonth() + 3);
				break;
			case 'weekly':
				nextDate.setDate(nextDate.getDate() + 7);
				break;
			case 'daily':
				nextDate.setDate(nextDate.getDate() + 1);
				break;
			default:
				throw new Error(`Unsupported billing period: ${billingPeriod}`);
		}

		return nextDate;
	}

	/**
	 * Calculates remaining subscription time in days
	 */
	calculateRemainingDays(): number {
		if (!this.endDate) return Infinity; // No expiration

		const now = new Date();
		const timeDiff = this.endDate.getTime() - now.getTime();
		return Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
	}

	/**
	 * Calculates prorated amount for upgrades/downgrades
	 */
	calculateProratedAmount(oldPrice: number, newPrice: number): number {
		const remainingDays = this.calculateRemainingDays();
		if (remainingDays === 0 || remainingDays === Infinity) return 0;

		const totalDays = this.getTotalSubscriptionDays();
		if (totalDays === 0) return 0;

		const unusedRatio = remainingDays / totalDays;
		const oldUnusedValue = oldPrice * unusedRatio;
		const newValue = newPrice * unusedRatio;

		return Math.max(0, newValue - oldUnusedValue);
	}

	/**
	 * Calculates total subscription days for current period
	 */
	private getTotalSubscriptionDays(): number {
		if (!this.endDate || !this.startDate) return 0;

		const timeDiff = this.endDate.getTime() - this.startDate.getTime();
		return Math.ceil(timeDiff / (1000 * 3600 * 24));
	}

	/**
	 * Calculates usage percentage of current subscription period
	 */
	calculateUsagePercentage(): number {
		const totalDays = this.getTotalSubscriptionDays();
		const remainingDays = this.calculateRemainingDays();

		if (totalDays === 0 || remainingDays === Infinity) return 0;

		const usedDays = totalDays - remainingDays;
		return Math.min(100, Math.max(0, (usedDays / totalDays) * 100));
	}

	/**
	 * Calculates credit amount for downgrade or cancellation
	 */
	calculateCreditAmount(pricePerPeriod: number): number {
		const remainingDays = this.calculateRemainingDays();
		const totalDays = this.getTotalSubscriptionDays();

		if (totalDays === 0 || remainingDays === 0 || remainingDays === Infinity) {
			return 0;
		}

		const unusedRatio = remainingDays / totalDays;
		return pricePerPeriod * unusedRatio;
	}

	/**
	 * Determines if subscription qualifies for refund
	 */
	qualifiesForRefund(refundPolicyDays: number = 30): boolean {
		if (!this.startDate) return false;

		const daysSinceStart = Math.floor((new Date().getTime() - this.startDate.getTime()) / (1000 * 3600 * 24));

		return (
			daysSinceStart <= refundPolicyDays &&
			[PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL].includes(this.status)
		);
	}

	/**
	 * Calculates renewal price with potential discounts
	 */
	calculateRenewalPrice(basePrice: number, loyaltyDiscountPercentage: number = 0): number {
		const renewalCount = this.getRenewalCount();
		const discount = Math.min(loyaltyDiscountPercentage * renewalCount, 50); // Max 50% discount

		return basePrice * (1 - discount / 100);
	}

	/**
	 * Gets the number of times this subscription has been renewed
	 */
	private getRenewalCount(): number {
		return this.metadata?.renewalCount || 0;
	}

	// ==========================================
	// DOMAIN SPECIFICATION METHODS
	// ==========================================

	/**
	 * Specification to check if subscription is active and accessible
	 * Implements Specification pattern for complex business rules
	 */
	static isActiveAndAccessible(subscription: IPluginSubscription): boolean {
		return (
			[PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL].includes(subscription.status) &&
			(!subscription.endDate || subscription.endDate > new Date())
		);
	}

	/**
	 * Specification to check if subscription is expiring soon
	 */
	static isExpiringSoon(subscription: IPluginSubscription, warningDays: number = 7): boolean {
		if (!subscription.endDate) return false;

		const warningDate = new Date();
		warningDate.setDate(warningDate.getDate() + warningDays);

		return (
			subscription.endDate <= warningDate &&
			subscription.endDate > new Date() &&
			subscription.status === PluginSubscriptionStatus.ACTIVE
		);
	}

	/**
	 * Specification to check if subscription requires payment attention
	 */
	static requiresPaymentAttention(subscription: IPluginSubscription): boolean {
		return (
			[PluginSubscriptionStatus.PENDING, PluginSubscriptionStatus.SUSPENDED].includes(subscription.status) ||
			(subscription.status === PluginSubscriptionStatus.TRIAL &&
				subscription.trialEndDate &&
				subscription.trialEndDate <= new Date())
		);
	}

	/**
	 * Specification to check if subscription is eligible for renewal
	 */
	static isEligibleForRenewal(subscription: IPluginSubscription): boolean {
		return (
			subscription.autoRenew &&
			[PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.EXPIRED].includes(subscription.status) &&
			(!subscription.parent || subscription.parent.status === PluginSubscriptionStatus.ACTIVE)
		);
	}

	/**
	 * Specification to check if subscription can manage users
	 */
	static canManageUsers(subscription: IPluginSubscription): boolean {
		return (
			[PluginScope.ORGANIZATION, PluginScope.TENANT].includes(subscription.scope) &&
			PluginSubscription.isActiveAndAccessible(subscription) &&
			!subscription.parentId
		);
	}

	/**
	 * Specification to check if subscription is a billable subscription
	 */
	static isBillable(subscription: IPluginSubscription): boolean {
		return (
			!!subscription.planId && subscription.status !== PluginSubscriptionStatus.CANCELLED && !subscription.parent
		); // Child subscriptions are not billed separately
	}

	/**
	 * Specification to check if subscription grants premium features
	 */
	static grantsPremiumFeatures(subscription: IPluginSubscription): boolean {
		return (
			PluginSubscription.isActiveAndAccessible(subscription) &&
			(!!subscription.planId || subscription.scope === PluginScope.TENANT)
		);
	}

	/**
	 * Specification to check if subscription is inherited from parent
	 */
	static isInherited(subscription: IPluginSubscription): boolean {
		return !!subscription.parent && !!subscription.parentId && subscription.scope === PluginScope.USER;
	}

	/**
	 * Specification to check if subscription needs billing attention
	 */
	static needsBillingAttention(subscription: IPluginSubscription): boolean {
		const hasPendingPayments =
			subscription.billings?.some((billing) => billing.status === 'pending' && billing.dueDate <= new Date()) ||
			false;

		return (
			hasPendingPayments ||
			PluginSubscription.requiresPaymentAttention(subscription) ||
			(subscription.status === PluginSubscriptionStatus.ACTIVE &&
				subscription.endDate &&
				subscription.endDate <= new Date())
		);
	}

	// ==========================================
	// DOMAIN QUERY BUILDERS
	// ==========================================

	/**
	 * Builds query criteria for finding similar subscriptions
	 */
	getSimilarSubscriptionCriteria(): Partial<IPluginSubscription> {
		return {
			pluginId: this.pluginId,
			tenantId: this.tenantId,
			organizationId: this.organizationId,
			scope: this.scope
		};
	}

	/**
	 * Builds query criteria for finding related subscriptions
	 */
	getRelatedSubscriptionCriteria(): Partial<IPluginSubscription> {
		const criteria: Partial<IPluginSubscription> = {
			pluginId: this.pluginId,
			tenantId: this.tenantId
		};

		// Include organization if present
		if (this.organizationId) {
			criteria.organizationId = this.organizationId;
		}

		return criteria;
	}

	/**
	 * Gets subscription hierarchy path (parent -> child relationships)
	 */
	getHierarchyPath(): string[] {
		const path: string[] = [];

		if (this.parent) {
			// Recursive call would require the parent to be a PluginSubscription entity
			// For now, just add parent ID
			path.push(this.parentId!);
		}

		path.push(this.id!);
		return path;
	}
}
