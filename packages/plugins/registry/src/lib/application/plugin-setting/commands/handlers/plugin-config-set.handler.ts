import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginConfigSetCommand } from '../plugin-config-set.command';

@CommandHandler(PluginConfigSetCommand)
export class PluginConfigSetHandler implements ICommandHandler<PluginConfigSetCommand> {
	async execute(command: PluginConfigSetCommand): Promise<any> {
		const { input } = command;
		// TODO: Implement plugin config set logic
		return input;
	}
}
