import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { CreatePluginSubscriptionCommand } from '../create-plugin-subscription.command';

@CommandHandler(CreatePluginSubscriptionCommand)
export class CreatePluginSubscriptionCommandHandler implements ICommandHandler<CreatePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: CreatePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { createDto } = command;

		// Transform date strings to Date objects for service compatibility
		const transformedDto = {
			...createDto,
			scope: createDto.scope,
			pluginTenantId: createDto.pluginTenantId,
			status: createDto.status ?? PluginSubscriptionStatus.ACTIVE, // Default to active if not specified
			autoRenew: createDto.autoRenew ?? false, // Default to false if not specified
			...(createDto.startDate && { startDate: new Date(createDto.startDate) }),
			...(createDto.endDate && { endDate: new Date(createDto.endDate) }),
			...(createDto.trialEndDate && { trialEndDate: new Date(createDto.trialEndDate) })
		};

		// Check if user already has a subscription for this plugin
		// The subscriberId might be in metadata or as a passed property
		const subscriberId = transformedDto.metadata?.subscriberId || (transformedDto as any).subscriberId;

		if (subscriberId && createDto.pluginId) {
			const existingSubscription = await this.pluginSubscriptionService.findOneByOptions({
				where: {
					pluginId: createDto.pluginId,
					subscriberId: subscriberId
				}
			});

			if (existingSubscription) {
				// If user has an active or trial subscription, reject the creation
				if (
					[
						PluginSubscriptionStatus.ACTIVE,
						PluginSubscriptionStatus.PENDING,
						PluginSubscriptionStatus.TRIAL
					].includes(existingSubscription.status)
				) {
					throw new BadRequestException(
						'You already have an active subscription for this plugin. Please use upgrade or downgrade to change your plan.'
					);
				}

				// If the existing subscription is cancelled or expired, we need to delete it before creating new one
				// This ensures we don't violate the unique constraint on pluginId + subscriberId
				if (
					existingSubscription.status === PluginSubscriptionStatus.CANCELLED ||
					existingSubscription.status === PluginSubscriptionStatus.EXPIRED
				) {
					console.log(
						`Deleting ${existingSubscription.status} subscription ${existingSubscription.id} to replace with new subscription`
					);
					// Delete the old subscription to avoid unique constraint violation
					await this.pluginSubscriptionService.delete(existingSubscription.id);
				}
			}
		}

		try {
			return await this.pluginSubscriptionService.create(transformedDto);
		} catch (error) {
			throw new BadRequestException(`Failed to create plugin subscription: ${error.message}`);
		}
	}
}
