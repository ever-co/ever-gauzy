import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { PluginSubscriptionPlanService, PluginSubscriptionService, PluginTenantService } from '../../../../domain';
import { PluginSubscription } from '../../../../domain/entities';
import { IPluginSubscription, PluginBillingPeriod, PluginScope, PluginSubscriptionStatus } from '../../../../shared';
import { PurchasePluginSubscriptionCommand } from '../purchase-plugin-subscription.command';

@CommandHandler(PurchasePluginSubscriptionCommand)
export class PurchasePluginSubscriptionCommandHandler implements ICommandHandler<PurchasePluginSubscriptionCommand> {
	constructor(
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginTenantService: PluginTenantService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService
	) {}

	/**
	 * Execute plugin subscription purchase with proper handling for free vs paid plans.
	 *
	 * Business Rules:
	 * 1. Free Plans: Automatically create USER-scoped subscriptions with immediate ACTIVE status
	 * 2. Paid Plans: Create subscriptions at the requested scope (TENANT/ORGANIZATION/USER) with PENDING status until payment
	 * 3. Trial Plans: Create subscriptions with TRIAL status and set trial end date
	 *
	 * @param command - The purchase command with subscription details
	 * @returns The created subscription
	 */
	async execute(command: PurchasePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { purchaseDto, tenantId, organizationId, userId } = command;

		// Validate required parameters
		if (!purchaseDto.pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}
		if (!tenantId) {
			throw new BadRequestException('Tenant ID is required');
		}

		if (!organizationId) {
			throw new BadRequestException('Organization ID is required for ORGANIZATION scope subscription');
		}

		if (!userId) {
			throw new BadRequestException('User ID is required for USER scope subscription');
		}

		// Check for existing subscription based on scope
		const options: FindOptionsWhere<PluginSubscription> = {
			pluginId: purchaseDto.pluginId
		};

		options.subscriberId = userId;

		options.organizationId = organizationId;

		options.tenantId = tenantId;

		const { record: existingSubscription, success } =
			await this.pluginSubscriptionService.findOneOrFailByWhereOptions(options);

		if (success && existingSubscription) {
			// If user has an active or trial subscription, reject the purchase
			if (
				[
					PluginSubscriptionStatus.ACTIVE,
					PluginSubscriptionStatus.TRIAL,
					PluginSubscriptionStatus.PENDING
				].includes(existingSubscription.status)
			) {
				throw new BadRequestException(
					'You already have an active subscription for this plugin. Please use upgrade or downgrade to change your plan.'
				);
			}
			console.log(
				`[PurchaseSubscription] Deleting ${existingSubscription.status} subscription ${existingSubscription.id} to replace with new purchase`
			);
			// Delete the old subscription to avoid unique constraint violation
			await this.pluginSubscriptionService.delete(existingSubscription.id);
		}

		const pluginTenantInput = {
			pluginId: purchaseDto.pluginId,
			tenantId,
			organizationId,
			scope: purchaseDto.scope
		};

		let subscription: PluginSubscription;

		// Handle subscription based on plan type
		if (purchaseDto.planId) {
			// Plan-based subscription
			const plan = await this.pluginSubscriptionPlanService.findOneByIdString(purchaseDto.planId);
			if (!plan) {
				throw new BadRequestException(`Plugin subscription plan with ID "${purchaseDto.planId}" not found`);
			}

			// Ensure plugin tenant relationship exists
			const pluginTenantId = await this.pluginTenantService.findOrCreate({
				...pluginTenantInput,
				...(plan.hasLimitations && {
					maxActiveUsers: plan.limitations?.['maxUsers'],
					maxInstallations: plan.limitations?.['maxProjects']
				})
			});

			if (plan.isFree) {
				// Free plan - create immediate active subscription
				subscription = PluginSubscription.createFreeSubscription(
					purchaseDto.pluginId,
					pluginTenantId,
					tenantId,
					userId,
					organizationId
				);
				subscription.planId = purchaseDto.planId;
				subscription.scope = purchaseDto.scope; // Use requested scope
			} else if (plan.hasTrial) {
				// Trial plan - create trial subscription
				subscription = PluginSubscription.createTrialSubscription(
					purchaseDto.pluginId,
					pluginTenantId,
					tenantId,
					purchaseDto.planId,
					plan.trialDays || 7, // Default to 7 days if not specified
					purchaseDto.scope,
					userId,
					organizationId
				);
			} else {
				// Paid plan - create pending subscription
				const endDate = this.calculateSubscriptionEndDate(plan.billingPeriod);
				subscription = PluginSubscription.createPaidSubscription(
					purchaseDto.pluginId,
					pluginTenantId,
					tenantId,
					purchaseDto.planId,
					purchaseDto.scope,
					endDate,
					userId,
					organizationId,
					purchaseDto.paymentMethod
				);
			}
		} else {
			// Get or create plugin tenant relationship
			const pluginTenantId = await this.pluginTenantService.findOrCreate(pluginTenantInput);
			// No plan specified - create free subscription
			subscription = PluginSubscription.createFreeSubscription(
				purchaseDto.pluginId,
				pluginTenantId,
				tenantId,
				userId,
				organizationId
			);
			// Ensure scope is set correctly for free subscription if not USER
			if (purchaseDto.scope !== PluginScope.USER) {
				subscription.scope = PluginScope.USER;
			}
		}

		// Set additional properties from purchase DTO
		subscription.autoRenew = purchaseDto.autoRenew;

		// Merge metadata
		if (purchaseDto.metadata) {
			subscription.metadata = {
				...subscription.metadata,
				...purchaseDto.metadata
			};
		}

		// Add purchase metadata
		if (purchaseDto.promoCode) {
			subscription.metadata = {
				...subscription.metadata,
				promoCode: purchaseDto.promoCode
			};
		}

		// Save the subscription
		return await this.pluginSubscriptionService.create(subscription);
	}

	/**
	 * Calculate subscription end date based on billing period
	 * @param billingPeriod - The billing period
	 * @returns The end date for the subscription
	 */
	private calculateSubscriptionEndDate(billingPeriod: PluginBillingPeriod): Date {
		const endDate = new Date();

		switch (billingPeriod) {
			case PluginBillingPeriod.DAILY:
				endDate.setDate(endDate.getDate() + 1);
				break;
			case PluginBillingPeriod.WEEKLY:
				endDate.setDate(endDate.getDate() + 7);
				break;
			case PluginBillingPeriod.MONTHLY:
				endDate.setMonth(endDate.getMonth() + 1);
				break;
			case PluginBillingPeriod.QUARTERLY:
				endDate.setMonth(endDate.getMonth() + 3);
				break;
			case PluginBillingPeriod.YEARLY:
				endDate.setFullYear(endDate.getFullYear() + 1);
				break;
			case PluginBillingPeriod.ONE_TIME:
				// For one-time payments, set end date far in the future
				endDate.setFullYear(endDate.getFullYear() + 99);
				break;
			case PluginBillingPeriod.USAGE_BASED:
			default:
				// Default to monthly for usage-based and unknown billing periods
				endDate.setMonth(endDate.getMonth() + 1);
				break;
		}

		return endDate;
	}
}
