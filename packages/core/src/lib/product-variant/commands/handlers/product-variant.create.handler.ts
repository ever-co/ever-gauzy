import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductVariant } from '../../product-variant.entity';
import { ProductVariantCreateCommand } from '../product-variant.create.command';
import { ProductVariantService } from '../../product-variant.service';
import { ProductVariantPriceService } from '../../../product-variant-price/product-variant-price.service';
import { ProductVariantSettingService } from '../../../product-setting/product-setting.service';
import { IVariantCreateInput } from '@gauzy/contracts';
import { ProductService } from '../../../product/product.service';

@CommandHandler(ProductVariantCreateCommand)
export class ProductVariantCreateHandler
	implements ICommandHandler<ProductVariantCreateCommand> {
	constructor(
		private productService: ProductService,
		private productVariantService: ProductVariantService,
		private productVariantPriceService: ProductVariantPriceService,
		private productVariantSettingsService: ProductVariantSettingService
	) {}

	public async execute(
		command?: ProductVariantCreateCommand
	): Promise<ProductVariant[]> {
		const variantCreateInput: IVariantCreateInput = command.productInput;

		const product = await this.productService.findById(
			variantCreateInput.product.id,
			{
				relations: ['optionGroups']
			}
		);

		let productOptions = [];

		product.optionGroups.forEach((optionGroup) => {
			productOptions = productOptions.concat(optionGroup.options);
		});

		const optionCombinations = variantCreateInput.optionCombinations;
		const { organizationId, tenantId } = variantCreateInput.product;

		const arrVariants = [];

		for await (const optionCombination of optionCombinations) {
			const newProductVariant = new ProductVariant();

			let variantOptions = [];

			await productOptions.forEach((dbOption, i) => {
				return optionCombination.options.forEach((option) => {
					if (
						!!dbOption.translations.find(
							(translation) => translation.name == option
						)
					) {
						variantOptions.push(dbOption);
					}
				});
			});

			newProductVariant.options = variantOptions;
			newProductVariant.internalReference = variantOptions
				.map((option) => option.name)
				.join('-');

			newProductVariant.organizationId = organizationId;
			newProductVariant.tenantId = tenantId;

			newProductVariant.setting = await this.productVariantSettingsService.createDefaultVariantSettings();
			newProductVariant.price = await this.productVariantPriceService.createDefaultProductVariantPrice();
			newProductVariant.product = await this.productService.findOneByIdString(
				variantCreateInput.product.id
			);

			arrVariants.push(
				await this.productVariantService.createVariant(
					newProductVariant
				)
			);
		}

		return arrVariants;
	}
}
