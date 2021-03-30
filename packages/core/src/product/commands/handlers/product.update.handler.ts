import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { Product } from '../../product.entity';
import { ProductUpdateCommand } from '../product.update.command';
import { ProductOptionGroupService } from 'product-option/product-option-group.service';
import {
	ProductOption,
	ProductOptionGroup,
	ProductOptionTranslation,
	ProductOptionGroupTranslation
} from 'core';
import {
	IProductOptionGroupTranslatable,
	IProductOptionTranslatable,
	IProductOptionTranslation
} from '@gauzy/contracts';

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

		const optionDeleteInputs = productUpdateRequest.optionDeleteInputs;
		const optionGroupCreateInputs =
			productUpdateRequest.optionGroupCreateInputs;
		const optionGroupUpdateInputs =
			productUpdateRequest.optionGroupUpdateInputs;

		const product = await this.productService.findById(
			productUpdateRequest.id,
			{ relations: ['optionGroups'] }
		);

		// delete options
		for await (const option of optionDeleteInputs) {
			await this.productOptionService.deleteOptionTranslationsBulk(
				option.translations
			);
		}

		await this.productOptionService.deleteBulk(optionDeleteInputs);

		// create new option group
		const optionsGroupsCreate: IProductOptionGroupTranslatable[] = await Promise.all(
			optionGroupCreateInputs.map(
				async (group: IProductOptionGroupTranslatable) => {
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

					newGroup.translations = (await groupTranslationsEntites) as any;
					return newGroup;
				}
			)
		);

		//update product option groups
		const optionGroupsUpdate:
			| IProductOptionGroupTranslatable[]
			| any = await Promise.all(
			optionGroupUpdateInputs.map(
				async (group: IProductOptionGroupTranslatable) => {
					for await (let option of group.options) {
						let isNewOption = false;

						if (!option.id) {
							option = Object.assign(new ProductOption(), {
								...option
							});
							isNewOption = true;
						}

						const optionsTranslationEntites = await Promise.all(
							option.translations.map(
								(
									optionTranslation: IProductOptionTranslation
								) => {
									if (
										this.productOptionTranslationUpdated(
											option,
											optionTranslation
										) ||
										!optionTranslation.id
									) {
										return this.productOptionService.saveProductOptionTranslation(
											{
												reference: option.id || null,
												...optionTranslation
											} as any
										);
									}
								}
							)
						);

						option.translations = option.translations.concat(
							(await optionsTranslationEntites).filter(
								(tr) => !!tr
							)
						);
						const optionEntity = await this.productOptionService.save(
							option
						);

						if (optionEntity && isNewOption) {
							group.options.push(optionEntity);
						}
					}
					return group;
				}
			)
		);

		let newProductOptions = await this.productOptionsGroupService.saveBulk(
			optionsGroupsCreate as any
		);
		await this.productOptionsGroupService.saveBulk(
			optionGroupsUpdate as any
		);

		product.optionGroups = product.optionGroups.concat(newProductOptions);

		const updatedProduct = await this.productService.saveProduct(
			product as any
		);

		return updatedProduct;
	}

	public productOptionTranslationUpdated(
		productOption: IProductOptionTranslatable,
		productOptionTranslation: IProductOptionTranslation
	) {
		let currentTranslation: IProductOptionTranslation = productOption.translations.find(
			(translation) =>
				translation.languageCode ==
				productOptionTranslation.languageCode
		);
		if (!currentTranslation) return true;

		if (
			currentTranslation.name !== productOptionTranslation.name ||
			currentTranslation.description !==
				productOptionTranslation.description
		)
			return true;

		return false;
	}
}
