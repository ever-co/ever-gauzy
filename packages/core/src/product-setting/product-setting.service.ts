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
		productVariantSettingRepository: Repository<ProductVariantSetting>,
		@MikroInjectRepository(ProductVariantSetting)
		mikroProductVariantSettingRepository: EntityRepository<ProductVariantSetting>
	) {
		super(productVariantSettingRepository, mikroProductVariantSettingRepository);
	}

	async createDefaultVariantSettings(): Promise<ProductVariantSetting> {
		const newProductVariantSettings = new ProductVariantSetting();
		return this.repository.save(newProductVariantSettings);
	}

	async deleteMany(productVariantPrices: ProductVariantSetting[]): Promise<ProductVariantSetting[]> {
		return this.repository.remove(productVariantPrices);
	}
}
