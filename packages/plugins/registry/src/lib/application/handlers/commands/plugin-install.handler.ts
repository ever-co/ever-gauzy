import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallCommand } from '../../commands';

@CommandHandler(PluginInstallCommand)
export class PluginInstallHandler implements ICommandHandler<PluginInstallCommand> {
	async execute(command: PluginInstallCommand): Promise<any> {
		const { input } = command;
		// TODO: Implement plugin install logic
		return input;
	}
}
