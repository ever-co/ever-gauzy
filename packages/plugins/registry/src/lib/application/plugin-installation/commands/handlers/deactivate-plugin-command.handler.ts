import { PluginInstallationStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../../domain';
import { DeactivatePluginCommand } from '../deactivate-plugin.command';

/**
 * Command handler for deactivating plugin installations
 */
@CommandHandler(DeactivatePluginCommand)
export class DeactivatePluginCommandHandler implements ICommandHandler<DeactivatePluginCommand> {
	constructor(private readonly pluginInstallationService: PluginInstallationService) {}

	/**
	 * Deactivates a plugin installation if the current user has permission
	 * @param command - Command containing the installation ID to deactivate
	 * @returns Promise resolving to void upon successful deactivation
	 * @throws BadRequestException if installation ID is missing
	 * @throws ForbiddenException if the installation is not the caller's installation of the plugin
	 */
	public async execute(command: DeactivatePluginCommand) {
		// The caller's own installation of the plugin of the path, as activating it requires: the installation was
		// read by its id alone, so any member with access to a plugin could switch a colleague's installation off.
		const installedById = RequestContext.currentUser()?.employeeId || null;
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
			throw new ForbiddenException('You do not have permission to deactivate this plugin installation');
		}

		// Get the installation record
		const installation = found.record;

		// Ensure installation is in INSTALLED status
		if (installation.status !== PluginInstallationStatus.INSTALLED) {
			throw new BadRequestException('Only installed plugins can be deactivated');
		}

		// Only update if plugin installation is currently activated
		if (installation.isActivated) {
			await this.pluginInstallationService.update(installationId, {
				isActivated: false,
				deactivatedAt: new Date()
			});
		}

		return {
			success: true,
			message: 'Plugin deactivated successfully'
		};
	}
}
