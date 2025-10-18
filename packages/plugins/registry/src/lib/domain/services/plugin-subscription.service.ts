import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { FindManyOptions, FindOneOptions, MoreThan } from 'typeorm';
import { TenantAwareCrudService } from '@gauzy/core';
import { PluginSubscription } from '../entities/plugin-subscription.entity';
import { TypeOrmPluginSubscriptionRepository } from '../repositories/type-orm-plugin-subscription.repository';
import { MikroOrmPluginSubscriptionRepository } from '../repositories/mikro-orm-plugin-subscription.repository';
import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionUpdateInput,
	IPluginSubscriptionFindInput,
	IPluginSubscriptionPurchaseInput,
	PluginSubscriptionStatus,
	PluginSubscriptionType,
	PluginBillingPeriod
} from '../../shared/models/plugin-subscription.model';
import { PluginScope } from '../../shared/models/plugin-scope.model';

@Injectable()
export class PluginSubscriptionService extends TenantAwareCrudService<PluginSubscription> {
	constructor(
		public readonly typeOrmPluginSubscriptionRepository: TypeOrmPluginSubscriptionRepository,
		public readonly mikroOrmPluginSubscriptionRepository: MikroOrmPluginSubscriptionRepository
	) {
		super(typeOrmPluginSubscriptionRepository, mikroOrmPluginSubscriptionRepository);
	}

	/**
	 * Purchase a plugin subscription
	 */
	async purchaseSubscription(
		purchaseInput: IPluginSubscriptionPurchaseInput,
		tenantId: string,
		organizationId?: string,
		subscriberId?: string
	): Promise<IPluginSubscription> {
		// Validate purchase input
		await this.validatePurchaseInput(purchaseInput, tenantId, organizationId);

		// Check for existing active subscription
		const existingSubscription = await this.findActiveSubscription(
			purchaseInput.pluginId,
			tenantId,
			organizationId,
			subscriberId
		);

		if (existingSubscription) {
			throw new BadRequestException('An active subscription already exists for this plugin');
		}

		// Calculate subscription dates
		const { startDate, endDate, nextBillingDate, trialEndDate } = this.calculateSubscriptionDates(
			purchaseInput.billingPeriod
		);

		// Create plugin tenant relationship (assuming it exists or needs to be created)
		const pluginTenantId = await this.ensurePluginTenantExists(purchaseInput.pluginId, tenantId, organizationId);

		// Create subscription
		const subscriptionData: IPluginSubscriptionCreateInput = {
			pluginId: purchaseInput.pluginId,
			pluginTenantId,
			subscriptionType: purchaseInput.subscriptionType,
			scope: purchaseInput.scope,
			billingPeriod: purchaseInput.billingPeriod,
			status:
				purchaseInput.subscriptionType === PluginSubscriptionType.FREE
					? PluginSubscriptionStatus.ACTIVE
					: PluginSubscriptionStatus.PENDING,
			price: await this.getSubscriptionPrice(purchaseInput),
			currency: 'USD', // Default currency, should be configurable
			startDate,
			endDate,
			nextBillingDate,
			trialEndDate,
			autoRenew: purchaseInput.autoRenew,
			subscriberId,
			metadata: purchaseInput.metadata,
			tenantId,
			organizationId
		};

		const subscription = await this.create(subscriptionData);

		// Process payment if not free
		if (purchaseInput.subscriptionType !== PluginSubscriptionType.FREE) {
			await this.processSubscriptionPayment(subscription, purchaseInput);
		}

		return subscription;
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
			status: PluginSubscriptionStatus.ACTIVE
		};

		if (organizationId) {
			where.organizationId = organizationId;
		}

		if (subscriberId) {
			where.subscriberId = subscriberId;
		}

		return this.findOne({
			where,
			relations: ['plugin', 'tenant', 'subscriber']
		} as FindOneOptions);
	}

	/**
	 * Find subscriptions by plugin ID
	 */
	async findByPluginId(pluginId: string, relations: string[] = []): Promise<IPluginSubscription[]> {
		return this.findAll({
			where: { pluginId },
			relations,
			order: { createdAt: 'DESC' }
		} as FindManyOptions);
	}

	/**
	 * Find subscriptions by subscriber ID
	 */
	async findBySubscriberId(subscriberId: string, relations: string[] = []): Promise<IPluginSubscription[]> {
		return this.findAll({
			where: { subscriberId },
			relations,
			order: { createdAt: 'DESC' }
		} as FindManyOptions);
	}

	/**
	 * Cancel a subscription
	 */
	async cancelSubscription(subscriptionId: string, reason?: string): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		if (subscription.status === PluginSubscriptionStatus.CANCELLED) {
			throw new BadRequestException('Subscription is already cancelled');
		}

		return this.update(subscriptionId, {
			status: PluginSubscriptionStatus.CANCELLED,
			cancelledAt: new Date(),
			cancellationReason: reason,
			autoRenew: false
		} as IPluginSubscriptionUpdateInput);
	}

	/**
	 * Renew a subscription
	 */
	async renewSubscription(subscriptionId: string): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		const { nextBillingDate, endDate } = this.calculateNextBillingPeriod(
			subscription.billingPeriod,
			subscription.nextBillingDate || new Date()
		);

		return this.update(subscriptionId, {
			status: PluginSubscriptionStatus.ACTIVE,
			nextBillingDate,
			endDate
		} as IPluginSubscriptionUpdateInput);
	}

	/**
	 * Get expiring subscriptions
	 */
	async getExpiringSubscriptions(days: number = 7): Promise<IPluginSubscription[]> {
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + days);

		return this.findAll({
			where: {
				status: PluginSubscriptionStatus.ACTIVE,
				nextBillingDate: MoreThan(new Date()),
				autoRenew: true
			},
			relations: ['plugin', 'pluginTenant', 'subscriber']
		} as FindManyOptions);
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
	 */
	async hasPluginAccess(
		pluginId: string,
		tenantId: string,
		organizationId?: string,
		subscriberId?: string
	): Promise<boolean> {
		const subscription = await this.findActiveSubscription(pluginId, tenantId, organizationId, subscriberId);

		if (!subscription) {
			return false;
		}

		// Check if subscription is active and not expired
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
	 */
	private calculateSubscriptionDates(billingPeriod: PluginBillingPeriod) {
		const startDate = new Date();
		let endDate: Date | undefined;
		let nextBillingDate: Date | undefined;
		let trialEndDate: Date | undefined;

		switch (billingPeriod) {
			case PluginBillingPeriod.MONTHLY:
				nextBillingDate = new Date(startDate);
				nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
				endDate = new Date(nextBillingDate);
				break;
			case PluginBillingPeriod.YEARLY:
				nextBillingDate = new Date(startDate);
				nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
				endDate = new Date(nextBillingDate);
				break;
			case PluginBillingPeriod.QUARTERLY:
				nextBillingDate = new Date(startDate);
				nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
				endDate = new Date(nextBillingDate);
				break;
			case PluginBillingPeriod.WEEKLY:
				nextBillingDate = new Date(startDate);
				nextBillingDate.setDate(nextBillingDate.getDate() + 7);
				endDate = new Date(nextBillingDate);
				break;
			case PluginBillingPeriod.ONE_TIME:
				// One-time payment, no renewal
				break;
		}

		return { startDate, endDate, nextBillingDate, trialEndDate };
	}

	/**
	 * Calculate next billing period
	 */
	private calculateNextBillingPeriod(billingPeriod: PluginBillingPeriod, currentDate: Date) {
		const nextBillingDate = new Date(currentDate);
		let endDate: Date | undefined;

		switch (billingPeriod) {
			case PluginBillingPeriod.MONTHLY:
				nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
				endDate = new Date(nextBillingDate);
				break;
			case PluginBillingPeriod.YEARLY:
				nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
				endDate = new Date(nextBillingDate);
				break;
			case PluginBillingPeriod.QUARTERLY:
				nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
				endDate = new Date(nextBillingDate);
				break;
			case PluginBillingPeriod.WEEKLY:
				nextBillingDate.setDate(nextBillingDate.getDate() + 7);
				endDate = new Date(nextBillingDate);
				break;
		}

		return { nextBillingDate, endDate };
	}

	/**
	 * Get subscription price based on type and billing period
	 */
	private async getSubscriptionPrice(input: IPluginSubscriptionPurchaseInput): Promise<number> {
		// This should be integrated with a pricing service or configuration
		// For now, return static prices based on type and period

		if (input.subscriptionType === PluginSubscriptionType.FREE) {
			return 0;
		}

		const basePrices = {
			[PluginSubscriptionType.BASIC]: 10,
			[PluginSubscriptionType.PREMIUM]: 25,
			[PluginSubscriptionType.ENTERPRISE]: 100,
			[PluginSubscriptionType.CUSTOM]: 50
		};

		const periodMultipliers = {
			[PluginBillingPeriod.WEEKLY]: 0.25,
			[PluginBillingPeriod.MONTHLY]: 1,
			[PluginBillingPeriod.QUARTERLY]: 2.7,
			[PluginBillingPeriod.YEARLY]: 10,
			[PluginBillingPeriod.ONE_TIME]: 5,
			[PluginBillingPeriod.USAGE_BASED]: 1
		};

		const basePrice = basePrices[input.subscriptionType] || 0;
		const multiplier = periodMultipliers[input.billingPeriod] || 1;

		return basePrice * multiplier;
	}

	/**
	 * Ensure plugin tenant exists
	 */
	private async ensurePluginTenantExists(
		pluginId: string,
		tenantId: string,
		organizationId?: string
	): Promise<string> {
		// This would integrate with PluginTenantService to create or get existing relationship
		// For now, return a placeholder - this should be implemented properly
		return `${pluginId}-${tenantId}-${organizationId || 'no-org'}`;
	}

	/**
	 * Process subscription payment
	 */
	private async processSubscriptionPayment(
		subscription: IPluginSubscription,
		purchaseInput: IPluginSubscriptionPurchaseInput
	): Promise<void> {
		// Integrate with payment processing service
		console.log('Processing payment for subscription:', subscription.id);
		// Implementation depends on payment provider (Stripe, PayPal, etc.)
	}

	/**
	 * Process payment
	 */
	private async processPayment(
		subscription: IPluginSubscription
	): Promise<{ success: boolean; transactionId?: string }> {
		// Integrate with payment processing service
		console.log('Processing payment for subscription renewal:', subscription.id);
		// Implementation depends on payment provider
		return { success: true, transactionId: 'mock-transaction-id' };
	}

	/**
	 * Handle failed payment
	 */
	private async handleFailedPayment(subscription: IPluginSubscription): Promise<void> {
		await this.update(subscription.id, {
			status: PluginSubscriptionStatus.FAILED
		} as IPluginSubscriptionUpdateInput);

		// Send notification, retry logic, etc.
	}
}
