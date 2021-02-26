import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductCreateCommand } from '../product.create.command';
import { ProductOptionService } from '../../../product-option/product-option.service';
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

		const optionsCreate = [];

		// const savedOptions = await this.productOptionService.saveBulk(
		// 	optionsCreate
		// );

		//tstodo
		productInput['optionsGroups'] = [];

		const product = await this.productService.saveProduct(productInput);

		return product;
	}
}
