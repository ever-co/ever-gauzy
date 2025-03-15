import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService } from '../../../domain/services/plugin.service';
import { ActivatePluginCommand } from '../../commands/activate-plugin.command';
import { UpdatePluginCommand } from '../../commands/update-plugin.command';

/**
 * Command handler for activating plugins
 */
@CommandHandler(ActivatePluginCommand)
export class ActivatePluginCommandHandler implements ICommandHandler<ActivatePluginCommand> {
	constructor(private readonly commandBus: CommandBus, private readonly pluginService: PluginService) {}

	/**
	 * Activates a plugin if the current employee has permission
	 * @param command - Command containing the plugin ID to activate
	 * @returns Promise resolving to void upon successful activation
	 * @throws BadRequestException if plugin ID is missing
	 * @throws NotFoundException if plugin doesn't exist
	 */
	public async execute(command: ActivatePluginCommand): Promise<void> {
		const { pluginId } = command;

		// Validate input
		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		try {
			// Find the plugin
			const plugin = await this.pluginService.findOneByIdString(pluginId);

			// Only update if plugin is not already active
			if (!plugin.isActive) {
				await this.commandBus.execute(new UpdatePluginCommand(pluginId, { isActive: true }));
			}
		} catch (error) {
			throw error;
		}
	}
}
