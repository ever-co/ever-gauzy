import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud';
import { ProductVariantSetting } from './product-setting.entity';
import { TypeOrmProductVariantSettingRepository } from './repository/type-orm-product-setting.repository';
import { MikroOrmProductVariantSettingRepository } from './repository/mikro-orm-product-setting.repository';

@Injectable()
export class ProductVariantSettingService extends TenantAwareCrudService<ProductVariantSetting> {
	constructor(
		typeOrmProductVariantSettingRepository: TypeOrmProductVariantSettingRepository,
		mikroOrmProductVariantSettingRepository: MikroOrmProductVariantSettingRepository
	) {
		super(typeOrmProductVariantSettingRepository, mikroOrmProductVariantSettingRepository);
	}

	/**
	 *
	 * @returns
	 */
	async createDefaultVariantSettings(): Promise<ProductVariantSetting> {
		const newProductVariantSettings = new ProductVariantSetting();
		return this.typeOrmRepository.save(newProductVariantSettings);
	}

	/**
	 *
	 * @param productVariantPrices
	 * @returns
	 */
	async deleteMany(productVariantPrices: ProductVariantSetting[]): Promise<ProductVariantSetting[]> {
		return this.typeOrmRepository.remove(productVariantPrices);
	}
}
