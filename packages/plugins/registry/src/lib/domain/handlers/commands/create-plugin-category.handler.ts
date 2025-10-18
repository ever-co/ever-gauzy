import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CreatePluginCategoryCommand } from '../../commands/create-plugin-category.command';
import { PluginCategoryService } from '../../services/plugin-category.service';
import { IPluginCategory } from '../../../shared/models';

@CommandHandler(CreatePluginCategoryCommand)
export class CreatePluginCategoryHandler implements ICommandHandler<CreatePluginCategoryCommand> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(command: CreatePluginCategoryCommand): Promise<IPluginCategory> {
		const { input } = command;

		try {
			// Validate slug uniqueness
			const existingCategory = await this.pluginCategoryService.findOneByWhereOptions({
				slug: input.slug,
				tenantId: input.tenantId,
				organizationId: input.organizationId
			});

			if (existingCategory) {
				throw new ConflictException(`Plugin category with slug '${input.slug}' already exists`);
			}

			// Validate parent category if provided
			if (input.parentId) {
				const parentCategory = await this.pluginCategoryService.findOneByIdString(input.parentId);
				if (!parentCategory) {
					throw new BadRequestException(`Parent category with ID '${input.parentId}' not found`);
				}
			}

			// Create the category using domain service
			return await this.pluginCategoryService.create(input);
		} catch (error) {
			if (error instanceof ConflictException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to create plugin category: ${error.message}`);
		}
	}
}
