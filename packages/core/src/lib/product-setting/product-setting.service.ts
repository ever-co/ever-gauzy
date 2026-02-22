import { Injectable } from '@nestjs/common';
import { In, FindOptionsWhere } from 'typeorm';
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
	 *
	 * @param productVariantSettings
	 * @returns
	 */
	async deleteMany(productVariantSettings: ProductVariantSetting[]): Promise<ProductVariantSetting[]> {
		const ids = productVariantSettings.filter((s) => s.id).map((s) => s.id);
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as FindOptionsWhere<ProductVariantSetting>);
		}
		return productVariantSettings;
	}
}
