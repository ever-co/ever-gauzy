import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductVariant } from '../../product-variant.entity';
import { ProductVariantCreateCommand } from '../product-variant.create.command';
import { ProductVariantService } from '../../product-variant.service';
import { ProductVariantPriceService } from '../../../product-variant-price/product-variant-price.service';
import { ProductVariantSettingService } from '../../../product-settings/product-settings.service';
import { IVariantCreateInput } from '@gauzy/models';
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
			{ relations: ['options'] }
		);
		const productOptions = product.options;
		const optionCombinations = variantCreateInput.optionCombinations;

		const arrVariants = [];

		for await (const optionCombination of optionCombinations) {
			const newProductVariant = new ProductVariant();
			const variantOptions = productOptions.filter((option) => {
				return optionCombination.options.includes(option.name);
			});

			newProductVariant.options = variantOptions;
			newProductVariant.internalReference = variantOptions
				.map((option) => option.name)
				.join('-');
			newProductVariant.settings = await this.productVariantSettingsService.createDefaultVariantSettings();
			newProductVariant.price = await this.productVariantPriceService.createDefaultProductVariantPrice();
			newProductVariant.product = await this.productService.findOne({
				id: variantCreateInput.product.id
			});

			arrVariants.push(
				await this.productVariantService.createVariant(
					newProductVariant
				)
			);
		}

		return arrVariants;
	}
}
