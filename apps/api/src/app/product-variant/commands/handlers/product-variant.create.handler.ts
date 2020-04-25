import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { ProductVariant } from '../../product-variant.entity';
import { ProductVariantCreateCommand } from '../product-variant.create.command';
import { ProductVariantService } from '../../product-variant.service';
import { ProductVariantPriceService } from '../../../product-variant-price/product-variant-price.service';
import { ProductVariantSettingService } from '../../../product-settings/product-settings.service';

@CommandHandler(ProductVariantCreateCommand)
export class ProductVariantCreateHandler
	implements ICommandHandler<ProductVariantCreateCommand> {
	constructor(
		private productVariantService: ProductVariantService,
		private productVariantPriceService: ProductVariantPriceService,
		private productVariantSettingsService: ProductVariantSettingService
	) {}

	public async execute(
		command?: ProductVariantCreateCommand
	): Promise<ProductVariant[]> {
		const { productInput } = command;

		const arrVariants = [];

		for await (const productOption of productInput.options) {
			const newProductVariant = new ProductVariant();

			newProductVariant.internalReference =
				productOption.name + ' ' + productOption.code;

			newProductVariant.settings = await this.productVariantSettingsService.createDefaultVariantSettings();
			newProductVariant.price = await this.productVariantPriceService.createDefaultProductVariantPrice();
			newProductVariant.product = productInput;

			arrVariants.push(
				await this.productVariantService.createVariant(
					newProductVariant
				)
			);
		}

		return arrVariants;
	}
}
