import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductCreateCommand } from '../product.create.command';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { ProductOption } from '../../../product-option/product-option.entity';
import { Product } from '../../product.entity';

@CommandHandler(ProductCreateCommand)
export class ProductCreateHandler
	implements ICommandHandler<ProductCreateCommand> {
	constructor(
		private productOptionService: ProductOptionService,
		private productService: ProductService
	) {}

	public async execute(command?: ProductCreateCommand): Promise<Product> {
		const { productInput } = command;

		const optionsCreate = productInput.optionCreateInputs.map(
			(optionInput) => {
				const option = new ProductOption();
				option.name = optionInput.name;
				option.code = optionInput.code;
				return option;
			}
		);

		const savedOptions = await this.productOptionService.saveBulk(
			optionsCreate
		);

		productInput['options'] = savedOptions;

		const product = await this.productService.saveProduct(productInput);

		return product;
	}
}
