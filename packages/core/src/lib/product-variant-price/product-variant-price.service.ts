import { Injectable } from '@nestjs/common';
import { In, DeleteResult } from 'typeorm';
import { MultiORMEnum } from './../core/utils';
import { TenantAwareCrudService } from './../core/crud';
import { ProductVariantPrice } from './product-variant-price.entity';
import { TypeOrmProductVariantPriceRepository } from './repository/type-orm-product-variant-price.repository';
import { MikroOrmProductVariantPriceRepository } from './repository/mikro-orm-product-variant-price.repository';

@Injectable()
export class ProductVariantPriceService extends TenantAwareCrudService<ProductVariantPrice> {
	constructor(
		typeOrmProductVariantPriceRepository: TypeOrmProductVariantPriceRepository,
		mikroOrmProductVariantPriceRepository: MikroOrmProductVariantPriceRepository
	) {
		super(typeOrmProductVariantPriceRepository, mikroOrmProductVariantPriceRepository);
	}

	/**
	 * Create default product variant price
	 *
	 * @returns
	 */
	async createDefaultProductVariantPrice(): Promise<ProductVariantPrice> {
		const newProductVariantPrice = new ProductVariantPrice();
		return this.save(newProductVariantPrice);
	}

	/**
	 * Delete many product variant prices
	 *
	 * @param productVariantPrices
	 * @returns
	 */
	async deleteMany(productVariantPrices: ProductVariantPrice[]): Promise<DeleteResult | []> {
		const ids = productVariantPrices.map((p) => p.id).filter((id): id is string => !!id);
		if (ids.length > 0) {
			if (this.ormType === MultiORMEnum.MikroORM) {
				return await this.delete({ id: { $in: ids } } as any);
			} else {
				return await this.delete({ id: In(ids) });
			}
		}
		return [];
	}
}
