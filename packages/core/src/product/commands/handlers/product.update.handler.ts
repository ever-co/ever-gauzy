import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { Product } from '../../product.entity';
import { ProductUpdateCommand } from '../product.update.command';
import { ProductOption } from '../../../product-option/product-option.entity';

@CommandHandler(ProductUpdateCommand)
export class ProductUpdateHandler
	implements ICommandHandler<ProductUpdateCommand> {
	constructor(
		private productOptionService: ProductOptionService,
		private productService: ProductService
	) {}

	public async execute(command?: ProductUpdateCommand): Promise<Product> {
		const { productUpdateRequest } = command;

		const optionsCreate = productUpdateRequest.optionCreateInputs
			.filter((option) => !option.id)
			.map((optionInput) => {
				const option = new ProductOption();
				option.name = optionInput.name;
				option.code = optionInput.code;
				return option;
			});

		await this.productOptionService.deleteBulk(
			productUpdateRequest.optionDeleteInputs
		);

		//tstodo
		// const savedOptions = await this.productOptionService.saveBulk(
		// 	optionsCreate
		// );

		// const updatedOptions = await this.productOptionService.saveBulk(
		// 	productUpdateRequest.optionCreateInputs.filter(
		// 		(option) => option.id
		// 	) as any
		// );

		// productUpdateRequest['options'] = [...savedOptions, ...updatedOptions];
		productUpdateRequest['optionGroups'] = [];

		const product = await this.productService.saveProduct(
			productUpdateRequest
		);
		return product;
	}
}
