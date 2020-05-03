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

		const product = await this.productService.create(productInput);

		const optionsInput = productInput.options.map((optionInput) => {
			const option = new ProductOption();
			Object.assign(option, { ...optionInput, product });

			return option;
		});

		await this.productOptionService.createBulk(optionsInput);

		return product;
	}
}
