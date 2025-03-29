import { RequestContext } from '@gauzy/core';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallation } from '../../../domain/entities/plugin-installation.entity';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';
import { InstallPluginCommand } from '../../commands/install-plugin.command';

/**
 * Command handler responsible for handling the installation of plugins.
 */
@CommandHandler(InstallPluginCommand)
export class InstallPluginCommandHandler implements ICommandHandler<InstallPluginCommand> {
	constructor(
		/**
		 * Service responsible for handling plugin installation logic.
		 */
		private readonly installationService: PluginInstallationService
	) {}

	/**
	 * Executes the command to install a plugin.
	 *
	 * @param command - The install plugin command containing the plugin ID and version information.
	 * @returns A promise that resolves when the plugin installation is completed.
	 * @throws {NotFoundException} If the plugin installation entry is not found.
	 */
	public async execute(command: InstallPluginCommand): Promise<void> {
		const {
			pluginId,
			input: { versionId }
		} = command;
		const installedById = RequestContext.currentEmployeeId();

		// Find existing plugin installation
		const found = await this.installationService.findOneOrFailByWhereOptions({
			pluginId,
			versionId,
			installedById,
			status: PluginInstallationStatus.INSTALLED
		});

		if (found.success) {
			// Plugin is already installed, no further action needed
			return;
		}

		// Create or update the PluginInstallation entity
		const installation = Object.assign(new PluginInstallation(), {
			installedById,
			pluginId,
			versionId,
			status: PluginInstallationStatus.INSTALLED,
			installedAt: new Date(),
			uninstalledAt: null
		});

		// Persist the plugin installation record
		await this.installationService.save(installation);
	}
}
