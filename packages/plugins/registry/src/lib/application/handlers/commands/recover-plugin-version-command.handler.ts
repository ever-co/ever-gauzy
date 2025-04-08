import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { RecoverPluginVersionCommand } from '../../commands/recover-plugin-version.command';

/**
 * Command handler responsible for recovering a soft-deleted plugin version.
 */
@CommandHandler(RecoverPluginVersionCommand)
export class RecoverPluginVersionCommandHandler implements ICommandHandler<RecoverPluginVersionCommand> {
	constructor(private readonly pluginVersionService: PluginVersionService) {}

	/**
	 * Executes the recover plugin version command.
	 * This method attempts to restore a previously soft-deleted plugin version.
	 *
	 * @param command - The command containing the plugin version ID and associated plugin ID.
	 * @throws NotFoundException if the specified plugin version is not found.
	 * @throws BadRequestException if the recovery operation fails.
	 */
	public async execute(command: RecoverPluginVersionCommand): Promise<void> {
		const { versionId, pluginId } = command;

		const result = await this.pluginVersionService.softRecover(versionId, {
			where: { pluginId },
			withDeleted: true
		});

		if (!result) {
			throw new NotFoundException(
				`Soft-deleted plugin version with ID ${versionId} and plugin ID ${pluginId} not found.`
			);
		}
	}
}
