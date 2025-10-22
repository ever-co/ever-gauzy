import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { PurchasePluginSubscriptionCommand } from '../../commands';
import { PluginSubscriptionService } from '../../../domain/services';
import { IPluginSubscription } from '../../../shared/models';

@CommandHandler(PurchasePluginSubscriptionCommand)
export class PurchasePluginSubscriptionCommandHandler implements ICommandHandler<PurchasePluginSubscriptionCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: PurchasePluginSubscriptionCommand): Promise<IPluginSubscription> {
		const { purchaseDto, tenantId, organizationId, userId } = command;

		try {
			return await this.pluginSubscriptionService.purchaseSubscription(
				purchaseDto,
				tenantId,
				organizationId,
				userId
			);
		} catch (error) {
			throw new BadRequestException(`Failed to purchase plugin subscription: ${error.message}`);
		}
	}
}
