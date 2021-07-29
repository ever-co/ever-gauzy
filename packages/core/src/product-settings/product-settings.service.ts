import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { Repository } from 'typeorm';
import { ProductVariantSettings } from './product-settings.entity';

@Injectable()
export class ProductVariantSettingService extends TenantAwareCrudService<ProductVariantSettings> {
	constructor(
		@InjectRepository(ProductVariantSettings)
		private readonly productVariantSettingsRepository: Repository<ProductVariantSettings>
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
