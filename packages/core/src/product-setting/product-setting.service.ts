import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { Repository } from 'typeorm';
import { ProductVariantSetting } from './product-setting.entity';

@Injectable()
export class ProductVariantSettingService extends TenantAwareCrudService<ProductVariantSetting> {
	constructor(
		@InjectRepository(ProductVariantSetting)
		private readonly productVariantSettingRepository: Repository<ProductVariantSetting>,
		@MikroInjectRepository(ProductVariantSetting)
		private readonly mikroProductVariantSettingRepository: EntityRepository<ProductVariantSetting>
	) {
		super(productVariantSettingRepository, mikroProductVariantSettingRepository);
	}

	async createDefaultVariantSettings(): Promise<ProductVariantSetting> {
		const newProductVariantSettings = new ProductVariantSetting();
		return this.productVariantSettingRepository.save(
			newProductVariantSettings
		);
	}

	async deleteMany(
		productVariantPrices: ProductVariantSetting[]
	): Promise<ProductVariantSetting[]> {
		return this.productVariantSettingRepository.remove(
			productVariantPrices
		);
	}
}
