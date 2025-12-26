import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTagService } from '../../../../domain';
import { IPluginTag } from '../../../../shared';
import {
	BulkUpdatePluginTagsCommand,
	UpdatePluginTagCommand,
	UpdatePluginTagsPriorityCommand
} from '../update-plugin-tag.command';

/**
 * Handler for updating single plugin-tag relationship
 */
@CommandHandler(UpdatePluginTagCommand)
export class UpdatePluginTagHandler implements ICommandHandler<UpdatePluginTagCommand> {
	private readonly logger = new Logger(UpdatePluginTagHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the update plugin-tag command
	 *
	 * @param command - The update command
	 * @returns Promise<IPluginTag>
	 */
	async execute(command: UpdatePluginTagCommand): Promise<IPluginTag> {
		try {
			this.logger.log(`Updating plugin-tag relationship: ${command.id}`);

			await this.pluginTagService.update(command.id, command.input);

			this.logger.log(`Successfully updated plugin-tag relationship: ${command.id}`);

			return this.pluginTagService.findOneByIdString(command.id);
		} catch (error) {
			this.logger.error(`Failed to update plugin-tag relationship: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to update plugin-tag relationship: ${error.message}`);
		}
	}
}

/**
 * Handler for bulk updating plugin-tag relationships
 */
@CommandHandler(BulkUpdatePluginTagsCommand)
export class BulkUpdatePluginTagsHandler implements ICommandHandler<BulkUpdatePluginTagsCommand> {
	private readonly logger = new Logger(BulkUpdatePluginTagsHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the bulk update plugin-tags command
	 *
	 * @param command - The bulk update command
	 * @returns Promise<IPluginTag[]>
	 */
	async execute(command: BulkUpdatePluginTagsCommand): Promise<IPluginTag[]> {
		try {
			this.logger.log(`Bulk updating plugin-tag relationships`);

			const results = await this.pluginTagService.bulkUpdate(command.updates);

			this.logger.log(`Successfully bulk updated ${results.length} plugin-tag relationships`);

			return results;
		} catch (error) {
			this.logger.error(`Failed to bulk update plugin-tag relationships: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to bulk update plugin-tag relationships: ${error.message}`);
		}
	}
}

/**
 * Handler for updating priority order of plugin tags
 */
@CommandHandler(UpdatePluginTagsPriorityCommand)
export class UpdatePluginTagsPriorityHandler implements ICommandHandler<UpdatePluginTagsPriorityCommand> {
	private readonly logger = new Logger(UpdatePluginTagsPriorityHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the update plugin tags priority command
	 *
	 * @param command - The priority update command
	 * @returns Promise<IPluginTag[]>
	 */
	async execute(command: UpdatePluginTagsPriorityCommand): Promise<IPluginTag[]> {
		try {
			this.logger.log(`Updating plugin tags priority order`);

			const result = await this.pluginTagService.updateTagsPriority(command.priorities);

			this.logger.log(`Successfully updated plugin tags priority order: ${result.length} tags`);

			return result;
		} catch (error) {
			this.logger.error(`Failed to update plugin tags priority: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to update plugin tags priority: ${error.message}`);
		}
	}
}
