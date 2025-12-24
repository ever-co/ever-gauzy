import { PluginInstallationStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../../domain';
import { ActivatePluginCommand } from '../activate-plugin.command';

/**
 * Command handler for activating plugin installations
 */
@CommandHandler(ActivatePluginCommand)
export class ActivatePluginCommandHandler implements ICommandHandler<ActivatePluginCommand> {
	constructor(private readonly pluginInstallationService: PluginInstallationService) {}

	/**
	 * Activates a plugin installation if the current user has permission
	 * @param command - Command containing the installation ID to activate
	 * @returns Promise resolving to void upon successful activation
	 * @throws BadRequestException if installation ID is missing
	 * @throws NotFoundException if installation doesn't exist
	 */
	public async execute(command: ActivatePluginCommand) {
		// Get current user and context
		const currentUser = RequestContext.currentUser();
		// Get employeeId - may be null for users without employee records or with CHANGE_SELECTED_EMPLOYEE permission
		const installedById = currentUser?.employeeId || null;
		// Extract installation ID and plugin ID from command
		const { installationId, pluginId } = command;

		// Validate input
		if (!installationId) {
			throw new BadRequestException('Plugin installation ID is required');
		}

		// Find the plugin installation
		const found = await this.pluginInstallationService.findOneOrFailByWhereOptions({
			id: installationId,
			installedById,
			pluginId
		});

		if (!found.success) {
			throw new ForbiddenException('You do not have permission to activate this plugin installation');
		}

		// Get the installation record
		const installation = found.record;

		// Ensure installation is in INSTALLED status before activation
		if (installation.status !== PluginInstallationStatus.INSTALLED) {
			throw new BadRequestException('Plugin must be installed before it can be activated');
		}

		// Only update if plugin installation is not already activated
		if (!installation.isActivated) {
			await this.pluginInstallationService.update(installationId, {
				isActivated: true,
				activatedAt: new Date(),
				deactivatedAt: null // Clear any previous deactivation date
			});
		}

		return {
			success: true,
			message: 'Plugin activated successfully'
		};
	}
}
