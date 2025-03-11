import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { IVariantCreateInput } from '@gauzy/contracts';
import { ProductVariant } from '../../product-variant.entity';
import { ProductVariantCreateCommand } from '../product-variant.create.command';
import { ProductVariantService } from '../../product-variant.service';
import { ProductVariantPriceService } from '../../../product-variant-price/product-variant-price.service';
import { ProductVariantSettingService } from '../../../product-setting/product-setting.service';
import { ProductService } from '../../../product/product.service';

@CommandHandler(ProductVariantCreateCommand)
export class ProductVariantCreateHandler implements ICommandHandler<ProductVariantCreateCommand> {
	constructor(
		private readonly productService: ProductService,
		private readonly productVariantService: ProductVariantService,
		private readonly productVariantPriceService: ProductVariantPriceService,
		private readonly productVariantSettingsService: ProductVariantSettingService
	) {}

	public async execute(command?: ProductVariantCreateCommand): Promise<ProductVariant[]> {
		const variantCreateInput: IVariantCreateInput = command.productInput;

		// Fetch the product with all necessary relations, ensuring options and translations are loaded
		const product = await this.productService.findById(variantCreateInput.product.id, {
			relations: ['optionGroups', 'optionGroups.options', 'optionGroups.options.translations']
		});

		// Extract all product options from optionGroups
		let productOptions = product.optionGroups.flatMap((optionGroup) => optionGroup.options);

		const optionCombinations = variantCreateInput.optionCombinations;
		const { organizationId, tenantId } = variantCreateInput.product;

		const arrVariants: ProductVariant[] = [];
		console.log(productOptions, optionCombinations);
		// Iterate over each option combination
		for (const optionCombination of optionCombinations) {
			const newProductVariant = new ProductVariant();
			let variantOptions = [];

			for (const dbOption of productOptions) {
				for (const option of optionCombination.options) {
					if (dbOption.translations?.some((translation) => translation.name === option)) {
						variantOptions.push(dbOption);
					}
				}
			}

			// Set product variant properties
			newProductVariant.options = variantOptions;
			newProductVariant.internalReference = variantOptions.map((option) => option.name).join('-');
			newProductVariant.organizationId = organizationId;
			newProductVariant.tenantId = tenantId;

			// Execute multiple async calls in parallel using `Promise.all` for better performance
			const [setting, price, productEntity] = await Promise.all([
				this.productVariantSettingsService.createDefaultVariantSettings(),
				this.productVariantPriceService.createDefaultProductVariantPrice(),
				this.productService.findOneByIdString(variantCreateInput.product.id)
			]);

			// Assign fetched values to the product variant
			newProductVariant.setting = setting;
			newProductVariant.price = price;
			newProductVariant.product = productEntity;

			// Create and store the new product variant
			const createdVariant = await this.productVariantService.createVariant(newProductVariant);
			arrVariants.push(createdVariant);
		}

		return arrVariants;
	}
}
