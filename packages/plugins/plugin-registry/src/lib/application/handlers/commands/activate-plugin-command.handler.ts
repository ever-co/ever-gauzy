import { RequestContext } from '@gauzy/core';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService } from '../../../domain/services/plugin.service';
import { IPlugin } from '../../../shared/models/plugin.model';
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
	 * @throws ForbiddenException if user doesn't have permission
	 * @throws NotFoundException if plugin doesn't exist
	 */
	public async execute(command: ActivatePluginCommand): Promise<void> {
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

			// Only update if plugin is not already active
			if (!plugin.isActive) {
				await this.commandBus.execute(new UpdatePluginCommand(pluginId, { isActive: true }));
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

		if (plugin.updatedByUserId !== employeeId) {
			throw new ForbiddenException("You don't have permission to activate this plugin");
		}

		return plugin;
	}
}
