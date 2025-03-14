import { RequestContext } from '@gauzy/core';
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../domain/services/plugin-installation.service';
import { PluginInstallationStatus } from '../../../shared/models/plugin-installation.model';
import { UninstallPluginCommand } from '../../commands/uninstall-plugin.command';

/**
 * Command handler for uninstalling a plugin.
 */
@CommandHandler(UninstallPluginCommand)
export class UninstallPluginCommandHandler implements ICommandHandler<UninstallPluginCommand> {
	/**
	 * Constructor for UninstallPluginCommandHandler.
	 *
	 * @param installationService - The plugin installation service.
	 */
	constructor(private readonly installationService: PluginInstallationService) {}

	/**
	 * Executes the command to uninstall a plugin.
	 *
	 * @param command - The uninstall plugin command containing the input data.
	 * @returns A promise that resolves when the plugin uninstallation is complete.
	 * @throws {NotFoundException} If the plugin installation is not found.
	 */
	public async execute(command: UninstallPluginCommand): Promise<void> {
		const { pluginId } = command;

		// Find the plugin installation by plugin ID and the current employee ID
		const installation = await this.installationService.findOneByOptions({
			where: {
				pluginId,
				installedById: RequestContext.currentEmployeeId()
			}
		});

		// If the installation is not found, throw a NotFoundException
		if (!installation) {
			throw new NotFoundException(`Installation of the plugin with ID ${pluginId} not found`);
		}

		// Update the installation status and uninstalled date
		installation.status = PluginInstallationStatus.UNINSTALLED;
		installation.uninstalledAt = new Date();

		// Save the updated installation record
		await this.installationService.save(installation);
	}
}
