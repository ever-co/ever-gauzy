import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { PluginCategoryService } from '../../../../domain';
import { IPluginCategory } from '../../../../shared';
import { UpdatePluginCategoryCommand } from '../update-plugin-category.command';

@CommandHandler(UpdatePluginCategoryCommand)
export class UpdatePluginCategoryHandler implements ICommandHandler<UpdatePluginCategoryCommand> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(command: UpdatePluginCategoryCommand): Promise<IPluginCategory | UpdateResult> {
		const { id, input } = command;

		try {
			// Check if category exists
			const existingCategory = await this.pluginCategoryService.findOneByIdString(id);
			if (!existingCategory) {
				throw new NotFoundException(`Plugin category with ID '${id}' not found`);
			}

			// Validate slug uniqueness if it's being changed
			if (input.slug && input.slug !== existingCategory.slug) {
				const categoryWithSlug = await this.pluginCategoryService.findOneByWhereOptions({
					slug: input.slug,
					tenantId: existingCategory.tenantId,
					organizationId: existingCategory.organizationId
				});

				if (categoryWithSlug && categoryWithSlug.id !== id) {
					throw new ConflictException(`Plugin category with slug '${input.slug}' already exists`);
				}
			}

			// Validate parent category if provided
			if (input.parentId) {
				const parentCategory = await this.pluginCategoryService.findOneByIdString(input.parentId);
				if (!parentCategory) {
					throw new BadRequestException(`Parent category with ID '${input.parentId}' not found`);
				}

				// Prevent setting self as parent
				if (input.parentId === id) {
					throw new BadRequestException('Category cannot be its own parent');
				}

				// Prevent circular references (basic check)
				const isDescendant = await this.pluginCategoryService.isDescendantOf(input.parentId, id);
				if (isDescendant) {
					throw new BadRequestException('Cannot set a descendant category as parent (circular reference)');
				}
			}

			// Update the category using domain service
			return this.pluginCategoryService.update(id, input);
		} catch (error) {
			if (
				error instanceof NotFoundException ||
				error instanceof ConflictException ||
				error instanceof BadRequestException
			) {
				throw error;
			}
			throw new BadRequestException(`Failed to update plugin category: ${error.message}`);
		}
	}
}
