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

	public async execute(command: ProductDeleteCommand): Promise<DeleteResult> {
		const { productId } = command;

		const product = await this.productService.findOneByOptions({
			where: { id: productId },
			relations: {
				variants: true,
				optionGroups: {
					options: {
						translations: true
					},
					translations: true
				}
			}
		});

		if (!product) {
			return { raw: [], affected: 0 };
		}

		const variants = product.variants ?? [];
		const optionGroups = product.optionGroups ?? [];

		// Collect related entities in single pass
		const settingsToDelete = variants.map((v) => v.setting).filter(Boolean);
		const pricesToDelete = variants.map((v) => v.price).filter(Boolean);

		// ---------- DELETE OPTION GROUPS ----------
		await Promise.all(
			optionGroups.map(async (group) => {
				// Delete option translations in parallel
				await Promise.all(
					(group.options ?? []).map((option) =>
						this.productOptionService.deleteOptionTranslationsBulk(option.translations ?? [])
					)
				);

				// Delete options
				await this.productOptionService.deleteMany((group.options ?? []).map((o) => o.id));

				// Delete group translations
				await this.productOptionsGroupService.deleteGroupTranslationsBulk(group.translations ?? []);
			})
		);

		// Delete groups
		await this.productOptionsGroupService.deleteMany(optionGroups.map((g) => g.id));

		// ---------- DELETE VARIANTS + RELATED ----------
		const deleteResults = await Promise.all([
			this.productVariantService.deleteManyVariants(variants),
			this.productVariantSettingsService.deleteManySettings(settingsToDelete),
			this.productVariantPricesService.deleteManyPrices(pricesToDelete),
			this.productService.delete(product.id)
		]);

		return {
			raw: deleteResults,
			affected: this.calculateAffected(deleteResults)
		};
	}

	private calculateAffected(results: any[]): number {
		return results.reduce((total, result) => {
			if (Array.isArray(result)) {
				return total + result.length;
			}
			return total + (result?.affected ?? 0);
		}, 0);
	}
}
