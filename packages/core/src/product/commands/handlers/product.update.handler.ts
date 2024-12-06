import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductService } from '../../../product/product.service';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { Product } from '../../product.entity';
import { ProductUpdateCommand } from '../product.update.command';
import { ProductOptionGroupService } from 'product-option/product-option-group.service';
import { ProductOption, ProductOptionGroup, ProductOptionTranslation, ProductOptionGroupTranslation } from 'core';
import {
	IProductOptionGroupTranslatable,
	IProductOptionTranslatable,
	IProductOptionTranslation,
	IProductOptionGroupTranslation,
	ID
} from '@gauzy/contracts';

@CommandHandler(ProductUpdateCommand)
export class ProductUpdateHandler implements ICommandHandler<ProductUpdateCommand> {
	constructor(
		private productOptionService: ProductOptionService,
		private productService: ProductService,
		private productOptionsGroupService: ProductOptionGroupService
	) {}

	public async execute(command?: ProductUpdateCommand): Promise<Product> {
		const { productUpdateRequest } = command;

		const optionDeleteInputs = productUpdateRequest.optionDeleteInputs;
		const optionGroupCreateInputs = productUpdateRequest.optionGroupCreateInputs;
		const optionGroupUpdateInputs = productUpdateRequest.optionGroupUpdateInputs;
		const optionGroupDeleteInputs = productUpdateRequest.optionGroupDeleteInputs;

		const product = await this.productService.findById(productUpdateRequest.id, { relations: ['optionGroups'] });

		/**
		 * Delete options
		 */
		for await (const option of optionDeleteInputs) {
			await this.productOptionService.deleteOptionTranslationsBulk(option.translations);
		}
		await this.productOptionService.deleteBulk(optionDeleteInputs);

		/**
		 * Delete option groups
		 */
		for await (const group of optionGroupDeleteInputs) {
			await this.productOptionsGroupService.deleteGroupTranslationsBulk(group.translations);
		}
		await this.productOptionsGroupService.deleteBulk(optionGroupDeleteInputs);

		/**
		 * Create new option groups and options
		 */
		const optionsGroupsCreate: IProductOptionGroupTranslatable[] = await Promise.all(
			optionGroupCreateInputs.map(async (group: IProductOptionGroupTranslatable) => {
				// Step 1: Create and save the group
				let newGroup = Object.assign(new ProductOptionGroup(), {
					name: group.name,
					productId: product.id,
					translations: [], // Placeholder for translations
					options: [] // Placeholder for options
				});

				const savedGroup = await this.productOptionsGroupService.save(newGroup);

				/**
				 * Step 2: Save options with groupId
				 */
				for await (const optionInput of group.options) {
					const optionEntity = await this.productOptionService.save(
						Object.assign(new ProductOption(), {
							...optionInput,
							groupId: savedGroup.id // Assign the groupId to the option
						})
					);

					if (optionEntity) {
						// Save translations for the option
						const optionTranslations = await Promise.all(
							optionInput.translations.map((optionTranslation) => {
								let optionTranslationEntity = Object.assign(new ProductOptionTranslation(), {
									...optionTranslation,
									referenceId: optionEntity.id // Assign the referenceId to the translation
								});
								return this.productOptionService.saveProductOptionTranslation(optionTranslationEntity);
							})
						);

						// Add translations to the option
						optionEntity.translations = optionTranslations;

						// Add the option to the group
						savedGroup.options.push(optionEntity);
					}
				}

				/**
				 * Step 3: Save translations for the group
				 */
				const groupTranslationsEntities = await Promise.all(
					group.translations.map((groupTranslation) => {
						let groupTranslationObj = Object.assign(new ProductOptionGroupTranslation(), {
							...groupTranslation,
							referenceId: savedGroup.id // Assign the referenceId to the group translation
						});
						return this.productOptionsGroupService.createTranslation(groupTranslationObj);
					})
				);

				savedGroup.translations = groupTranslationsEntities as any;

				return savedGroup;
			})
		);

		/**
		 * Update product option groups
		 */
		const optionGroupsUpdate: IProductOptionGroupTranslatable[] | any = await Promise.all(
			optionGroupUpdateInputs.map(async (group: IProductOptionGroupTranslatable) => {
				for await (let option of group.options) {
					let isNewOption = false;

					if (!option.id) {
						option = Object.assign(new ProductOption(), {
							...option,
							groupId: group.id // Ensure new option gets groupId
						});
						isNewOption = true;
					}

					let existingOption = isNewOption
						? null
						: await this.productOptionService.findOneByIdString(option.id);

					const optionsTranslationEntities = await Promise.all(
						option.translations.map(async (optionTranslation: IProductOptionTranslation) => {
							if (
								this.productOptionTranslationUpdated(existingOption, optionTranslation) ||
								!optionTranslation.id
							) {
								return this.productOptionService.saveProductOptionTranslation({
									referenceId: option.id || null,
									...optionTranslation
								} as any);
							}
						})
					);

					option.translations = option.translations.concat(
						(await optionsTranslationEntities).filter((tr) => !!tr)
					);

					const optionEntity = await this.productOptionService.save(option);

					if (optionEntity && isNewOption) {
						group.options.push(optionEntity);
					}
				}

				// Save group translations
				let existingGroup = await this.productOptionsGroupService.findOneByIdString(group.id);

				const groupTranslationsEntities = Promise.all(
					group.translations.map((groupTranslation) => {
						if (this.productOptionGroupTranslationUpdated(existingGroup, groupTranslation)) {
							return this.productOptionsGroupService.createTranslation({
								referenceId: group.id || null,
								...groupTranslation
							} as any);
						}
					})
				);

				group.translations = existingGroup.translations.concat(
					(await groupTranslationsEntities).filter((tr) => !!tr) as any
				);

				return group;
			})
		);

		const newProductOptions = await this.productOptionsGroupService.saveBulk(optionsGroupsCreate as any);
		await this.productOptionsGroupService.saveBulk(optionGroupsUpdate as any);

		product.optionGroups = product.optionGroups.concat(newProductOptions);
		product.productCategoryId = <ID>productUpdateRequest.productCategoryId;
		product.productTypeId = <ID>productUpdateRequest.productTypeId;
		product.tags = productUpdateRequest.tags;

		const productTranslations = <any>await Promise.all(
			productUpdateRequest.translations.map((optionTranslation) => {
				return this.productService.saveProductTranslation(<any>optionTranslation);
			})
		);

		product.translations = productTranslations;

		const updatedProduct = await this.productService.saveProduct(product as any);

		return updatedProduct;
	}

	/**
	 * Check if product option translation has been changed and needs updating
	 */
	public productOptionTranslationUpdated(
		productOption: IProductOptionTranslatable,
		productOptionTranslation: IProductOptionTranslation
	) {
		if (!productOption) return true;

		let currentTranslation: IProductOptionTranslation = productOption.translations.find(
			(translation) => translation.languageCode == productOptionTranslation.languageCode
		);

		if (!currentTranslation) return true;

		if (
			currentTranslation.name !== productOptionTranslation.name ||
			currentTranslation.description !== productOptionTranslation.description
		) {
			return true;
		}

		return false;
	}

	/**
	 * Check if product option group translation has been changed and needs updating
	 */
	public productOptionGroupTranslationUpdated(
		optionGroup: IProductOptionGroupTranslatable,
		optionGroupTranslation: IProductOptionGroupTranslation
	) {
		if (!optionGroup) return false;

		let currentTranslation: IProductOptionGroupTranslation = optionGroup.translations.find(
			(translation) => translation.languageCode == optionGroupTranslation.languageCode
		);

		if (!currentTranslation) return true;

		if (currentTranslation.name !== optionGroupTranslation.name) {
			return true;
		}

		return false;
	}
}
