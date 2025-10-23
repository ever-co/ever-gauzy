import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTagService } from '../../../../domain/services/plugin-tag.service';
import { IPluginTag } from '../../../../shared/models/plugin-tag.model';
import { CreatePluginTagCommand } from '../../../commands/plugin-tag/create-plugin-tag.command';

/**
 * Handler for creating plugin-tag relationships
 */
@CommandHandler(CreatePluginTagCommand)
export class CreatePluginTagHandler implements ICommandHandler<CreatePluginTagCommand> {
	private readonly logger = new Logger(CreatePluginTagHandler.name);

	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Execute the create plugin-tag command
	 *
	 * @param command - The create command
	 * @returns Promise<IPluginTag>
	 */
	async execute(command: CreatePluginTagCommand): Promise<IPluginTag> {
		try {
			this.logger.log(`Creating plugin-tag relationship: ${JSON.stringify(command.input)}`);

			const pluginTag = await this.pluginTagService.create(command.input);

			this.logger.log(`Successfully created plugin-tag relationship with ID: ${pluginTag.id}`);

			return pluginTag;
		} catch (error) {
			this.logger.error(`Failed to create plugin-tag relationship: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Failed to create plugin-tag relationship: ${error.message}`);
		}
	}
}
