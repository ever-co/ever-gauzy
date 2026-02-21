import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
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
	 *
	 * @returns
	 */
	async createDefaultProductVariantPrice(): Promise<ProductVariantPrice> {
		const newProductVariantPrice = new ProductVariantPrice();
		return this.save(newProductVariantPrice);
	}

	/**
	 *
	 * @param productVariantPrices
	 * @returns
	 */
	async deleteMany(productVariantPrices: ProductVariantPrice[]): Promise<void> {
		const ids = productVariantPrices.filter((p) => p.id).map((p) => p.id);
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as any);
		}
	}
}
