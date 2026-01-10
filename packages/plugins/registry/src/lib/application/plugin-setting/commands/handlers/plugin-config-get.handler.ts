import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginConfigGetCommand } from '../plugin-config-get.command';

@CommandHandler(PluginConfigGetCommand)
export class PluginConfigGetHandler implements ICommandHandler<PluginConfigGetCommand> {
	async execute(command: PluginConfigGetCommand): Promise<any> {
		const { input } = command;
		// TODO: Implement plugin config get logic
		return input;
	}
}
