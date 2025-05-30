import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { RecoverPluginSourceCommand } from '../../commands/recover-plugin-source.command';

/**
 * Command handler responsible for recovering a soft-deleted plugin source.
 */
@CommandHandler(RecoverPluginSourceCommand)
export class RecoverPluginSourceCommandHandler implements ICommandHandler<RecoverPluginSourceCommand> {
	constructor(private readonly pluginSourceService: PluginSourceService) {}

	/**
	 * Executes the recover plugin source command.
	 * This method attempts to restore a previously soft-deleted plugin source.
	 *
	 * @param command - The command containing the plugin source ID, version ID and associated plugin ID.
	 * @throws NotFoundException if the specified plugin source is not found.
	 * @throws BadRequestException if the recovery operation fails.
	 */
	public async execute(command: RecoverPluginSourceCommand): Promise<void> {
		const { versionId, pluginId, sourceId } = command;

		const result = await this.pluginSourceService.softRecover(versionId, {
			where: { id: sourceId, version: { id: versionId, pluginId } },
			relations: ['version'],
			withDeleted: true
		});

		if (!result) {
			throw new NotFoundException(
				`Soft-deleted plugin source with ID ${sourceId}, version ID ${versionId} and plugin ID $:console.warn();
				{pluginId} not found.`
			);
		}
	}
}
