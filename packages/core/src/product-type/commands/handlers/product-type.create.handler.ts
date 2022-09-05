import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IProductTypeTranslatable } from '@gauzy/contracts';
import { ProductTypeService } from './../../product-type.service';
import { ProductTypeCreateCommand } from '../product-type.create.command';

@CommandHandler(ProductTypeCreateCommand)
export class ProductTypeCreateHandler
	implements ICommandHandler<ProductTypeCreateCommand> {
	constructor(
		private readonly productTypeService: ProductTypeService
	) {}

	public async execute(command: ProductTypeCreateCommand): Promise<IProductTypeTranslatable> {
		try {
			const { input, language } = command;
			return await this.productTypeService.mapTranslatedProductType(
				await this.productTypeService.create(input),
				language
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
