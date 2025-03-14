import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import {
	IProductOptionGroupTranslatable,
	IProductOptionTranslatable,
	IProductOptionTranslation,
	IProductOptionGroupTranslation
} from '@gauzy/contracts';
import { ProductService } from '../../../product/product.service';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { Product } from '../../product.entity';
import { ProductUpdateCommand } from '../product.update.command';
import { ProductOptionGroupService } from '../../../product-option/product-option-group.service';
import {
	ProductOption,
	ProductOptionGroup,
	ProductOptionTranslation,
	ProductOptionGroupTranslation
} from '../../../core/entities/internal';

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

		await Promise.all(
			(optionDeleteInputs || []).map((option) =>
				this.productOptionService.deleteOptionTranslationsBulk(option.translations)
			)
		);
		await this.productOptionService.deleteBulk(optionDeleteInputs);

		await Promise.all(
			(optionGroupDeleteInputs || []).map((group) =>
				this.productOptionsGroupService.deleteGroupTranslationsBulk(group.translations)
			)
		);
		await this.productOptionsGroupService.deleteBulk(optionGroupDeleteInputs);

		/**
		 * create new option group
		 */

		const optionsGroupsCreate: IProductOptionGroupTranslatable[] = await Promise.all(
			optionGroupCreateInputs.map(async (group: IProductOptionGroupTranslatable) => {
				let newGroup = new ProductOptionGroup();
				newGroup.name = group.name;
				newGroup.productId = productUpdateRequest.id;
				newGroup.translations = [];
				newGroup.options = [];

				const savedGroup = await this.productOptionsGroupService.save(newGroup);

				/**
				 * save group options with their translations
				 */
				for await (const optionInput of group.options || []) {
					const option = Object.assign(new ProductOption(), {
						...optionInput,
						groupId: savedGroup.id
					});
					const savedOption = await this.productOptionService.save(option);

					const optionsTranslationEntities = await Promise.all(
						(option.translations || []).map((optionTranslation) => {
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

				/**
				 * save group translations.
				 */
				const groupTranslationsEntities = await Promise.all(
					(group.translations || []).map((groupTranslation) => {
						let groupTranslationObj = Object.assign(new ProductOptionGroupTranslation(), {
							...groupTranslation,
							referenceId: savedGroup.id
						});
						return this.productOptionsGroupService.createTranslation(groupTranslationObj);
					})
				);

				savedGroup.translations = (await groupTranslationsEntities) as any;

				return savedGroup;
			})
		);

		/**
		 * update product option groups
		 */

		const optionGroupsUpdate: IProductOptionGroupTranslatable[] | any = await Promise.all(
			(optionGroupUpdateInputs || []).map(async (group: IProductOptionGroupTranslatable) => {
				for await (let option of group.options) {
					let isNewOption = false;

					if (!option.id) {
						option = Object.assign(new ProductOption(), {
							...option,
							groupId: group.id
						});
						isNewOption = true;
					}

					let optionEntity = isNewOption
						? await this.productOptionService.save(option)
						: await this.productOptionService.findOneByIdString(option.id);

					const optionsTranslationEntities = await Promise.all(
						(option.translations || []).map(async (optionTranslation: IProductOptionTranslation) => {
							if (
								this.productOptionTranslationUpdated(optionEntity, optionTranslation) ||
								!optionTranslation.id
							) {
								return this.productOptionService.saveProductOptionTranslation({
									referenceId: optionEntity.id || null,
									...optionTranslation
								} as any);
							}
						})
					);

					optionEntity.translations = (option.translations || []).concat(
						optionsTranslationEntities.filter((tr) => !!tr)
					);

					if (isNewOption) {
						group.options.push(optionEntity);
					}
				}

				/**
				 * save group translations.
				 */

				let existingGroup = await this.productOptionsGroupService.findOneByIdString(group.id);

				const groupTranslationsEntities = Promise.all(
					(group.translations || []).map((groupTranslation) => {
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

		let newProductOptions = await this.productOptionsGroupService.saveBulk(optionsGroupsCreate as any);
		await this.productOptionsGroupService.saveBulk(optionGroupsUpdate as any);

		product.optionGroups = product.optionGroups?.concat(newProductOptions);
		product.productCategory = <any>productUpdateRequest.category;
		product.productType = <any>productUpdateRequest.type;
		product.tags = productUpdateRequest.tags;

		const productTranslations = <any>await Promise.all(
			(productUpdateRequest.translations || []).map((optionTranslation) => {
				return this.productService.saveProductTranslation(<any>optionTranslation);
			})
		);

		product.translations = productTranslations;

		const updatedProduct = await this.productService.saveProduct(product as any);

		return updatedProduct;
	}

	/**
	 * check if product option translation has been changed and needs updating
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
	 * check if product option group translation has been changed and needs updating
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
