import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTagService } from '../../../../domain';
import { IPluginTagBulkCreateResponse } from '../../../../shared';
import { BulkCreatePluginTagsCommand } from '../bulk-create-plugin-tags.command';

/**
 * Handler for bulk creating plugin-tag relationships
 */
@CommandHandler(BulkCreatePluginTagsCommand)
export class BulkCreatePluginTagsHandler implements ICommandHandler<BulkCreatePluginTagsCommand> {
	private readonly logger = new Logger(BulkCreatePluginTagsHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the bulk create plugin-tags command
	 *
	 * @param command - The bulk create command
	 * @returns Promise<IPluginTagBulkCreateResponse>
	 */
	async execute(command: BulkCreatePluginTagsCommand): Promise<IPluginTagBulkCreateResponse> {
		try {
			this.logger.log(`Bulk creating plugin-tag relationships for plugin: ${command.input.pluginId}`);

			const result = await this.pluginTagService.bulkCreate(command.input);

			this.logger.log(
				`Successfully bulk created ${result.created} plugin-tag relationships, ${result.existing} already existed`
			);

			return result;
		} catch (error) {
			this.logger.error(`Failed to bulk create plugin-tag relationships: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to bulk create plugin-tag relationships: ${error.message}`);
		}
	}
}
