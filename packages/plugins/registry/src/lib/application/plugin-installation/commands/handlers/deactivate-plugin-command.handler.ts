import { PluginInstallationStatus } from '@gauzy/contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
	 * @throws NotFoundException if installation doesn't exist
	 */
	public async execute(command: DeactivatePluginCommand) {
		const { installationId } = command;

		// Validate input
		if (!installationId) {
			throw new BadRequestException('Plugin installation ID is required');
		}

		// Find the plugin installation
		const found = await this.pluginInstallationService.findOneOrFailByIdString(installationId);

		if (!found.success) {
			throw new NotFoundException('Plugin installation not found');
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
