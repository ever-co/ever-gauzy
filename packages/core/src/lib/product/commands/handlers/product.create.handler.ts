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
} from '../../../core/entities/internal';
import { ProductOptionGroupService } from '../../../product-option/product-option-group.service';

@CommandHandler(ProductCreateCommand)
export class ProductCreateHandler implements ICommandHandler<ProductCreateCommand> {
	constructor(
		private productOptionService: ProductOptionService,
		private productService: ProductService,
		private productOptionsGroupService: ProductOptionGroupService
	) {}

	public async execute(command?: ProductCreateCommand): Promise<Product> {
		const { productInput } = command;

		const { optionGroupCreateInputs: optionGroupsUpdate, ...others } = productInput;

		const product = Object.assign(new Product(), { ...others });

		const savedProduct = await this.productService.save(product);

		const optionsGroupsCreate: ProductOptionGroup[] = await Promise.all(
			optionGroupsUpdate.map(async (group) => {
				let newGroup = new ProductOptionGroup();
				newGroup.name = group.name;
				newGroup.productId = savedProduct.id;
				newGroup.translations = [];
				newGroup.options = [];

				const savedGroup = await this.productOptionsGroupService.save(newGroup);
				// save group options with their translations
				for await (const optionInput of group.options) {
					const option = Object.assign(new ProductOption(), {
						...optionInput,
						groupId: savedGroup.id
					});

					const savedOption = await this.productOptionService.save(option);

					const optionsTranslationEntities = await Promise.all(
						option.translations.map((optionTranslation) => {
							let optionTranslationEntity = Object.assign(new ProductOptionTranslation(), {
								...optionTranslation,
								referenceId: savedOption.id
							});
							return this.productOptionService.saveProductOptionTranslation(optionTranslationEntity);
						})
					);

					savedOption.translations = optionsTranslationEntities;
					const optionEntity = await this.productOptionService.save(savedOption);

					if (optionEntity) {
						savedGroup.options.push(optionEntity);
					}
				}

				//save group translations
				const groupTranslationsEntities = Promise.all(
					group.translations.map((groupTranslation) => {
						let groupTranslationObj = Object.assign(new ProductOptionGroupTranslation(), {
							...groupTranslation,
							referenceId: savedGroup.id
						});
						return this.productOptionsGroupService.createTranslation(groupTranslationObj);
					})
				);

				savedGroup.translations = await groupTranslationsEntities;
				return savedGroup;
			})
		);

		savedProduct.optionGroups = await this.productOptionsGroupService.saveBulk(optionsGroupsCreate);
		const updatedProduct = await this.productService.saveProduct(savedProduct as any);

		return updatedProduct;
	}
}
