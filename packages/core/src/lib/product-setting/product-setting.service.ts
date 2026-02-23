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
	 * Create default variant settings
	 *
	 * @returns - ProductVariantSetting
	 */
	async createDefaultVariantSettings(): Promise<ProductVariantSetting> {
		const newProductVariantSettings = new ProductVariantSetting();
		return this.save(newProductVariantSettings);
	}

	/**
	 * Delete many product variant settings
	 *
	 * @param productVariantSettings
	 * @returns
	 */
	async deleteManySettings(productVariantSettings: ProductVariantSetting[]): Promise<ProductVariantSetting[]> {
		const ids = productVariantSettings.map((s) => s.id).filter((id): id is string => !!id);
		if (ids.length > 0) {
			await super.deleteMany(ids);
		}
		return productVariantSettings;
	}
}
