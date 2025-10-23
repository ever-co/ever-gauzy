import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';
import { DeactivatePluginCommand } from '../../commands/deactivate-plugin.command';

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
	 * @throws NotFoundException if installation doesn't exist
	 */
	public async execute(command: DeactivatePluginCommand): Promise<void> {
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
	}
}
