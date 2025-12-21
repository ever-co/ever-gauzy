import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginBillingService } from '../../../../domain';
import { ProcessBillingCommand } from '../process-billing.command';

@CommandHandler(ProcessBillingCommand)
export class ProcessBillingCommandHandler implements ICommandHandler<ProcessBillingCommand> {
	constructor(private readonly pluginBillingService: PluginBillingService) {}

	async execute(command: ProcessBillingCommand) {
		const { id } = command;
		return this.pluginBillingService.markAsPaid(id);
	}
}
