import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { Product } from '../../product.entity';
import { ProductUpdateCommand } from '../product.update.command';
import { ProductOption } from '../../../product-option/product-option.entity';
import { ProductOptionGroup } from 'core';
import { ProductOptionGroupService } from 'product-option/product-option-group.service';

@CommandHandler(ProductUpdateCommand)
export class ProductUpdateHandler
	implements ICommandHandler<ProductUpdateCommand> {
	constructor(
		private productOptionService: ProductOptionService,
		private productService: ProductService,
		private productOptionsGroupService: ProductOptionGroupService
	) {}

	public async execute(command?: ProductUpdateCommand): Promise<Product> {
		const { productUpdateRequest } = command;

		const optionGroupsUpdate = productUpdateRequest.optionGroupCreateInputs;

		const optionsGroupCreate = optionGroupsUpdate.map((group) => {
			let newGroup = new ProductOptionGroup();
			newGroup.name = group.name;
			newGroup.options = group.options.map((option) =>
				Object.assign(new ProductOption(), { ...option })
			);

			newGroup.translations = group.translations as any;

			return newGroup;
		});

		let result = await this.productOptionsGroupService.saveBulk(
			optionsGroupCreate
		);

		await this.productOptionService.deleteBulk(
			productUpdateRequest.optionDeleteInputs
		);

		productUpdateRequest.optionGroupCreateInputs = result;

		const product = await this.productService.saveProduct(
			productUpdateRequest
		);
		return product;
	}
}
