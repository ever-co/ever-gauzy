import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IProductTypeTranslatable } from '@gauzy/contracts';
import { ProductCategoryCreateCommand } from '../product-category.create.command';
import { ProductCategoryService } from './../../product-category.service';

@CommandHandler(ProductCategoryCreateCommand)
export class ProductCategoryCreateHandler
	implements ICommandHandler<ProductCategoryCreateCommand> {
	constructor(
		private readonly productCategoryService: ProductCategoryService
	) {}

	public async execute(command: ProductCategoryCreateCommand): Promise<IProductTypeTranslatable> {
		try {
			const { input, language } = command;
			return await this.productCategoryService.mapTranslatedProductType(
				await this.productCategoryService.create(input),
				language
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
