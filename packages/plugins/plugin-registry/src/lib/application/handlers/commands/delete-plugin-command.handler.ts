import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';

import { PluginService } from '../../../domain/services/plugin.service';
import { DeactivatePluginCommand } from '../../commands/deactivate-plugin.command';
import { DeletePluginCommand } from '../../commands/delete-plugin.command';
import { RequestContext } from '@gauzy/core';
import { IPlugin } from '../../../shared/models/plugin.model';

@CommandHandler(DeletePluginCommand)
export class DeletePluginCommandHandler implements ICommandHandler<DeletePluginCommand> {
	constructor(
		private readonly pluginService: PluginService,
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Executes the delete plugin command
	 *
	 * @param command - The command containing the plugin ID to delete
	 * @throws NotFoundException if the plugin doesn't exist
	 * @throws BadRequestException if the deletion fails
	 */
	public async execute(command: DeletePluginCommand): Promise<void> {
		const { pluginId } = command;

		// Validate plugin ID
		if (!pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}

		// Start a transaction
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Verify that the plugin exists
			const plugin = await this.findPluginWithPermissionCheck(pluginId, RequestContext.currentEmployeeId());
			if (!plugin) {
				throw new NotFoundException(`Plugin with ID ${pluginId} not found`);
			}

			// Deactivate the plugin
			await this.commandBus.execute(new DeactivatePluginCommand(pluginId));

			// Delete the plugin
			await this.pluginService.delete(pluginId);

			// Commit the transaction
			await queryRunner.commitTransaction();
		} catch (error) {
			// Rollback the transaction on error
			await queryRunner.rollbackTransaction();

			// Rethrow specific errors
			if (error instanceof NotFoundException) {
				throw error;
			}

			// Wrap other errors
			throw new BadRequestException(`Failed to delete plugin: ${error.message}`);
		} finally {
			// Release resources
			await queryRunner.release();
		}
	}

	/**
	 * Helper method to find plugin and verify permissions
	 */
	private async findPluginWithPermissionCheck(pluginId: string, employeeId: string): Promise<IPlugin> {
		const plugin = await this.pluginService.findOneByWhereOptions({
			id: pluginId
		});

		if (!plugin) {
			throw new NotFoundException(`Plugin with ID ${pluginId} not found`);
		}

		if (plugin.uploadedById !== employeeId) {
			throw new ForbiddenException("You don't have permission to delete this plugin");
		}

		return plugin;
	}
}
