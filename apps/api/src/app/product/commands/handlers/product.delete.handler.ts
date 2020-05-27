import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductDeleteCommand } from '../product.delete.command';
import { ProductService } from '../../product.service';
import { ProductVariantService } from '../../../product-variant/product-variant.service';
import { DeleteResult } from 'typeorm';
import { ProductVariantSettingService } from '../../../product-settings/product-settings.service';
import { ProductVariantPriceService } from '../../../product-variant-price/product-variant-price.service';

@CommandHandler(ProductDeleteCommand)
export class ProductDeleteHandler
	implements ICommandHandler<ProductDeleteCommand> {
	constructor(
		private productService: ProductService,
		private productVariantService: ProductVariantService,
		private productVariantSettingsService: ProductVariantSettingService,
		private productVariantPricesService: ProductVariantPriceService
	) {}

	public async execute(
		command?: ProductDeleteCommand
	): Promise<DeleteResult> {
		const { productId } = command;

		const product = await this.productService.findOne({
			where: { id: productId },
			relations: ['variants'],
		});

		const settingsToDelete = [];
		const pricesToDelete = [];

		product.variants.forEach((variant) => {
			settingsToDelete.push(variant.settings);
		});
		product.variants.forEach((variant) => {
			pricesToDelete.push(variant.price);
		});

		const deleteRes = [
			await this.productVariantService.deleteMany(product.variants),
			await this.productVariantSettingsService.deleteMany(
				settingsToDelete
			),
			await this.productVariantPricesService.deleteMany(pricesToDelete),
			await this.productService.delete(product.id),
		];

		return {
			raw: deleteRes,
			affected: deleteRes
				.map((res) => {
					if (Array.isArray(res)) {
						return res.length;
					} else {
						return res.affected ? res.affected : 0;
					}
				})
				.reduce((acc, value) => acc + value),
		};
	}
}
