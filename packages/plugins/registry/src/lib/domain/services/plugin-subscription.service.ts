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
		const { startDate, endDate, trialEndDate } = this.calculateSubscriptionDates(purchaseInput.billingPeriod);

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
			startDate,
			endDate,
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

		try {
			return await this.findOneByOptions({
				where,
				relations: ['plugin', 'tenant', 'subscriber']
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
	 */
	async cancelSubscription(subscriptionId: string, reason?: string): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

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
	 */
	async renewSubscription(subscriptionId: string): Promise<IPluginSubscription> {
		const subscription = await this.findOneByIdString(subscriptionId);
		if (!subscription) {
			throw new NotFoundException('Subscription not found');
		}

		const { endDate } = this.calculateNextBillingPeriod(
			subscription.billingPeriod,
			subscription.endDate || new Date()
		);

		await this.update(subscriptionId, {
			status: PluginSubscriptionStatus.ACTIVE,
			endDate
		} as IPluginSubscriptionUpdateInput);

		return await this.findOneByIdString(subscriptionId);
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
		let trialEndDate: Date | undefined;

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
			case PluginBillingPeriod.ONE_TIME:
				// One-time payment, no renewal
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
