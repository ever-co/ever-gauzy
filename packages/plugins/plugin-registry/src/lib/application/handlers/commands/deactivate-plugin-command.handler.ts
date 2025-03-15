import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService } from '../../../domain/services/plugin.service';
import { DeactivatePluginCommand } from '../../commands/deactivate-plugin.command';
import { UpdatePluginCommand } from '../../commands/update-plugin.command';

/**
 * Command handler for deactivating plugins
 */
@CommandHandler(DeactivatePluginCommand)
export class DeactivatePluginCommandHandler implements ICommandHandler<DeactivatePluginCommand> {
	constructor(private readonly commandBus: CommandBus, private readonly pluginService: PluginService) {}

	/**
	 * Deactivates a plugin if the current employee has permission
	 * @param command - Command containing the plugin ID to deactivate
	 * @returns Promise resolving to void upon successful deactivation
	 * @throws BadRequestException if plugin ID is missing
	 * @throws NotFoundException if plugin doesn't exist
	 */
	public async execute(command: DeactivatePluginCommand): Promise<void> {
		const { pluginId } = command;

		// Validate input
		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		try {
			// Find the plugin
			const plugin = await this.pluginService.findOneByIdString(pluginId);

			// Only update if plugin is currently active
			if (plugin.isActive) {
				await this.commandBus.execute(new UpdatePluginCommand(pluginId, { isActive: false }));
			}
		} catch (error) {
			throw error;
		}
	}
}
