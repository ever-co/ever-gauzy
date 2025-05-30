import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { DeletePluginSourceCommand } from '../../commands/delete-plugin-source.command';

@CommandHandler(DeletePluginSourceCommand)
export class DeletePluginSourceCommandHandler implements ICommandHandler<DeletePluginSourceCommand> {
	constructor(private readonly pluginSourceService: PluginSourceService) {}

	/**
	 * Executes the delete plugin source command.
	 * It attempts to soft delete the plugin source by sourceId, versionId and pluginId.
	 *
	 * @param command - The command containing the plugin source details
	 * @throws NotFoundException if the plugin source is not found
	 * @throws BadRequestException if the deletion fails
	 */
	public async execute(command: DeletePluginSourceCommand): Promise<void> {
		const { versionId, pluginId, sourceId } = command;

		const count = await this.pluginSourceService.count({
			where: {
				version: {
					id: versionId,
					pluginId
				}
			},
			relations: ['version']
		});

		if (count <= 1) {
			throw new ForbiddenException('Cannot delete last source of plugin');
		}

		const result = await this.pluginSourceService.softDelete(sourceId, {
			where: {
				version: {
					id: versionId,
					pluginId
				}
			},
			relations: ['version']
		});

		if (!result) {
			throw new NotFoundException(
				`Plugin source with ID ${sourceId} not found or doesn't belong to the specified plugin version.`
			);
		}
	}
}
