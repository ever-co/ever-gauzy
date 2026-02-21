import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
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
		return this.save(newProductVariantSettings);
	}

	/**
	 *
	 * @param productVariantPrices
	 * @returns
	 */
	async deleteMany(productVariantPrices: ProductVariantSetting[]): Promise<void> {
		const ids = productVariantPrices.filter((s) => s.id).map((s) => s.id);
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as any);
		}
	}
}
