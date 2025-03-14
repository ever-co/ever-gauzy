import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PluginService } from '../../../domain/services/plugin.service';
import { DeletePluginCommand } from '../../commands/delete-plugin.command';

@CommandHandler(DeletePluginCommand)
export class DeletePluginCommandHandler implements ICommandHandler<DeletePluginCommand> {
	constructor(private readonly pluginService: PluginService, private readonly dataSource: DataSource) {}

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
			const plugin = await this.pluginService.findOneByIdString(pluginId);
			if (!plugin) {
				throw new NotFoundException(`Plugin with ID ${pluginId} not found`);
			}

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
}
