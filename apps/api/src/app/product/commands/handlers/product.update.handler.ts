import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { Product } from '../../product.entity';
import { ProductUpdateCommand } from '../product.update.command';

@CommandHandler(ProductUpdateCommand)
export class ProductUpdateHandler
	implements ICommandHandler<ProductUpdateCommand> {
	constructor(
		private productOptionService: ProductOptionService,
		private productService: ProductService
	) {}

	public async execute(command?: ProductUpdateCommand): Promise<Product> {
		const { productUpdateRequest } = command;

		const product = await this.productService.saveProduct(
			productUpdateRequest
		);

		//todo manage options

		return product;
	}
}
