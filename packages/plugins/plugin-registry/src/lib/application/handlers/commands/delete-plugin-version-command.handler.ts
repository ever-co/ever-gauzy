import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { DeletePluginVersionCommand } from '../../commands/delete-plugin-version.command';

@CommandHandler(DeletePluginVersionCommand)
export class DeletePluginVersionCommandHandler implements ICommandHandler<DeletePluginVersionCommand> {
	constructor(private readonly pluginVersionService: PluginVersionService) {}

	/**
	 * Executes the delete plugin command.
	 * It attempts to soft delete the plugin version by versionId and pluginId.
	 *
	 * @param command - The command containing the plugin version details
	 * @throws NotFoundException if the plugin version is not found
	 * @throws BadRequestException if the deletion fails
	 */
	public async execute(command: DeletePluginVersionCommand): Promise<void> {
		const { versionId, pluginId } = command;

		const count = await this.pluginVersionService.count({ where: { pluginId } });

		if (count <= 1) {
			throw new ForbiddenException('Cannot delete last version of plugin');
		}

		const result = await this.pluginVersionService.softDelete(versionId, {
			where: {
				pluginId
			}
		});

		if (!result) {
			throw new NotFoundException(`Plugin version with ID ${versionId} and plugin ID ${pluginId} not found.`);
		}
	}
}
