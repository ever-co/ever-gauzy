import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProductVariantDeleteCommand } from '../product-variant.delete.command';
import { ProductVariantService } from '../../product-variant.service';
import { ProductVariantSettingService } from '../../../product-settings/product-settings.service';
import { ProductVariantPriceService } from '../../../product-variant-price/product-variant-price.service';
import { DeleteResult } from 'typeorm/query-builder/result/DeleteResult';

@CommandHandler(ProductVariantDeleteCommand)
export class ProductVariantDeleteHandler
	implements ICommandHandler<ProductVariantDeleteCommand> {
	constructor(
		private productVariantService: ProductVariantService,
		private productVariantSettingsService: ProductVariantSettingService,
		private productVariantPricesService: ProductVariantPriceService
	) {}

	public async execute(
		command?: ProductVariantDeleteCommand
	): Promise<DeleteResult> {
		const { productVariantId } = command;

		const productVariant = await this.productVariantService.findOne({
			where: { id: productVariantId }
		});

		const deleteRes = [
			await this.productVariantService.delete(productVariant.id),
			await this.productVariantPricesService.delete(
				productVariant.price.id
			),
			await this.productVariantSettingsService.delete(
				productVariant.settings.id
			)
		];

		return {
			raw: deleteRes.map((res) => res.affected),
			affected: deleteRes
				.map((res) => (res.affected ? res.affected : 0))
				.reduce((acc, value) => acc + value)
		};
	}
}
