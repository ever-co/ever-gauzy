import { BadRequestException, ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginCategoryService } from '../../../../domain';
import { IPluginCategory } from '../../../../shared';
import { CreatePluginCategoryCommand } from '../create-plugin-category.command';

@CommandHandler(CreatePluginCategoryCommand)
export class CreatePluginCategoryHandler implements ICommandHandler<CreatePluginCategoryCommand> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(command: CreatePluginCategoryCommand): Promise<IPluginCategory> {
		const { input } = command;

		try {
			// Validate slug uniqueness
			const { success } = await this.pluginCategoryService.findOneOrFailByWhereOptions({
				slug: input.slug
			});

			if (success) {
				throw new ConflictException(`Plugin category with slug '${input.slug}' already exists`);
			}

			// Validate parent category if provided
			if (input.parentId) {
				const { success } = await this.pluginCategoryService.findOneOrFailByIdString(input.parentId);
				if (!success) {
					throw new BadRequestException(`Parent category with ID '${input.parentId}' not found`);
				}
			}

			// Create the category using domain service
			return this.pluginCategoryService.save(input);
		} catch (error) {
			if (error instanceof ConflictException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to create plugin category: ${error.message}`);
		}
	}
}
