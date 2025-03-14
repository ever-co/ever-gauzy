import { RequestContext } from '@gauzy/core';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService } from '../../../domain/services/plugin.service';
import { IPlugin } from '../../../shared/models/plugin.model';
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
	 * @throws ForbiddenException if user doesn't have permission
	 * @throws NotFoundException if plugin doesn't exist
	 */
	public async execute(command: DeactivatePluginCommand): Promise<void> {
		const { pluginId } = command;

		// Validate input
		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		// Get current employee ID from context
		const employeeId = RequestContext.currentEmployeeId();
		if (!employeeId) {
			throw new ForbiddenException('Employee context is required');
		}

		try {
			// Find the plugin with permission check
			const plugin = await this.findPluginWithPermissionCheck(pluginId, employeeId);

			// Only update if plugin is currently active
			if (plugin.isActive) {
				await this.commandBus.execute(new UpdatePluginCommand(pluginId, { isActive: false }));
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Helper method to find plugin and verify permissions
	 */
	private async findPluginWithPermissionCheck(pluginId: string, employeeId: string): Promise<IPlugin> {
		const plugin = await this.pluginService.findOneByWhereOptions({
			id: pluginId
		});

		if (!plugin) {
			throw new NotFoundException(`Plugin with ID ${pluginId} not found`);
		}

		if (plugin.uploadedById !== employeeId) {
			throw new ForbiddenException("You don't have permission to deactivate this plugin");
		}

		return plugin;
	}
}
