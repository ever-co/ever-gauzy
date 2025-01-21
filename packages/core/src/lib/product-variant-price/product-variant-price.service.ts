import { Injectable } from '@nestjs/common';
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
		return this.typeOrmRepository.save(newProductVariantPrice);
	}

	/**
	 *
	 * @param productVariantPrices
	 * @returns
	 */
	async deleteMany(productVariantPrices: ProductVariantPrice[]): Promise<ProductVariantPrice[]> {
		return this.typeOrmRepository.remove(productVariantPrices);
	}
}
