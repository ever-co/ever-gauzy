import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantPrice } from './product-variant-price.entity';

@Injectable()
export class ProductVariantPriceService extends TenantAwareCrudService<ProductVariantPrice> {
	constructor(
		@InjectRepository(ProductVariantPrice)
		productVariantPriceRepository: Repository<ProductVariantPrice>,
		@MikroInjectRepository(ProductVariantPrice)
		mikroProductVariantPriceRepository: EntityRepository<ProductVariantPrice>
	) {
		super(productVariantPriceRepository, mikroProductVariantPriceRepository);
	}

	async createDefaultProductVariantPrice(): Promise<ProductVariantPrice> {
		const newProductVariantPrice = new ProductVariantPrice();
		return this.repository.save(newProductVariantPrice);
	}

	async deleteMany(productVariantPrices: ProductVariantPrice[]): Promise<ProductVariantPrice[]> {
		return this.repository.remove(productVariantPrices);
	}
}
