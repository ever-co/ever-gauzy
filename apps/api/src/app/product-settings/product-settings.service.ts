import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantSettings } from './product-settings.entity';

@Injectable()
export class ProductVariantSettingService extends CrudService<
	ProductVariantSettings
> {
	constructor(
		@InjectRepository(ProductVariantSettings)
		private readonly productVariantSettingsRepository: Repository<
			ProductVariantSettings
		>
	) {
		super(productVariantSettingsRepository);
	}

	async createDefaultVariantSettings(): Promise<ProductVariantSettings> {
		const newProductVariantSettings = new ProductVariantSettings();
		return this.productVariantSettingsRepository.save(
			newProductVariantSettings
		);
	}

	async deleteMany(
		productVariantPrices: ProductVariantSettings[]
	): Promise<ProductVariantSettings[]> {
		return this.productVariantSettingsRepository.remove(
			productVariantPrices
		);
	}
}
