import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { PluginTagService } from '../../../../domain';
import { IPluginTag } from '../../../../shared';
import {
	BulkDeletePluginTagsCommand,
	DeletePluginTagCommand,
	ReplacePluginTagsCommand
} from '../delete-plugin-tag.command';

/**
 * Handler for deleting single plugin-tag relationship
 */
@CommandHandler(DeletePluginTagCommand)
export class DeletePluginTagHandler implements ICommandHandler<DeletePluginTagCommand> {
	private readonly logger = new Logger(DeletePluginTagHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the delete plugin-tag command
	 *
	 * @param command - The delete command
	 * @returns Promise<DeleteResult>
	 */
	async execute(command: DeletePluginTagCommand): Promise<DeleteResult> {
		try {
			this.logger.log(`Deleting plugin-tag relationship: ${command.id}`);

			const result = await this.pluginTagService.delete(command.id);

			this.logger.log(`Successfully deleted plugin-tag relationship: ${command.id}`);

			return result;
		} catch (error) {
			this.logger.error(`Failed to delete plugin-tag relationship: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to delete plugin-tag relationship: ${error.message}`);
		}
	}
}

/**
 * Handler for bulk deleting plugin-tag relationships
 */
@CommandHandler(BulkDeletePluginTagsCommand)
export class BulkDeletePluginTagsHandler implements ICommandHandler<BulkDeletePluginTagsCommand> {
	private readonly logger = new Logger(BulkDeletePluginTagsHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the bulk delete plugin-tags command
	 *
	 * @param command - The bulk delete command
	 * @returns Promise<number>
	 */
	async execute(command: BulkDeletePluginTagsCommand): Promise<number> {
		try {
			this.logger.log(`Bulk deleting plugin-tag relationships`);

			const deletedCount = await this.pluginTagService.bulkDelete(command.input);

			this.logger.log(`Successfully bulk deleted ${deletedCount} plugin-tag relationships`);

			return deletedCount;
		} catch (error) {
			this.logger.error(`Failed to bulk delete plugin-tag relationships: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to bulk delete plugin-tag relationships: ${error.message}`);
		}
	}
}

/**
 * Handler for replacing all tags for a plugin
 */
@CommandHandler(ReplacePluginTagsCommand)
export class ReplacePluginTagsHandler implements ICommandHandler<ReplacePluginTagsCommand> {
	private readonly logger = new Logger(ReplacePluginTagsHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the replace plugin tags command
	 *
	 * @param command - The replace command
	 * @returns Promise<IPluginTag[]>
	 */
	async execute(command: ReplacePluginTagsCommand): Promise<IPluginTag[]> {
		try {
			this.logger.log(`Replacing tags for plugin: ${command.pluginId}`);

			const result = await this.pluginTagService.replacePluginTags(
				command.pluginId,
				command.tagIds,
				command.tenantId,
				command.organizationId
			);

			this.logger.log(`Successfully replaced tags for plugin ${command.pluginId}: ${result.length} tags`);

			return result;
		} catch (error) {
			this.logger.error(`Failed to replace plugin tags: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to replace plugin tags: ${error.message}`);
		}
	}
}
