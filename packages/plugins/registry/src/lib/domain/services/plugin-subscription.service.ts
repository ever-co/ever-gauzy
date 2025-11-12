import { TenantAwareCrudService } from '@gauzy/core';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FindManyOptions, In } from 'typeorm';
import { PluginBillingCreateCommand } from '../../application/commands';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPurchaseInput,
	IPluginSubscriptionUpdateInput,
	PluginBillingPeriod,
	PluginSubscriptionStatus
} from '../../shared/models/plugin-subscription.model';
import { PluginSubscription } from '../entities/plugin-subscription.entity';
import { PluginBillingFactory } from '../factories';
import { MikroOrmPluginSubscriptionRepository } from '../repositories/mikro-orm-plugin-subscription.repository';
import { TypeOrmPluginSubscriptionRepository } from '../repositories/type-orm-plugin-subscription.repository';
import { PluginSubscriptionPlanService } from './plugin-subscription-plan.service';
import { PluginTenantService } from './plugin-tenant.service';

@Injectable()
export class PluginSubscriptionService extends TenantAwareCrudService<PluginSubscription> {
	private readonly logger = new Logger(PluginSubscriptionService.name);

	constructor(
		public readonly typeOrmPluginSubscriptionRepository: TypeOrmPluginSubscriptionRepository,
		public readonly mikroOrmPluginSubscriptionRepository: MikroOrmPluginSubscriptionRepository,
		private readonly pluginTenantService: PluginTenantService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly commandBus: CommandBus,
		private readonly pluginBillingFactory: PluginBillingFactory
	) {
		super(typeOrmPluginSubscriptionRepository, mikroOrmPluginSubscriptionRepository);
	}

	/**
	 * Override create method to handle tree entity properly for TypeORM
	 * This is necessary because PluginSubscription uses TypeORM's closure-table tree functionality
	 * which requires the parent entity to be loaded when creating child subscriptions
	 */
	async create(entity: IPluginSubscriptionCreateInput): Promise<PluginSubscription> {
		// If parentId is provided, load the parent entity first and pass the loaded
		// entity as `parent` to the create flow. This ensures both TypeORM (closure-table)
		// and MikroORM get a proper relation object instead of a raw id which can cause
		// persistence internals to fail (e.g. getEntityValue undefined).
		if (entity.parentId) {
			const parent = await this.findOneByIdString(entity.parentId);
			if (!parent) {
				throw new NotFoundException(`Parent subscription with ID ${entity.parentId} not found`);
			}
			// Remove parentId from the entity data and replace with loaded parent object
			const { parentId, ...entityWithoutParentId } = entity;
			// Delegate to the base create which will handle ORM specifics for both
			// MikroORM and TypeORM when given a proper `parent` relation object.
			return await super.create({
				...entityWithoutParentId,
				parent
			});
		}

		// No parent, proceed with standard creation
		return await super.create(entity);
	}

	/**
	 * Purchase a plugin subscription with proper handling for free vs paid plans
	 * Now uses CQRS commands for billing creation to ensure proper separation of concerns
	 */
	async purchaseSubscription(
		purchaseInput: IPluginSubscriptionPurchaseInput,
		tenantId: string,
		organizationId?: string,
		subscriberId?: string
	): Promise<IPluginSubscription> {
		// Validate purchase input
		await this.validatePurchaseInput(purchaseInput, tenantId, organizationId);

		// Determine the actual scope
		const actualScope = purchaseInput.scope;

		// Check for existing active subscription at the determined scope
		const existingSubscription = await this.findActiveSubscription(
			purchaseInput.pluginId,
			tenantId,
			actualScope === PluginScope.ORGANIZATION ? organizationId : undefined,
			subscriberId
		);

		if (existingSubscription) {
			throw new BadRequestException('An active subscription already exists for this plugin at this scope');
		}

		// Get the plan if planId is provided
		let plan = null;
		if (purchaseInput.planId) {
			plan = await this.pluginSubscriptionPlanService.findOneByIdString(purchaseInput.planId);
			if (!plan) {
				throw new NotFoundException('Subscription plan not found');
			}
		}

		// Calculate subscription dates based on plan's billing period
		const billingPeriod = plan?.billingPeriod || PluginBillingPeriod.MONTHLY;
		const { startDate, endDate, trialEndDate } = this.calculateSubscriptionDates(
			billingPeriod,
			plan?.trialDays || 0
		);

		// Determine initial status based on business rules:
		// 1. Free Plans: ACTIVE status (no payment required)
		// 2. Trial Plans: TRIAL status (trial period before payment)
		// 3. Paid Plans: PENDING status (awaiting payment confirmation)
		const initialStatus = this.determineInitialSubscriptionStatus(plan);

		// Determine scope based on business rules:
		// 1. Free Plans: Always USER scope for immediate individual access
		// 2. Paid Plans: Respect the requested scope (TENANT/ORGANIZATION/USER)
		const subscriptionScope = this.determineSubscriptionScope(plan, purchaseInput.scope);

		// Create plugin tenant relationship (assuming it exists or needs to be created)
		const pluginTenantId = await this.ensurePluginTenantExists(purchaseInput.pluginId, tenantId, organizationId);

		// Create subscription
		const subscriptionData: IPluginSubscriptionCreateInput = {
			pluginId: purchaseInput.pluginId,
			pluginTenantId,
			scope: subscriptionScope,
			status: initialStatus,
			startDate,
			endDate,
			trialEndDate: plan?.trialDays ? trialEndDate : undefined,
			autoRenew: purchaseInput.autoRenew ?? true, // Default to true if not specified
			subscriberId,
			planId: purchaseInput.planId,
			metadata: {
				...purchaseInput.metadata,
				purchasedAt: new Date().toISOString(),
				paymentMethod: purchaseInput.paymentMethod,
				promoCode: purchaseInput.promoCode,
				isFree: !plan || plan.price === 0,
				isTrial: !!plan?.trialDays
			},
			tenantId,
			organizationId
		};

		const subscription = await this.create(subscriptionData);
		this.logger.log(`Subscription created: ${subscription.id} for plugin: ${purchaseInput.pluginId}`);

		// Process payment and billing if plan has a price
		if (plan && plan.price > 0) {
			this.logger.log(`Creating billing for subscription: ${subscription.id} with price: ${plan.price}`);
			await this.createInitialBilling(subscription, plan, purchaseInput, tenantId, organizationId);
		} else {
			this.logger.log(`Skipping billing for free plan subscription: ${subscription.id}`);
		}

		return subscription;
	}

	/**
	 * Creates initial billing for a subscription using CQRS commands
	 * @param subscription - The subscription
	 * @param plan - The subscription plan
	 * @param purchaseInput - The purchase input
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID (optional)
	 */
	private async createInitialBilling(
		subscription: IPluginSubscription,
		plan: any,
		purchaseInput: IPluginSubscriptionPurchaseInput,
		tenantId: string,
		organizationId?: string
	): Promise<void> {
		try {
			this.logger.log(`Creating initial billing for subscription: ${subscription.id}`);

			// Create initial billing using the factory with full plan details
			const billingInput = await this.pluginBillingFactory.createInitialBilling(
				subscription.id,
				plan,
				!!plan.trialDays,
				tenantId,
				organizationId
			);

			this.logger.debug(`Billing input prepared: ${JSON.stringify(billingInput)}`);

			// Execute billing creation command
			const billing = await this.commandBus.execute(new PluginBillingCreateCommand(billingInput));
			this.logger.log(
				`Billing created successfully: ${billing.id} - Amount: ${billing.amount} ${billing.currency}`
			);

			// TODO: Implement payment processing integration
			// If payment method is provided and not a trial, process payment immediately
			// Temporarily disabled until payment gateway is integrated
			/*
			if (purchaseInput.paymentMethod && !plan.trialDays) {
				await this.commandBus.execute(
					new PluginBillingProcessPaymentCommand(billing.id, {
						paymentMethod: purchaseInput.paymentMethod,
						metadata: {
							subscriptionId: subscription.id,
							planId: plan.id,
							promoCode: purchaseInput.promoCode
						}
					})
				);
			}
			*/
		} catch (error) {
			this.logger.error(`Failed to create initial billing: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Determine the appropriate subscription scope based on plan type.
	 * Business Rule: Free plans automatically use USER scope for immediate individual access.
	 * Paid plans respect the requested scope.
	 *
	 * @param plan - The subscription plan (null for free plans)
	 * @param requestedScope - The requested scope from purchase
	 * @returns The determined subscription scope
	 */
	private determineSubscriptionScope(plan: any, requestedScope: PluginScope): PluginScope {
		// Free plans (no plan or price = 0) always use USER scope for immediate individual access
		if (!plan || plan.price === 0) {
			this.logger.log('Free plan detected - using USER scope');
			return PluginScope.USER;
		}

		// Paid plans respect the requested scope
		this.logger.log(`Paid plan detected - using requested scope: ${requestedScope}`);
		return requestedScope;
	}

	/**
	 * Determine the initial subscription status based on plan type.
	 * Business Rules:
	 * 1. Free Plans: Immediately ACTIVE (no payment required)
	 * 2. Trial Plans: TRIAL status (trial period before payment)
	 * 3. Paid Plans: PENDING status (awaiting payment confirmation)
	 *
	 * @param plan - The subscription plan (null for free plans)
	 * @returns The initial subscription status
	 */
	private determineInitialSubscriptionStatus(plan: any): PluginSubscriptionStatus {
		// Free plans (no plan or price = 0) are immediately active
		if (!plan || plan.price === 0) {
			this.logger.log('Free plan - status: ACTIVE');
			return PluginSubscriptionStatus.ACTIVE;
		}

		// Trial plans start as TRIAL
		if (plan.trialDays && plan.trialDays > 0) {
			this.logger.log(`Trial plan with ${plan.trialDays} days - status: TRIAL`);
			return PluginSubscriptionStatus.TRIAL;
		}

		// Paid plans start as PENDING until payment confirmation
		this.logger.log('Paid plan - status: PENDING (awaiting payment)');
		return PluginSubscriptionStatus.PENDING;
	}

	/**
	 * Find active subscription for a plugin
	 */
	async findActiveSubscription(
		pluginId: string,
		tenantId: string,
		organizationId?: string,
		subscriberId?: string
	): Promise<IPluginSubscription | null> {
		const where: any = {
			pluginId,
			tenantId,
			status: In([PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.TRIAL])
		};

		if (organizationId) {
			where.organizationId = organizationId;
		}

		if (subscriberId) {
			where.subscriberId = subscriberId;
		}

		try {
			return await this.findOneByOptions({
				where,
				relations: ['plugin', 'tenant', 'subscriber', 'parent']
			});
		} catch {
			return null;
		}
	}

	/**
	 * Find subscriptions by plugin ID
	 */
	async findByPluginId(pluginId: string, relations: string[] = []): Promise<IPluginSubscription[]> {
		const result = await this.findAll({
			where: { pluginId },
			relations,
			order: { createdAt: 'DESC' }
		} as FindManyOptions);
		return result.items || [];
	}

	/**
	 * Find subscriptions by subscriber ID
	 */
	async findBySubscriberId(subscriberId: string, relations: string[] = []): Promise<IPluginSubscription[]> {
		const result = await this.findAll({
			where: { subscriberId },
			relations,
			order: { createdAt: 'DESC' }
		} as FindManyOptions);
		return result.items || [];
	}

	/**
	 * Cancel a subscription
	 * Now uses domain methods for business logic validation and state changes
	 */
	async cancelSubscription(subscriptionId: string, reason?: string): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		// Use domain method for validation and state change
		if (subscription.canBeCancelled && !subscription.canBeCancelled()) {
			throw new BadRequestException('Subscription cannot be cancelled in its current state');
		}

		// Use domain method for cancellation logic
		if (subscription.cancel) {
			subscription.cancel(reason);
			return await this.save(subscription);
		}

		// Fallback to old logic for compatibility
		if (subscription.status === PluginSubscriptionStatus.CANCELLED) {
			throw new BadRequestException('Subscription is already cancelled');
		}

		await this.update(subscriptionId, {
			status: PluginSubscriptionStatus.CANCELLED,
			cancelledAt: new Date(),
			cancellationReason: reason,
			autoRenew: false
		});

		return this.findOneByIdString(subscriptionId);
	}

	/**
	 * Renew a subscription
	 * Now uses CQRS commands for billing creation and domain methods for business logic
	 */
	async renewSubscription(subscriptionId: string): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId, {
			relations: ['plan']
		});
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		// Use domain method for validation
		if (subscription.canBeRenewed && !subscription.canBeRenewed()) {
			throw new BadRequestException('Subscription cannot be renewed in its current state');
		}

		const billingPeriod = subscription.plan?.billingPeriod || PluginBillingPeriod.MONTHLY;

		// Use domain method for date calculation if available
		let newEndDate: Date;
		if (subscription.calculateNextBillingDate) {
			newEndDate = subscription.calculateNextBillingDate(billingPeriod);
		} else {
			const { endDate } = this.calculateNextBillingPeriod(billingPeriod, subscription.endDate || new Date());
			newEndDate = endDate!;
		}

		// Use domain method for renewal if available
		if (subscription.renew) {
			subscription.renew(newEndDate);
			const renewed = await this.save(subscription);

			// Create billing for renewal if plan has a price
			if (subscription.plan && subscription.plan.price > 0) {
				await this.createRenewalBilling(renewed, subscription.plan);
			}

			return renewed;
		}

		// Fallback to old logic for compatibility
		await this.update(subscriptionId, {
			status: PluginSubscriptionStatus.ACTIVE,
			endDate: newEndDate
		} as IPluginSubscriptionUpdateInput);

		// Create billing for renewal if plan has a price
		if (subscription.plan && subscription.plan.price > 0) {
			const billingInput = await this.pluginBillingFactory.createForRenewal(
				subscriptionId,
				subscription.plan,
				subscription.tenantId,
				subscription.organizationId
			);

			await this.commandBus.execute(new PluginBillingCreateCommand(billingInput));
			this.logger.log(
				`Renewal billing created for subscription: ${subscriptionId} - Amount: ${billingInput.amount}`
			);
		}

		return await this.findOneByIdString(subscriptionId);
	}

	/**
	 * Helper method to create renewal billing
	 */
	private async createRenewalBilling(subscription: IPluginSubscription, plan: any): Promise<void> {
		const billingInput = await this.pluginBillingFactory.createForRenewal(
			subscription.id,
			plan,
			subscription.tenantId,
			subscription.organizationId
		);

		await this.commandBus.execute(new PluginBillingCreateCommand(billingInput));
		this.logger.log(
			`Renewal billing created for subscription: ${subscription.id} - Amount: ${billingInput.amount}`
		);
	}

	/**
	 * Upgrade a subscription to a new plan
	 * Now uses CQRS commands for billing creation and domain methods for calculations
	 */
	async upgradeSubscription(
		subscriptionId: string,
		newPlanId: string,
		tenantId: string,
		organizationId?: string,
		userId?: string
	): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		// Use domain method for validation
		if (subscription.canBeUpgraded && !subscription.canBeUpgraded()) {
			throw new BadRequestException('Subscription cannot be upgraded in its current state');
		}

		// Get plans for calculation
		const [oldPlan, newPlan] = await Promise.all([
			this.pluginSubscriptionPlanService.findOneByIdString(subscription.planId),
			this.pluginSubscriptionPlanService.findOneByIdString(newPlanId)
		]);

		if (!newPlan) {
			throw new NotFoundException('New subscription plan not found');
		}

		// Calculate prorated amount using domain method if available
		let proratedAmount = 0;
		if (subscription.calculateProratedAmount && oldPlan) {
			proratedAmount = subscription.calculateProratedAmount(oldPlan.price, newPlan.price);
		} else {
			const upgradeDetails = await this.calculateUpgradeDetails(subscription, newPlanId);
			proratedAmount = upgradeDetails.proratedAmount;
		}

		// Create billing for upgrade using CQRS command
		if (proratedAmount > 0) {
			const billingInput = await this.pluginBillingFactory.createForUpgrade(
				subscriptionId,
				proratedAmount,
				newPlan.billingPeriod,
				tenantId,
				organizationId
			);

			await this.commandBus.execute(new PluginBillingCreateCommand(billingInput));
		}

		// Use domain method for upgrade if available
		if (subscription.upgradeToPlan) {
			subscription.upgradeToPlan(newPlanId);
			return await this.save(subscription);
		}

		// Fallback to old logic for compatibility
		await this.update(subscriptionId, {
			planId: newPlanId,
			metadata: {
				...subscription.metadata,
				previousPlanId: subscription.planId,
				upgradedAt: new Date().toISOString(),
				upgradeReason: 'user_requested'
			}
		} as IPluginSubscriptionUpdateInput);

		return await this.findOneByIdString(subscriptionId);
	}

	/**
	 * Downgrade a subscription to a new plan
	 * Now uses CQRS commands for billing creation and domain methods for calculations
	 */
	async downgradeSubscription(
		subscriptionId: string,
		newPlanId: string,
		tenantId: string,
		organizationId?: string,
		userId?: string
	): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		// Use domain method for validation
		if (subscription.canBeDowngraded && !subscription.canBeDowngraded()) {
			throw new BadRequestException('Subscription cannot be downgraded in its current state');
		}

		// Get plans for calculation
		const [oldPlan, newPlan] = await Promise.all([
			this.pluginSubscriptionPlanService.findOneByIdString(subscription.planId),
			this.pluginSubscriptionPlanService.findOneByIdString(newPlanId)
		]);

		if (!newPlan) {
			throw new NotFoundException('New subscription plan not found');
		}

		// Calculate credit using domain method if available
		let creditAmount = 0;
		if (subscription.calculateProratedAmount && oldPlan) {
			creditAmount = subscription.calculateProratedAmount(newPlan.price, oldPlan.price);
		} else {
			const downgradeDetails = await this.calculateDowngradeDetails(subscription, newPlanId);
			creditAmount = downgradeDetails.creditAmount;
		}

		// Process credit if applicable using CQRS command
		if (creditAmount > 0) {
			// For now, just add a billing record for the credit
			// TODO: Implement proper credit processing through billing factory
			console.log(`Credit of ${creditAmount} will be processed for subscription ${subscriptionId}`);
		}

		// Use domain method for downgrade if available
		if (subscription.downgradeToPlan) {
			subscription.downgradeToPlan(newPlanId);
			return await this.save(subscription);
		}

		// Fallback to old logic for compatibility
		await this.update(subscriptionId, {
			planId: newPlanId,
			metadata: {
				...subscription.metadata,
				previousPlanId: subscription.planId,
				downgradedAt: new Date().toISOString(),
				downgradeReason: 'user_requested'
			}
		} as IPluginSubscriptionUpdateInput);

		return await this.findOneByIdString(subscriptionId);
	}

	/**
	 * Extend trial period for a subscription
	 * Now uses domain methods for validation and date calculations
	 */
	async extendTrial(
		subscriptionId: string,
		days: number,
		tenantId: string,
		organizationId?: string,
		userId?: string
	): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		// Use domain method for validation if available
		if (subscription.canExtendTrial && !subscription.canExtendTrial()) {
			throw new BadRequestException('Trial cannot be extended for this subscription');
		}

		// Validate trial status if domain method is not available
		if (!subscription.canExtendTrial && subscription.status !== PluginSubscriptionStatus.TRIAL) {
			throw new BadRequestException('Can only extend trial subscriptions');
		}

		// Use domain method for trial extension if available
		if (subscription.extendTrial) {
			subscription.extendTrial(days, userId);
			return await this.save(subscription);
		}

		// Fallback to old logic for compatibility
		const currentTrialEnd = subscription.trialEndDate || new Date();
		const newTrialEnd = new Date(currentTrialEnd);
		newTrialEnd.setDate(newTrialEnd.getDate() + days);

		await this.update(subscriptionId, {
			trialEndDate: newTrialEnd,
			metadata: {
				...subscription.metadata,
				trialExtended: true,
				extensionDays: days,
				extendedAt: new Date().toISOString(),
				extendedBy: userId
			}
		} as IPluginSubscriptionUpdateInput);

		return await this.findOneByIdString(subscriptionId);
	}

	/**
	 * Create child user subscriptions from a parent tenant/organization subscription
	 * Used when assigning plugin access to users from an organization/tenant-level subscription
	 * Now uses domain methods for validation and child subscription creation
	 *
	 * @param parentSubscriptionId - The parent subscription ID (tenant/organization level)
	 * @param userIds - Array of user IDs to create child subscriptions for
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @returns Array of created child subscriptions
	 */
	async createChildSubscriptions(
		parentSubscriptionId: string,
		userIds: string[],
		tenantId: string,
		organizationId?: string
	): Promise<IPluginSubscription[]> {
		// Get the parent subscription
		const parentSubscription = await this.findOneByIdString(parentSubscriptionId);
		if (!parentSubscription) {
			throw new NotFoundException('Parent subscription not found');
		}

		// Use domain method for validation if available
		if (parentSubscription.canAssignToUsers && !parentSubscription.canAssignToUsers()) {
			throw new BadRequestException(
				'Parent subscription cannot assign access to users in its current state'
			);
		}

		// Validate parent subscription is at organization or tenant level (fallback)
		if (!parentSubscription.canAssignToUsers) {
			if (parentSubscription.scope !== PluginScope.ORGANIZATION && parentSubscription.scope !== PluginScope.TENANT) {
				throw new BadRequestException(
					'Can only create child subscriptions from organization or tenant-level subscriptions'
				);
			}

			if (parentSubscription.status !== PluginSubscriptionStatus.ACTIVE) {
				throw new BadRequestException('Parent subscription must be active to create child subscriptions');
			}
		}

		const childSubscriptions: IPluginSubscription[] = [];

		for (const userId of userIds) {
			// Check if child subscription already exists for this user
			const existingChild = await this.findOneByWhereOptions({
				pluginId: parentSubscription.pluginId,
				subscriberId: userId,
				parentId: parentSubscriptionId,
				tenantId,
				organizationId
			}).catch(() => null);

			if (existingChild) {
				// Skip if already exists
				continue;
			}

			// Create child subscription with USER scope
			const childSubscriptionData: IPluginSubscriptionCreateInput = {
				pluginId: parentSubscription.pluginId,
				pluginTenantId: parentSubscription.pluginTenantId,
				planId: parentSubscription.planId,
				scope: PluginScope.USER, // Child subscriptions are always USER scope
				status: PluginSubscriptionStatus.ACTIVE, // Inherit active status from parent
				startDate: new Date(),
				endDate: parentSubscription.endDate, // Inherit end date from parent
				trialEndDate: parentSubscription.trialEndDate,
				autoRenew: false, // Child subscriptions don't auto-renew independently
				subscriberId: userId,
				parentId: parentSubscriptionId, // Link to parent subscription
				metadata: {
					createdFrom: 'assignment',
					parentSubscriptionId: parentSubscriptionId,
					assignedAt: new Date().toISOString()
				},
				tenantId,
				organizationId
			};

			const childSubscription = await this.create(childSubscriptionData);

			childSubscriptions.push(childSubscription);
		}

		return childSubscriptions;
	}

	/**
	 * Revoke child subscriptions for specific users
	 *
	 * @param parentSubscriptionId - The parent subscription ID
	 * @param userIds - Array of user IDs whose child subscriptions should be revoked
	 * @returns Array of revoked subscriptions
	 */
	async revokeChildSubscriptions(parentSubscriptionId: string, userIds: string[]): Promise<IPluginSubscription[]> {
		const revokedSubscriptions: IPluginSubscription[] = [];

		for (const userId of userIds) {
			const childSubscription = await this.findOneByWhereOptions({
				parentId: parentSubscriptionId,
				subscriberId: userId,
				status: PluginSubscriptionStatus.ACTIVE
			}).catch(() => null);

			if (childSubscription) {
				await this.update(childSubscription.id, {
					status: PluginSubscriptionStatus.CANCELLED,
					cancelledAt: new Date(),
					cancellationReason: 'Access revoked by parent subscription owner'
				} as IPluginSubscriptionUpdateInput);

				const updated = await this.findOneByIdString(childSubscription.id);
				revokedSubscriptions.push(updated);
			}
		}

		return revokedSubscriptions;
	}

	/**
	 * Get expiring subscriptions
	 */
	async getExpiringSubscriptions(days: number = 7): Promise<IPluginSubscription[]> {
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + days);

		const result = await this.findAll({
			where: {
				status: PluginSubscriptionStatus.ACTIVE,
				autoRenew: true
			},
			relations: ['plugin', 'pluginTenant', 'subscriber']
		} as FindManyOptions);

		return result.items || [];
	}

	/**
	 * Process subscription billing
	 */
	async processBilling(subscriptionId: string): Promise<boolean> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			return false;
		}

		try {
			// Process payment (integrate with payment service)
			const paymentResult = await this.processPayment(subscription);

			if (paymentResult.success) {
				// Update subscription for next billing period
				await this.renewSubscription(subscriptionId);
				return true;
			} else {
				// Handle failed payment
				await this.handleFailedPayment(subscription);
				return false;
			}
		} catch (error) {
			console.error('Error processing billing:', error);
			await this.handleFailedPayment(subscription);
			return false;
		}
	}

	/**
	 * Check if subscription has access to plugin
	 * Now uses domain methods for access validation
	 */
	async hasPluginAccess(
		pluginId: string,
		tenantId: string,
		organizationId?: string,
		subscriberId?: string
	): Promise<boolean> {
		// If subscriberId is provided, check for user-level subscription first
		if (subscriberId) {
			const userSubscription = await this.findActiveSubscription(
				pluginId,
				tenantId,
				organizationId,
				subscriberId
			);

			if (userSubscription) {
				// Use domain method for access validation if available
				if (userSubscription.grantsAccessToUser) {
					return userSubscription.grantsAccessToUser(subscriberId);
				}
				// Fallback to old method
				return this.isSubscriptionActive(userSubscription);
			}
		}

		// Check for organization-level subscription
		if (organizationId) {
			const orgSubscription = await this.findActiveSubscription(pluginId, tenantId, organizationId);
			if (orgSubscription) {
				// Use domain method for access validation if available
				if (orgSubscription.isActiveAndAccessible) {
					return orgSubscription.isActiveAndAccessible();
				}
				// Fallback to old method
				return this.isSubscriptionActive(orgSubscription);
			}
		}

		// Check for tenant-level subscription
		const tenantSubscription = await this.findActiveSubscription(pluginId, tenantId);
		if (tenantSubscription) {
			// Use domain method for access validation if available
			if (tenantSubscription.isActiveAndAccessible) {
				return tenantSubscription.isActiveAndAccessible();
			}
			// Fallback to old method
			return this.isSubscriptionActive(tenantSubscription);
		}

		return false;
	}

	/**
	 * Check if subscription is active and not expired
	 */
	private isSubscriptionActive(subscription: IPluginSubscription): boolean {
		return (
			subscription.status === PluginSubscriptionStatus.ACTIVE &&
			(!subscription.endDate || subscription.endDate > new Date())
		);
	}

	/**
	 * Validate purchase input
	 */
	private async validatePurchaseInput(
		input: IPluginSubscriptionPurchaseInput,
		tenantId: string,
		organizationId?: string
	): Promise<void> {
		// Add validation logic here
		if (!input.pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		// Validate scope matches provided IDs
		if (input.scope === PluginScope.ORGANIZATION && !organizationId) {
			throw new BadRequestException('Organization ID is required for organization scope');
		}

		// Add more validation as needed
	}

	/**
	 * Calculate subscription dates based on billing period
	 * @param billingPeriod - The billing period
	 * @param trialDays - Number of trial days (0 if no trial)
	 */
	private calculateSubscriptionDates(billingPeriod: PluginBillingPeriod, trialDays: number = 0) {
		const startDate = new Date();
		let endDate: Date | undefined;
		let trialEndDate: Date | undefined;

		// Calculate trial end date if trial days are provided
		if (trialDays > 0) {
			trialEndDate = new Date(startDate);
			trialEndDate.setDate(trialEndDate.getDate() + trialDays);
		}

		switch (billingPeriod) {
			case PluginBillingPeriod.MONTHLY:
				endDate = new Date(startDate);
				endDate.setMonth(endDate.getMonth() + 1);
				break;
			case PluginBillingPeriod.YEARLY:
				endDate = new Date(startDate);
				endDate.setFullYear(endDate.getFullYear() + 1);
				break;
			case PluginBillingPeriod.QUARTERLY:
				endDate = new Date(startDate);
				endDate.setMonth(endDate.getMonth() + 3);
				break;
			case PluginBillingPeriod.WEEKLY:
				endDate = new Date(startDate);
				endDate.setDate(endDate.getDate() + 7);
				break;
			case PluginBillingPeriod.DAILY:
				endDate = new Date(startDate);
				endDate.setDate(endDate.getDate() + 1);
				break;
			case PluginBillingPeriod.ONE_TIME:
				// One-time payment, no renewal
				endDate = undefined;
				break;
		}

		return { startDate, endDate, trialEndDate };
	}

	/**
	 * Calculate next billing period
	 */
	private calculateNextBillingPeriod(billingPeriod: PluginBillingPeriod, currentDate: Date) {
		const nextDate = new Date(currentDate);
		let endDate: Date | undefined;

		switch (billingPeriod) {
			case PluginBillingPeriod.MONTHLY:
				nextDate.setMonth(nextDate.getMonth() + 1);
				endDate = new Date(nextDate);
				break;
			case PluginBillingPeriod.YEARLY:
				nextDate.setFullYear(nextDate.getFullYear() + 1);
				endDate = new Date(nextDate);
				break;
			case PluginBillingPeriod.QUARTERLY:
				nextDate.setMonth(nextDate.getMonth() + 3);
				endDate = new Date(nextDate);
				break;
			case PluginBillingPeriod.WEEKLY:
				nextDate.setDate(nextDate.getDate() + 7);
				endDate = new Date(nextDate);
				break;
		}

		return { endDate };
	}

	/**
	 * Ensure plugin tenant exists
	 * Uses the PluginTenantService to find or create a plugin tenant relationship
	 *
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - Optional organization ID
	 * @returns The plugin tenant ID
	 */
	private async ensurePluginTenantExists(
		pluginId: string,
		tenantId: string,
		organizationId?: string
	): Promise<string> {
		return this.pluginTenantService.findOrCreate(pluginId, tenantId, organizationId);
	}

	/**
	 * Calculate upgrade details including prorated amount
	 */
	private async calculateUpgradeDetails(subscription: IPluginSubscription, newPlanId: string) {
		// Get the new plan details
		const newPlan = await this.pluginSubscriptionPlanService.findOneByIdString(newPlanId);
		if (!newPlan) {
			throw new NotFoundException('New plan not found');
		}

		// TODO: Implement proper prorated calculation based on remaining subscription time
		return {
			proratedAmount: 15.0, // Calculate based on remaining time and price difference
			newPlanId
		};
	}

	/**
	 * Calculate downgrade details including credit amount
	 */
	private async calculateDowngradeDetails(subscription: IPluginSubscription, newPlanId: string) {
		// Get the new plan details
		const newPlan = await this.pluginSubscriptionPlanService.findOneByIdString(newPlanId);
		if (!newPlan) {
			throw new NotFoundException('New plan not found');
		}

		// TODO: Implement proper credit calculation based on remaining subscription time
		return {
			creditAmount: 5.0, // Calculate based on remaining time and price difference
			newPlanId
		};
	}

	/**
	 * Process credit refund for downgrades
	 * Note: This now creates a credit billing record instead of direct processing
	 */
	private async processCreditRefund(subscription: IPluginSubscription, downgradeDetails: any): Promise<void> {
		// TODO: Create a credit/refund billing record using CQRS commands
		console.log('Processing credit refund:', downgradeDetails.creditAmount);
	}

	/**
	 * Process payment - now delegates to billing commands
	 * TODO: Implement actual payment processing
	 */
	private async processPayment(
		subscription: IPluginSubscription
	): Promise<{ success: boolean; transactionId?: string }> {
		// This method now creates billing and processes payment through CQRS
		// Temporarily disabled until payment gateway is integrated
		try {
			const plan = await this.pluginSubscriptionPlanService.findOneByIdString(subscription.planId);
			if (!plan) {
				return { success: false };
			}

			const billingInput = await this.pluginBillingFactory.createForRenewal(
				subscription.id,
				plan,
				subscription.tenantId,
				subscription.organizationId
			);

			const billing = await this.commandBus.execute(new PluginBillingCreateCommand(billingInput));
			this.logger.log(`Payment billing created: ${billing.id} - Amount: ${billing.amount} ${billing.currency}`);

			// TODO: Process payment through payment gateway
			/*
			await this.commandBus.execute(
				new PluginBillingProcessPaymentCommand(billing.id, {
					paymentMethod: 'default'
				})
			);
			*/

			return { success: true, transactionId: billing.id };
		} catch (error) {
			this.logger.error(`Payment processing failed: ${error.message}`, error.stack);
			return { success: false };
		}
	}

	/**
	 * Handle failed payment - now handled by event handlers
	 */
	private async handleFailedPayment(subscription: IPluginSubscription): Promise<void> {
		// This is now handled by the PluginBillingFailedHandler event handler
		// Keep this method for backward compatibility
		await this.update(subscription.id, {
			status: PluginSubscriptionStatus.SUSPENDED
		} as IPluginSubscriptionUpdateInput);
	}
}
