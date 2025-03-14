import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InstallPluginCommand } from '../../commands/install-plugin.command';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { PluginInstallation } from '../../../domain/entities/plugin-installation.entity';
import { PluginService } from '../../../domain/services/plugin.service';
import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';

/**
 * Command handler for installing a plugin.
 */
@CommandHandler(InstallPluginCommand)
export class InstallPluginCommandHandler implements ICommandHandler<InstallPluginCommand> {
	constructor(
		/**
		 * Plugin installation service.
		 */
		private readonly installationService: PluginInstallationService,
		/**
		 * Plugin service.
		 */
		private readonly pluginService: PluginService
	) {}

	/**
	 * Executes the command to install a plugin.
	 *
	 * @param command - The install plugin command containing the input data.
	 * @returns A promise that resolves when the plugin installation is complete.
	 * @throws {NotFoundException} If the plugin is not found.
	 */
	public async execute(command: InstallPluginCommand): Promise<void> {
		const { input } = command;

		// Find the plugin by ID and version ID
		const plugin = await this.pluginService.findOneByOptions({
			where: {
				id: input.pluginId,
				versions: {
					id: input.versionId
				}
			}
		});

		// If the plugin is not found, throw a NotFoundException
		if (!plugin) {
			throw new NotFoundException(`Plugin with ID ${input.pluginId} and version ID ${input.versionId} not found`);
		}

		// Find the plugin installation by plugin ID and the current employee ID
		const installationExists = await this.installationService.findOneByOptions({
			where: {
				pluginId: input.pluginId,
				installedById: RequestContext.currentEmployeeId(),
				versionId: input.versionId
			}
		});

		// Create a new PluginInstallation entity
		const installation = installationExists ? installationExists : new PluginInstallation();
		installation.installedById = RequestContext.currentEmployeeId();
		installation.pluginId = input.pluginId;
		installation.status = PluginInstallationStatus.INSTALLED;
		installation.installedAt = new Date();
		installation.uninstalledAt = null;
		installation.versionId = input.versionId;

		// Save the installation record
		await this.installationService.save(installation);
	}
}
