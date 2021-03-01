import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductCreateCommand } from '../product.create.command';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { Product } from '../../product.entity';
import {
	ProductOption,
	ProductOptionGroup,
	ProductOptionTranslation,
	ProductOptionGroupTranslation
} from 'core';
import { ProductOptionGroupService } from 'product-option/product-option-group.service';

@CommandHandler(ProductCreateCommand)
export class ProductCreateHandler
	implements ICommandHandler<ProductCreateCommand> {
	constructor(
		private productOptionService: ProductOptionService,
		private productService: ProductService,
		private productOptionsGroupService: ProductOptionGroupService
	) {}

	public async execute(command?: ProductCreateCommand): Promise<Product> {
		const { productInput } = command;

		const optionGroupsUpdate = productInput.optionGroupCreateInputs;
		const product = Object.assign(new Product(), { ...productInput });

		const optionsGroupsCreate: ProductOptionGroup[] = await Promise.all(
			optionGroupsUpdate.map(async (group) => {
				let newGroup = new ProductOptionGroup();
				newGroup.name = group.name;
				newGroup.translations = [];
				newGroup.options = [];

				// save group options with their translations
				for await (const optionInput of group.options) {
					const option = Object.assign(new ProductOption(), {
						...optionInput
					});

					const optionsTranslationEntites = await Promise.all(
						option.translations.map((optionTranslation) => {
							let optionTranslationEntity = Object.assign(
								new ProductOptionTranslation(),
								{ ...optionTranslation }
							);
							return this.productOptionService.saveProductOptionTranslation(
								optionTranslationEntity
							);
						})
					);

					option.translations = optionsTranslationEntites;
					const optionEntity = await this.productOptionService.save(
						option
					);

					if (optionEntity) {
						newGroup.options.push(optionEntity);
					}
				}

				//save group translations
				const groupTranslationsEntites = Promise.all(
					group.translations.map((groupTranslation) => {
						let groupTranslationObj = Object.assign(
							new ProductOptionGroupTranslation(),
							{ ...groupTranslation }
						);
						return this.productOptionsGroupService.createTranslation(
							groupTranslationObj
						);
					})
				);

				newGroup.translations = await groupTranslationsEntites;
				return newGroup;
			})
		);

		product.optionGroups = await this.productOptionsGroupService.saveBulk(
			optionsGroupsCreate
		);
		const updatedProduct = await this.productService.saveProduct(
			product as any
		);

		return updatedProduct;
	}
}
