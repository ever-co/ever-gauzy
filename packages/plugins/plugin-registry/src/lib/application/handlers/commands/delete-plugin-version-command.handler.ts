import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { DeletePluginVersionCommand } from '../../commands/delete-plugin-version.command';
import { NotFoundException, BadRequestException } from '@nestjs/common';

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

		try {
			const result = await this.pluginVersionService.softDelete(versionId, {
				where: {
					pluginId
				}
			});

			if (!result) {
				throw new NotFoundException(`Plugin version with ID ${versionId} and plugin ID ${pluginId} not found.`);
			}
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new BadRequestException(`Failed to delete plugin version with ID ${versionId}.`);
		}
	}
}
