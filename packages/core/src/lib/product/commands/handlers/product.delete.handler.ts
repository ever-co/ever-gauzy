import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { ProductDeleteCommand } from '../product.delete.command';
import { ProductService } from '../../product.service';
import { ProductVariantService } from '../../../product-variant/product-variant.service';
import { ProductVariantSettingService } from '../../../product-setting/product-setting.service';
import { ProductVariantPriceService } from '../../../product-variant-price/product-variant-price.service';
import { ProductOptionService } from '../../../product-option/product-option.service';
import { ProductOptionGroupService } from '../../../product-option/product-option-group.service';

@CommandHandler(ProductDeleteCommand)
export class ProductDeleteHandler implements ICommandHandler<ProductDeleteCommand> {
	constructor(
		private productService: ProductService,
		private productOptionService: ProductOptionService,
		private productOptionsGroupService: ProductOptionGroupService,
		private productVariantService: ProductVariantService,
		private productVariantSettingsService: ProductVariantSettingService,
		private productVariantPricesService: ProductVariantPriceService
	) {}

	public async execute(command?: ProductDeleteCommand): Promise<DeleteResult> {
		const { productId } = command;

		const product = await this.productService.findOneByOptions({
			where: { id: productId },
			relations: ['variants', 'optionGroups']
		});

		const settingsToDelete = [];
		const pricesToDelete = [];

		product.variants.forEach((variant) => {
			settingsToDelete.push(variant.setting);
		});
		product.variants.forEach((variant) => {
			pricesToDelete.push(variant.price);
		});

		const optionGroups = product.optionGroups;

		for await (const optionGroup of optionGroups) {
			optionGroup.options.forEach(async (option) => {
				await this.productOptionService.deleteOptionTranslationsBulk(option.translations);
			});

			await this.productOptionService.deleteBulk(optionGroup.options);
		}

		for await (const group of optionGroups) {
			await this.productOptionsGroupService.deleteGroupTranslationsBulk(group.translations);
		}

		await this.productOptionsGroupService.deleteBulk(optionGroups);

		const deleteRes = [
			await this.productVariantService.deleteMany(product.variants),
			await this.productVariantSettingsService.deleteMany(settingsToDelete),
			await this.productVariantPricesService.deleteMany(pricesToDelete),
			await this.productService.delete(product.id)
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
				.reduce((acc, value) => acc + value)
		};
	}
}
