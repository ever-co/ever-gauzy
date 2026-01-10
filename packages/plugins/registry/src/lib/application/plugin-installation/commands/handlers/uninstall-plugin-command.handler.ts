import { PluginInstallationStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginInstallationService } from '../../../../domain';
import { UninstallPluginCommand } from '../uninstall-plugin.command';
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
		// Get current user and context
		const currentUser = RequestContext.currentUser();
		// Get employeeId - may be null for users without employee records or with CHANGE_SELECTED_EMPLOYEE permission
		const installedById = currentUser?.employeeId || null;
		const { pluginId } = command;

		// Find the plugin installation by plugin ID and the current employee ID
		const found = await this.installationService.findOneOrFailByWhereOptions({
			pluginId,
			installedById,
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
