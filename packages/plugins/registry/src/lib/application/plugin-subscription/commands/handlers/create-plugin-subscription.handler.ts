import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription, PluginSubscriptionStatus } from '../../../../shared';
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

		try {
			return await this.pluginSubscriptionService.create(transformedDto);
		} catch (error) {
			throw new BadRequestException(`Failed to create plugin subscription: ${error.message}`);
		}
	}
}
