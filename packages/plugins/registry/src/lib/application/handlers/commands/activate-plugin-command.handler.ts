import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';
import { ActivatePluginCommand } from '../../commands/activate-plugin.command';

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
	public async execute(command: ActivatePluginCommand): Promise<void> {
		const { installationId } = command;

		// Validate input
		if (!installationId) {
			throw new BadRequestException('Plugin installation ID is required');
		}

		// Find the plugin installation
		const installation = await this.pluginInstallationService.findOneByIdString(installationId);
		if (!installation) {
			throw new NotFoundException('Plugin installation not found');
		}

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
	}
}
