import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSubscriptionService } from '../../../../domain';
import { ProcessBillingCommand } from '../process-billing.command';

@CommandHandler(ProcessBillingCommand)
export class ProcessBillingCommandHandler implements ICommandHandler<ProcessBillingCommand> {
	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	async execute(command: ProcessBillingCommand): Promise<{ success: boolean; message: string }> {
		const { id } = command;

		try {
			const success = await this.pluginSubscriptionService.processBilling(id);

			return {
				success,
				message: success ? 'Billing processed successfully' : 'Billing processing failed'
			};
		} catch (error) {
			throw new BadRequestException(`Failed to process billing: ${error.message}`);
		}
	}
}
