import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { PluginCategoryService } from '../../../../domain';
import { DeletePluginCategoryCommand } from '../delete-plugin-category.command';

@CommandHandler(DeletePluginCategoryCommand)
export class DeletePluginCategoryHandler implements ICommandHandler<DeletePluginCategoryCommand> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(command: DeletePluginCategoryCommand): Promise<DeleteResult> {
		const { id } = command;

		try {
			// Check if category exists
			const existingCategory = await this.pluginCategoryService.findOneByIdString(id, {
				relations: ['children', 'plugins']
			});

			if (!existingCategory) {
				throw new NotFoundException(`Plugin category with ID '${id}' not found`);
			}

			// Check if category has children
			if (existingCategory.children && existingCategory.children.length > 0) {
				throw new BadRequestException(
					`Cannot delete category '${existingCategory.name}' because it has ${existingCategory.children.length} child categories`
				);
			}

			// Check if category has plugins assigned
			if (existingCategory.plugins && existingCategory.plugins.length > 0) {
				throw new BadRequestException(
					`Cannot delete category '${existingCategory.name}' because it has ${existingCategory.plugins.length} plugins assigned`
				);
			}

			// Delete the category using domain service
			return await this.pluginCategoryService.delete(id);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to delete plugin category: ${error.message}`);
		}
	}
}
