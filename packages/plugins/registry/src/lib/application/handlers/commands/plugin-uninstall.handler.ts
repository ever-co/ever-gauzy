import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginUninstallCommand } from '../../commands';

@CommandHandler(PluginUninstallCommand)
export class PluginUninstallHandler implements ICommandHandler<PluginUninstallCommand> {
	async execute(command: PluginUninstallCommand): Promise<any> {
		const { input } = command;
		// TODO: Implement plugin uninstall logic
		return input;
	}
}
