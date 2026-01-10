import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginService } from '../../../../domain';
import { DeletePluginCommand } from '../delete-plugin.command';

@CommandHandler(DeletePluginCommand)
export class DeletePluginCommandHandler implements ICommandHandler<DeletePluginCommand> {
	constructor(private readonly pluginService: PluginService) {}

	/**
	 * Executes the delete plugin command
	 *
	 * @param command - The command containing the plugin ID to delete
	 * @throws NotFoundException if the plugin doesn't exist
	 * @throws BadRequestException if the deletion fails
	 */
	public async execute(command: DeletePluginCommand) {
		const { pluginId } = command;

		// Validate plugin ID
		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		try {
			// Verify that the plugin exists before attempting deletion
			const plugin = await this.pluginService.findOneOrFailByIdString(pluginId);

			if (!plugin.success) {
				throw new NotFoundException(`Plugin with ID ${pluginId} not found`);
			}

			// Delete the plugin
			await this.pluginService.softDelete(pluginId);

			return {
				message: `Plugin with ID ${pluginId} has been deleted successfully`,
				status: HttpStatus.OK
			};
		} catch (error) {
			// Rethrow specific errors
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}

			// Wrap unexpected errors
			throw new BadRequestException(`Failed to delete plugin: ${error.message}`);
		}
	}
}
