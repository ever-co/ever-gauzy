import { RequestContext } from '@gauzy/core';
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
		const found = await this.installationService.findOneOrFailByWhereOptions({
			pluginId,
			installedById: RequestContext.currentEmployeeId(),
			status: PluginInstallationStatus.INSTALLED
		});

		// If the installation is not found, throw a NotFoundException
		if (!found.success) {
			// No further action needed
			return;
		}

		// Assign found installation
		const { id } = found.record;

		// Update the installation status and uninstalled date
		await this.installationService.update(id, {
			status: PluginInstallationStatus.UNINSTALLED,
			uninstalledAt: new Date()
		});
	}
}
